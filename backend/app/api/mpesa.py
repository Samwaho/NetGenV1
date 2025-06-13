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
from pydantic import BaseModel

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

class MpesaService:
    @staticmethod
    async def get_access_token(consumer_key: str, consumer_secret: str, environment: str = "sandbox") -> str:
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

    @staticmethod
    def generate_callback_url(organization_id: str, callback_type: str) -> str:
        """Generate a callback URL for Mpesa callbacks
        
        Args:
            organization_id: The ID of the organization
            callback_type: Type of callback (c2b, stk_push, etc.)
            
        Returns:
            str: The fully qualified callback URL
        """
        api_url = settings.API_URL
        
        # Ensure URL starts with https://
        if not api_url.startswith(('http://', 'https://')):
            api_url = f"https://{api_url}"
        elif api_url.startswith('http://'):
            api_url = f"https://{api_url[7:]}"
            
        return f"{api_url}/api/payments/callback/{organization_id}/{callback_type}"

    @staticmethod
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
                
                access_token = await MpesaService.get_access_token(consumer_key, consumer_secret, environment)
                
                if not access_token:
                    return False
            
            # Generate all callback URLs using the utility function
            c2b_callback_url = MpesaService.generate_callback_url(organization_id, "c2b")
            c2b_validation_url = f"{settings.API_URL}/api/payments/validate"
            stk_callback_url = MpesaService.generate_callback_url(organization_id, "stk_push")
            
            # Register C2B URLs
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
            
            logger.info(f"=== REGISTERING MPESA CALLBACKS ===")
            logger.info(f"Organization ID: {organization_id}")
            logger.info(f"Environment: {environment}")
            logger.info(f"Shortcode: {shortcode}")
            logger.info(f"C2B Validation URL: {c2b_validation_url}")
            logger.info(f"C2B Confirmation URL: {c2b_callback_url}")
            logger.info(f"STK Push Callback URL: {stk_callback_url}")
            logger.info(f"Request Payload: {json.dumps(c2b_payload, indent=2)}")
            
            # Make C2B registration request
            c2b_response = requests.post(MPESA_URLS[environment]["register_c2b_url"], json=c2b_payload, headers=headers)
            logger.info(f"C2B Registration Response: {c2b_response.text}")
            
            if c2b_response.status_code != 200:
                logger.error(f"Failed to register C2B callbacks: {c2b_response.text}")
                return False
                
            c2b_result = c2b_response.json()
            if c2b_result.get("ResponseCode") not in ["0", "00000000"]:
                logger.error(f"Failed to register C2B callbacks: {c2b_result}")
                return False
            
            # Update organization with all callback URLs
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
            
            logger.info(f"Successfully registered all Mpesa callbacks for shortcode {shortcode}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering Mpesa callbacks: {str(e)}")
            logger.exception("Full traceback:")
            return False

# Export functions for backward compatibility
get_mpesa_access_token = MpesaService.get_access_token
register_c2b_urls = MpesaService.register_c2b_urls

class C2BTransactionService:
    @staticmethod
    async def process_transaction(organization_id: str, payload: Dict[str, Any]) -> bool:
        """Process a C2B transaction"""
        try:
            # Extract transaction details
            transaction_type = payload.get("TransactionType")
            transaction_id = payload.get("TransID")
            amount = float(payload.get("TransAmount", 0))
            phone = payload.get("MSISDN")
            bill_ref = payload.get("BillRefNumber")
            
            if not all([transaction_type, transaction_id, amount, phone, bill_ref]):
                logger.error("Missing required C2B transaction fields")
                return False
            
            # Process as customer payment
            return await process_customer_payment(
                organization_id=organization_id,
                username=bill_ref,
                amount=amount,
                phone=phone,
                transaction_id=transaction_id
            )
            
        except Exception as e:
            logger.error(f"Error processing C2B transaction: {str(e)}")
            return False

