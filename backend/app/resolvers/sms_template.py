import strawberry
from typing import List, Optional
from fastapi import HTTPException
from bson.objectid import ObjectId
from datetime import datetime, timezone

from app.config.deps import Context
from app.config.database import sms_templates, organizations
from app.schemas.sms_template import SmsTemplate, SmsTemplateInput, TemplateCategory
from app.schemas.enums import OrganizationPermission
from app.services.sms.template import SmsTemplateService
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class SmsTemplateResponse:
    success: bool
    message: str
    template: Optional[SmsTemplate] = None

@strawberry.type
class SmsTemplatesResponse:
    success: bool
    message: str
    templates: List[SmsTemplate] = strawberry.field(default_factory=list)

@strawberry.type
class SmsTemplateResolver:
    @strawberry.mutation
    async def create_sms_template(
        self,
        organization_id: str,
        input: SmsTemplateInput,
        info: strawberry.Info
    ) -> SmsTemplateResponse:
        """Create a new SMS template for an organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Fetch the organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Find the member
        user_id = current_user.id
        user_member = next((m for m in organization["members"] if str(m.get("userId")) == str(user_id)), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        # Find the user's role
        user_role = next((r for r in organization["roles"] if r["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Create template
        result = await SmsTemplateService.create_template(
            organization_id=organization_id,
            name=input.name,
            content=input.content,
            category=input.category,
            description=input.description,
            variables=input.variables,
            is_active=input.is_active,
            created_by=str(current_user.id)
        )
        
        if not result["success"]:
            return SmsTemplateResponse(
                success=False,
                message=result["message"]
            )
        
        # Convert to schema type
        template_doc = result["template"]
        template = SmsTemplate(
            id=str(template_doc["_id"]),
            organization_id=str(template_doc["organization_id"]),
            name=template_doc["name"],
            content=template_doc["content"],
            category=TemplateCategory(template_doc["category"]),
            description=template_doc.get("description"),
            variables=template_doc.get("variables", []),
            is_active=template_doc.get("is_active", True),
            created_at=template_doc["created_at"],
            updated_at=template_doc.get("updated_at"),
            created_by=str(template_doc["created_by"]) if template_doc.get("created_by") else None
        )
        
        return SmsTemplateResponse(
            success=True,
            message="Template created successfully",
            template=template
        )
    
    @strawberry.mutation
    async def update_sms_template(
        self,
        template_id: str,
        organization_id: str,
        input: SmsTemplateInput,
        info: strawberry.Info
    ) -> SmsTemplateResponse:
        """Update an existing SMS template"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Fetch the organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Find the member
        user_id = current_user.id
        user_member = next((m for m in organization["members"] if str(m.get("userId")) == str(user_id)), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        # Find the user's role
        user_role = next((r for r in organization["roles"] if r["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Update template
        update_data = {
            "name": input.name,
            "content": input.content,
            "category": input.category,
            "description": input.description,
            "variables": input.variables,
            "is_active": input.is_active,
        }
        
        result = await SmsTemplateService.update_template(
            template_id=template_id,
            organization_id=organization_id,
            **update_data
        )
        
        if not result["success"]:
            return SmsTemplateResponse(
                success=False,
                message=result["message"]
            )
        
        # Get updated template
        template_result = await SmsTemplateService.get_template(
            template_id=template_id,
            organization_id=organization_id
        )
        
        if not template_result["success"]:
            return SmsTemplateResponse(
                success=True,
                message="Template updated but could not retrieve updated data"
            )
        
        # Convert to schema type
        template_doc = template_result["template"]
        template = SmsTemplate(
            id=str(template_doc["_id"]),
            organization_id=str(template_doc["organization_id"]),
            name=template_doc["name"],
            content=template_doc["content"],
            category=TemplateCategory(template_doc["category"]),
            description=template_doc.get("description"),
            variables=template_doc.get("variables", []),
            is_active=template_doc.get("is_active", True),
            created_at=template_doc["created_at"],
            updated_at=template_doc.get("updated_at"),
            created_by=str(template_doc["created_by"]) if template_doc.get("created_by") else None
        )
        
        return SmsTemplateResponse(
            success=True,
            message="Template updated successfully",
            template=template
        )
    
    @strawberry.mutation
    async def delete_sms_template(
        self,
        template_id: str,
        organization_id: str,
        info: strawberry.Info
    ) -> SmsTemplateResponse:
        """Delete an SMS template"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Fetch the organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Find the member
        user_id = current_user.id
        user_member = next((m for m in organization["members"] if str(m.get("userId")) == str(user_id)), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        # Find the user's role
        user_role = next((r for r in organization["roles"] if r["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Delete template
        result = await SmsTemplateService.delete_template(
            template_id=template_id,
            organization_id=organization_id
        )
        
        return SmsTemplateResponse(
            success=result["success"],
            message=result["message"]
        )
    
    @strawberry.field
    async def get_sms_template(
        self,
        template_id: str,
        organization_id: str,
        info: strawberry.Info
    ) -> SmsTemplateResponse:
        """Get a specific SMS template"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Fetch the organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Find the member
        user_id = current_user.id
        user_member = next((m for m in organization["members"] if str(m.get("userId")) == str(user_id)), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        # Find the user's role
        user_role = next((r for r in organization["roles"] if r["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Get template
        result = await SmsTemplateService.get_template(
            template_id=template_id,
            organization_id=organization_id
        )
        
        if not result["success"]:
            return SmsTemplateResponse(
                success=False,
                message=result["message"]
            )
        
        # Convert to schema type
        template_doc = result["template"]
        template = SmsTemplate(
            id=str(template_doc["_id"]),
            organization_id=str(template_doc["organization_id"]),
            name=template_doc["name"],
            content=template_doc["content"],
            category=TemplateCategory(template_doc["category"]),
            description=template_doc.get("description"),
            variables=template_doc.get("variables", []),
            is_active=template_doc.get("is_active", True),
            created_at=template_doc["created_at"],
            updated_at=template_doc.get("updated_at"),
            created_by=str(template_doc["created_by"]) if template_doc.get("created_by") else None
        )
        
        return SmsTemplateResponse(
            success=True,
            message="Template retrieved successfully",
            template=template
        )
    
    @strawberry.field
    async def list_sms_templates(
        self,
        organization_id: str,
        info: strawberry.Info,
        category: Optional[TemplateCategory] = None,
        is_active: Optional[bool] = None
    ) -> SmsTemplatesResponse:
        """List SMS templates for an organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Fetch the organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Find the member
        user_id = current_user.id
        user_member = next((m for m in organization["members"] if str(m.get("userId")) == str(user_id)), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        # Find the user's role
        user_role = next((r for r in organization["roles"] if r["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # List templates
        result = await SmsTemplateService.list_templates(
            organization_id=organization_id,
            category=category,
            is_active=is_active
        )
        
        if not result["success"]:
            return SmsTemplatesResponse(
                success=False,
                message=result["message"]
            )
        
        # Convert to schema types
        templates = []
        for doc in result["templates"]:
            template = SmsTemplate(
                id=str(doc["_id"]),
                organization_id=str(doc["organization_id"]),
                name=doc["name"],
                content=doc["content"],
                category=TemplateCategory(doc["category"]),
                description=doc.get("description"),
                variables=doc.get("variables", []),
                is_active=doc.get("is_active", True),
                created_at=doc["created_at"],
                updated_at=doc.get("updated_at"),
                created_by=str(doc["created_by"]) if doc.get("created_by") else None
            )
            templates.append(template)
        
        return SmsTemplatesResponse(
            success=True,
            message=f"Found {len(templates)} templates",
            templates=templates
        )






