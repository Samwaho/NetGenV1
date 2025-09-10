from datetime import datetime, timezone, timedelta
from typing import Optional
import strawberry
from fastapi import HTTPException
from app.config.database import organizations, isp_customers, payment_references
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging
import time
import uuid
from app.api.mpesa import process_customer_payment as mpesa_process_customer_payment
from app.api.kopokopo import process_customer_payment as kopokopo_process_customer_payment
from app.config.settings import settings

logger = logging.getLogger(__name__)

@strawberry.input
class GeneratePaymentLinkInput:
    """Input type for generating a payment link"""
    customer_id: str = strawberry.field(name="customerId")
    amount: float
    description: Optional[str] = None
    expiry_hours: Optional[int] = strawberry.field(name="expiryHours", default=24)

@strawberry.type
class PaymentLinkResponse:
    """Response type for payment link generation"""
    payment_link: str = strawberry.field(name="paymentLink")
    reference: str
    ussd_code: Optional[str] = strawberry.field(name="ussdCode", default=None)
    qr_code: Optional[str] = strawberry.field(name="qrCode", default=None)
    expires_at: datetime = strawberry.field(name="expiresAt")

@strawberry.type
class PaymentStatusResponse:
    """Response type for payment status queries"""
    reference: str
    status: str
    amount: float
    created_at: datetime = strawberry.field(name="createdAt")
    expires_at: datetime = strawberry.field(name="expiresAt")

@strawberry.type
class PaymentLinkMutationResponse:
    """Response wrapper for payment link mutations"""
    success: bool
    message: str
    payment_link: Optional[PaymentLinkResponse] = strawberry.field(name="paymentLink", default=None)

@strawberry.type
class PaymentLinkQuery:
    """Query resolver for payment link operations"""
    
    @strawberry.field
    async def payment_status(self, reference: str, info: strawberry.Info) -> PaymentStatusResponse:
        """Get payment status by reference"""
        context: Context = info.context
        current_user = await context.authenticate()
        
        try:
            payment_ref = await payment_references.find_one({"reference": reference})
            if not payment_ref:
                raise HTTPException(status_code=404, detail="Payment reference not found")
            
            return PaymentStatusResponse(
                reference=reference,
                status=payment_ref["status"],
                amount=payment_ref["amount"],
                created_at=payment_ref["created_at"],
                expires_at=payment_ref["expires_at"]
            )
            
        except Exception as e:
            logger.error(f"Error getting payment status: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")

