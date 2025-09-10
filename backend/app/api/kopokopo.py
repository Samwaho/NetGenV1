from fastapi import APIRouter, Request, HTTPException, Depends
from app.config.database import organizations, isp_kopokopo_transactions, isp_customers, isp_packages, isp_customer_payments, hotspot_vouchers
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
import ipaddress
import hashlib
import hmac

router = APIRouter()
logger = logging.getLogger(__name__)

# Centralized KopoKopo Configuration
class KopoKopoConfig:
    URLS = {
        "sandbox": {
            "base": "https://sandbox.kopokopo.com",
            "auth": "https://sandbox.kopokopo.com/oauth/token",
            "webhooks": "https://sandbox.kopokopo.com/api/v1/webhook_subscriptions",
            "pay": "https://sandbox.kopokopo.com/api/v1/pay_recipients",
            "transfers": "https://sandbox.kopokopo.com/api/v1/transfers",
            "polling": "https://sandbox.kopokopo.com/api/v1/transactions"
        },
        "production": {
            "base": "https://api.kopokopo.com",
            "auth": "https://api.kopokopo.com/oauth/token",
            "webhooks": "https://api.kopokopo.com/api/v1/webhook_subscriptions",
            "pay": "https://api.kopokopo.com/api/v1/pay_recipients",
            "transfers": "https://api.kopokopo.com/api/v1/transfers",
            "polling": "https://api.kopokopo.com/api/v1/transactions"
        }
    }

    # KopoKopo IP whitelist for callbacks (you should verify these with KopoKopo)
    KOPOKOPO_IPS = [
        # Add KopoKopo's IP addresses here when available
        # For now, we'll use a more permissive approach during development
    ]

    @staticmethod
    def is_valid_kopokopo_ip(ip_address: str) -> bool:
        """Check if the IP address is from KopoKopo"""
        # During development, accept all IPs. In production, verify with KopoKopo
        return True  # TODO: Implement proper IP validation

    @staticmethod
    def get_urls(environment: str = "sandbox") -> Dict[str, str]:
        return KopoKopoConfig.URLS.get(environment, KopoKopoConfig.URLS["sandbox"])

