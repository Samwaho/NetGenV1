from fastapi import APIRouter, Request, HTTPException, Depends
from app.config.database import organizations, isp_mpesa_transactions, isp_customers, isp_packages, isp_customer_payments, hotspot_vouchers
from bson.objectid import ObjectId
import logging
from datetime import datetime, timezone, timedelta
from app.config.deps import get_current_user
from app.services.sms.template import SmsTemplateService
from app.services.sms.utils import send_sms_for_organization
from app.schemas.sms_template import TemplateCategory
from typing import Dict, Any, Optional, Tuple
import json
import requests
import base64
from app.config.settings import settings
from app.config.utils import record_activity
from app.schemas.enums import OrganizationPermission, IspManagerCustomerStatus

router = APIRouter()
logger = logging.getLogger(__name__)

# Constants
MPESA_URLS = {
    "sandbox": {
        "auth": "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        "register_c2b_url": "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl",
        "stk_push": "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        "b2c_payment": "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest"
    },
    "production": {
        "auth": "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        "register_c2b_url": "https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl",
        "stk_push": "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        "b2c_payment": "https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest"
    }
}

async def authenticate_user(request: Request, required_permission: OrganizationPermission = None) -> Tuple[Any, Any, Any]:
    """Authenticate user and verify organization permissions"""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        token = auth_header.split(" ")[1]
        user = await get_current_user(token)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    organization_id = request.path_params.get("organization_id")
    if not organization_id:
        raise HTTPException(status_code=400, detail="Missing organization ID")
    
    org = await organizations.find_one({"_id": ObjectId(organization_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    user_member = next((m for m in org.get("members", []) if m.get("userId") == user.id), None)
    if not user_member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    if required_permission:
        user_role = next((r for r in org.get("roles", []) if r.get("name") == user_member.get("roleName")), None)
        if not user_role or required_permission.value not in user_role.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    return user, org, organization_id

async def get_mpesa_access_token(consumer_key: str, consumer_secret: str, environment: str = "sandbox") -> str:
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

async def register_c2b_urls(organization_id: str, shortcode: str, 
                           access_token: str = None, environment: str = "sandbox") -> bool:
    """Register C2B URLs for a given shortcode"""
    try:
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org or not org.get("mpesaConfig"):
            logger.error(f"Invalid organization or missing Mpesa config for ID: {organization_id}")
            return False
        
        mpesa_config = org["mpesaConfig"]
        
        if not access_token:
            consumer_key = mpesa_config.get("consumerKey")
            consumer_secret = mpesa_config.get("consumerSecret")
            
            if not consumer_key or not consumer_secret:
                logger.error("Missing consumer key or secret for Mpesa API")
                return False
            
            access_token = await get_mpesa_access_token(consumer_key, consumer_secret, environment)
            
            if not access_token:
                return False
        
        api_url = settings.API_URL
        if not api_url.startswith(('http://', 'https://')):
            api_url = f"https://{api_url}"
        
        c2b_callback_url = f"{api_url}/api/isp-customer-payments/callback/{organization_id}/c2b"
        c2b_validation_url = f"{api_url}/api/isp-customer-payments/validate"
        stk_callback_url = f"{api_url}/api/isp-customer-payments/callback/{organization_id}/stk_push"
        
        c2b_payload = {
            "ShortCode": shortcode,
            "ResponseType": "Completed",
            "ConfirmationURL": c2b_callback_url,
            "ValidationURL": c2b_validation_url
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Registering payment callbacks for shortcode {shortcode}")
        logger.info(f"Validation URL: {c2b_validation_url}")
        logger.info(f"Confirmation URL: {c2b_callback_url}")
        logger.info(f"STK Push Callback URL: {stk_callback_url}")
        
        c2b_response = requests.post(MPESA_URLS[environment]["register_c2b_url"], json=c2b_payload, headers=headers)
        
        if c2b_response.status_code != 200:
            logger.error(f"Failed to register payment callbacks: {c2b_response.text}")
            return False
            
        c2b_result = c2b_response.json()
        if c2b_result.get("ResponseCode") not in ["0", "00000000"]:
            logger.error(f"Failed to register payment callbacks: {c2b_result}")
            return False
        
        update_data = {
            "mpesaConfig.c2bCallbackUrl": c2b_callback_url,
            "mpesaConfig.validationUrl": c2b_validation_url,
            "mpesaConfig.stkPushCallbackUrl": stk_callback_url,
            "mpesaConfig.callbacksRegistered": True,
            "mpesaConfig.updatedAt": datetime.now(timezone.utc)
        }
        
        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Successfully registered all payment callbacks for shortcode {shortcode}")
        return True
        
    except Exception as e:
        logger.error(f"Error registering Mpesa callbacks: {str(e)}")
        return False

@router.post("/register-callbacks/{organization_id}")
async def register_callbacks_for_organization(organization_id: str, request: Request):
    """Register all callback URLs for an organization"""
    try:
        user, org, _ = await authenticate_user(request, OrganizationPermission.MANAGE_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]
        
        missing_fields = []
        if not mpesa_config.get("shortCode"):
            missing_fields.append("shortCode")
        if not mpesa_config.get("consumerKey"):
            missing_fields.append("consumerKey")
        if not mpesa_config.get("consumerSecret"):
            missing_fields.append("consumerSecret")
            
        if missing_fields:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )
        
        environment = mpesa_config.get("environment", "sandbox")
        access_token = await get_mpesa_access_token(
            mpesa_config["consumerKey"],
            mpesa_config["consumerSecret"],
            environment
        )
        
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        c2b_success = await register_c2b_urls(
            organization_id,
            mpesa_config["shortCode"],
            access_token,
            environment
        )
        
        if c2b_success:
            await record_activity(
                user.id,
                ObjectId(organization_id),
                "registered Mpesa callbacks"
            )
            
            updated_config = (await organizations.find_one({"_id": ObjectId(organization_id)}))["mpesaConfig"]
            
            return {
                "success": True,
                "message": "Successfully registered Mpesa callbacks",
                "c2bCallbackUrl": updated_config.get("c2bCallbackUrl")
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to register callbacks with Mpesa"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering callbacks: {str(e)}")
        raise HTTPException(status_code=500, detail="Error registering callbacks")

async def store_transaction(organization_id: str, callback_type: str, payload: Dict[Any, Any]):
    """Store essential Mpesa transaction data"""
    try:
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            logger.error(f"Organization {organization_id} not found for Mpesa callback")
            return
        
        transaction_data = {
            "organizationId": ObjectId(organization_id),
            "callbackType": callback_type,
            "createdAt": datetime.now(timezone.utc)
        }
        
        if callback_type == "stk_push":
            body = payload.get("Body", {})
            stk_callback = body.get("stkCallback", {})
            
            if stk_callback.get("ResultCode") == 0:  # Success
                items = stk_callback.get("CallbackMetadata", {}).get("Item", [])
                for item in items:
                    name, value = item.get("Name"), item.get("Value")
                    if name in ["Amount", "MpesaReceiptNumber", "PhoneNumber"]:
                        transaction_data[name.lower()] = value
                
            transaction_data.update({
                "resultCode": stk_callback.get("ResultCode"),
                "merchantRequestId": stk_callback.get("MerchantRequestID"),
                "checkoutRequestId": stk_callback.get("CheckoutRequestID")
            })
        
        elif callback_type == "c2b":
            field_mappings = {
                "TransactionType": "transactionType",
                "TransID": "transactionId",
                "TransTime": "transTime",
                "TransAmount": "amount",
                "BusinessShortCode": "businessShortCode",
                "BillRefNumber": "billRefNumber",
                "InvoiceNumber": "invoiceNumber",
                "OrgAccountBalance": "orgAccountBalance",
                "ThirdPartyTransID": "thirdPartyTransID",
                "MSISDN": "phoneNumber",
                "FirstName": "firstName",
                "MiddleName": "middleName",
                "LastName": "lastName"
            }
            
            for mpesa_key, db_key in field_mappings.items():
                if mpesa_key in payload:
                    if mpesa_key == "TransAmount":
                        transaction_data[db_key] = float(payload.get(mpesa_key))
                    else:
                        transaction_data[db_key] = payload.get(mpesa_key)
            
            transaction_data["updatedAt"] = datetime.now(timezone.utc)
        
        await isp_mpesa_transactions.insert_one(transaction_data)
        
    except Exception as e:
        logger.error(f"Error storing Mpesa transaction: {str(e)}")

@router.post("/callback/{organization_id}/{callback_type}")
async def mpesa_callback(organization_id: str, callback_type: str, request: Request):
    """Universal callback handler for all Mpesa callback types"""
    try:
        payload = await request.json()
        logger.info(f"=== MPESA CALLBACK RECEIVED ===")
        logger.info(f"Callback Type: {callback_type}")
        logger.info(f"Organization ID: {organization_id}")
        logger.info(f"Raw Payload: {json.dumps(payload, indent=2)}")
        
        await store_transaction(organization_id, callback_type, payload)
        
        if callback_type == "stk_push":
            try:
                body = payload.get("Body", {})
                stk_callback = body.get("stkCallback", {})
                
                logger.info(f"=== STK PUSH CALLBACK DETAILS ===")
                logger.info(f"Result Code: {stk_callback.get('ResultCode')}")
                logger.info(f"Result Description: {stk_callback.get('ResultDesc')}")
                logger.info(f"Merchant Request ID: {stk_callback.get('MerchantRequestID')}")
                logger.info(f"Checkout Request ID: {stk_callback.get('CheckoutRequestID')}")
                
                if stk_callback.get("ResultCode") == 0:  # Success
                    items = stk_callback.get("CallbackMetadata", {}).get("Item", [])
                    amount = None
                    mpesa_receipt = None
                    phone = None
                    
                    for item in items:
                        name, value = item.get("Name"), item.get("Value")
                        if name == "Amount":
                            amount = float(value)
                        elif name == "MpesaReceiptNumber":
                            mpesa_receipt = value
                        elif name == "PhoneNumber":
                            phone = value
                    
                    logger.info(f"=== PAYMENT DETAILS ===")
                    logger.info(f"Amount: {amount}")
                    logger.info(f"Mpesa Receipt: {mpesa_receipt}")
                    logger.info(f"Phone Number: {phone}")
                    
                    merchant_request_id = stk_callback.get("MerchantRequestID")
                    checkout_request_id = stk_callback.get("CheckoutRequestID")
                    
                    transaction = await isp_mpesa_transactions.find_one({
                        "organizationId": ObjectId(organization_id),
                        "merchantRequestId": merchant_request_id,
                        "checkoutRequestId": checkout_request_id
                    })
                    
                    logger.info(f"=== TRANSACTION LOOKUP ===")
                    logger.info(f"Transaction Found: {bool(transaction)}")
                    if transaction:
                        logger.info(f"Transaction Details: {json.dumps(transaction, default=str, indent=2)}")
                    
                    if transaction and transaction.get("accountReference"):
                        account_ref = transaction.get("accountReference")
                        logger.info(f"=== VOUCHER PROCESSING ===")
                        logger.info(f"Account Reference: {account_ref}")
                        
                        voucher = await hotspot_vouchers.find_one({
                            "organizationId": ObjectId(organization_id),
                            "code": account_ref,
                            "status": "pending"
                        })
                        
                        logger.info(f"Voucher Found: {bool(voucher)}")
                        if voucher:
                            logger.info(f"Voucher Details: {json.dumps(voucher, default=str, indent=2)}")
                            
                            # Get organization details for SMS
                            org = await organizations.find_one({"_id": ObjectId(organization_id)})
                            if not org:
                                logger.error(f"Organization {organization_id} not found")
                                return {"ResultCode": 0, "ResultDesc": "Accepted"}
                                
                            # Get package details
                            package = await isp_packages.find_one({"_id": voucher["packageId"]})
                            if not package:
                                logger.error(f"Package not found for voucher {account_ref}")
                                return {"ResultCode": 0, "ResultDesc": "Accepted"}
                            
                            # Update voucher status
                            update_result = await hotspot_vouchers.update_one(
                                {"_id": voucher["_id"]},
                                {
                                    "$set": {
                                        "status": "active",
                                        "paymentReference": mpesa_receipt,
                                        "updatedAt": datetime.now(timezone.utc)
                                    }
                                }
                            )
                            
                            if update_result.modified_count > 0:
                                logger.info(f"Activated voucher {account_ref} after payment confirmation")
                                
                                # Get SMS template for voucher
                                from app.services.sms.template import SmsTemplateService
                                from app.services.sms.utils import send_sms_for_organization
                                from app.schemas.sms_template import TemplateCategory
                                
                                logger.info(f"=== FETCHING SMS TEMPLATE ===")
                                template_result = await SmsTemplateService.list_templates(
                                    organization_id=organization_id,
                                    category=TemplateCategory.HOTSPOT_VOUCHER,
                                    is_active=True
                                )
                                
                                logger.info(f"Template Result: {json.dumps(template_result, default=str, indent=2)}")
                                
                                template_doc = None
                                if template_result.get("success") and template_result.get("templates"):
                                    template_doc = template_result["templates"][0]
                                    logger.info(f"Found template: {json.dumps(template_doc, default=str, indent=2)}")
                                    
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
                                    sms_vars = {
                                        "firstName": "Customer",  # Since we don't have customer name for hotspot users
                                        "voucherCode": account_ref,
                                        "organizationName": org.get("name", "Provider"),
                                        "packageName": package.get("name", ""),
                                        "expirationDate": expiry_str,
                                        "amountPaid": amount
                                    }
                                    
                                    logger.info(f"=== SENDING SMS ===")
                                    logger.info(f"SMS Variables: {json.dumps(sms_vars, indent=2)}")
                                    logger.info(f"Phone Number: {voucher.get('phoneNumber')}")
                                    
                                    # Render and send SMS
                                    message = SmsTemplateService.render_template(template_doc["content"], sms_vars)
                                    logger.info(f"Rendered Message: {message}")
                                    
                                    sms_result = await send_sms_for_organization(
                                        organization_id=organization_id,
                                        to=voucher.get("phoneNumber"),
                                        message=message
                                    )
                                    
                                    logger.info(f"SMS Send Result: {json.dumps(sms_result, default=str, indent=2)}")
                                    logger.info(f"Sent voucher SMS to {voucher.get('phoneNumber')}")
                                else:
                                    logger.warning(f"No SMS template found for voucher delivery in organization {organization_id}")
                            else:
                                logger.error(f"Failed to update voucher {account_ref}")
                        else:
                            logger.error(f"Voucher {account_ref} not found or not in pending state")
                    else:
                        logger.error(f"Transaction not found or missing account reference")
                else:
                    logger.error(f"STK Push failed with Result Code: {stk_callback.get('ResultCode')}")
                    logger.error(f"Error Description: {stk_callback.get('ResultDesc')}")
            except Exception as e:
                logger.error(f"Error processing STK Push callback: {str(e)}")
                logger.exception("Full traceback:")
        
        return {"ResultCode": 0, "ResultDesc": "Accepted"}
    except Exception as e:
        logger.error(f"Error processing Mpesa {callback_type} callback: {str(e)}")
        logger.exception("Full traceback:")
        return {"ResultCode": 1, "ResultDesc": "Rejected"}

@router.post("/validate")
async def mpesa_validate(request: Request):
    """Simple validation endpoint for M-Pesa that always returns success"""
    try:
        payload = await request.json()
        logger.info(f"Received Mpesa validation request")
        logger.info(f"Validation payload: {payload}")
        
        return {
            "ResultCode": 0,
            "ResultDesc": "Accepted"
        }
    except Exception as e:
        logger.error(f"Error processing Mpesa validation request: {str(e)}")
        return {
            "ResultCode": 1,
            "ResultDesc": "Rejected"
        }

async def process_customer_payment(organization_id: str, username: str, amount: float, phone: str = None, transaction_id: str = None) -> bool:
    """Process a payment from a customer and update their subscription"""
    try:
        customer = await isp_customers.find_one({
            "organizationId": ObjectId(organization_id),
            "username": username
        })
        
        if not customer:
            logger.error(f"Customer with username {username} not found in organization {organization_id}")
            return False
        
        package = await isp_packages.find_one({"_id": customer.get("packageId")})
        if not package:
            logger.error(f"Package not found for customer {username}")
            return False
        
        now = datetime.now(timezone.utc)
        current_expiry = customer.get("expirationDate")
        
        if current_expiry and not current_expiry.tzinfo:
            current_expiry = current_expiry.replace(tzinfo=timezone.utc)
            
        base_date = current_expiry if current_expiry and current_expiry > now else now
        
        package_price = package.get("price", 0)
        if package_price <= 0:
            logger.error(f"Invalid package price {package_price} for customer {username}")
            return False
        
        is_new = customer.get("isNew", True)
        initial_amount = customer.get("initialAmount", 0.0)
        days_to_add = 0
        used_amount = amount
        
        if is_new:
            if amount == initial_amount:
                duration_paid = amount / package_price
                days_to_add = int(30 * duration_paid)
            else:
                remainder = initial_amount - package_price
                if remainder < 0:
                    remainder = 0
                used_amount = amount - remainder
                if used_amount < 0:
                    used_amount = 0
                duration_paid = used_amount / package_price
                days_to_add = int(30 * duration_paid)
            await isp_customers.update_one(
                {"_id": customer["_id"]},
                {"$set": {"isNew": False}}
            )
        else:
            duration_paid = amount / package_price
            days_to_add = int(30 * duration_paid)
        
        new_expiry = base_date + timedelta(days=days_to_add)
        
        update_result = await isp_customers.update_one(
            {"_id": customer["_id"]},
            {
                "$set": {
                    "status": IspManagerCustomerStatus.ACTIVE.value,
                    "expirationDate": new_expiry,
                    "updatedAt": now
                }
            }
        )
        
        payment_data = {
            "customerId": customer["_id"],
            "organizationId": ObjectId(organization_id),
            "amount": amount,
            "transactionId": transaction_id,
            "phoneNumber": phone,
            "packageId": package["_id"],
            "daysAdded": days_to_add,
            "paidAt": now,
            "createdAt": now,
            "updatedAt": now
        }
        
        await isp_customer_payments.insert_one(payment_data)
        
        await record_activity(
            None,
            ObjectId(organization_id),
            f"Payment of {amount} received for customer {username}, subscription extended by {days_to_add} days"
        )
        
        logger.info(f"Updated subscription for customer {username}: active until {new_expiry}")

        try:
            org = await organizations.find_one({"_id": ObjectId(organization_id)})
            org_name = org.get("name", "Provider") if org else "Provider"
            paybill_number = None
            if org and org.get("mpesaConfig"):
                paybill_number = org["mpesaConfig"].get("shortCode")

            template_result = await SmsTemplateService.list_templates(
                organization_id=organization_id,
                category=TemplateCategory.PAYMENT_CONFIRMATION,
                is_active=True
            )
            template_doc = None
            if template_result.get("success") and template_result.get("templates"):
                template_doc = template_result["templates"][0]
            if template_doc:
                sms_vars = {
                    "firstName": customer.get("firstName", ""),
                    "lastName": customer.get("lastName", ""),
                    "username": customer.get("username", ""),
                    "organizationName": org_name,
                    "amountPaid": amount,
                    "paybillNumber": paybill_number or "",
                    "expirationDate": new_expiry.strftime("%Y-%m-%d")
                }
                message = SmsTemplateService.render_template(template_doc["content"], sms_vars)
                await send_sms_for_organization(
                    organization_id=organization_id,
                    to=customer.get("phone"),
                    message=message
                )
        except Exception as sms_exc:
            logger.error(f"Failed to send payment confirmation SMS: {sms_exc}")

        return True
        
    except Exception as e:
        logger.error(f"Error processing customer payment: {str(e)}")
        return False

async def process_hotspot_voucher_payment(organization_id: str, voucher_code: str, amount: float, transaction_id: str = None) -> bool:
    """Process a payment for a hotspot voucher"""
    try:
        voucher = await hotspot_vouchers.find_one({
            "organizationId": ObjectId(organization_id),
            "code": voucher_code,
            "status": "pending"
        })
        
        if not voucher:
            logger.error(f"Pending voucher with code {voucher_code} not found in organization {organization_id}")
            return False
        
        update_result = await hotspot_vouchers.update_one(
            {"_id": voucher["_id"]},
            {
                "$set": {
                    "status": "active",
                    "paymentReference": transaction_id,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        if update_result.modified_count > 0:
            logger.info(f"Activated voucher {voucher_code} after payment confirmation")
            return True
        else:
            logger.error(f"Failed to update voucher {voucher_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error processing hotspot voucher payment: {str(e)}")
        return False

@router.get("/callback-status/{organization_id}")
async def check_callback_status(organization_id: str, request: Request):
    """Check the registration status of Mpesa callbacks for an organization"""
    try:
        _, org, _ = await authenticate_user(request, OrganizationPermission.VIEW_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]
        
        return {
            "success": True,
            "message": "Mpesa callback status retrieved",
            "status": {
                "isActive": mpesa_config.get("isActive", False),
                "callbacksRegistered": mpesa_config.get("callbacksRegistered", False),
                "environment": mpesa_config.get("environment", "sandbox"),
                "c2bCallbackUrl": mpesa_config.get("c2bCallbackUrl")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking callback status: {str(e)}")
        raise HTTPException(status_code=500, detail="Error checking callback status")

@router.post("/stk-push/{organization_id}")
async def initiate_stk_push(organization_id: str, request: Request):
    """Initiate STK Push request for a customer"""
    try:
        user, org, _ = await authenticate_user(request, OrganizationPermission.MANAGE_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]
        
        if not mpesa_config.get("isActive"):
            raise HTTPException(status_code=400, detail="Mpesa integration not enabled")
            
        data = await request.json()
        phone_number = data.get("phoneNumber")
        amount = data.get("amount")
        
        if not phone_number or not amount:
            raise HTTPException(status_code=400, detail="Phone number and amount required")
        
        if phone_number.startswith("0"):
            phone_number = "254" + phone_number[1:]
        elif not phone_number.startswith("254"):
            phone_number = "254" + phone_number
        
        shortcode = mpesa_config.get("stkPushShortCode") or mpesa_config.get("shortCode")
        passkey = mpesa_config.get("stkPushPassKey") or mpesa_config.get("passKey")
        consumer_key = mpesa_config.get("consumerKey")
        consumer_secret = mpesa_config.get("consumerSecret")
        callback_url = mpesa_config.get("c2bCallbackUrl")
        environment = mpesa_config.get("environment", "sandbox")
        
        if not all([shortcode, passkey, consumer_key, consumer_secret]):
            raise HTTPException(status_code=400, detail="Missing required Mpesa configuration")
        
        access_token = await get_mpesa_access_token(consumer_key, consumer_secret, environment)
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((shortcode + passkey + timestamp).encode()).decode()
        
        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": mpesa_config.get("transactionType", "CustomerPayBillOnline"),
            "Amount": int(float(amount)),
            "PartyA": phone_number,
            "PartyB": shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url or f"{settings.API_URL}/api/mpesa/callback/{organization_id}/stk-push",
            "AccountReference": data.get("accountReference") or mpesa_config.get("accountReference") or "Account",
            "TransactionDesc": data.get("transactionDesc", "Payment")
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(MPESA_URLS[environment]["stk_push"], json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            
            await isp_mpesa_transactions.insert_one({
                "organizationId": ObjectId(organization_id),
                "phoneNumber": phone_number,
                "amount": amount,
                "merchantRequestId": result.get("MerchantRequestID"),
                "checkoutRequestId": result.get("CheckoutRequestID"),
                "status": "pending",
                "createdAt": datetime.now(timezone.utc)
            })
            
            return {
                "success": True,
                "message": "STK push initiated",
                "merchantRequestId": result.get("MerchantRequestID"),
                "checkoutRequestId": result.get("CheckoutRequestID")
            }
        else:
            logger.error(f"Failed to initiate STK push: {response.text}")
            raise HTTPException(status_code=500, detail="Failed to initiate STK push")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating STK push: {str(e)}")
        raise HTTPException(status_code=500, detail="Error initiating STK push")

@router.post("/callback/{organization_id}/validation")
async def mpesa_validation(organization_id: str, request: Request):
    """Handle M-Pesa validation requests"""
    try:
        payload = await request.json()
        logger.info(f"Received Mpesa validation request for organization {organization_id}")
        logger.info(f"Validation payload: {payload}")
        
        return {
            "ResultCode": 0,
            "ResultDesc": "Accepted"
        }
    except Exception as e:
        logger.error(f"Error processing Mpesa validation request: {str(e)}")
        return {
            "ResultCode": 1,
            "ResultDesc": "Rejected"
        }

@router.get("/test-callback/{organization_id}")
async def test_callback(organization_id: str):
    """Test endpoint to verify callback URL accessibility"""
    try:
        logger.info(f"=== TEST CALLBACK RECEIVED ===")
        logger.info(f"Organization ID: {organization_id}")
        
        # Simulate a successful STK push callback
        test_payload = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "test-request-id",
                    "CheckoutRequestID": "test-checkout-id",
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {
                                "Name": "Amount",
                                "Value": 1.0
                            },
                            {
                                "Name": "MpesaReceiptNumber",
                                "Value": "TEST123"
                            },
                            {
                                "Name": "PhoneNumber",
                                "Value": "254746373618"
                            }
                        ]
                    }
                }
            }
        }
        
        # Process the test callback
        await mpesa_callback(organization_id, "stk_push", Request({"type": "http", "method": "POST", "json": lambda: test_payload}))
        
        return {"status": "success", "message": "Test callback processed"}
    except Exception as e:
        logger.error(f"Error in test callback: {str(e)}")
        logger.exception("Full traceback:")
        return {"status": "error", "message": str(e)} 
