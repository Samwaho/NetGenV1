from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from app.config.database import organizations, isp_packages, hotspot_vouchers, isp_mpesa_transactions, isp_kopokopo_transactions
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
    """
    try:
        # Validate organization exists
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get packages that are available for hotspot
        packages = await isp_packages.find({
            "organizationId": ObjectId(organization_id),
            "showInHotspot": True,
            "isActive": True
        }).to_list(length=None)
        
        # Convert ObjectId to string for JSON serialization
        for package in packages:
            package["_id"] = str(package["_id"])
            package["organizationId"] = str(package["organizationId"])
        
        return {
            "success": True,
            "packages": packages
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error getting hotspot packages: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.options("/packages")
async def options_packages():
    """Handle CORS preflight for packages endpoint"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400"
        }
    )

@router.options("/purchase-voucher")
async def options_purchase_voucher():
    """Handle CORS preflight for voucher purchase endpoint"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400"
        }
    )

@router.post("/purchase-voucher")
async def purchase_voucher(request: Request):
    """
    Purchase a hotspot voucher using the organization's active payment method
    
    This endpoint automatically determines which payment method to use based on
    the organization's paymentMethod field and routes to the appropriate processor.
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
        
        # Get active payment method
        payment_method = organization.get("paymentMethod")
        if not payment_method:
            return JSONResponse(
                status_code=400,
                content={"detail": "No active payment method configured for this organization"},
                headers={"Access-Control-Allow-Origin": "*"}
            )
        
        # Route to appropriate payment processor based on active method
        if payment_method == "MPESA":
            return await process_mpesa_payment(organization, package_id, phone_number, organization_id)
        elif payment_method == "KOPOKOPO":
            return await process_kopokopo_payment(organization, package_id, phone_number, organization_id)
        else:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Unsupported payment method: {payment_method}"},
                headers={"Access-Control-Allow-Origin": "*"}
            )
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in voucher purchase: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Error processing voucher purchase: {str(e)}")

async def process_mpesa_payment(organization: dict, package_id: str, phone_number: str, organization_id: str):
    """Process M-Pesa payment for hotspot voucher"""
    # Check if Mpesa is enabled for the organization
    mpesa_config = organization.get("mpesaConfig", {})
    if not mpesa_config.get("isActive"):
        return JSONResponse(
            status_code=400,
            content={"detail": "Mpesa integration not enabled for this organization"},
            headers={"Access-Control-Allow-Origin": "*"}
        )
    
    # Validate package
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
    
    # Prepare STK Push request
    amount = package.get("price", 0)
    stk_request = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone_number,
        "PartyB": shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": callback_url,
        "AccountReference": voucher_code,
        "TransactionDesc": f"Hotspot voucher: {package.get('name', 'Internet Package')}"
    }
    
    # Make STK Push request
    stk_url = MPESA_URLS[environment]["stk_push"]
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    logger.info(f"STK Push Request - URL: {stk_url}")
    logger.info(f"STK Push Request - Data: {stk_request}")
    
    response = requests.post(stk_url, json=stk_request, headers=headers)
    
    if response.status_code == 200:
        response_data = response.json()
        logger.info(f"STK Push Response: {response_data}")
        
        if response_data.get("ResponseCode") == "0":
            # Store M-Pesa transaction
            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "transactionType": TransactionType.STK_PUSH.value,
                "amount": amount,
                "phoneNumber": phone_number,
                "shortCode": shortcode,
                "checkoutRequestId": response_data.get("CheckoutRequestID"),
                "merchantRequestId": response_data.get("MerchantRequestID"),
                "accountReference": voucher_code,
                "status": TransactionStatus.PENDING.value,
                "voucherCode": voucher_code,
                "packageId": str(package_id),
                "packageName": package.get("name", ""),
                "duration": package.get("duration", 0),
                "dataLimit": package.get("dataLimit", 0),
                "expiresAt": expiry_date,
                "createdAt": now,
                "updatedAt": now
            }
            
            await isp_mpesa_transactions.insert_one(transaction_data)
            
            return {
                "success": True,
                "message": "Payment initiated. Please check your phone to complete the transaction.",
                "voucherId": voucher_id,
                "voucherCode": voucher_code,
                "checkoutRequestId": response_data.get("CheckoutRequestID"),
                "paymentMethod": "mpesa"
            }
        else:
            # Clean up the voucher if STK Push failed
            await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
            error_msg = response_data.get("ResponseDescription", "STK Push failed")
            return JSONResponse(
                status_code=400,
                content={"detail": error_msg},
                headers={"Access-Control-Allow-Origin": "*"}
            )
    else:
        # Clean up the voucher if request failed
        await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
        error_msg = f"STK Push request failed: {response.text}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=500,
            content={"detail": error_msg},
            headers={"Access-Control-Allow-Origin": "*"}
        )

