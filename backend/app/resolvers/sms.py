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

        # Check if user has permission to send SMS
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Send SMS
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

        # Check if user has permission to send SMS
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Send bulk SMS
        result = await send_bulk_sms_for_organization(
            organization_id=organization_id,
            to=to,
            message=message
        )
        
        # Extract result details
        success = result.get("success", False)
        message = result.get("message", "Unknown error")
        total = len(to)
        failed = 0
        
        # Different providers may return results differently
        if "failed" in result:
            failed = result["failed"]
        elif "results" in result:
            # Count failures from individual results
            failed = sum(1 for r in result["results"] if not r.get("success", False))
        
        return BulkSMSResponse(
            success=success,
            message=message,
            total_sent=total,
            failed=failed
        ) 