class STKTransactionService:
    @staticmethod
    async def process_transaction(organization_id: str, payload: Dict[str, Any]) -> bool:
        """Process an STK Push transaction"""
        try:
            logger.info(f"=== STK TRANSACTION PROCESSING STARTED ===")
            logger.info(f"Organization ID: {organization_id}")
            logger.info(f"Raw Payload: {json.dumps(payload, indent=2)}")
            
            body = payload.get("Body", {})
            stk_callback = body.get("stkCallback", {})
            
            logger.info(f"=== STK CALLBACK DETAILS ===")
            logger.info(f"Result Code: {stk_callback.get('ResultCode')}")
            logger.info(f"Result Description: {stk_callback.get('ResultDesc')}")
            logger.info(f"Merchant Request ID: {stk_callback.get('MerchantRequestID')}")
            logger.info(f"Checkout Request ID: {stk_callback.get('CheckoutRequestID')}")
            
            if stk_callback.get("ResultCode") != 0:
                logger.error(f"STK Push failed with Result Code: {stk_callback.get('ResultCode')}")
                logger.error(f"Error Description: {stk_callback.get('ResultDesc')}")
                return False
            
            # Extract transaction details
            items = stk_callback.get("CallbackMetadata", {}).get("Item", [])
            amount = None
            mpesa_receipt = None
            phone = None
            
            logger.info(f"=== CALLBACK METADATA ITEMS ===")
            logger.info(f"Items: {json.dumps(items, indent=2)}")
            
            for item in items:
                name, value = item.get("Name"), item.get("Value")
                if name == "Amount":
                    amount = float(value)
                elif name == "MpesaReceiptNumber":
                    mpesa_receipt = value
                elif name == "PhoneNumber":
                    phone = value
                logger.info(f"Processed Item - Name: {name}, Value: {value}")
            
            logger.info(f"=== EXTRACTED TRANSACTION DETAILS ===")
            logger.info(f"Amount: {amount}")
            logger.info(f"Mpesa Receipt: {mpesa_receipt}")
            logger.info(f"Phone Number: {phone}")
            
            if not all([amount, mpesa_receipt, phone]):
                logger.error("Missing required STK transaction fields")
                return False
            
            # Get account reference (voucher code)
            merchant_request_id = stk_callback.get("MerchantRequestID")
            checkout_request_id = stk_callback.get("CheckoutRequestID")
            
            logger.info(f"=== LOOKING UP TRANSACTION ===")
            logger.info(f"Merchant Request ID: {merchant_request_id}")
            logger.info(f"Checkout Request ID: {checkout_request_id}")
            
            transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "merchantRequestId": merchant_request_id,
                "checkoutRequestId": checkout_request_id
            })
            
            logger.info(f"Transaction Found: {bool(transaction)}")
            if transaction:
                logger.info(f"Transaction Details: {json.dumps(transaction, default=str, indent=2)}")
            
            if not transaction or not transaction.get("accountReference"):
                logger.error("Transaction not found or missing account reference")
                return False
            
            voucher_code = transaction["accountReference"]
            logger.info(f"=== PROCESSING VOUCHER ===")
            logger.info(f"Voucher Code: {voucher_code}")
            
            # Process as hotspot voucher payment
            success = await process_hotspot_voucher_payment(
                organization_id=organization_id,
                voucher_code=voucher_code,
                amount=amount,
                transaction_id=mpesa_receipt
            )
            
            logger.info(f"Voucher Processing Result: {success}")
            return success
            
        except Exception as e:
            logger.error(f"Error processing STK transaction: {str(e)}")
            logger.exception("Full traceback:")
            return False

