from fastapi import APIRouter, HTTPException, Query, Request
from app.config.database import organizations, isp_packages, hotspot_vouchers
from bson.objectid import ObjectId
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import secrets
import string
import requests
import base64
from app.config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/packages")
async def get_hotspot_packages(
    organization_id: str = Query(..., description="Organization ID")
):
    """
    Get available hotspot packages for an organization
    
    This endpoint returns all active packages that can be displayed
    in a hotspot captive portal for a specific organization.
    """
    try:
        # Verify organization exists
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get packages for this organization
        cursor = isp_packages.find({
            "organizationId": ObjectId(organization_id),
            "showInHotspot": True
        })
        
        # Convert to list and format for frontend
        packages = []
        async for package in cursor:
            packages.append({
                "id": str(package["_id"]),
                "name": package.get("name", ""),
                "description": package.get("description", ""),
                "price": package.get("price", 0),
                "duration": package.get("duration", 0),
                "durationUnit": package.get("durationUnit", "days"),
                "dataLimit": package.get("dataLimit", 0),
                "dataLimitUnit": package.get("dataLimitUnit", "MB"),
                "downloadSpeed": package.get("downloadSpeed", 0),
                "uploadSpeed": package.get("uploadSpeed", 0),
                "serviceType": package.get("serviceType", "HOTSPOT")
            })
        
        return {"packages": packages}
    
    except Exception as e:
        logger.error(f"Error fetching hotspot packages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch packages: {str(e)}")

@router.post("/purchase-voucher")
async def purchase_voucher_with_mpesa(request: Request):
    """
    Purchase a hotspot voucher using Mpesa STK Push
    
    This endpoint initiates an STK push request and creates a pending voucher
    that will be activated once payment is confirmed.
    """
    try:
        data = await request.json()
        
        # Validate required fields
        required_fields = ["organizationId", "packageId", "phoneNumber"]
        for field in required_fields:
            if field not in data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        organization_id = data["organizationId"]
        package_id = data["packageId"]
        phone_number = data["phoneNumber"]
        
        # Validate organization and package
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if Mpesa is enabled for the organization
        mpesa_config = organization.get("mpesaConfig", {})
        if not mpesa_config.get("isActive"):
            raise HTTPException(status_code=400, detail="Mpesa integration not enabled for this organization")
        
        package = await isp_packages.find_one({
            "_id": ObjectId(package_id),
            "organizationId": ObjectId(organization_id),
            "showInHotspot": True
        })
        if not package:
            raise HTTPException(status_code=404, detail="Package not found or not available for hotspot")
        
        # Format phone number (ensure it starts with 254)
        if phone_number.startswith("0"):
            phone_number = "254" + phone_number[1:]
        elif phone_number.startswith("+"):
            phone_number = phone_number[1:]
        elif not phone_number.startswith("254"):
            phone_number = "254" + phone_number
        
        # Generate a unique voucher code
        voucher_code = generate_voucher_code()
        
        # Create a pending voucher
        now = datetime.now(timezone.utc)
        expiry_date = calculate_expiry_date(now, package)
        
        voucher_data = {
            "code": voucher_code,
            "packageId": ObjectId(package_id),
            "organizationId": ObjectId(organization_id),
            "paymentMethod": "mpesa",
            "paymentReference": None,  # Will be updated after payment
            "status": "pending",  # Will be updated to active after payment
            "createdAt": now,
            "expiresAt": expiry_date,
            "dataLimit": package.get("dataLimit"),
            "dataLimitUnit": package.get("dataLimitUnit", "MB"),
            "duration": package.get("duration"),
            "durationUnit": package.get("durationUnit", "days"),
            "phoneNumber": phone_number
        }
        
        # Insert the pending voucher
        voucher_result = await hotspot_vouchers.insert_one(voucher_data)
        voucher_id = str(voucher_result.inserted_id)
        
        # Get Mpesa configuration
        shortcode = mpesa_config.get("stkPushShortCode") or mpesa_config.get("shortCode")
        passkey = mpesa_config.get("stkPushPassKey") or mpesa_config.get("passKey")
        consumer_key = mpesa_config.get("consumerKey")
        consumer_secret = mpesa_config.get("consumerSecret")
        environment = mpesa_config.get("environment", "sandbox")
        
        if not all([shortcode, passkey, consumer_key, consumer_secret]):
            # Clean up the voucher if we can't proceed
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            raise HTTPException(status_code=400, detail="Missing required Mpesa configuration")
        
        # Define Mpesa API URLs
        MPESA_URLS = {
            "sandbox": {
                "auth": "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                "stk_push": "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
            },
            "production": {
                "auth": "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                "stk_push": "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
            }
        }
        
        # Get access token
        auth_response = requests.get(
            MPESA_URLS[environment]["auth"],
            auth=(consumer_key, consumer_secret)
        )
        
        if auth_response.status_code != 200:
            # Clean up the voucher if we can't proceed
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        access_token = auth_response.json().get("access_token")
        
        # Generate timestamp and password
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((shortcode + passkey + timestamp).encode()).decode()
        
        # Generate callback URL
        api_url = settings.API_URL
        if not api_url.startswith(('http://', 'https://')):
            api_url = f"https://{api_url}"
        
        callback_url = mpesa_config.get("c2bCallbackUrl") or f"{api_url}/api/mpesa/callback/{organization_id}/stk_push"
        
        # Prepare STK Push payload
        stk_payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": mpesa_config.get("transactionType", "CustomerPayBillOnline"),
            "Amount": int(float(package["price"])),
            "PartyA": phone_number,
            "PartyB": shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": voucher_code,
            "TransactionDesc": f"Hotspot Voucher: {package['name']}"
        }
        
        # Make STK Push request
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        stk_response = requests.post(
            MPESA_URLS[environment]["stk_push"],
            json=stk_payload,
            headers=headers
        )
        
        if stk_response.status_code != 200:
            # Clean up the voucher if STK push fails
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            raise HTTPException(status_code=500, detail=f"Failed to initiate STK push: {stk_response.text}")
        
        stk_result = stk_response.json()
        
        # Store transaction information
        from app.config.database import isp_mpesa_transactions
        await isp_mpesa_transactions.insert_one({
            "organizationId": ObjectId(organization_id),
            "phoneNumber": phone_number,
            "amount": float(package["price"]),
            "accountReference": voucher_code,
            "merchantRequestId": stk_result.get("MerchantRequestID"),
            "checkoutRequestId": stk_result.get("CheckoutRequestID"),
            "status": "pending",
            "createdAt": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "message": "Payment initiated. Please check your phone to complete the transaction.",
            "voucherId": voucher_id,
            "voucherCode": voucher_code,
            "merchantRequestId": stk_result.get("MerchantRequestID"),
            "checkoutRequestId": stk_result.get("CheckoutRequestID")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purchasing voucher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing voucher purchase: {str(e)}")

def generate_voucher_code(length=8):
    """Generate a random voucher code"""
    characters = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

def calculate_expiry_date(start_date, package):
    """Calculate expiry date based on package duration"""
    duration = package.get("duration")
    duration_unit = package.get("durationUnit", "days")
    
    if not duration:
        # Default to 1 day if no duration specified
        return start_date + timedelta(days=1)
    
    if duration_unit == "hours":
        return start_date + timedelta(hours=duration)
    elif duration_unit == "days":
        return start_date + timedelta(days=duration)
    elif duration_unit == "weeks":
        return start_date + timedelta(weeks=duration)
    elif duration_unit == "months":
        # Approximate months as 30 days
        return start_date + timedelta(days=30 * duration)
    else:
        return start_date + timedelta(days=duration)


