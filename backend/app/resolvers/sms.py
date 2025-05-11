import strawberry
from fastapi import HTTPException
from typing import List, Optional
from app.config.deps import Context
from app.config.database import organizations
from bson.objectid import ObjectId
from app.schemas.enums import OrganizationPermission
from app.services.sms.utils import send_sms_for_organization, send_bulk_sms_for_organization
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class SMSResponse:
    success: bool
    message: str
    message_id: Optional[str] = None
    status: Optional[str] = None

@strawberry.type
class BulkSMSResponse:
    success: bool
    message: str
    total_sent: int
    failed: int

@strawberry.type
class SMSResolver:
    @strawberry.mutation
    async def send_sms(
        self, 
        organization_id: str, 
        to: str, 
        message: str, 
        info: strawberry.Info
    ) -> SMSResponse:
        """Send an SMS message using the organization's configured SMS provider"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Check organization exists and user has permission
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Send the SMS
        result = await send_sms_for_organization(
            organization_id=organization_id,
            to=to,
            message=message
        )
        
        return SMSResponse(
            success=result.get("success", False),
            message=result.get("message", "Unknown error"),
            message_id=result.get("message_id"),
            status=result.get("status")
        )
    
    @strawberry.mutation
    async def send_bulk_sms(
        self, 
        organization_id: str, 
        to: List[str], 
        message: str, 
        info: strawberry.Info
    ) -> BulkSMSResponse:
        """Send SMS messages to multiple recipients"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Check organization exists and user has permission
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Send the bulk SMS
        result = await send_bulk_sms_for_organization(
            organization_id=organization_id,
            to=to,
            message=message
        )
        
        # Extract result details
        success = result.get("success", False)
        message_text = result.get("message", "Unknown error")
        total = result.get("total", len(to))
        successful = result.get("successful", 0)
        failed = result.get("failed", total - successful)
        
        return BulkSMSResponse(
            success=success,
            message=message_text,
            total_sent=successful,
            failed=failed
        )