class KopoKopoService:
    @staticmethod
    async def get_access_token(client_id: str, client_secret: str, environment: str = "sandbox") -> str:
        """Get KopoKopo access token using client credentials flow"""
        try:
            auth_url = KopoKopoConfig.get_urls(environment)["auth"]
            
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "NetGenV1 / 1.0.0"
            }
            
            # Send credentials as form data according to KopoKopo documentation
            data = {
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials"
            }
            
            logger.info(f"KopoKopo Auth Request - URL: {auth_url}")
            response = requests.post(auth_url, headers=headers, data=data)
            
            if response.status_code == 200:
                return response.json().get("access_token")
            else:
                error_msg = f"Failed to get KopoKopo access token: {response.text}"
                logger.error(error_msg)
                return None
                
        except Exception as e:
            logger.error(f"Error getting KopoKopo access token: {str(e)}")
            return None

    @staticmethod
    def generate_callback_url(organization_id: str, callback_type: str) -> str:
        """Generate callback URL for KopoKopo webhooks"""
        base_url = settings.API_URL.rstrip('/')
        return f"{base_url}/api/payments/kopokopo/callback/{organization_id}/{callback_type}"

    @staticmethod
    async def create_webhook_subscription(organization_id: str, client_id: str, 
                                        access_token: str, environment: str = "sandbox", till_number: str = None) -> bool:
        """Create webhook subscription for KopoKopo"""
        try:
            webhook_url = KopoKopoConfig.get_urls(environment)["webhooks"]
            
            # Create webhook subscription for different event types
            event_types = [
                "buygoods_transaction_received",
                "buygoods_transaction_reversed",
                "b2b_transaction_received",
                "m2m_transaction_received",
                "settlement_transfer_completed",
                "customer_created"
            ]
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            for event_type in event_types:
                payload = {
                    "event_type": event_type,
                    "url": KopoKopoService.generate_callback_url(organization_id, event_type),
                    "scope": "till",
                    "scope_reference": till_number or client_id  # Use till number if available, fallback to client_id
                }
                
                response = requests.post(webhook_url, headers=headers, json=payload)
                
                if response.status_code in [200, 201]:
                    logger.info(f"Webhook subscription created for {event_type}")
                else:
                    logger.error(f"Failed to create webhook for {event_type}: {response.text}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error creating KopoKopo webhook subscription: {str(e)}")
            return False

    @staticmethod
    async def create_pay_recipient(organization_id: str, phone_number: str, 
                                 access_token: str, environment: str = "sandbox") -> Optional[str]:
        """Create a pay recipient for sending money"""
        try:
            pay_url = KopoKopoConfig.get_urls(environment)["pay"]
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "type": "mobile",
                "first_name": "Customer",
                "last_name": "Payment",
                "phone_number": phone_number,
                "email": f"customer@{organization_id}.local",
                "network": "SAFARICOM"  # Default to Safaricom for M-Pesa
            }
            
            response = requests.post(pay_url, headers=headers, json=payload)
            
            if response.status_code in [200, 201]:
                result = response.json()
                return result.get("id")  # Return recipient ID
            else:
                logger.error(f"Failed to create pay recipient: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating KopoKopo pay recipient: {str(e)}")
            return None

    @staticmethod
    async def initiate_payment(organization_id: str, recipient_id: str, amount: float,
                             access_token: str, environment: str = "sandbox") -> Optional[str]:
        """Initiate a payment to a recipient"""
        try:
            transfers_url = KopoKopoConfig.get_urls(environment)["transfers"]
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "pay_recipient": recipient_id,
                "amount": {
                    "currency": "KES",
                    "value": str(amount)
                },
                "metadata": {
                    "organization_id": organization_id,
                    "payment_type": "customer_payment"
                },
                "links": {
                    "callback_url": KopoKopoService.generate_callback_url(organization_id, "transfer")
                }
            }
            
            response = requests.post(transfers_url, headers=headers, json=payload)
            
            if response.status_code in [200, 201]:
                result = response.json()
                return result.get("id")  # Return transfer ID
            else:
                logger.error(f"Failed to initiate payment: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error initiating KopoKopo payment: {str(e)}")
            return None

