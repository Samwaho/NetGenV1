from fastapi import APIRouter, Request, HTTPException, Depends
from app.config.database import organizations, isp_customers, payment_references
from bson.objectid import ObjectId
import logging
from datetime import datetime, timezone, timedelta
from app.config.deps import get_current_user
from app.schemas.enums import OrganizationPermission
from typing import Dict, Any, Optional, Tuple
import json
import time
import uuid
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class PaymentLinkRequest(BaseModel):
    customer_id: str
    amount: float
    description: Optional[str] = None
    expiry_hours: Optional[int] = 24

class PaymentLinkResponse(BaseModel):
    payment_link: str
    reference: str
    ussd_code: Optional[str] = None
    qr_code: Optional[str] = None
    expires_at: datetime

@router.post("/generate/{organization_id}")
async def generate_payment_link(
    organization_id: str, 
    request: PaymentLinkRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a payment link for a specific customer with reference tracking
    """
    try:
        # Validate organization and permissions
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if user has permission to manage payments
        user_permissions = organization.get("userPermissions", {})
        user_permission = user_permissions.get(str(current_user["_id"]), {})
        
        if not user_permission.get("canManagePayments", False):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Validate customer exists
        customer = await isp_customers.find_one({
            "_id": ObjectId(request.customer_id),
            "organizationId": organization_id
        })
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get active payment method
        payment_method = organization.get("paymentMethod")
        if not payment_method:
            raise HTTPException(status_code=400, detail="No active payment method configured")
        
        # Generate unique reference
        reference = f"CUST_{request.customer_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        
        # Calculate expiry
        expires_at = datetime.now(timezone.utc) + timedelta(hours=request.expiry_hours)
        
        # Store payment reference mapping
        payment_ref = {
            "reference": reference,
            "customer_id": request.customer_id,
            "organization_id": organization_id,
            "amount": request.amount,
            "description": request.description,
            "payment_method": payment_method,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
            "created_by": str(current_user["_id"])
        }
        
        await payment_references.insert_one(payment_ref)
        
        # Generate payment link based on payment method
        if payment_method == "MPESA":
            return await generate_mpesa_payment_link(organization, reference, request.amount)
        elif payment_method == "KOPOKOPO":
            return await generate_kopokopo_payment_link(organization, reference, request.amount)
        else:
            raise HTTPException(status_code=400, detail="Unsupported payment method")
            
    except Exception as e:
        logger.error(f"Error generating payment link: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def generate_mpesa_payment_link(organization: dict, reference: str, amount: float) -> PaymentLinkResponse:
    """Generate M-Pesa payment link with reference"""
    
    mpesa_config = organization.get("mpesaConfig", {})
    shortcode = mpesa_config.get("shortCode")
    environment = mpesa_config.get("environment", "sandbox")
    
    if not shortcode:
        raise HTTPException(status_code=400, detail="M-Pesa shortcode not configured")
    
    # Generate USSD code for Buy Goods
    ussd_code = f"*123*1*{shortcode}*{amount}#{reference}#"
    
    # Generate payment link
    base_url = "https://your-domain.com"  # Replace with your actual domain
    payment_link = f"{base_url}/pay/mpesa/{organization['_id']}/{reference}"
    
    return PaymentLinkResponse(
        payment_link=payment_link,
        reference=reference,
        ussd_code=ussd_code,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )

async def generate_kopokopo_payment_link(organization: dict, reference: str, amount: float) -> PaymentLinkResponse:
    """Generate KopoKopo payment link with reference"""
    
    kopokopo_config = organization.get("kopokopoConfig", {})
    client_id = kopokopo_config.get("clientId")
    environment = kopokopo_config.get("environment", "sandbox")
    
    if not client_id:
        raise HTTPException(status_code=400, detail="KopoKopo client ID not configured")
    
    # Generate payment link with metadata
    base_url = "https://your-domain.com"  # Replace with your actual domain
    payment_link = f"{base_url}/pay/kopokopo/{organization['_id']}/{reference}"
    
    return PaymentLinkResponse(
        payment_link=payment_link,
        reference=reference,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )

@router.get("/status/{reference}")
async def get_payment_status(reference: str):
    """Get payment status by reference"""
    try:
        payment_ref = await payment_references.find_one({"reference": reference})
        if not payment_ref:
            raise HTTPException(status_code=404, detail="Payment reference not found")
        
        return {
            "reference": reference,
            "status": payment_ref["status"],
            "amount": payment_ref["amount"],
            "created_at": payment_ref["created_at"],
            "expires_at": payment_ref["expires_at"]
        }
        
    except Exception as e:
        logger.error(f"Error getting payment status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/process-callback/{organization_id}")
async def process_payment_callback(organization_id: str, request: Request):
    """Process payment callbacks and match to customer using reference"""
    try:
        body = await request.body()
        payload = json.loads(body.decode('utf-8'))
        
        # Extract reference from payload (implementation depends on payment method)
        reference = extract_reference_from_payload(payload)
        
        if not reference:
            raise HTTPException(status_code=400, detail="No reference found in payload")
        
        # Find payment reference
        payment_ref = await payment_references.find_one({"reference": reference})
        if not payment_ref:
            raise HTTPException(status_code=404, detail="Payment reference not found")
        
        # Update payment status
        await payment_references.update_one(
            {"reference": reference},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc),
                    "payment_data": payload
                }
            }
        )
        
        # Process customer payment
        customer_id = payment_ref["customer_id"]
        amount = payment_ref["amount"]
        
        # Call existing payment processing logic
        success = await process_customer_payment_from_reference(
            organization_id, customer_id, amount, reference
        )
        
        if success:
            return {"status": "success", "message": "Payment processed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to process payment")
            
    except Exception as e:
        logger.error(f"Error processing payment callback: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

def extract_reference_from_payload(payload: dict) -> Optional[str]:
    """Extract reference from payment callback payload"""
    # Implementation depends on payment method
    # For M-Pesa: payload.get("BillReferenceNumber") or payload.get("AccountReference")
    # For KopoKopo: payload.get("metadata", {}).get("reference")
    
    # M-Pesa
    if "BillReferenceNumber" in payload:
        return payload["BillReferenceNumber"]
    elif "AccountReference" in payload:
        return payload["AccountReference"]
    
    # KopoKopo
    if "metadata" in payload and "reference" in payload["metadata"]:
        return payload["metadata"]["reference"]
    
    return None

async def process_customer_payment_from_reference(
    organization_id: str, 
    customer_id: str, 
    amount: float, 
    reference: str
) -> bool:
    """Process customer payment using existing logic"""
    try:
        # Import existing payment processing functions
        from app.api.mpesa import process_customer_payment as mpesa_process
        from app.api.kopokopo import process_customer_payment as kopokopo_process
        
        # Get organization to determine payment method
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        payment_method = organization.get("paymentMethod")
        
        if payment_method == "MPESA":
            return await mpesa_process(organization_id, customer_id, amount, reference=reference)
        elif payment_method == "KOPOKOPO":
            return await kopokopo_process(organization_id, customer_id, amount, reference=reference)
        else:
            logger.error(f"Unsupported payment method: {payment_method}")
            return False
            
    except Exception as e:
        logger.error(f"Error processing customer payment: {str(e)}")
        return False
