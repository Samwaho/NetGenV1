from fastapi import APIRouter, Request, HTTPException, Depends
from app.config.database import organizations, isp_mpesa_transactions, isp_customers, isp_packages, isp_customer_payments, hotspot_vouchers
from bson.objectid import ObjectId
import logging
from datetime import datetime, timezone, timedelta
from app.config.deps import get_current_user
from app.services.sms.template import SmsTemplateService
from app.services.sms.utils import send_sms_for_organization
from app.schemas.sms_template import TemplateCategory
from app.schemas.isp_transactions import TransactionType, TransactionStatus
from typing import Dict, Any, Optional, Tuple, List
import json
import requests
import base64
from app.config.settings import settings
from app.config.utils import record_activity
from app.schemas.enums import OrganizationPermission, IspManagerCustomerStatus
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# Centralized Mpesa Configuration
class MpesaConfig:
    URLS = {
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

    SANDBOX_CREDENTIALS = {
        "shortcode": "174379",
        "passkey": "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
    }

    @staticmethod
    def get_urls(environment: str = "sandbox") -> Dict[str, str]:
        return MpesaConfig.URLS.get(environment, MpesaConfig.URLS["sandbox"])

    @staticmethod
    def validate_sandbox_credentials(shortcode: str, passkey: str) -> Tuple[str, str]:
        if shortcode != MpesaConfig.SANDBOX_CREDENTIALS["shortcode"]:
            logger.warning(f"Invalid sandbox shortcode: {shortcode}, using default")
            shortcode = MpesaConfig.SANDBOX_CREDENTIALS["shortcode"]
        if passkey != MpesaConfig.SANDBOX_CREDENTIALS["passkey"]:
            logger.warning("Invalid sandbox passkey, using default")
            passkey = MpesaConfig.SANDBOX_CREDENTIALS["passkey"]
        return shortcode, passkey

class MpesaService:
    @staticmethod
    async def get_access_token(consumer_key: str, consumer_secret: str, environment: str = "sandbox") -> str:
        """Get Mpesa access token using consumer key and secret"""
        try:
            auth_url = MpesaConfig.get_urls(environment)["auth"]
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
            c2b_response = requests.post(MpesaConfig.get_urls(environment)["register_c2b_url"], json=c2b_payload, headers=headers)
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

class MpesaErrorHandler:
    """Enhanced error handling for M-Pesa operations"""

    # M-Pesa error codes and their meanings
    ERROR_CODES = {
        "0": "Success",
        "1": "Insufficient Funds",
        "2": "Less Than Minimum Transaction Value",
        "3": "More Than Maximum Transaction Value",
        "4": "Would Exceed Daily Transfer Limit",
        "5": "Would Exceed Minimum Balance",
        "6": "Unresolved Primary Party",
        "7": "Unresolved Receiver Party",
        "8": "Would Exceed Maximum Balance",
        "11": "Debit Account Invalid",
        "12": "Credit Account Invalid",
        "13": "Unresolved Debit Account",
        "14": "Unresolved Credit Account",
        "15": "Duplicate Detected",
        "17": "Internal Failure",
        "20": "Unresolved Initiator",
        "26": "Traffic blocking condition in place",
        "1001": "Invalid Phone Number",
        "1019": "Timeout",
        "1032": "Request cancelled by user",
        "1037": "DS timeout user cannot be reached",
        "2001": "Invalid Amount",
        "9999": "Request timeout"
    }

    @staticmethod
    def get_error_message(error_code: str) -> str:
        """Get human-readable error message for M-Pesa error code"""
        return MpesaErrorHandler.ERROR_CODES.get(str(error_code), f"Unknown error code: {error_code}")

    @staticmethod
    def is_retryable_error(error_code: str) -> bool:
        """Check if an error is retryable"""
        retryable_codes = ["17", "1019", "9999", "26"]  # Internal failure, timeout, traffic blocking
        return str(error_code) in retryable_codes

    @staticmethod
    def handle_stk_push_error(result_code: int, result_desc: str) -> Dict[str, Any]:
        """Handle STK Push errors with appropriate response"""
        error_message = MpesaErrorHandler.get_error_message(str(result_code))
        is_retryable = MpesaErrorHandler.is_retryable_error(str(result_code))

        return {
            "success": False,
            "error_code": result_code,
            "error_message": error_message,
            "original_description": result_desc,
            "is_retryable": is_retryable,
            "user_message": MpesaErrorHandler._get_user_friendly_message(result_code)
        }

    @staticmethod
    def _get_user_friendly_message(result_code: int) -> str:
        """Get user-friendly error message"""
        user_messages = {
            1: "Insufficient funds in your M-Pesa account. Please top up and try again.",
            1001: "Invalid phone number. Please check and try again.",
            1032: "Transaction was cancelled. Please try again.",
            1037: "Unable to reach your phone. Please ensure your phone is on and try again.",
            2001: "Invalid amount. Please check the amount and try again.",
            1019: "Transaction timed out. Please try again.",
            9999: "Transaction timed out. Please try again."
        }
        return user_messages.get(result_code, "Transaction failed. Please try again or contact support.")

class MpesaRetryService:
    """Service for handling M-Pesa transaction retries"""

    @staticmethod
    async def schedule_retry(transaction_id: str, retry_count: int = 0, max_retries: int = 3) -> bool:
        """Schedule a retry for a failed transaction"""
        try:
            if retry_count >= max_retries:
                logger.info(f"Max retries reached for transaction {transaction_id}")
                return False

            transaction = await isp_mpesa_transactions.find_one({"_id": ObjectId(transaction_id)})
            if not transaction:
                logger.error(f"Transaction not found for retry: {transaction_id}")
                return False

            # Only retry if the error is retryable
            if not transaction.get("isRetryable", False):
                logger.info(f"Transaction {transaction_id} is not retryable")
                return False

            # Update transaction with retry information
            await isp_mpesa_transactions.update_one(
                {"_id": ObjectId(transaction_id)},
                {
                    "$set": {
                        "retryCount": retry_count + 1,
                        "lastRetryAt": datetime.now(timezone.utc),
                        "status": TransactionStatus.PENDING.value
                    }
                }
            )

            logger.info(f"Scheduled retry {retry_count + 1} for transaction {transaction_id}")
            return True

        except Exception as e:
            logger.error(f"Error scheduling retry for transaction {transaction_id}: {str(e)}")
            return False

    @staticmethod
    async def get_failed_retryable_transactions(organization_id: str) -> List[Dict[str, Any]]:
        """Get failed transactions that can be retried"""
        try:
            cursor = isp_mpesa_transactions.find({
                "organizationId": ObjectId(organization_id),
                "status": TransactionStatus.FAILED.value,
                "isRetryable": True,
                "retryCount": {"$lt": 3}
            })

            return await cursor.to_list(None)

        except Exception as e:
            logger.error(f"Error getting retryable transactions: {str(e)}")
            return []

class TransactionValidationService:
    """Service for validating M-Pesa transactions"""

    @staticmethod
    def validate_phone_number(phone: str) -> bool:
        """Validate Kenyan phone number format"""
        if not phone:
            return False

        # Remove any spaces or special characters
        phone = phone.replace(" ", "").replace("-", "").replace("+", "")

        # Check if it's a valid Kenyan number
        if phone.startswith("254"):
            return len(phone) == 12 and phone[3:].isdigit()
        elif phone.startswith("0"):
            return len(phone) == 10 and phone[1:].isdigit()
        else:
            # Assume it's a local number without country code
            return len(phone) == 9 and phone.isdigit()

    @staticmethod
    def validate_amount(amount: Any) -> bool:
        """Validate transaction amount"""
        try:
            amount_float = float(amount)
            return 1 <= amount_float <= 70000  # M-Pesa limits
        except (ValueError, TypeError):
            return False

    @staticmethod
    def validate_stk_push_payload(payload: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate STK Push callback payload"""
        try:
            body = payload.get("Body", {})
            stk_callback = body.get("stkCallback", {})

            # Check required fields
            required_fields = ["MerchantRequestID", "CheckoutRequestID", "ResultCode"]
            for field in required_fields:
                if field not in stk_callback:
                    return False, f"Missing required field: {field}"

            # Validate result code
            result_code = stk_callback.get("ResultCode")
            if not isinstance(result_code, int):
                return False, "Invalid ResultCode format"

            # If successful, validate callback metadata
            if result_code == 0:
                metadata = stk_callback.get("CallbackMetadata", {})
                items = metadata.get("Item", [])

                required_items = ["Amount", "MpesaReceiptNumber", "PhoneNumber"]
                found_items = {item.get("Name") for item in items if item.get("Name")}

                for required_item in required_items:
                    if required_item not in found_items:
                        return False, f"Missing callback metadata item: {required_item}"

                # Validate specific values
                for item in items:
                    name = item.get("Name")
                    value = item.get("Value")

                    if name == "Amount" and not TransactionValidationService.validate_amount(value):
                        return False, "Invalid amount in callback"
                    elif name == "PhoneNumber" and not TransactionValidationService.validate_phone_number(str(value)):
                        return False, "Invalid phone number in callback"
                    elif name == "MpesaReceiptNumber" and not value:
                        return False, "Missing M-Pesa receipt number"

            return True, "Valid"

        except Exception as e:
            return False, f"Validation error: {str(e)}"

    @staticmethod
    def validate_c2b_payload(payload: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate C2B callback payload"""
        try:
            required_fields = ["TransID", "TransAmount", "MSISDN", "BillRefNumber"]
            for field in required_fields:
                if field not in payload:
                    return False, f"Missing required field: {field}"

            # Validate amount
            if not TransactionValidationService.validate_amount(payload.get("TransAmount")):
                return False, "Invalid transaction amount"

            # Validate phone number
            if not TransactionValidationService.validate_phone_number(payload.get("MSISDN")):
                return False, "Invalid phone number"

            # Validate transaction ID
            if not payload.get("TransID"):
                return False, "Missing transaction ID"

            return True, "Valid"

        except Exception as e:
            return False, f"Validation error: {str(e)}"

class TransactionReconciliationService:
    """Service for reconciling and managing M-Pesa transactions"""

    @staticmethod
    async def reconcile_stk_transaction(organization_id: str, merchant_request_id: str, checkout_request_id: str) -> Optional[Dict[str, Any]]:
        """Reconcile an STK Push transaction by checking its current status"""
        try:
            transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "merchantRequestId": merchant_request_id,
                "checkoutRequestId": checkout_request_id
            })

            if not transaction:
                logger.error(f"Transaction not found for reconciliation: {merchant_request_id}")
                return None

            # Check if transaction is still pending after reasonable time (e.g., 10 minutes)
            created_at = transaction.get("createdAt")
            if created_at:
                time_elapsed = datetime.now(timezone.utc) - created_at
                if time_elapsed > timedelta(minutes=10) and transaction.get("status") == TransactionStatus.PENDING.value:
                    # Mark as failed due to timeout
                    await isp_mpesa_transactions.update_one(
                        {"_id": transaction["_id"]},
                        {
                            "$set": {
                                "status": TransactionStatus.FAILED.value,
                                "failureReason": "Transaction timeout - no callback received",
                                "updatedAt": datetime.now(timezone.utc)
                            }
                        }
                    )
                    logger.info(f"Marked transaction as failed due to timeout: {merchant_request_id}")

            return transaction

        except Exception as e:
            logger.error(f"Error reconciling transaction: {str(e)}")
            return None

    @staticmethod
    async def cleanup_duplicate_transactions(organization_id: str) -> int:
        """Clean up duplicate transactions for an organization"""
        try:
            # Find duplicate STK Push transactions (same merchantRequestId)
            pipeline = [
                {"$match": {"organizationId": ObjectId(organization_id), "transactionType": TransactionType.STK_PUSH.value}},
                {"$group": {
                    "_id": "$merchantRequestId",
                    "count": {"$sum": 1},
                    "docs": {"$push": "$$ROOT"}
                }},
                {"$match": {"count": {"$gt": 1}}}
            ]

            duplicates = await isp_mpesa_transactions.aggregate(pipeline).to_list(None)
            cleaned_count = 0

            for duplicate_group in duplicates:
                docs = duplicate_group["docs"]
                # Keep the most recent one, delete others
                docs.sort(key=lambda x: x.get("createdAt", datetime.min), reverse=True)
                keep_doc = docs[0]

                for doc in docs[1:]:
                    await isp_mpesa_transactions.delete_one({"_id": doc["_id"]})
                    cleaned_count += 1
                    logger.info(f"Removed duplicate transaction: {doc['_id']}")

            return cleaned_count

        except Exception as e:
            logger.error(f"Error cleaning up duplicate transactions: {str(e)}")
            return 0

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

        # Validate payload based on callback type
        if callback_type == "stk_push":
            is_valid, validation_message = TransactionValidationService.validate_stk_push_payload(payload)
            if not is_valid:
                logger.error(f"Invalid STK Push payload: {validation_message}")
                return {"ResultCode": 1, "ResultDesc": f"Invalid payload: {validation_message}"}
        elif callback_type == "c2b":
            is_valid, validation_message = TransactionValidationService.validate_c2b_payload(payload)
            if not is_valid:
                logger.error(f"Invalid C2B payload: {validation_message}")
                return {"ResultCode": 1, "ResultDesc": f"Invalid payload: {validation_message}"}

        # Store transaction data first
        transaction_id = await store_transaction(organization_id, callback_type, payload)
        
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
    """Store essential Mpesa transaction data following ISPTransaction schema with deduplication"""
    try:
        org = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            logger.error(f"Organization {organization_id} not found for Mpesa callback")
            return

        now = datetime.now(timezone.utc)

        if callback_type == "stk_push":
            body = payload.get("Body", {})
            stk_callback = body.get("stkCallback", {})

            merchant_request_id = stk_callback.get("MerchantRequestID")
            checkout_request_id = stk_callback.get("CheckoutRequestID")
            result_code = stk_callback.get("ResultCode")

            if not merchant_request_id or not checkout_request_id:
                logger.error("Missing required STK Push identifiers")
                return

            # Extract transaction details from callback
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

            # Find existing pending transaction and update it
            existing_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "merchantRequestId": merchant_request_id,
                "checkoutRequestId": checkout_request_id
            })

            if existing_transaction:
                # Update existing transaction with callback data
                update_data = {
                    "updatedAt": now,
                    "status": TransactionStatus.COMPLETED.value if result_code == 0 else TransactionStatus.FAILED.value,
                    "callbackReceivedAt": now
                }

                # Only update these fields if the transaction was successful
                if result_code == 0 and amount and mpesa_receipt and phone:
                    update_data.update({
                        "amount": amount,
                        "transactionId": mpesa_receipt,
                        "phoneNumber": phone,
                        "mpesaReceiptNumber": mpesa_receipt
                    })
                elif result_code != 0:
                    # Store failure reason with enhanced error handling
                    error_info = MpesaErrorHandler.handle_stk_push_error(result_code, stk_callback.get("ResultDesc", ""))
                    update_data["failureReason"] = error_info["error_message"]
                    update_data["errorCode"] = result_code
                    update_data["isRetryable"] = error_info["is_retryable"]

                await isp_mpesa_transactions.update_one(
                    {"_id": existing_transaction["_id"]},
                    {"$set": update_data}
                )
                logger.info(f"Updated existing STK Push transaction: {merchant_request_id}")
                return existing_transaction["_id"]
            else:
                # Create new transaction record (this shouldn't happen for STK callbacks)
                logger.warning(f"No existing transaction found for STK callback: {merchant_request_id}")
                transaction_data = {
                    "organizationId": ObjectId(organization_id),
                    "transactionType": TransactionType.STK_PUSH.value,
                    "callbackType": "stk_push",
                    "status": TransactionStatus.COMPLETED.value if result_code == 0 else TransactionStatus.FAILED.value,
                    "merchantRequestId": merchant_request_id,
                    "checkoutRequestId": checkout_request_id,
                    "createdAt": now,
                    "updatedAt": now,
                    "callbackReceivedAt": now,
                    "paymentMethod": "mpesa"
                }

                if result_code == 0 and amount and mpesa_receipt and phone:
                    transaction_data.update({
                        "amount": amount,
                        "transactionId": mpesa_receipt,
                        "phoneNumber": phone,
                        "mpesaReceiptNumber": mpesa_receipt
                    })
                elif result_code != 0:
                    transaction_data["failureReason"] = stk_callback.get("ResultDesc", "Transaction failed")

                result = await isp_mpesa_transactions.insert_one(transaction_data)
                logger.info(f"Created new STK Push transaction: {result.inserted_id}")
                return result.inserted_id

        elif callback_type == "c2b":
            transaction_id = payload.get("TransID")
            if not transaction_id:
                logger.error("Missing TransID in C2B callback")
                return

            # Check for existing transaction using unique M-Pesa transaction ID
            existing_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "transactionId": transaction_id
            })

            if existing_transaction:
                logger.info(f"C2B transaction already exists: {transaction_id}")
                return existing_transaction["_id"]

            # Map Mpesa transaction type to schema enum value
            mpesa_transaction_type = payload.get("TransactionType", "").lower()
            transaction_type = TransactionType.C2B.value if mpesa_transaction_type == "pay bill" else TransactionType.CUSTOMER_PAYMENT.value

            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "transactionType": transaction_type,
                "callbackType": "c2b",
                "status": TransactionStatus.COMPLETED.value,
                "transactionId": transaction_id,
                "createdAt": now,
                "updatedAt": now,
                "paymentMethod": "mpesa"
            }

            # Map all C2B fields
            field_mappings = {
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

            result = await isp_mpesa_transactions.insert_one(transaction_data)
            logger.info(f"Stored new C2B transaction: {result.inserted_id}")
            return result.inserted_id

        elif callback_type == "hotspot_voucher":
            # For hotspot vouchers, we don't store separate transaction records
            # The transaction is already handled in the STK Push callback
            logger.info("Hotspot voucher callback - transaction already handled in STK Push")
            return

    except Exception as e:
        logger.error(f"Error storing Mpesa transaction: {str(e)}")
        logger.exception("Full traceback:")
        return None

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
    """Initiate STK Push request for a customer with idempotency support"""
    try:
        user, org, _ = await authenticate_user(request, OrganizationPermission.MANAGE_MPESA_CONFIG)
        mpesa_config = org["mpesaConfig"]

        if not mpesa_config.get("isActive"):
            raise HTTPException(status_code=400, detail="Mpesa integration not enabled")

        data = await request.json()
        phone_number = data.get("phoneNumber")
        amount = data.get("amount")
        idempotency_key = data.get("idempotencyKey")  # Optional idempotency key

        if not phone_number or not amount:
            raise HTTPException(status_code=400, detail="Phone number and amount required")

        # Validate phone number
        if not TransactionValidationService.validate_phone_number(phone_number):
            raise HTTPException(status_code=400, detail="Invalid phone number format")

        # Validate amount
        if not TransactionValidationService.validate_amount(amount):
            raise HTTPException(status_code=400, detail="Invalid amount (must be between 1 and 70,000)")

        # Format phone number
        if phone_number.startswith("0"):
            phone_number = "254" + phone_number[1:]
        elif not phone_number.startswith("254"):
            phone_number = "254" + phone_number

        # Check for existing pending transaction with same parameters (idempotency)
        if idempotency_key:
            existing_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "idempotencyKey": idempotency_key,
                "status": {"$in": [TransactionStatus.PENDING.value, TransactionStatus.COMPLETED.value]}
            })

            if existing_transaction:
                logger.info(f"Found existing transaction with idempotency key: {idempotency_key}")
                return {
                    "success": True,
                    "message": "Transaction already exists",
                    "merchantRequestId": existing_transaction.get("merchantRequestId"),
                    "checkoutRequestId": existing_transaction.get("checkoutRequestId"),
                    "existingTransaction": True
                }

        # Additional check for recent duplicate requests (same phone, amount, organization)
        recent_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
        recent_transaction = await isp_mpesa_transactions.find_one({
            "organizationId": ObjectId(organization_id),
            "phoneNumber": phone_number,
            "amount": float(amount),
            "status": TransactionStatus.PENDING.value,
            "createdAt": {"$gte": recent_cutoff}
        })

        if recent_transaction:
            logger.info(f"Found recent pending transaction for same parameters")
            return {
                "success": True,
                "message": "Recent transaction already pending",
                "merchantRequestId": recent_transaction.get("merchantRequestId"),
                "checkoutRequestId": recent_transaction.get("checkoutRequestId"),
                "existingTransaction": True
            }
        
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
        logger.info(f"Request URL: {MpesaConfig.get_urls(environment)['stk_push']}")
        logger.info(f"Request Headers: {json.dumps(headers, indent=2)}")
        logger.info(f"Request Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(MpesaConfig.get_urls(environment)["stk_push"], json=payload, headers=headers)
        
        logger.info(f"=== STK PUSH RESPONSE ===")
        logger.info(f"Status Code: {response.status_code}")
        try:
            response_json = response.json()
            logger.info(f"Response Body: {json.dumps(response_json, indent=2)}")
        except:
            logger.error(f"Failed to parse response as JSON: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Store transaction information with proper deduplication
            merchant_request_id = result.get("MerchantRequestID")
            checkout_request_id = result.get("CheckoutRequestID")

            if not merchant_request_id or not checkout_request_id:
                logger.error("Missing required identifiers from STK Push response")
                raise HTTPException(status_code=500, detail="Invalid STK Push response")

            # Check if transaction already exists (idempotency check)
            existing_transaction = await isp_mpesa_transactions.find_one({
                "organizationId": ObjectId(organization_id),
                "merchantRequestId": merchant_request_id,
                "checkoutRequestId": checkout_request_id
            })

            if existing_transaction:
                logger.info(f"STK Push transaction already exists: {merchant_request_id}")
                return {
                    "success": True,
                    "message": "STK push already initiated",
                    "merchantRequestId": merchant_request_id,
                    "checkoutRequestId": checkout_request_id,
                    "existingTransaction": True
                }

            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "transactionType": TransactionType.STK_PUSH.value,
                "callbackType": "stk_push",
                "status": TransactionStatus.PENDING.value,
                "phoneNumber": phone_number,
                "amount": float(amount),
                "merchantRequestId": merchant_request_id,
                "checkoutRequestId": checkout_request_id,
                "accountReference": data.get("accountReference") or mpesa_config.get("accountReference") or "Account",
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
                "callbackUrl": callback_url,
                "paymentMethod": "mpesa",
                "initiatedAt": datetime.now(timezone.utc)
            }

            # Add idempotency key if provided
            if idempotency_key:
                transaction_data["idempotencyKey"] = idempotency_key

            result_insert = await isp_mpesa_transactions.insert_one(transaction_data)
            
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

@router.post("/reconcile-transactions/{organization_id}")
async def reconcile_transactions(organization_id: str, request: Request):
    """Reconcile pending transactions and clean up duplicates"""
    try:
        user, org, _ = await authenticate_user(request, OrganizationPermission.MANAGE_MPESA_CONFIG)

        # Clean up duplicate transactions
        cleaned_count = await TransactionReconciliationService.cleanup_duplicate_transactions(organization_id)

        # Find and reconcile pending transactions
        pending_transactions = await isp_mpesa_transactions.find({
            "organizationId": ObjectId(organization_id),
            "status": TransactionStatus.PENDING.value,
            "transactionType": TransactionType.STK_PUSH.value
        }).to_list(None)

        reconciled_count = 0
        for transaction in pending_transactions:
            merchant_request_id = transaction.get("merchantRequestId")
            checkout_request_id = transaction.get("checkoutRequestId")

            if merchant_request_id and checkout_request_id:
                await TransactionReconciliationService.reconcile_stk_transaction(
                    organization_id, merchant_request_id, checkout_request_id
                )
                reconciled_count += 1

        await record_activity(
            user.id,
            ObjectId(organization_id),
            f"Reconciled {reconciled_count} transactions and cleaned {cleaned_count} duplicates"
        )

        return {
            "success": True,
            "message": "Transaction reconciliation completed",
            "reconciledCount": reconciled_count,
            "cleanedDuplicates": cleaned_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reconciling transactions: {str(e)}")
        raise HTTPException(status_code=500, detail="Error reconciling transactions")

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