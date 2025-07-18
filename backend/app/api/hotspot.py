from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from app.config.database import organizations, isp_packages, hotspot_vouchers
from bson.objectid import ObjectId
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import secrets
import string
import requests
import base64
from app.config.settings import settings
from fastapi.middleware.cors import CORSMiddleware
import json
from app.api.mpesa import MpesaService
from app.services.sms.template import SmsTemplateService
from app.services.sms.utils import send_sms_for_organization
from app.schemas.sms_template import TemplateCategory
from app.config.database import isp_mpesa_transactions
from app.schemas.isp_transactions import TransactionType, TransactionStatus

logger = logging.getLogger(__name__)
router = APIRouter()

# Constants
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

SANDBOX_CREDENTIALS = {
    "shortcode": "174379",
    "passkey": "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
}

async def get_mpesa_access_token(consumer_key: str, consumer_secret: str, environment: str) -> str:
    """Get Mpesa access token using consumer key and secret"""
    try:
        auth_url = MPESA_URLS[environment]["auth"]
        auth_string = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
        
        headers = {
            "Authorization": f"Basic {auth_string}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Mpesa Auth Request - URL: {auth_url}")
        response = requests.get(auth_url, headers=headers)
        
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            error_msg = f"Failed to get Mpesa access token: {response.text}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        error_msg = f"Error getting Mpesa access token: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

def format_phone_number(phone: str) -> str:
    """Format phone number to Safaricom format (254XXXXXXXXX)"""
    if phone.startswith("0"):
        return "254" + phone[1:]
    elif phone.startswith("+"):
        return phone[1:]
    elif not phone.startswith("254"):
        return "254" + phone
    return phone

def generate_voucher_code(length: int = 8) -> str:
    """Generate a random voucher code"""
    characters = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

def calculate_expiry_date(start_date: datetime, package: Dict[str, Any]) -> datetime:
    """Calculate expiry date based on package duration"""
    duration = package.get("duration")
    duration_unit = package.get("durationUnit", "days")
    
    if not duration:
        return start_date + timedelta(days=1)
    
    duration_map = {
        "hours": lambda d: timedelta(hours=d),
        "days": lambda d: timedelta(days=d),
        "weeks": lambda d: timedelta(weeks=d),
        "months": lambda d: timedelta(days=30 * d)
    }
    
    return start_date + duration_map.get(duration_unit, lambda d: timedelta(days=d))(duration)

@router.get("/packages")
async def get_hotspot_packages(organization_id: str = Query(..., description="Organization ID")):
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
        
        return JSONResponse(
            content={"packages": packages},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Accept, Content-Type, Cache-Control",
                "Access-Control-Expose-Headers": "Content-Length, Content-Range",
                "Access-Control-Max-Age": "1728000"
            }
        )
    
    except Exception as e:
        logger.error(f"Error fetching hotspot packages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch packages: {str(e)}")

@router.options("/packages")
async def options_packages():
    """Handle OPTIONS request for packages endpoint"""
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Accept, Content-Type, Cache-Control",
            "Access-Control-Max-Age": "1728000",
            "Content-Type": "text/plain charset=UTF-8",
            "Content-Length": "0"
        }
    )