async def process_kopokopo_payment(organization: dict, package_id: str, phone_number: str, organization_id: str):
    """Process KopoKopo payment for hotspot voucher"""
    # Check if KopoKopo is enabled for the organization
    kopokopo_config = organization.get("kopokopoConfig", {})
    if not kopokopo_config.get("isActive"):
        return JSONResponse(
            status_code=400,
            content={"detail": "KopoKopo integration not enabled for this organization"},
            headers={"Access-Control-Allow-Origin": "*"}
        )
    
    # Validate package
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
        "paymentMethod": "kopokopo",
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
    
    # Get KopoKopo configuration
    environment = kopokopo_config.get("environment", "sandbox")
    client_id = kopokopo_config.get("clientId")
    client_secret = kopokopo_config.get("clientSecret")
    till_number = kopokopo_config.get("tillNumber")
    
    if not all([client_id, client_secret, till_number]):
        # Clean up the voucher if we can't proceed
        await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
        raise HTTPException(status_code=400, detail="Missing required KopoKopo configuration")
    
    # Get access token
    from app.api.kopokopo import KopoKopoService
    access_token = await KopoKopoService.get_access_token(client_id, client_secret, environment)
    
    if not access_token:
        # Clean up the voucher if we can't get access token
        await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
        raise HTTPException(status_code=500, detail="Failed to get KopoKopo access token")
    
    # Create pay recipient
    recipient_id = await KopoKopoService.create_pay_recipient(
        organization_id, phone_number, access_token, environment
    )
    
    if not recipient_id:
        # Clean up the voucher if we can't create recipient
        await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
        raise HTTPException(status_code=500, detail="Failed to create KopoKopo pay recipient")
    
    # Initiate payment
    amount = package.get("price", 0)
    transfer_id = await KopoKopoService.initiate_payment(
        organization_id, recipient_id, amount, access_token, environment
    )
    
    if not transfer_id:
        # Clean up the voucher if we can't initiate payment
        await hotspot_vouchers.delete_one({"_id": ObjectId(voucher_id)})
        raise HTTPException(status_code=500, detail="Failed to initiate KopoKopo payment")
    
    # Store KopoKopo transaction
    transaction_data = {
        "organizationId": ObjectId(organization_id),
        "transactionType": TransactionType.KOPOKOPO_BUYGOODS.value,
        "amount": amount,
        "phoneNumber": phone_number,
        "tillNumber": till_number,
        "reference": f"VOUCHER_{voucher_code}",
        "status": TransactionStatus.PENDING.value,
        "transferId": transfer_id,
        "recipientId": recipient_id,
        "voucherCode": voucher_code,
        "packageId": str(package_id),
        "packageName": package.get("name", ""),
        "duration": package.get("duration", 0),
        "dataLimit": package.get("dataLimit", 0),
        "expiresAt": expiry_date,
        "createdAt": now,
        "updatedAt": now
    }
    
    await isp_kopokopo_transactions.insert_one(transaction_data)
    
    return {
        "success": True,
        "message": "Payment initiated. Please check your phone to complete the transaction.",
        "voucherId": voucher_id,
        "voucherCode": voucher_code,
        "transferId": transfer_id,
        "recipientId": recipient_id,
        "paymentMethod": "kopokopo"
    }

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
                    "packageId": str(package["_id"]),
                    "packageName": package.get("name", ""),
                    "duration": package.get("duration", 0),
                    "dataLimit": package.get("dataLimit", 0),
                    "expiresAt": voucher["expiresAt"]
                }
                
                await isp_mpesa_transactions.update_one(
                    {"_id": stk_transaction["_id"]},
                    {"$set": voucher_update_data}
                )
                logger.info(f"Updated existing STK Push transaction with voucher details")
            else:
                # Create a fallback transaction if the original STK Push transaction is not found
                fallback_transaction = {
                    "organizationId": ObjectId(organization_id),
                    "transactionType": TransactionType.STK_PUSH.value,
                    "amount": amount,
                    "phoneNumber": voucher.get("phoneNumber"),
                    "shortCode": "HOTSPOT",
                    "checkoutRequestId": transaction_id or f"FALLBACK_{voucher_code}",
                    "merchantRequestId": f"FALLBACK_{voucher_code}",
                    "accountReference": voucher_code,
                    "status": TransactionStatus.COMPLETED.value,
                    "voucherCode": voucher_code,
                    "packageId": str(package["_id"]),
                    "packageName": package.get("name", ""),
                    "duration": package.get("duration", 0),
                    "dataLimit": package.get("dataLimit", 0),
                    "expiresAt": voucher["expiresAt"],
                    "createdAt": now,
                    "updatedAt": now
                }
                
                await isp_mpesa_transactions.insert_one(fallback_transaction)
                logger.info(f"Created fallback transaction for voucher {voucher_code}")

            # Send SMS notification
            try:
                sms_message = f"Your hotspot voucher {voucher_code} has been activated! Package: {package.get('name', 'Internet Package')}, Duration: {package.get('duration', 0)} {package.get('durationUnit', 'days')}, Data: {package.get('dataLimit', 0)} {package.get('dataLimitUnit', 'MB')}. Expires: {voucher['expiresAt'].strftime('%Y-%m-%d %H:%M')}"
                
                await send_sms_for_organization(
                    organization_id=organization_id,
                    phone_number=voucher.get("phoneNumber"),
                    message=sms_message,
                    template_category=TemplateCategory.HOTSPOT_VOUCHER_ACTIVATED
                )
                logger.info(f"Sent SMS notification for activated voucher {voucher_code}")
            except Exception as sms_error:
                logger.error(f"Failed to send SMS for voucher {voucher_code}: {str(sms_error)}")

            return True
        else:
            logger.error(f"Failed to update voucher {voucher_code} status")
            return False

    except Exception as e:
        logger.error(f"Error processing hotspot voucher payment: {str(e)}")
        logger.exception("Full traceback:")
        return False