class KopoKopoTransactionService:
    @staticmethod
    async def process_transaction(organization_id: str, payload: Dict[str, Any]) -> bool:
        """Process incoming KopoKopo transaction"""
        try:
            # Extract transaction details
            event_type = payload.get("event_type")
            resource = payload.get("resource", {})
            
            if event_type == "buygoods_transaction_received":
                return await KopoKopoTransactionService._process_buygoods_transaction(organization_id, resource)
            elif event_type == "b2b_transaction_received":
                return await KopoKopoTransactionService._process_b2b_transaction(organization_id, resource)
            elif event_type == "settlement_transfer_completed":
                return await KopoKopoTransactionService._process_settlement_transfer(organization_id, resource)
            else:
                logger.info(f"Unhandled KopoKopo event type: {event_type}")
                return True
                
        except Exception as e:
            logger.error(f"Error processing KopoKopo transaction: {str(e)}")
            return False

    @staticmethod
    async def _process_buygoods_transaction(organization_id: str, resource: Dict[str, Any]) -> bool:
        """Process buygoods transaction (C2B)"""
        try:
            transaction_id = resource.get("id")
            amount = float(resource.get("amount", {}).get("value", 0))
            phone_number = resource.get("sender", {}).get("phone_number")
            till_number = resource.get("till", {}).get("number")
            reference = resource.get("reference")
            status = resource.get("status")
            
            # Store transaction
            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "transactionId": transaction_id,
                "amount": amount,
                "phoneNumber": phone_number,
                "tillNumber": till_number,
                "reference": reference,
                "status": status,
                "transactionType": "buygoods",
                "callbackType": "buygoods_transaction_received",
                "payload": resource,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            
            await isp_kopokopo_transactions.insert_one(transaction_data)
            
            # Process payment based on reference
            if reference:
                if reference.startswith("CUST_"):
                    # Customer payment
                    customer_id = reference.replace("CUST_", "")
                    return await process_customer_payment(organization_id, customer_id, amount, phone_number, transaction_id)
                elif reference.startswith("VOUCHER_"):
                    # Hotspot voucher payment
                    voucher_code = reference.replace("VOUCHER_", "")
                    return await process_hotspot_voucher_payment(organization_id, voucher_code, amount, transaction_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing buygoods transaction: {str(e)}")
            return False

    @staticmethod
    async def _process_b2b_transaction(organization_id: str, resource: Dict[str, Any]) -> bool:
        """Process B2B transaction"""
        try:
            transaction_id = resource.get("id")
            amount = float(resource.get("amount", {}).get("value", 0))
            sender_till = resource.get("sender", {}).get("till", {}).get("number")
            receiver_till = resource.get("destination", {}).get("till", {}).get("number")
            reference = resource.get("reference")
            status = resource.get("status")
            
            # Store transaction
            transaction_data = {
                "organizationId": ObjectId(organization_id),
                "transactionId": transaction_id,
                "amount": amount,
                "senderTill": sender_till,
                "receiverTill": receiver_till,
                "reference": reference,
                "status": status,
                "transactionType": "b2b",
                "callbackType": "b2b_transaction_received",
                "payload": resource,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            
            await isp_kopokopo_transactions.insert_one(transaction_data)
            return True
            
        except Exception as e:
            logger.error(f"Error processing B2B transaction: {str(e)}")
            return False

    @staticmethod
    async def _process_settlement_transfer(organization_id: str, resource: Dict[str, Any]) -> bool:
        """Process settlement transfer"""
        try:
            transfer_id = resource.get("id")
            amount = float(resource.get("amount", {}).get("value", 0))
            destination = resource.get("destination", {})
            status = resource.get("status")
            
            # Store transfer
            transfer_data = {
                "organizationId": ObjectId(organization_id),
                "transferId": transfer_id,
                "amount": amount,
                "destination": destination,
                "status": status,
                "transactionType": "settlement_transfer",
                "callbackType": "settlement_transfer_completed",
                "payload": resource,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            
            await isp_kopokopo_transactions.insert_one(transfer_data)
            return True
            
        except Exception as e:
            logger.error(f"Error processing settlement transfer: {str(e)}")
            return False

class KopoKopoErrorHandler:
    """Error handling for KopoKopo operations"""
    
    ERROR_CODES = {
        "400": "Bad Request - Invalid parameters",
        "401": "Unauthorized - Invalid credentials",
        "403": "Forbidden - Insufficient permissions",
        "404": "Not Found - Resource not found",
        "409": "Conflict - Resource already exists",
        "422": "Unprocessable Entity - Validation error",
        "500": "Internal Server Error - KopoKopo server error"
    }
    
    @staticmethod
    def get_error_message(error_code: str) -> str:
        """Get user-friendly error message"""
        return KopoKopoErrorHandler.ERROR_CODES.get(error_code, f"Unknown error: {error_code}")
    
    @staticmethod
    def is_retryable_error(error_code: str) -> bool:
        """Check if error is retryable"""
        retryable_codes = ["500", "502", "503", "504"]
        return error_code in retryable_codes

class KopoKopoValidationService:
    """Validation service for KopoKopo operations"""
    
    @staticmethod
    def validate_phone_number(phone: str) -> bool:
        """Validate phone number format"""
        if not phone:
            return False
        
        # Remove any non-digit characters
        clean_phone = ''.join(filter(str.isdigit, phone))
        
        # Check if it's a valid Kenyan phone number
        if clean_phone.startswith('254') and len(clean_phone) == 12:
            return True
        elif clean_phone.startswith('0') and len(clean_phone) == 10:
            return True
        elif clean_phone.startswith('7') and len(clean_phone) == 9:
            return True
        
        return False
    
    @staticmethod
    def validate_amount(amount: Any) -> bool:
        """Validate payment amount"""
        try:
            amount_float = float(amount)
            return amount_float > 0
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def validate_webhook_signature(payload: str, signature: str, webhook_secret: str) -> bool:
        """Validate webhook signature"""
        try:
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
        except Exception:
            return False

# API Endpoints
@router.post("/callback/{organization_id}/{callback_type}")
async def kopokopo_callback(organization_id: str, callback_type: str, request: Request):
    """Handle KopoKopo webhook callbacks"""
    try:
        # Get client IP for validation
        client_ip = request.client.host
        
        # Validate IP (optional during development)
        if not KopoKopoConfig.is_valid_kopokopo_ip(client_ip):
            logger.warning(f"Invalid IP address for KopoKopo callback: {client_ip}")
            # Don't reject during development
        
        # Get request body
        body = await request.body()
        payload_str = body.decode('utf-8')
        
        # Get organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        kopokopo_config = organization.get("kopokopoConfig", {})
        webhook_secret = kopokopo_config.get("webhookSecret")
        
        # Validate webhook signature if secret is configured
        if webhook_secret:
            signature = request.headers.get("X-KopoKopo-Signature")
            if not signature or not KopoKopoValidationService.validate_webhook_signature(
                payload_str, signature, webhook_secret
            ):
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse payload
        payload = json.loads(payload_str)
        
        # Process transaction
        success = await KopoKopoTransactionService.process_transaction(organization_id, payload)
        
        if success:
            return {"status": "success"}
        else:
            raise HTTPException(status_code=500, detail="Failed to process transaction")
            
    except Exception as e:
        logger.error(f"Error processing KopoKopo callback: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/initiate-payment/{organization_id}")
async def initiate_kopokopo_payment(organization_id: str, request: Request):
    """Initiate a KopoKopo payment"""
    try:
        # Authenticate user
        current_user, organization, user_member = await authenticate_user(
            request, OrganizationPermission.MANAGE_CUSTOMER_PAYMENTS
        )
        
        # Get request data
        data = await request.json()
        phone_number = data.get("phone_number")
        amount = data.get("amount")
        reference = data.get("reference")
        
        # Validate inputs
        if not KopoKopoValidationService.validate_phone_number(phone_number):
            raise HTTPException(status_code=400, detail="Invalid phone number")
        
        if not KopoKopoValidationService.validate_amount(amount):
            raise HTTPException(status_code=400, detail="Invalid amount")
        
        # Get KopoKopo configuration
        kopokopo_config = organization.get("kopokopoConfig", {})
        if not kopokopo_config.get("isActive"):
            raise HTTPException(status_code=400, detail="KopoKopo is not configured")
        
        client_id = kopokopo_config.get("clientId")
        client_secret = kopokopo_config.get("clientSecret")
        environment = kopokopo_config.get("environment", "sandbox")
        
        if not client_id or not client_secret:
            raise HTTPException(status_code=400, detail="KopoKopo credentials not configured")
        
        # Get access token
        access_token = await KopoKopoService.get_access_token(client_id, client_secret, environment)
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to get KopoKopo access token")
        
        # Create pay recipient
        recipient_id = await KopoKopoService.create_pay_recipient(
            organization_id, phone_number, access_token, environment
        )
        if not recipient_id:
            raise HTTPException(status_code=500, detail="Failed to create pay recipient")
        
        # Initiate payment
        transfer_id = await KopoKopoService.initiate_payment(
            organization_id, recipient_id, amount, access_token, environment
        )
        if not transfer_id:
            raise HTTPException(status_code=500, detail="Failed to initiate payment")
        
        return {
            "success": True,
            "transfer_id": transfer_id,
            "message": "Payment initiated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating KopoKopo payment: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/transactions/{organization_id}")
async def get_kopokopo_transactions(organization_id: str, request: Request):
    """Get KopoKopo transactions for an organization"""
    try:
        # Authenticate user
        current_user, organization, user_member = await authenticate_user(
            request, OrganizationPermission.VIEW_MPESA_TRANSACTIONS
        )
        
        # Get query parameters
        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 20))
        skip = (page - 1) * limit
        
        # Get transactions
        transactions = await isp_kopokopo_transactions.find(
            {"organizationId": ObjectId(organization_id)}
        ).sort("createdAt", -1).skip(skip).limit(limit).to_list(None)
        
        # Get total count
        total_count = await isp_kopokopo_transactions.count_documents(
            {"organizationId": ObjectId(organization_id)}
        )
        
        return {
            "success": True,
            "transactions": transactions,
            "total_count": total_count,
            "page": page,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error getting KopoKopo transactions: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Helper functions (similar to M-Pesa implementation)
async def authenticate_user(request: Request, required_permission: OrganizationPermission = None) -> Tuple[Any, Any, Any]:
    """Authenticate user and check permissions"""
    try:
        current_user = await get_current_user(request)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Get organization from URL or request
        organization_id = request.path_params.get("organization_id")
        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")
        
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if user is member
        user_member = next(
            (member for member in organization["members"] 
             if member["userId"] == current_user.id and member["status"] == "ACTIVE"),
            None
        )
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        
        # Check permissions if required
        if required_permission:
            user_role = next(
                (role for role in organization["roles"] 
                 if role["name"] == user_member["roleName"]),
                None
            )
            if not user_role or required_permission.value not in user_role["permissions"]:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return current_user, organization, user_member
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication error")

async def process_customer_payment(organization_id: str, customer_id: str, amount: float, 
                                 phone: str = None, transaction_id: str = None) -> bool:
    """Process customer payment from KopoKopo transaction"""
    try:
        # Get customer
        customer = await isp_customers.find_one({
            "_id": ObjectId(customer_id),
            "organizationId": ObjectId(organization_id)
        })
        
        if not customer:
            logger.error(f"Customer not found: {customer_id}")
            return False
        
        # Create payment record
        payment_data = {
            "customerId": ObjectId(customer_id),
            "organizationId": ObjectId(organization_id),
            "amount": amount,
            "transactionId": transaction_id,
            "phoneNumber": phone,
            "daysAdded": 30,  # Default to 30 days
            "paidAt": datetime.now(timezone.utc),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        await isp_customer_payments.insert_one(payment_data)
        
        # Update customer status and expiry
        new_expiry = datetime.now(timezone.utc) + timedelta(days=30)
        await isp_customers.update_one(
            {"_id": ObjectId(customer_id)},
            {
                "$set": {
                    "status": IspManagerCustomerStatus.ACTIVE.value,
                    "expiryDate": new_expiry,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        # Send SMS notification
        try:
            await send_sms_for_organization(
                organization_id,
                phone or customer.get("phoneNumber"),
                "payment_confirmation",
                {
                    "customer_name": f"{customer.get('firstName', '')} {customer.get('lastName', '')}",
                    "amount": amount,
                    "days_added": 30
                }
            )
        except Exception as e:
            logger.error(f"Failed to send SMS notification: {str(e)}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error processing customer payment: {str(e)}")
        return False

async def process_hotspot_voucher_payment(organization_id: str, voucher_code: str, 
                                        amount: float, transaction_id: str = None) -> bool:
    """Process hotspot voucher payment from KopoKopo transaction"""
    try:
        # Get voucher
        voucher = await hotspot_vouchers.find_one({
            "voucherCode": voucher_code,
            "organizationId": ObjectId(organization_id)
        })
        
        if not voucher:
            logger.error(f"Voucher not found: {voucher_code}")
            return False
        
        # Update voucher status
        await hotspot_vouchers.update_one(
            {"_id": voucher["_id"]},
            {
                "$set": {
                    "isUsed": True,
                    "usedAt": datetime.now(timezone.utc),
                    "transactionId": transaction_id,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        return True
        
    except Exception as e:
        logger.error(f"Error processing voucher payment: {str(e)}")
        return False