@router.options("/purchase-voucher")
async def options_purchase_voucher():
    """Handle OPTIONS request for purchase-voucher endpoint"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "1728000",
            "Content-Type": "text/plain charset=UTF-8",
            "Content-Length": "0"
        }
    )

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
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required fields: {', '.join(missing_fields)}"},
                headers={"Access-Control-Allow-Origin": "*"}
            )
        
        organization_id = data["organizationId"]
        package_id = data["packageId"]
        phone_number = format_phone_number(data["phoneNumber"])
        
        # Validate organization and package
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            return JSONResponse(
                status_code=404,
                content={"detail": "Organization not found"},
                headers={"Access-Control-Allow-Origin": "*"}
            )
        
        # Check if Mpesa is enabled for the organization
        mpesa_config = organization.get("mpesaConfig", {})
        if not mpesa_config.get("isActive"):
            return JSONResponse(
                status_code=400,
                content={"detail": "Mpesa integration not enabled for this organization"},
                headers={"Access-Control-Allow-Origin": "*"}
            )
        
        package = await isp_packages.find_one({
            "_id": ObjectId(package_id),
            "organizationId": ObjectId(organization_id),
            "showInHotspot": True
        })
        if not package:
            raise HTTPException(status_code=404, detail="Package not found or not available for hotspot")
        
        # Generate voucher
        voucher_code = generate_voucher_code()
        now = datetime.now(timezone.utc)
        expiry_date = calculate_expiry_date(now, package)
        
        voucher_data = {
            "code": voucher_code,
            "packageId": ObjectId(package_id),
            "organizationId": ObjectId(organization_id),
            "paymentMethod": "mpesa",
            "paymentReference": None,
            "status": "pending",
            "createdAt": now,
            "expiresAt": expiry_date,
            "dataLimit": package.get("dataLimit"),
            "dataLimitUnit": package.get("dataLimitUnit", "MB"),
            "duration": package.get("duration"),
            "durationUnit": package.get("durationUnit", "days"),
            "phoneNumber": phone_number
        }
        
        voucher_result = await hotspot_vouchers.insert_one(voucher_data)
        voucher_id = str(voucher_result.inserted_id)
        
        # Get Mpesa configuration
        environment = mpesa_config.get("environment", "sandbox")
        shortcode = mpesa_config.get("stkPushShortCode") or mpesa_config.get("shortCode")
        passkey = mpesa_config.get("stkPushPassKey") or mpesa_config.get("passKey")
        consumer_key = mpesa_config.get("consumerKey")
        consumer_secret = mpesa_config.get("consumerSecret")
        
        # Validate sandbox credentials
        if environment == "sandbox":
            if shortcode != SANDBOX_CREDENTIALS["shortcode"]:
                logger.warning(f"Invalid sandbox shortcode: {shortcode}, using default: {SANDBOX_CREDENTIALS['shortcode']}")
                shortcode = SANDBOX_CREDENTIALS["shortcode"]
            if passkey != SANDBOX_CREDENTIALS["passkey"]:
                logger.warning("Invalid sandbox passkey, using default")
                passkey = SANDBOX_CREDENTIALS["passkey"]
        
        if not all([shortcode, passkey, consumer_key, consumer_secret]):
            # Clean up the voucher if we can't proceed
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            raise HTTPException(status_code=400, detail="Missing required Mpesa configuration")
        
        # Get access token
        access_token = await get_mpesa_access_token(consumer_key, consumer_secret, environment)
        
        # Generate timestamp and password
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((shortcode + passkey + timestamp).encode()).decode()
        
        # Generate callback URL using the utility function
        callback_url = mpesa_config.get("stkPushCallbackUrl") or MpesaService.generate_callback_url(organization_id, "stk_push")
        
        # Prepare STK Push payload according to Safaricom docs
        stk_payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",  # Fixed value as per docs
            "Amount": int(float(package["price"])),
            "PartyA": phone_number,
            "PartyB": shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": voucher_code,
            "TransactionDesc": f"Hotspot Voucher: {package['name']}"
        }
        
        # Make STK Push request with proper headers
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Log the request for debugging
        logger.info(f"=== STK PUSH INITIATION ===")
        logger.info(f"Organization ID: {organization_id}")
        logger.info(f"Package ID: {package_id}")
        logger.info(f"Phone Number: {phone_number}")
        logger.info(f"Amount: {package['price']}")
        logger.info(f"Voucher Code: {voucher_code}")
        logger.info(f"Callback URL: {callback_url}")
        logger.info(f"Environment: {environment}")
        logger.info(f"Request URL: {MPESA_URLS[environment]['stk_push']}")
        logger.info(f"Request Headers: {json.dumps(headers, indent=2)}")
        logger.info(f"Request Payload: {json.dumps(stk_payload, indent=2)}")
        
        stk_response = requests.post(
            MPESA_URLS[environment]["stk_push"],
            json=stk_payload,
            headers=headers
        )
        
        # Log the response for debugging
        logger.info(f"=== STK PUSH RESPONSE ===")
        logger.info(f"Status Code: {stk_response.status_code}")
        try:
            response_json = stk_response.json()
            logger.info(f"Response Body: {json.dumps(response_json, indent=2)}")
        except:
            logger.error(f"Failed to parse response as JSON: {stk_response.text}")
        
        if stk_response.status_code != 200:
            # Clean up the voucher if STK push fails
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            error_msg = stk_response.text
            try:
                error_data = stk_response.json()
                error_msg = error_data.get("errorMessage", error_msg)
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Failed to initiate STK push: {error_msg}")
        
        stk_result = stk_response.json()
        
        # Store transaction information with proper deduplication
        merchant_request_id = stk_result.get("MerchantRequestID")
        checkout_request_id = stk_result.get("CheckoutRequestID")

        if not merchant_request_id or not checkout_request_id:
            # Clean up the voucher if we can't track the transaction
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            raise HTTPException(status_code=500, detail="Invalid STK Push response - missing identifiers")

        # Check if transaction already exists (idempotency check)
        # Only check for PENDING transactions to avoid blocking legitimate new purchases
        existing_transaction = await isp_mpesa_transactions.find_one({
            "organizationId": ObjectId(organization_id),
            "merchantRequestId": merchant_request_id,
            "checkoutRequestId": checkout_request_id,
            "status": TransactionStatus.PENDING.value  # Only check pending transactions
        })

        if existing_transaction:
            # Clean up the duplicate voucher since we have a pending transaction
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            logger.info(f"Found pending STK Push transaction: {merchant_request_id}")

            # Find the existing voucher for this transaction
            existing_voucher = await hotspot_vouchers.find_one({
                "organizationId": ObjectId(organization_id),
                "code": existing_transaction.get("accountReference"),
                "status": "pending"
            })

            if existing_voucher:
                return {
                    "success": True,
                    "message": "Payment already initiated. Please check your phone to complete the transaction.",
                    "voucherId": str(existing_voucher["_id"]),
                    "voucherCode": existing_voucher["code"],
                    "merchantRequestId": merchant_request_id,
                    "checkoutRequestId": checkout_request_id,
                    "existingTransaction": True
                }
            else:
                # If no existing voucher found, clean up and allow new transaction
                logger.warning(f"Pending transaction found but no voucher exists, cleaning up transaction: {merchant_request_id}")
                await isp_mpesa_transactions.delete_one({"_id": existing_transaction["_id"]})

        # Additional check for recent duplicate requests (same phone, amount, organization)
        # This prevents rapid-fire duplicate requests but allows legitimate new purchases
        recent_cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)  # Reduced from 5 to 2 minutes
        recent_transaction = await isp_mpesa_transactions.find_one({
            "organizationId": ObjectId(organization_id),
            "phoneNumber": phone_number,
            "amount": float(package["price"]),
            "status": TransactionStatus.PENDING.value,
            "createdAt": {"$gte": recent_cutoff}
        })

        if recent_transaction:
            # Clean up the duplicate voucher
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            logger.info(f"Found recent pending transaction for same parameters")

            # Find the existing voucher for this transaction
            existing_voucher = await hotspot_vouchers.find_one({
                "organizationId": ObjectId(organization_id),
                "code": recent_transaction.get("accountReference"),
                "status": "pending"
            })

            if existing_voucher:
                return {
                    "success": True,
                    "message": "Recent transaction already pending. Please check your phone to complete the transaction.",
                    "voucherId": str(existing_voucher["_id"]),
                    "voucherCode": existing_voucher["code"],
                    "merchantRequestId": recent_transaction.get("merchantRequestId"),
                    "checkoutRequestId": recent_transaction.get("checkoutRequestId"),
                    "existingTransaction": True
                }

        transaction_data = {
            "organizationId": ObjectId(organization_id),
            "transactionType": TransactionType.STK_PUSH.value,
            "callbackType": "stk_push",
            "status": TransactionStatus.PENDING.value,
            "phoneNumber": phone_number,
            "amount": float(package["price"]),
            "accountReference": voucher_code,
            "merchantRequestId": merchant_request_id,
            "checkoutRequestId": checkout_request_id,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "callbackUrl": callback_url,
            "paymentMethod": "mpesa",
            "initiatedAt": datetime.now(timezone.utc)
        }

        await isp_mpesa_transactions.insert_one(transaction_data)
        
        logger.info(f"=== STK PUSH TRANSACTION STORED ===")
        logger.info(f"Transaction Data: {json.dumps(transaction_data, default=str, indent=2)}")
        
        return {
            "success": True,
            "message": "Payment initiated. Please check your phone to complete the transaction.",
            "voucherId": voucher_id,
            "voucherCode": voucher_code,
            "merchantRequestId": stk_result.get("MerchantRequestID"),
            "checkoutRequestId": stk_result.get("CheckoutRequestID")
        }
    except HTTPException as he:
        # Re-raise HTTP exceptions to maintain proper status codes
        raise he
    except Exception as e:
        logger.error(f"Error purchasing voucher: {str(e)}")
        logger.exception("Full traceback:")
        # Always return a proper JSON response with 500 status
        raise HTTPException(status_code=500, detail=f"Error processing voucher purchase: {str(e)}")

async def process_hotspot_voucher_payment(organization_id: str, voucher_code: str, amount: float, transaction_id: str = None) -> bool:
    """Process a payment for a hotspot voucher"""
    try:
        logger.info(f"=== PROCESSING HOTSPOT VOUCHER PAYMENT ===")
        logger.info(f"Organization ID: {organization_id}")
        logger.info(f"Voucher Code: {voucher_code}")
        logger.info(f"Amount: {amount}")
        logger.info(f"Transaction ID: {transaction_id}")

        voucher = await hotspot_vouchers.find_one({
            "organizationId": ObjectId(organization_id),
            "code": voucher_code,
            "status": "pending"
        })
        
        if not voucher:
            logger.error(f"Pending voucher with code {voucher_code} not found in organization {organization_id}")
            return False

        # Get organization details
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            logger.error(f"Organization {organization_id} not found")
            return False

        # Get package details
        package = await isp_packages.find_one({"_id": voucher["packageId"]})
        if not package:
            logger.error(f"Package not found for voucher {voucher_code}")
            return False

        now = datetime.now(timezone.utc)
        
        # Update voucher status
        update_result = await hotspot_vouchers.update_one(
            {"_id": voucher["_id"]},
            {
                "$set": {
                    "status": "active",
                    "paymentReference": transaction_id,
                    "activatedAt": now,
                    "updatedAt": now
                }
            }
        )
        
        if update_result.modified_count > 0:
            logger.info(f"Activated voucher {voucher_code} after payment confirmation")

            # Update the existing STK Push transaction instead of creating a new one
            # Find the STK Push transaction that initiated this voucher purchase
            stk_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "accountReference": voucher_code,
                "transactionType": TransactionType.STK_PUSH.value,
                "status": TransactionStatus.COMPLETED.value
            })

            if stk_transaction:
                # Update the existing transaction with voucher details
                voucher_update_data = {
                    "updatedAt": now,
                    "voucherCode": voucher_code,
                    "packageId": str(voucher["packageId"]),
                    "packageName": package.get("name", ""),
                    "duration": package.get("duration", 0),
                    "dataLimit": package.get("dataLimit", 0),
                    "expiresAt": voucher.get("expiresAt"),
                    "voucherActivatedAt": now,
                    "callbackType": "hotspot_voucher"  # Update callback type to reflect final state
                }

                await isp_mpesa_transactions.update_one(
                    {"_id": stk_transaction["_id"]},
                    {"$set": voucher_update_data}
                )
                logger.info(f"Updated STK Push transaction with voucher details for {voucher_code}")
            else:
                logger.warning(f"No matching STK Push transaction found for voucher {voucher_code}")
                # Only create a new transaction if we can't find the original STK Push transaction
                transaction_data = {
                    "organizationId": ObjectId(organization_id),
                    "transactionType": TransactionType.HOTSPOT_VOUCHER.value,
                    "callbackType": "hotspot_voucher",
                    "status": TransactionStatus.COMPLETED.value,
                    "amount": amount,
                    "phoneNumber": voucher.get("phoneNumber"),
                    "paymentMethod": "mpesa",
                    "transactionId": transaction_id,
                    "createdAt": now,
                    "updatedAt": now,
                    "voucherCode": voucher_code,
                    "packageId": str(voucher["packageId"]),
                    "packageName": package.get("name", ""),
                    "duration": package.get("duration", 0),
                    "dataLimit": package.get("dataLimit", 0),
                    "expiresAt": voucher.get("expiresAt")
                }

                await isp_mpesa_transactions.insert_one(transaction_data)
                logger.info(f"Created fallback transaction record for voucher {voucher_code}")
            
            # Send SMS notification
            try:
                template_result = await SmsTemplateService.list_templates(
                    organization_id=organization_id,
                    category=TemplateCategory.HOTSPOT_VOUCHER,
                    is_active=True
                )
                
                template_doc = None
                if template_result.get("success") and template_result.get("templates"):
                    template_doc = template_result["templates"][0]
                    logger.info(f"Found hotspot voucher template: {json.dumps(template_doc, default=str)}")
                else:
                    logger.error("No active hotspot voucher template found")
                    
                if template_doc:
                    # Format expiry date
                    expiry_date = voucher.get("expiresAt")
                    if expiry_date:
                        if not expiry_date.tzinfo:
                            expiry_date = expiry_date.replace(tzinfo=timezone.utc)
                        expiry_str = expiry_date.strftime("%Y-%m-%d %H:%M")
                    else:
                        expiry_str = "N/A"
                        
                    # Prepare SMS variables
                    sms_vars = SmsTemplateService.build_sms_vars([
                        voucher,
                        org or {},
                        package or {},
                        {"firstName": "Customer", "voucherCode": voucher_code, "expirationDate": expiry_str, "amountPaid": amount, "dataLimit": package.get("dataLimit", "Unlimited") if package else "Unlimited", "duration": f"{package.get('duration', 0)} days" if package else ""}
                    ])
                    logger.info(f"SMS Variables: {json.dumps(sms_vars, default=str)}")
                    
                    # Render and send SMS
                    message = SmsTemplateService.render_template(template_doc["content"], sms_vars)
                    logger.info(f"Rendered Message: {message}")
                    
                    phone_number = voucher.get("phoneNumber")
                    if not phone_number:
                        logger.error("Voucher phone number is missing")
                    else:
                        sms_result = await send_sms_for_organization(
                            organization_id=organization_id,
                            to=phone_number,
                            message=message
                        )
                        logger.info(f"SMS Send Result: {json.dumps(sms_result, default=str)}")
                else:
                    logger.error("Template document is missing")
            except Exception as sms_exc:
                logger.error(f"Failed to send hotspot voucher SMS: {str(sms_exc)}")
                logger.exception("Full traceback:")
                
            return True
        else:
            logger.error(f"Failed to update voucher {voucher_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error processing hotspot voucher payment: {str(e)}")
        logger.exception("Full traceback:")
        return False

@router.get("/voucher-status/{voucher_id}")
async def get_voucher_status(voucher_id: str):
    """Get the current status of a voucher"""
    try:
        voucher = await hotspot_vouchers.find_one({"_id": ObjectId(voucher_id)})
        if not voucher:
            raise HTTPException(status_code=404, detail="Voucher not found")
            
        return {
            "status": voucher.get("status", "pending"),
            "code": voucher.get("code"),
            "expiresAt": voucher.get("expiresAt")
        }
    except Exception as e:
        logger.error(f"Error getting voucher status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/connect")
async def connect_with_voucher(request: Request):
    """Attempt to automatically connect a user with their voucher"""
    try:
        data = await request.json()
        voucher_code = data.get("voucherCode")
        
        if not voucher_code:
            raise HTTPException(status_code=400, detail="Voucher code is required")
            
        # Find the voucher
        voucher = await hotspot_vouchers.find_one({
            "code": voucher_code,
            "status": "active"
        })
        
        if not voucher:
            raise HTTPException(status_code=404, detail="Invalid or inactive voucher")
            
        # Check if voucher is expired
        now = datetime.now(timezone.utc)
        expires_at = voucher.get("expiresAt")
        if expires_at:
            # Ensure expires_at is timezone-aware
            if not expires_at.tzinfo:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < now:
                raise HTTPException(status_code=400, detail="Voucher has expired")
            
        # Get organization details
        org = await organizations.find_one({"_id": voucher["organizationId"]})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
            
        # Get package details
        package = await isp_packages.find_one({"_id": voucher["packageId"]})
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
            
        # Here you would implement the actual connection logic
        # This could involve calling your MikroTik API or other network management system
        # For now, we'll just return success
        
        # Update voucher usage
        await hotspot_vouchers.update_one(
            {"_id": voucher["_id"]},
            {
                "$set": {
                    "lastUsedAt": now,
                    "updatedAt": now
                },
                "$inc": {"usageCount": 1}
            }
        )
        
        return {
            "success": True,
            "message": "Connection successful",
            "voucher": {
                "code": voucher_code,
                "expiresAt": expires_at,
                "package": {
                    "name": package.get("name"),
                    "duration": package.get("duration"),
                    "dataLimit": package.get("dataLimit")
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting with voucher: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))