@router.get("/voucher-status/{voucher_id}")
async def get_voucher_status(voucher_id: str):
    """Get the status of a hotspot voucher"""
    try:
        voucher = await hotspot_vouchers.find_one({"_id": ObjectId(voucher_id)})
        if not voucher:
            raise HTTPException(status_code=404, detail="Voucher not found")
        
        # Convert ObjectId to string for JSON serialization
        voucher["_id"] = str(voucher["_id"])
        voucher["packageId"] = str(voucher["packageId"])
        voucher["organizationId"] = str(voucher["organizationId"])
        
        return {
            "success": True,
            "voucher": voucher
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error getting voucher status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/connect")
async def connect_with_voucher(request: Request):
    """Connect to hotspot using a voucher code"""
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
        
        # Check if voucher has expired
        if voucher["expiresAt"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Voucher has expired")
        
        # Here you would implement the actual hotspot connection logic
        # For now, we'll just return success
        return {
            "success": True,
            "message": "Connected successfully",
            "voucher": {
                "code": voucher["code"],
                "packageName": "Internet Package",  # You'd get this from the package
                "dataLimit": voucher.get("dataLimit"),
                "dataLimitUnit": voucher.get("dataLimitUnit"),
                "duration": voucher.get("duration"),
                "durationUnit": voucher.get("durationUnit"),
                "expiresAt": voucher["expiresAt"]
            }
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error connecting with voucher: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