@router.post("/callback/{organization_id}/{callback_type}")
async def mpesa_callback(organization_id: str, callback_type: str, request: Request):
    """Universal callback handler for all Mpesa callback types"""
    try:
        logger.info(f"=== MPESA CALLBACK RECEIVED ===")
        logger.info(f"Request Headers: {dict(request.headers)}")
        logger.info(f"Request Method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        
        # Verify organization exists
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            logger.error(f"Organization {organization_id} not found")
            return {"ResultCode": 1, "ResultDesc": "Organization not found"}
            
        # Verify Mpesa is configured
        mpesa_config = org.get("mpesaConfig", {})
        if not mpesa_config.get("isActive"):
            logger.error(f"Mpesa not active for organization {organization_id}")
            return {"ResultCode": 1, "ResultDesc": "Mpesa not active"}
        
        payload = await request.json()
        logger.info(f"Callback Type: {callback_type}")
        logger.info(f"Organization ID: {organization_id}")
        logger.info(f"Raw Payload: {json.dumps(payload, indent=2)}")
        
        # Store transaction data first
        await store_transaction(organization_id, callback_type, payload)
        
        # Process based on callback type
        if callback_type == "c2b":
            logger.info("=== PROCESSING C2B TRANSACTION ===")
            success = await C2BTransactionService.process_transaction(organization_id, payload)
            logger.info(f"C2B Transaction Processing Result: {success}")
            
            # For C2B, always return success to Mpesa
            # This is because we've already stored the transaction and will process it asynchronously if needed
            return {"ResultCode": 0, "ResultDesc": "Accepted"}
            
        elif callback_type == "stk_push":
            logger.info("=== PROCESSING STK PUSH TRANSACTION ===")
            success = await STKTransactionService.process_transaction(organization_id, payload)
            logger.info(f"STK Push Transaction Processing Result: {success}")
            
            # For STK Push, return based on processing result
            # This is because STK Push requires immediate response
            return {
                "ResultCode": 0 if success else 1,
                "ResultDesc": "Accepted" if success else "Failed to process STK Push"
            }
        else:
            logger.error(f"Unknown callback type: {callback_type}")
            return {"ResultCode": 1, "ResultDesc": f"Unknown callback type: {callback_type}"}
        
    except Exception as e:
        logger.error(f"Error processing Mpesa {callback_type} callback: {str(e)}")
        logger.exception("Full traceback:")
        return {"ResultCode": 1, "ResultDesc": "Internal server error"}

@router.post("/validate")
async def mpesa_validate(request: Request):
    """Handle M-Pesa validation requests"""
    try:
        logger.info(f"=== MPESA VALIDATION REQUEST RECEIVED ===")
        logger.info(f"Request Headers: {dict(request.headers)}")
        logger.info(f"Request Method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        
        payload = await request.json()
        logger.info(f"Validation payload: {json.dumps(payload, indent=2)}")
        
        # Extract organization from shortcode
        shortcode = payload.get("BusinessShortCode")
        if not shortcode:
            logger.error("No BusinessShortCode in validation request")
            return {
                "ResultCode": 1,
                "ResultDesc": "Missing BusinessShortCode"
            }
            
        # Find organization by shortcode
        org = await organizations.find_one({
            "mpesaConfig.shortCode": str(shortcode),
            "mpesaConfig.isActive": True
        })
        
        if not org:
            logger.error(f"No active organization found for shortcode {shortcode}")
            return {
                "ResultCode": 1,
                "ResultDesc": "Invalid BusinessShortCode"
            }
            
        # For now, we accept all validation requests
        # You can add custom validation logic here if needed
        logger.info(f"Validation accepted for organization {org['_id']} with shortcode {shortcode}")
        return {
            "ResultCode": 0,
            "ResultDesc": "Accepted"
        }
    except Exception as e:
        logger.error(f"Error processing Mpesa validation request: {str(e)}")
        logger.exception("Full traceback:")
        return {
            "ResultCode": 1,
            "ResultDesc": "Internal server error"
        }

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
        access_token = await MpesaService.get_access_token(
            mpesa_config["consumerKey"],
            mpesa_config["consumerSecret"],
            environment
        )
        
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        c2b_success = await MpesaService.register_c2b_urls(
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

async def store_transaction(organization_id: str, callback_type: str, payload: Dict[Any, Any]):
    """Store essential Mpesa transaction data"""
    try:
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            logger.error(f"Organization {organization_id} not found for Mpesa callback")
            return
        
        now = datetime.now(timezone.utc)
        transaction_data = {
            "organizationId": ObjectId(organization_id),
            "callbackType": callback_type,
            "createdAt": now,
            "updatedAt": now
        }
        
        if callback_type == "stk_push":
            body = payload.get("Body", {})
            stk_callback = body.get("stkCallback", {})
            
            # Check if transaction already exists
            existing_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "merchantRequestId": stk_callback.get("MerchantRequestID"),
                "checkoutRequestId": stk_callback.get("CheckoutRequestID")
            })
            
            if existing_transaction:
                logger.info(f"Transaction already exists for STK push: {stk_callback.get('MerchantRequestID')}")
                return
            
            if stk_callback.get("ResultCode") == 0:  # Success
                items = stk_callback.get("CallbackMetadata", {}).get("Item", [])
                for item in items:
                    name, value = item.get("Name"), item.get("Value")
                    if name == "Amount":
                        transaction_data["amount"] = float(value)
                    elif name == "MpesaReceiptNumber":
                        transaction_data["transactionId"] = value
                    elif name == "PhoneNumber":
                        transaction_data["phoneNumber"] = value
                
                transaction_data.update({
                    "transactionType": "stk_push",  # Map to schema enum value
                    "status": "completed",
                    "resultCode": stk_callback.get("ResultCode"),
                    "merchantRequestId": stk_callback.get("MerchantRequestID"),
                    "checkoutRequestId": stk_callback.get("CheckoutRequestID"),
                    "paymentMethod": "mpesa"
                })
            else:
                transaction_data.update({
                    "transactionType": "stk_push",  # Map to schema enum value
                    "status": "failed",
                    "resultCode": stk_callback.get("ResultCode"),
                    "merchantRequestId": stk_callback.get("MerchantRequestID"),
                    "checkoutRequestId": stk_callback.get("CheckoutRequestID")
                })
        
        elif callback_type == "c2b":
            # Check if transaction already exists
            existing_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "transactionId": payload.get("TransID")
            })
            
            if existing_transaction:
                logger.info(f"Transaction already exists for C2B: {payload.get('TransID')}")
                return
            
            # Map Mpesa transaction type to schema enum value
            mpesa_transaction_type = payload.get("TransactionType", "").lower()
            if mpesa_transaction_type == "pay bill":
                transaction_type = "c2b"
            else:
                transaction_type = "customer_payment"  # Default to customer_payment for other C2B types
            
            field_mappings = {
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
            
            transaction_data.update({
                "transactionType": transaction_type,  # Use mapped transaction type
                "status": "completed",
                "paymentMethod": "mpesa"
            })
        
        elif callback_type == "hotspot_voucher":
            # For hotspot vouchers, we don't need to check for duplicates
            # as they are created during the voucher activation process
            return
        
        # Insert the transaction
        result = await isp_mpesa_transactions.insert_one(transaction_data)
        logger.info(f"Stored transaction with ID: {result.inserted_id}")
        
    except Exception as e:
        logger.error(f"Error storing Mpesa transaction: {str(e)}")
        logger.exception("Full traceback:")

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
            logger.info(f"=== STARTING PAYMENT CONFIRMATION SMS PROCESS ===")
            logger.info(f"Organization ID: {organization_id}")
            logger.info(f"Customer Username: {username}")
            
            org = await organizations.find_one({"_id": ObjectId(organization_id)})
            org_name = org.get("name", "Provider") if org else "Provider"
            paybill_number = None
            if org and org.get("mpesaConfig"):
                paybill_number = org["mpesaConfig"].get("shortCode")
            
            logger.info(f"Organization Name: {org_name}")
            logger.info(f"Paybill Number: {paybill_number}")

            template_result = await SmsTemplateService.list_templates(
                organization_id=organization_id,
                category=TemplateCategory.PAYMENT_CONFIRMATION,
                is_active=True
            )
            logger.info(f"Template Result: {json.dumps(template_result, default=str)}")
            
            template_doc = None
            if template_result.get("success") and template_result.get("templates"):
                template_doc = template_result["templates"][0]
                logger.info(f"Found Template: {json.dumps(template_doc, default=str)}")
            else:
                logger.error("No active payment confirmation template found")
                
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
                logger.info(f"SMS Variables: {json.dumps(sms_vars, default=str)}")
                
                message = SmsTemplateService.render_template(template_doc["content"], sms_vars)
                logger.info(f"Rendered Message: {message}")
                
                customer_phone = customer.get("phone")
                logger.info(f"Customer Phone: {customer_phone}")
                
                if not customer_phone:
                    logger.error("Customer phone number is missing")
                else:
                    sms_result = await send_sms_for_organization(
                        organization_id=organization_id,
                        to=customer_phone,
                        message=message
                    )
                    logger.info(f"SMS Send Result: {json.dumps(sms_result, default=str)}")
            else:
                logger.error("Template document is missing")
        except Exception as sms_exc:
            logger.error(f"Failed to send payment confirmation SMS: {str(sms_exc)}")
            logger.exception("Full traceback:")

        return True
        
    except Exception as e:
        logger.error(f"Error processing customer payment: {str(e)}")
        return False

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

            # Store detailed transaction data
            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "callbackType": "hotspot_voucher",
                "createdAt": now,
                "updatedAt": now,
                "transactionId": transaction_id,
                "amount": amount,
                "voucherCode": voucher_code,
                "packageId": voucher["packageId"],
                "packageName": package.get("name", ""),
                "duration": package.get("duration", 0),
                "dataLimit": package.get("dataLimit", 0),
                "phoneNumber": voucher.get("phoneNumber"),
                "status": "completed",
                "paymentMethod": "mpesa",
                "expiresAt": voucher.get("expiresAt")
            }
            
            await isp_mpesa_transactions.insert_one(transaction_data)
            logger.info(f"Stored detailed transaction data for voucher {voucher_code}")
            
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
                    sms_vars = {
                        "firstName": "Customer",  # Since we don't have customer name for hotspot users
                        "voucherCode": voucher_code,
                        "organizationName": org.get("name", "Provider"),
                        "packageName": package.get("name", ""),
                        "expirationDate": expiry_str,
                        "amountPaid": amount,
                        "dataLimit": package.get("dataLimit", "Unlimited"),
                        "duration": f"{package.get('duration', 0)} days"
                    }
                    
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
        environment = mpesa_config.get("environment", "sandbox")
        
        if not all([shortcode, passkey, consumer_key, consumer_secret]):
            raise HTTPException(status_code=400, detail="Missing required Mpesa configuration")
        
        access_token = await MpesaService.get_access_token(consumer_key, consumer_secret, environment)
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((shortcode + passkey + timestamp).encode()).decode()
        
        # Generate callback URL using the utility function
        callback_url = mpesa_config.get("stkPushCallbackUrl") or MpesaService.generate_callback_url(organization_id, "stk_push")
        
        logger.info(f"=== STK PUSH CALLBACK URL ===")
        logger.info(f"Using callback URL: {callback_url}")
        
        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(float(amount)),
            "PartyA": phone_number,
            "PartyB": shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": data.get("accountReference") or mpesa_config.get("accountReference") or "Account",
            "TransactionDesc": data.get("transactionDesc", "Payment")
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"=== STK PUSH REQUEST ===")
        logger.info(f"Organization ID: {organization_id}")
        logger.info(f"Phone Number: {phone_number}")
        logger.info(f"Amount: {amount}")
        logger.info(f"Environment: {environment}")
        logger.info(f"Request URL: {MPESA_URLS[environment]['stk_push']}")
        logger.info(f"Request Headers: {json.dumps(headers, indent=2)}")
        logger.info(f"Request Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(MPESA_URLS[environment]["stk_push"], json=payload, headers=headers)
        
        logger.info(f"=== STK PUSH RESPONSE ===")
        logger.info(f"Status Code: {response.status_code}")
        try:
            response_json = response.json()
            logger.info(f"Response Body: {json.dumps(response_json, indent=2)}")
        except:
            logger.error(f"Failed to parse response as JSON: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Store transaction information
            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "phoneNumber": phone_number,
                "amount": amount,
                "merchantRequestId": result.get("MerchantRequestID"),
                "checkoutRequestId": result.get("CheckoutRequestID"),
                "status": "pending",
                "createdAt": datetime.now(timezone.utc),
                "callbackUrl": callback_url  # Store the callback URL for reference
            }
            await isp_mpesa_transactions.insert_one(transaction_data)
            
            logger.info(f"=== STK PUSH TRANSACTION STORED ===")
            logger.info(f"Transaction Data: {json.dumps(transaction_data, default=str, indent=2)}")
            
            return {
                "success": True,
                "message": "STK push initiated",
                "merchantRequestId": result.get("MerchantRequestID"),
                "checkoutRequestId": result.get("CheckoutRequestID")
            }
        else:
            error_msg = response.text
            try:
                error_data = response.json()
                error_msg = error_data.get("errorMessage", error_msg)
            except:
                pass
            logger.error(f"Failed to initiate STK push: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Failed to initiate STK push: {error_msg}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating STK push: {str(e)}")
        logger.exception("Full traceback:")
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
