from fastapi import APIRouter, Request, HTTPException, Depends
from app.config.database import organizations, isp_mpesa_transactions, isp_customers, isp_packages, isp_customer_payments
from bson.objectid import ObjectId
import logging
from datetime import datetime, timezone, timedelta
from app.config.deps import get_current_user
from app.services.sms.template import SmsTemplateService
from app.services.sms.utils import send_sms_for_organization
from app.schemas.sms_template import TemplateCategory
from app.config.database import organizations
from typing import Dict, Any, Optional, Tuple
import json
import requests
import base64
from app.config.settings import settings
from app.config.utils import record_activity
from app.schemas.enums import OrganizationPermission, IspManagerCustomerStatus

router = APIRouter()
logger = logging.getLogger(__name__)

# Mpesa API endpoints
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
    
    # Get organization ID from path
    organization_id = request.path_params.get("organization_id")
    if not organization_id:
        raise HTTPException(status_code=400, detail="Missing organization ID")
    
    # Get organization
    org = await organizations.find_one({"_id": ObjectId(organization_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Check if user is a member of the organization
    user_member = next((m for m in org.get("members", []) if m.get("userId") == user.id), None)
    if not user_member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    # Check permission if required
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
            "Authorization": f"Basic {auth_string}"
        }
        
        response = requests.get(auth_url, headers=headers)
        
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            logger.error(f"Failed to get Mpesa access token: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Error getting Mpesa access token: {str(e)}")
        return None

async def register_c2b_urls(organization_id: str, shortcode: str, 
                           access_token: str = None, environment: str = "sandbox") -> bool:
    """Register C2B URLs for a given shortcode"""
    try:
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org or not org.get("mpesaConfig"):
            logger.error(f"Invalid organization or missing Mpesa config for ID: {organization_id}")
            return False
        
        mpesa_config = org["mpesaConfig"]
        
        # Get access token if not provided
        if not access_token:
            consumer_key = mpesa_config.get("consumerKey")
            consumer_secret = mpesa_config.get("consumerSecret")
            
            if not consumer_key or not consumer_secret:
                logger.error("Missing consumer key or secret for Mpesa API")
                return False
            
            access_token = await get_mpesa_access_token(consumer_key, consumer_secret, environment)
            
            if not access_token:
                return False
        
        # Generate minimal required callback URLs
        # Ensure the API_URL is properly formatted with http/https
        api_url = settings.API_URL
        if not api_url.startswith(('http://', 'https://')):
            api_url = f"https://{api_url}"
        
        callback_url = f"{api_url}/api/isp-customer-payments/callback/{organization_id}/c2b"
        validation_url = f"{api_url}/api/isp-customer-payments/validate"
        
        # Ensure URLs are properly formatted
        if not validation_url.startswith(('http://', 'https://')):
            validation_url = f"https://{validation_url}"
        
        if not callback_url.startswith(('http://', 'https://')):
            callback_url = f"https://{callback_url}"
        
        payload = {
            "ShortCode": shortcode,
            "ResponseType": "Completed",
            "ConfirmationURL": callback_url,
            "ValidationURL": validation_url
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Registering C2B URLs for shortcode {shortcode}")
        logger.info(f"Validation URL: {validation_url}")
        logger.info(f"Confirmation URL: {callback_url}")
        
        response = requests.post(MPESA_URLS[environment]["register_c2b_url"], json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("ResponseCode") == "0":
                logger.info(f"Successfully registered C2B URLs for shortcode {shortcode}")
                
                # Store minimal required data
                update_data = {
                    "mpesaConfig.c2bCallbackUrl": callback_url,
                    "mpesaConfig.validationUrl": validation_url,
                    "mpesaConfig.callbacksRegistered": True,
                    "mpesaConfig.updatedAt": datetime.now(timezone.utc)
                }
                
                await organizations.update_one(
                    {"_id": ObjectId(organization_id)},
                    {"$set": update_data}
                )
                
                return True
            else:
                logger.error(f"Failed to register C2B URLs: {result}")
                return False
        else:
            logger.error(f"Failed to register C2B URLs: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Error registering C2B URLs: {str(e)}")
        return False

@router.post("/register-callbacks/{organization_id}")
async def register_callbacks_for_organization(organization_id: str, request: Request):
    """Register all callback URLs for an organization"""
    try:
        # Authenticate user and verify permissions
        user, org, _ = await authenticate_user(request, OrganizationPermission.MANAGE_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]
        
        # Check required fields
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
        
        # Get access token
        environment = mpesa_config.get("environment", "sandbox")
        access_token = await get_mpesa_access_token(
            mpesa_config["consumerKey"],
            mpesa_config["consumerSecret"],
            environment
        )
        
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        # Register C2B URLs
        c2b_success = await register_c2b_urls(
            organization_id,
            mpesa_config["shortCode"],
            access_token,
            environment
        )
        
        if c2b_success:
            # Record activity
            await record_activity(
                user.id,
                ObjectId(organization_id),
                "registered Mpesa callbacks"
            )
            
            # Get updated configuration
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
        # Verify organization exists
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            logger.error(f"Organization {organization_id} not found for Mpesa callback")
            return
        
        # Extract and store minimal transaction data
        transaction_data = {
            "organizationId": ObjectId(organization_id),
            "callbackType": callback_type,
            "createdAt": datetime.now(timezone.utc)
        }
        
        # Add essential fields based on callback type
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
            # Store all fields from the C2B payload
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
                    # Convert amount to float if it's the TransAmount field
                    if mpesa_key == "TransAmount":
                        transaction_data[db_key] = float(payload.get(mpesa_key))
                    else:
                        transaction_data[db_key] = payload.get(mpesa_key)
            
            # Add updatedAt field
            transaction_data["updatedAt"] = datetime.now(timezone.utc)
        
        # Store the data
        await isp_mpesa_transactions.insert_one(transaction_data)
        
    except Exception as e:
        logger.error(f"Error storing Mpesa transaction: {str(e)}")

@router.post("/callback/{organization_id}/{callback_type}")
async def mpesa_callback(organization_id: str, callback_type: str, request: Request):
    """Universal callback handler for all Mpesa callback types"""
    try:
        # Log the callback
        payload = await request.json()
        logger.info(f"Received Mpesa {callback_type} callback for organization {organization_id}")
        logger.info(f"Callback payload: {payload}")
        
        # Process and store essential transaction data
        await store_transaction(organization_id, callback_type, payload)
        
        # Process customer payment if this is a C2B transaction
        if callback_type == "c2b":
            try:
                # Extract account reference (which should be customer username)
                account_ref = payload.get("BillRefNumber")
                amount = payload.get("TransAmount")
                phone = payload.get("MSISDN")
                trans_id = payload.get("TransID")
                
                if account_ref and amount:
                    success = await process_customer_payment(
                        organization_id=organization_id,
                        username=account_ref,
                        amount=float(amount),
                        phone=phone,
                        transaction_id=trans_id
                    )
                    
                    if success:
                        logger.info(f"Successfully processed customer payment for {account_ref}")
                    else:
                        logger.error(f"Failed to process customer payment for {account_ref}")
            except Exception as e:
                logger.error(f"Error processing customer payment: {str(e)}")
                # Don't fail the callback, still return success to M-Pesa
        
        # Return success response
        return {"ResultCode": 0, "ResultDesc": "Accepted"}
    except Exception as e:
        logger.error(f"Error processing Mpesa {callback_type} callback: {str(e)}")
        return {"ResultCode": 1, "ResultDesc": "Rejected"}

async def process_customer_payment(organization_id: str, username: str, amount: float, phone: str = None, transaction_id: str = None) -> bool:
    """Process a payment from a customer and update their subscription
    
    Args:
        organization_id: The organization ID
        username: The customer's username used as account reference
        amount: The payment amount
        phone: Customer's phone number (optional)
        transaction_id: M-Pesa transaction ID (optional)
        
    Returns:
        bool: True if payment was processed successfully
    """
    try:
        # Find the customer by username
        customer = await isp_customers.find_one({
            "organizationId": ObjectId(organization_id),
            "username": username
        })
        
        if not customer:
            logger.error(f"Customer with username {username} not found in organization {organization_id}")
            return False
        
        # Find the customer's package
        package = await isp_packages.find_one({"_id": customer.get("packageId")})
        if not package:
            logger.error(f"Package not found for customer {username}")
            return False
        
        # Calculate new expiration date
        now = datetime.now(timezone.utc)
        current_expiry = customer.get("expirationDate")
        
        # Normalize to UTC if it's not already
        if current_expiry and not current_expiry.tzinfo:
            current_expiry = current_expiry.replace(tzinfo=timezone.utc)
            
        base_date = current_expiry if current_expiry and current_expiry > now else now
        
        # Calculate the subscription duration based on payment amount and package price
        package_price = package.get("price", 0)
        if package_price <= 0:
            logger.error(f"Invalid package price {package_price} for customer {username}")
            return False
        
        # --- Custom logic for isNew and initialAmount ---
        is_new = customer.get("isNew", True)
        initial_amount = customer.get("initialAmount", 0.0)
        days_to_add = 0
        used_amount = amount
        
        if is_new:
            if amount == initial_amount:
                # Standard calculation
                duration_paid = amount / package_price
                days_to_add = int(30 * duration_paid)
            else:
                # Subtract package price from initial amount to get remainder
                remainder = initial_amount - package_price
                if remainder < 0:
                    remainder = 0
                # Subtract remainder from paid amount
                used_amount = amount - remainder
                if used_amount < 0:
                    used_amount = 0
                duration_paid = used_amount / package_price
                days_to_add = int(30 * duration_paid)
            # After first payment, set isNew to False
            await isp_customers.update_one(
                {"_id": customer["_id"]},
                {"$set": {"isNew": False}}
            )
        else:
            # Standard calculation for existing customers
            duration_paid = amount / package_price
            days_to_add = int(30 * duration_paid)
        
        # Calculate new expiration date
        new_expiry = base_date + timedelta(days=days_to_add)
        
        # Update the customer record
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
        
        # Create a payment record in the isp_customer_payments collection
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
        
        # Record activity
        await record_activity(
            None,  # System-generated activity
            ObjectId(organization_id),
            f"Payment of {amount} received for customer {username}, subscription extended by {days_to_add} days"
        )
        
        logger.info(f"Updated subscription for customer {username}: active until {new_expiry}")

        # --- Send payment confirmation SMS ---
        try:
           

            # Fetch organization for SMS context
            org = await organizations.find_one({"_id": ObjectId(organization_id)})
            org_name = org.get("name", "Provider") if org else "Provider"
            paybill_number = None
            if org and org.get("mpesaConfig"):
                paybill_number = org["mpesaConfig"].get("shortCode")

            # Fetch payment confirmation template
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

@router.get("/callback-status/{organization_id}")
async def check_callback_status(organization_id: str, request: Request):
    """Check the registration status of Mpesa callbacks for an organization"""
    try:
        # Authenticate user and verify permissions
        _, org, _ = await authenticate_user(request, OrganizationPermission.VIEW_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]
        
        # Return only essential information
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
        # Authenticate user and verify permissions
        user, org, _ = await authenticate_user(request, OrganizationPermission.MANAGE_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]
        
        # Check if Mpesa is enabled
        if not mpesa_config.get("isActive"):
            raise HTTPException(status_code=400, detail="Mpesa integration not enabled")
            
        # Get request data
        data = await request.json()
        phone_number = data.get("phoneNumber")
        amount = data.get("amount")
        
        if not phone_number or not amount:
            raise HTTPException(status_code=400, detail="Phone number and amount required")
        
        # Format phone number (remove leading zero and add country code if needed)
        if phone_number.startswith("0"):
            phone_number = "254" + phone_number[1:]
        elif not phone_number.startswith("254"):
            phone_number = "254" + phone_number
        
        # Get required configuration
        shortcode = mpesa_config.get("stkPushShortCode") or mpesa_config.get("shortCode")
        passkey = mpesa_config.get("stkPushPassKey") or mpesa_config.get("passKey")
        consumer_key = mpesa_config.get("consumerKey")
        consumer_secret = mpesa_config.get("consumerSecret")
        callback_url = mpesa_config.get("c2bCallbackUrl")
        environment = mpesa_config.get("environment", "sandbox")
        
        if not all([shortcode, passkey, consumer_key, consumer_secret]):
            raise HTTPException(status_code=400, detail="Missing required Mpesa configuration")
        
        # Get access token
        access_token = await get_mpesa_access_token(consumer_key, consumer_secret, environment)
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to obtain Mpesa access token")
        
        # Generate timestamp and password
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((shortcode + passkey + timestamp).encode()).decode()
        
        # Prepare minimal payload
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
        
        # Make API request
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(MPESA_URLS[environment]["stk_push"], json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            
            # Store minimal transaction information
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
        # Log the validation request
        payload = await request.json()
        logger.info(f"Received Mpesa validation request for organization {organization_id}")
        logger.info(f"Validation payload: {payload}")
        
        # For validation, we just need to return a success response
        # The actual transaction processing happens in the confirmation callback
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

@router.post("/validate")
async def mpesa_validate(request: Request):
    """Simple validation endpoint for M-Pesa that always returns success"""
    try:
        # Log the validation request
        payload = await request.json()
        logger.info(f"Received Mpesa validation request")
        logger.info(f"Validation payload: {payload}")
        
        # For validation, we just need to return a success response
        # The actual transaction processing happens in the confirmation callback
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