@strawberry.type
class PaymentLinkMutation:
    """Mutation resolver for payment link operations"""
    
    @strawberry.mutation
    async def generate_payment_link(
        self, 
        organization_id: str, 
        input: GeneratePaymentLinkInput, 
        info: strawberry.Info
    ) -> PaymentLinkMutationResponse:
        """Generate a payment link for a specific customer with reference tracking"""
        context: Context = info.context
        current_user = await context.authenticate()
        
        try:
            # Validate input
            if not input.amount or input.amount <= 0:
                raise HTTPException(status_code=400, detail="Amount must be greater than 0")
            
            if not input.customer_id:
                raise HTTPException(status_code=400, detail="Customer ID is required")
            
            # Validate organization and permissions
            organization = await organizations.find_one({"_id": ObjectId(organization_id)})
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Check if user has permission to manage payments
            # First check if user is a member of the organization
            user_member = next((member for member in organization.get("members", []) 
                              if member["userId"] == current_user.id), None)
            if not user_member:
                raise HTTPException(status_code=403, detail="Not a member of this organization")
            
            # Check if user has payment management permissions
            user_role = next((role for role in organization.get("roles", []) 
                            if role["name"] == user_member["roleName"]), None)
            if not user_role:
                raise HTTPException(status_code=403, detail="User role not found")
            
            # Check for payment management permissions
            has_payment_permission = any(
                perm in user_role.get("permissions", []) 
                for perm in ["MANAGE_CUSTOMER_PAYMENTS", "MANAGE_MPESA_CONFIG", "MANAGE_KOPOKOPO_CONFIG"]
            )
            
            if not has_payment_permission:
                raise HTTPException(status_code=403, detail="Insufficient permissions to manage payments")
            
            # Validate customer exists
            customer = await isp_customers.find_one({
                "_id": ObjectId(input.customer_id),
                "organizationId": ObjectId(organization_id)
            })
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            
            # Get active payment method
            payment_method = organization.get("paymentMethod")
            if not payment_method:
                raise HTTPException(status_code=400, detail="No active payment method configured")
            
            # Generate unique reference
            reference = f"CUST_{input.customer_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            
            # Calculate expiry
            expiry_hours = input.expiry_hours or settings.PAYMENT_LINK_EXPIRY_HOURS
            expires_at = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)
            
            # Store payment reference mapping
            payment_ref = {
                "reference": reference,
                "customer_id": input.customer_id,
                "organization_id": ObjectId(organization_id),
                "amount": input.amount,
                "description": input.description,
                "payment_method": payment_method,
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "expires_at": expires_at,
                "created_by": str(current_user.id)
            }
            
            await payment_references.insert_one(payment_ref)
            
            # Generate payment link based on payment method
            logger.info(f"Generating payment link for method: {payment_method}, customer: {input.customer_id}, amount: {input.amount}")
            logger.info(f"Organization config - M-Pesa: {bool(organization.get('mpesaConfig'))}, KopoKopo: {bool(organization.get('kopokopoConfig'))}")
            
            if payment_method == "MPESA":
                payment_link_data = await PaymentLinkMutation._generate_mpesa_payment_link(organization, reference, input.amount)
            elif payment_method == "KOPOKOPO":
                payment_link_data = await PaymentLinkMutation._generate_kopokopo_payment_link(organization, reference, input.amount)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported payment method: {payment_method}")
            
            # Record activity
            await record_activity(
                current_user.id,
                ObjectId(organization_id),
                f"generated payment link for customer {customer.get('username', 'Unknown')} - {reference}"
            )
            
            return PaymentLinkMutationResponse(
                success=True,
                message="Payment link generated successfully",
                payment_link=payment_link_data
            )
                
        except Exception as e:
            logger.error(f"Error generating payment link: {str(e)}")
            return PaymentLinkMutationResponse(
                success=False,
                message=f"Failed to generate payment link: {str(e)}",
                payment_link=None
            )
    
    @staticmethod
    async def _generate_mpesa_payment_link(organization: dict, reference: str, amount: float) -> PaymentLinkResponse:
        """Generate M-Pesa payment link with reference"""
        
        mpesa_config = organization.get("mpesaConfig", {})
        logger.info(f"M-Pesa config keys: {list(mpesa_config.keys())}")
        logger.info(f"M-Pesa config: {mpesa_config}")
        
        shortcode = mpesa_config.get("shortCode")
        environment = mpesa_config.get("environment", "sandbox")
        consumer_key = mpesa_config.get("consumerKey")
        consumer_secret = mpesa_config.get("consumerSecret")
        passkey = mpesa_config.get("passKey")  # Note: capital K in passKey
        
        if not shortcode:
            raise HTTPException(status_code=400, detail="M-Pesa shortcode not configured")
        
        if not consumer_key:
            raise HTTPException(status_code=400, detail="M-Pesa consumer key not configured")
        
        if not consumer_secret:
            raise HTTPException(status_code=400, detail="M-Pesa consumer secret not configured")
        
        if not passkey:
            raise HTTPException(status_code=400, detail="M-Pesa passkey not configured")
        
        # Generate USSD code for Buy Goods
        ussd_code = f"*123*1*{shortcode}*{amount}#{reference}#"
        
        # Generate payment link
        payment_domain = settings.PAYMENT_LINK_DOMAIN.rstrip('/') if settings.PAYMENT_LINK_DOMAIN else settings.FRONTEND_URL.rstrip('/')
        payment_link = f"{payment_domain}/pay/mpesa/{organization['_id']}/{reference}"
        
        return PaymentLinkResponse(
            payment_link=payment_link,
            reference=reference,
            ussd_code=ussd_code,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
    
    @staticmethod
    async def _generate_kopokopo_payment_link(organization: dict, reference: str, amount: float) -> PaymentLinkResponse:
        """Generate KopoKopo payment link with reference"""
        
        kopokopo_config = organization.get("kopokopoConfig", {})
        client_id = kopokopo_config.get("clientId")
        client_secret = kopokopo_config.get("clientSecret")
        environment = kopokopo_config.get("environment", "sandbox")
        base_url = kopokopo_config.get("baseUrl")
        
        if not client_id:
            raise HTTPException(status_code=400, detail="KopoKopo client ID not configured")
        
        if not client_secret:
            raise HTTPException(status_code=400, detail="KopoKopo client secret not configured")
        
        # Use organization's base URL or fallback to settings
        if not base_url:
            if environment == "production":
                base_url = settings.KOPOKOPO_PRODUCTION_URL
            else:
                base_url = settings.KOPOKOPO_SANDBOX_URL
        
        # Generate payment link with metadata
        payment_domain = settings.PAYMENT_LINK_DOMAIN.rstrip('/') if settings.PAYMENT_LINK_DOMAIN else settings.FRONTEND_URL.rstrip('/')
        payment_link = f"{payment_domain}/pay/kopokopo/{organization['_id']}/{reference}"
        
        return PaymentLinkResponse(
            payment_link=payment_link,
            reference=reference,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
