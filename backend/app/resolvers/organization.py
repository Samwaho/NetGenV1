from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from jwt.exceptions import PyJWTError
from app.config.database import organizations, users, activities  # Add activities import
from app.schemas.organization import (
    Organization,
    OrganizationResponse,
    OrganizationsResponse,
    CreateOrganizationInput,
    OrganizationMember,
    MpesaConfigurationInput,
    SmsConfigurationInput,
    KopoKopoConfigurationInput,
    parse_organization_datetimes,
    PaymentMethodInput,
    PaymentMethodType
)
from app.schemas.enums import OrganizationStatus, OrganizationMemberStatus, OrganizationPermission
from app.schemas.user import User
from app.config.email import email_manager
from app.config.settings import settings
from app.config.utils import create_invitation_token
import logging
import jwt
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
from app.api.mpesa import register_c2b_urls, get_mpesa_access_token
import json
from app.services.sms.template import SmsTemplateService
from app.services.sms.default_templates import DEFAULT_SMS_TEMPLATES
from app.schemas.sms_template import TemplateCategory
from app.api.kopokopo import KopoKopoService

logger = logging.getLogger(__name__)

def organization_cache_key(org_id: str) -> str:
    return f"organization:{org_id}"

def organizations_cache_key(user_id: str) -> str:
    return f"organizations:{user_id}"

@strawberry.type
class OrganizationQuery:
    @strawberry.field
    async def organizations(self, info) -> OrganizationsResponse:
        """Get all organizations for current user"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        user_orgs = await organizations.find({"members.userId": current_user.id}).to_list(None)
        orgs = []
        for org in user_orgs:
            orgs.append(await Organization.from_db(org))

        return OrganizationsResponse(
            success=True,
            message="Organizations retrieved successfully",
            organizations=orgs
        )

    @strawberry.field
    async def organization(self, id: str, info: strawberry.Info) -> Organization:
        context : Context = info.context
        current_user = await context.authenticate()

        """Get organization by ID"""
        organization = await organizations.find_one({"_id": ObjectId(id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        return await Organization.from_db(organization)

@strawberry.type
class OrganizationMutation:
    @strawberry.mutation
    async def create_organization(self, input: CreateOrganizationInput, info: strawberry.Info) -> OrganizationResponse:
        """Create a new organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Create default roles
        default_roles = [
            {
                "name": "Owner",
                "description": "Organization owner with full access",
                "permissions": [perm.value for perm in OrganizationPermission],
                "isSystemRole": True
            },
            {
                "name": "Admin",
                "description": "Organization administrator",
                "permissions": [
                    OrganizationPermission.MANAGE_MEMBERS.value,
                    OrganizationPermission.MANAGE_ROLES.value,
                    OrganizationPermission.VIEW_ORGANIZATION.value,
                    OrganizationPermission.MANAGE_ORGANIZATION.value,
                    OrganizationPermission.VIEW_ANALYTICS.value,
                    OrganizationPermission.MANAGE_BILLING.value,
                    OrganizationPermission.MANAGE_SUBSCRIPTIONS.value,
                    OrganizationPermission.ACCESS_ISP_MANAGER.value,
                    OrganizationPermission.VIEW_ISP_MANAGER_DASHBOARD.value,
                    OrganizationPermission.VIEW_ISP_MANAGER_PACKAGES.value,
                    OrganizationPermission.MANAGE_ISP_MANAGER_PACKAGES.value,
                    OrganizationPermission.VIEW_ISP_MANAGER_CUSTOMERS.value,
                    OrganizationPermission.MANAGE_ISP_MANAGER_CUSTOMERS.value,
                    OrganizationPermission.VIEW_ISP_MANAGER_STATIONS.value,
                    OrganizationPermission.MANAGE_ISP_MANAGER_STATIONS.value,
                    OrganizationPermission.VIEW_ISP_MANAGER_INVENTORY.value,
                    OrganizationPermission.MANAGE_ISP_MANAGER_INVENTORY.value,
                    OrganizationPermission.VIEW_ISP_MANAGER_TICKETS.value,
                    OrganizationPermission.MANAGE_ISP_MANAGER_TICKETS.value,
                    OrganizationPermission.VIEW_MPESA_CONFIG.value,
                    OrganizationPermission.MANAGE_MPESA_CONFIG.value,
                    OrganizationPermission.VIEW_MPESA_TRANSACTIONS.value,
                    OrganizationPermission.VIEW_KOPOKOPO_CONFIG.value,
                    OrganizationPermission.MANAGE_KOPOKOPO_CONFIG.value,
                    OrganizationPermission.VIEW_KOPOKOPO_TRANSACTIONS.value,
                    OrganizationPermission.VIEW_SMS_CONFIG.value,
                    OrganizationPermission.MANAGE_SMS_CONFIG.value,
                    OrganizationPermission.VIEW_CUSTOMER_PAYMENTS.value,
                    OrganizationPermission.MANAGE_CUSTOMER_PAYMENTS.value,
                    OrganizationPermission.VIEW_ACTIVITY.value,
                    OrganizationPermission.CLEAR_ACTIVITY.value
                ],
                "isSystemRole": False
            },
            {
                "name": "Member",
                "description": "Regular organization member",
                "permissions": [OrganizationPermission.VIEW_ORGANIZATION.value],
                "isSystemRole": False
            }
        ]

        # Create organization
        organization_data = {
            "name": input.name,
            "description": input.description,
            "ownerId": current_user.id,
            "members": [{
                "userId": current_user.id,
                "roleName": "Owner",
                "status": OrganizationMemberStatus.ACTIVE.value
            }],
            "roles": default_roles,
            "status": OrganizationStatus.ACTIVE.value,
            "mpesaConfig": {
                "shortCode": None,
                "businessName": None,
                "accountReference": None,
                "isActive": False,
                "consumerKey": None,
                "consumerSecret": None,
                "passKey": None,
                "environment": "sandbox",
                "callbackUrl": None,
                "stkPushCallbackUrl": None,
                "c2bCallbackUrl": None,
                "b2cResultUrl": None,
                "b2cTimeoutUrl": None,
                "transactionType": "CustomerPayBillOnline",
                "stkPushShortCode": None,
                "stkPushPassKey": None,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            },
            "smsConfig": {
                "provider": None,
                "isActive": False,
                "apiKey": None,
                "apiSecret": None,
                "accountSid": None,
                "authToken": None,
                "username": None,
                "senderId": None,
                "callbackUrl": None,
                "environment": "sandbox",
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            },
            "kopokopoConfig": {
                "clientId": None,
                "clientSecret": None,
                "isActive": False,
                "environment": "sandbox",
                "businessName": None,
                "tillNumber": None,
                "webhookSecret": None,
                "webhookUrl": None,
                "callbackUrl": None,
                "buygoodsCallbackUrl": None,
                "b2bCallbackUrl": None,
                "settlementCallbackUrl": None,
                "defaultCurrency": "KES",
                "defaultNetwork": "SAFARICOM",
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            },
            # New robust fields
            "contact": {
                "email": input.contact.email if input.contact else None,
                "phone": input.contact.phone if input.contact else None,
                "website": input.contact.website if input.contact else None,
                "address": input.contact.address if input.contact else None,
                "city": input.contact.city if input.contact else None,
                "state": input.contact.state if input.contact else None,
                "country": input.contact.country if input.contact else None,
                "postalCode": input.contact.postalCode if input.contact else None,
                "timezone": input.contact.timezone if input.contact else None,
            } if input.contact else None,
            "business": {
                "legalName": input.business.legalName if input.business else None,
                "taxId": input.business.taxId if input.business else None,
                "registrationNumber": input.business.registrationNumber if input.business else None,
                "industry": input.business.industry if input.business else None,
                "businessType": input.business.businessType if input.business else None,
                "foundedDate": input.business.foundedDate if input.business else None,
                "employeeCount": input.business.employeeCount if input.business else None,
                "annualRevenue": input.business.annualRevenue if input.business else None,
                "logo": input.business.logo if input.business else None,
                "banner": input.business.banner if input.business else None,
                "socialMedia": input.business.socialMedia if input.business else None,
            } if input.business else None,

            "tags": input.tags or [],
            "customFields": {},
            "metadata": {},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await organizations.insert_one(organization_data)
        organization_data["_id"] = result.inserted_id

        # Update user's organizations list
        await users.update_one(
            {"_id": current_user.id},
            {"$push": {"organizations": str(result.inserted_id)}}
        )

        # Create default SMS templates for the organization
        for template in DEFAULT_SMS_TEMPLATES:
            await SmsTemplateService.create_template(
                organization_id=str(result.inserted_id),
                name=template["name"],
                content=template["content"],
                category=TemplateCategory(template["category"]),
                description=template.get("description"),
                variables=template.get("variables", []),
                is_active=True,
                created_by=str(current_user.id)
            )

        # Record activity
        await record_activity(
            current_user.id,
            result.inserted_id,
            f"created organization '{input.name}'"
        )

        return OrganizationResponse(
            success=True,
            message="Organization created successfully",
            organization=await Organization.from_db(organization_data)
        )

    @strawberry.mutation
    async def update_organization(self, id: str, input: CreateOrganizationInput, info: strawberry.Info) -> OrganizationResponse:
        """Update organization details"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to update organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_ORGANIZATION.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        update_data = {
            "name": input.name,
            "description": input.description,
            "updatedAt": datetime.now(timezone.utc)
        }

        # Update contact information if provided
        if input.contact:
            update_data["contact"] = {
                "email": input.contact.email,
                "phone": input.contact.phone,
                "website": input.contact.website,
                "address": input.contact.address,
                "city": input.contact.city,
                "state": input.contact.state,
                "country": input.contact.country,
                "postalCode": input.contact.postalCode,
                "timezone": input.contact.timezone,
            }

        # Update business information if provided
        if input.business:
            update_data["business"] = {
                "legalName": input.business.legalName,
                "taxId": input.business.taxId,
                "registrationNumber": input.business.registrationNumber,
                "industry": input.business.industry,
                "businessType": input.business.businessType,
                "foundedDate": input.business.foundedDate,
                "employeeCount": input.business.employeeCount,
                "annualRevenue": input.business.annualRevenue,
                "logo": input.business.logo,
                "banner": input.business.banner,
                "socialMedia": input.business.socialMedia,
            }

        # Update tags if provided
        if input.tags is not None:
            update_data["tags"] = input.tags

        await organizations.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(id),
            f"updated organization to '{input.name}'"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(id)})
        return OrganizationResponse(
            success=True,
            message="Organization updated successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def delete_organization(self, id: str, info: strawberry.Info) -> OrganizationResponse:
        """Delete an organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Only owner can delete organization
        if organization["ownerId"] != current_user.id:
            raise HTTPException(status_code=403, detail="Only organization owner can delete the organization")

        await organizations.delete_one({"_id": ObjectId(id)})

        # Remove organization from all members' organizations list
        member_ids = [member["userId"] for member in organization["members"]]
        await users.update_many(
            {"_id": {"$in": member_ids}},
            {"$pull": {"organizations": id}}
        )

        return OrganizationResponse(
            success=True,
            message="Organization deleted successfully",
            organization=await Organization.from_db(organization)
        )

    @strawberry.mutation
    async def invite_member(self, organization_id: str, email: str, role_name: str, info: strawberry.Info, message: Optional[str] = None) -> OrganizationResponse:
        """Invite a new member to the organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user is already an active member
        existing_member = next((member for member in organization["members"] if 
            (isinstance(member["userId"], str) and member["userId"] == email) or
            (isinstance(member["userId"], ObjectId) and str(member["userId"]) == email)), None)
        
        if existing_member:
            if existing_member["status"] == OrganizationMemberStatus.ACTIVE.value:
                raise HTTPException(status_code=400, detail="User is already an active member of this organization")
            elif existing_member["status"] == OrganizationMemberStatus.PENDING.value:
                raise HTTPException(status_code=400, detail="User has already been invited to this organization")

        # Check if user has a pending invitation
        existing_user = await users.find_one({"email": email})
        if existing_user:
            existing_member = next((member for member in organization["members"] if 
                member["userId"] == existing_user["_id"]), None)
            if existing_member:
                raise HTTPException(status_code=400, detail="User is already a member of this organization")

        # Create invitation token
        invitation_token = create_invitation_token(organization_id, email, role_name)
        invitation_url = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation_token}"

        # Send invitation email
        email_sent = await email_manager.send_organization_invitation(
            to_email=email,
            organization_name=organization["name"],
            inviter_name=f"{current_user.firstName} {current_user.lastName}",
            role_name=role_name,
            invite_message=message,
            invite_link=invitation_url
        )

        if not email_sent:
            raise HTTPException(status_code=500, detail="Failed to send invitation email")

        # Add pending member to organization
        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {
                "$push": {
                    "members": {
                        "userId": email,  # Store email as userId for pending invitations
                        "roleName": role_name,
                        "status": OrganizationMemberStatus.PENDING.value
                    }
                }
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"invited {email} as {role_name}"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Invitation sent successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def accept_invitation(self, token: str, info: strawberry.Info) -> OrganizationResponse:
        """Accept organization invitation"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("type") != "organization_invitation":
                raise HTTPException(status_code=400, detail="Invalid token type")

            organization_id = payload.get("organization_id")
            email = payload.get("email")
            role_name = payload.get("role_name")

            if email != current_user.email:
                raise HTTPException(status_code=400, detail="Invitation was sent to a different email")

            organization = await organizations.find_one({"_id": ObjectId(organization_id)})
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")

            # Check if user is already an active member
            existing_member = next(
                (member for member in organization["members"] 
                 if isinstance(member["userId"], ObjectId) and member["userId"] == current_user.id 
                 and member["status"] == OrganizationMemberStatus.ACTIVE.value),
                None
            )
            if existing_member:
                raise HTTPException(status_code=400, detail="You are already a member of this organization")

            # Remove any pending invitations for this user (both by email and userId)
            await organizations.update_one(
                {"_id": ObjectId(organization_id)},
                {
                    "$pull": {
                        "members": {
                            "$or": [
                                {"userId": email, "status": OrganizationMemberStatus.PENDING.value},
                                {"userId": current_user.id, "status": OrganizationMemberStatus.PENDING.value}
                            ]
                        }
                    }
                }
            )

            # Add user as member
            await organizations.update_one(
                {"_id": ObjectId(organization_id)},
                {
                    "$push": {
                        "members": {
                            "userId": current_user.id,
                            "roleName": role_name,
                            "status": OrganizationMemberStatus.ACTIVE.value
                        }
                    }
                }
            )

            # Update user's organizations list if not already present
            await users.update_one(
                {
                    "_id": current_user.id,
                    "organizations": {"$ne": organization_id}
                },
                {
                    "$addToSet": {"organizations": organization_id}
                }
            )

            # Record activity
            await record_activity(
                current_user.id,
                ObjectId(organization_id),
                "joined organization"
            )

            # Get updated organization
            updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
            
            return OrganizationResponse(
                success=True,
                message="Invitation accepted successfully",
                organization=await Organization.from_db(updated_org)
            )

        except PyJWTError:
            raise HTTPException(status_code=400, detail="Invalid token")

    @strawberry.input
    class CreateRoleInput:
        name: str
        description: Optional[str] = None
        permissions: List[OrganizationPermission]

    @strawberry.mutation
    async def create_role(self, organization_id: str, input: CreateRoleInput, info: strawberry.Info) -> OrganizationResponse:
        """Create a new role in the organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage roles
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_ROLES.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Check if role name already exists
        if any(role["name"] == input.name for role in organization["roles"]):
            raise HTTPException(status_code=400, detail="Role name already exists")

        new_role = {
            "name": input.name,
            "description": input.description,
            "permissions": [perm.value for perm in input.permissions],
            "isSystemRole": False
        }

        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {
                "$push": {"roles": new_role},
                "$set": {"updatedAt": datetime.now(timezone.utc)}
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"created role '{input.name}'"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Role created successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.input
    class UpdateRoleInput:
        name: str
        description: Optional[str] = None
        permissions: List[OrganizationPermission]

    @strawberry.mutation
    async def update_role(self, organization_id: str, role_name: str, input: UpdateRoleInput, info: strawberry.Info) -> OrganizationResponse:
        """Update an existing role in the organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage roles
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_ROLES.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Find the role to update
        role_to_update = next((role for role in organization["roles"] if role["name"] == role_name), None)
        if not role_to_update:
            raise HTTPException(status_code=404, detail="Role not found")

        # Prevent updating system roles
        if role_to_update.get("isSystemRole", False):
            raise HTTPException(status_code=403, detail="Cannot modify system roles")

        # Check if new role name already exists (if name is being changed)
        if input.name != role_name and any(role["name"] == input.name for role in organization["roles"]):
            raise HTTPException(status_code=400, detail="Role name already exists")

        # Update the role
        updated_role = {
            "name": input.name,
            "description": input.description,
            "permissions": [perm.value for perm in input.permissions],
            "isSystemRole": role_to_update.get("isSystemRole", False)
        }

        await organizations.update_one(
            {"_id": ObjectId(organization_id), "roles.name": role_name},
            {
                "$set": {
                    "roles.$": updated_role,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"updated role '{role_name}' to '{input.name}'"
        )

        # If role name changed, update all members using this role
        if input.name != role_name:
            await organizations.update_many(
                {"_id": ObjectId(organization_id), "members.roleName": role_name},
                {"$set": {"members.$.roleName": input.name}}
            )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Role updated successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def delete_role(self, organization_id: str, role_name: str, info: strawberry.Info) -> OrganizationResponse:
        """Delete a role from the organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage roles
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_ROLES.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Find the role to delete
        role_to_delete = next((role for role in organization["roles"] if role["name"] == role_name), None)
        if not role_to_delete:
            raise HTTPException(status_code=404, detail="Role not found")

        # Prevent deleting system roles
        if role_to_delete.get("isSystemRole", False):
            raise HTTPException(status_code=403, detail="Cannot delete system roles")

        # Check if role is being used by any members
        if any(member["roleName"] == role_name for member in organization["members"]):
            raise HTTPException(status_code=400, detail="Cannot delete role that is currently assigned to members")

        # Delete the role
        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {
                "$pull": {"roles": {"name": role_name}},
                "$set": {"updatedAt": datetime.now(timezone.utc)}
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"deleted role '{role_name}'"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Role deleted successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def update_member(self, organization_id: str, user_id: str, role_name: str, info: strawberry.Info) -> OrganizationResponse:
        """Update a member's role in the organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage members
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_MEMBERS.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Check if role exists
        if not any(role["name"] == role_name for role in organization["roles"]):
            raise HTTPException(status_code=404, detail="Role not found")

        # Check if member exists
        member_to_update = next((member for member in organization["members"] 
                               if str(member["userId"]) == user_id 
                               and member["status"] == OrganizationMemberStatus.ACTIVE.value), None)
        if not member_to_update:
            raise HTTPException(status_code=404, detail="Member not found")

        # Prevent updating owner's role
        if organization["ownerId"] == ObjectId(user_id):
            raise HTTPException(status_code=403, detail="Cannot modify organization owner's role")

        # Update member's role
        await organizations.update_one(
            {
                "_id": ObjectId(organization_id),
                "members": {
                    "$elemMatch": {
                        "userId": ObjectId(user_id),
                        "status": OrganizationMemberStatus.ACTIVE.value
                    }
                }
            },
            {
                "$set": {
                    "members.$.roleName": role_name,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        # Get member's name for activity log
        member_user = await users.find_one({"_id": ObjectId(user_id)})
        member_name = f"{member_user['firstName']} {member_user['lastName']}" if member_user else user_id

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"updated {member_name}'s role to {role_name}"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Member role updated successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def remove_member(self, organization_id: str, user_id: str, info: strawberry.Info) -> OrganizationResponse:
        """Remove a member from the organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage members
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_MEMBERS.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Check if member exists (active or pending)
        member_to_remove = next((member for member in organization["members"] 
                               if (str(member["userId"]) == user_id or member["userId"] == user_id)
                               and member["status"] in [OrganizationMemberStatus.ACTIVE.value, OrganizationMemberStatus.PENDING.value]), None)
        if not member_to_remove:
            raise HTTPException(status_code=404, detail="Member not found")

        # Prevent removing the owner (only applies to active members with ObjectId)
        if member_to_remove["status"] == OrganizationMemberStatus.ACTIVE.value and organization["ownerId"] == ObjectId(user_id):
            raise HTTPException(status_code=403, detail="Cannot remove organization owner")

        # Remove member from organization
        if member_to_remove["status"] == OrganizationMemberStatus.PENDING.value and isinstance(member_to_remove["userId"], str):
            # Remove pending invite by email
            await organizations.update_one(
                {"_id": ObjectId(organization_id)},
                {
                    "$pull": {
                        "members": {
                            "userId": user_id,
                            "status": OrganizationMemberStatus.PENDING.value
                        }
                    },
                    "$set": {"updatedAt": datetime.now(timezone.utc)}
                }
            )
        else:
            # Remove active member by ObjectId
            await organizations.update_one(
                {"_id": ObjectId(organization_id)},
                {
                    "$pull": {
                        "members": {
                            "userId": ObjectId(user_id),
                            "status": OrganizationMemberStatus.ACTIVE.value
                        }
                    },
                    "$set": {"updatedAt": datetime.now(timezone.utc)}
                }
            )

        # Remove organization from user's organizations list (only for active members with ObjectId)
        if member_to_remove["status"] == OrganizationMemberStatus.ACTIVE.value and not isinstance(member_to_remove["userId"], str):
            await users.update_one(
                {"_id": ObjectId(user_id)},
                {"$pull": {"organizations": str(organization_id)}}
            )

        # Get member's name for activity log (try to fetch if ObjectId, else use email)
        member_name = user_id
        if member_to_remove["status"] == OrganizationMemberStatus.ACTIVE.value and not isinstance(member_to_remove["userId"], str):
            member_user = await users.find_one({"_id": ObjectId(user_id)})
            if member_user:
                member_name = f"{member_user.get('firstName', '')} {member_user.get('lastName', '')}".strip() or user_id

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"removed {member_name} from organization"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Member removed successfully",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def update_mpesa_configuration(self, organization_id: str, input: MpesaConfigurationInput, info: strawberry.Info) -> OrganizationResponse:
        """Update Mpesa configuration for an organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to update organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_MPESA_CONFIG.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Create Mpesa configuration with only essential fields
        mpesa_config = {
            "shortCode": input.shortCode,
            "businessName": input.businessName,
            "accountReference": input.accountReference,
            "isActive": input.isActive,
            "consumerKey": input.consumerKey,
            "consumerSecret": input.consumerSecret,
            "passKey": input.passKey,
            "environment": input.environment,
            "transactionType": input.transactionType,
            "stkPushShortCode": input.stkPushShortCode or input.shortCode,
            "stkPushPassKey": input.stkPushPassKey or input.passKey,
            "updatedAt": datetime.now(timezone.utc)
        }
        
        # Preserve existing callback URLs and creation date if they exist
        if organization.get("mpesaConfig"):
            existing_config = organization["mpesaConfig"]
            for field in ["callbackUrl", "stkPushCallbackUrl", "c2bCallbackUrl", 
                         "validationUrl", "b2cResultUrl", "b2cTimeoutUrl", "callbacksRegistered", "createdAt"]:
                if field in existing_config and existing_config[field]:
                    mpesa_config[field] = existing_config[field]
            
            if "createdAt" not in mpesa_config:
                mpesa_config["createdAt"] = datetime.now(timezone.utc)

        # Update organization with Mpesa configuration
        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {
                "$set": {
                    "mpesaConfig": mpesa_config,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"updated Mpesa configuration for the organization"
        )

        # Try to automatically register the callbacks with Mpesa API
        auto_registration_result = False
        registration_message = ""
        if input.isActive and input.consumerKey and input.consumerSecret and input.shortCode:
            try:
                # Get access token
                access_token = await get_mpesa_access_token(
                    input.consumerKey,
                    input.consumerSecret,
                    input.environment or "sandbox"
                )
                
                if access_token:
                    # Register C2B URLs - let register_c2b_urls handle the URL generation
                    auto_registration_result = await register_c2b_urls(
                        organization_id,
                        input.shortCode,
                        access_token,
                        input.environment or "sandbox"
                    )
                    
                    if auto_registration_result:
                        registration_message = " and callbacks registered with M-Pesa"
                        # Add activity for successful registration
                        await record_activity(
                            current_user.id,
                            ObjectId(organization_id),
                            "registered Mpesa callbacks"
                        )
                    else:
                        registration_message = " but callback registration failed"
                else:
                    registration_message = " but couldn't obtain M-Pesa token"
            except Exception as e:
                logger.error(f"Error registering Mpesa callbacks: {str(e)}")
                registration_message = f" but callback registration failed: {str(e)}"
        elif input.isActive:
            registration_message = " (callback registration requires credentials)"

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="Mpesa configuration updated successfully" + registration_message,
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def update_sms_configuration(self, organization_id: str, input: SmsConfigurationInput, info: strawberry.Info) -> OrganizationResponse:
        """Update SMS configuration for an organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to update organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_SMS_CONFIG.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Create SMS configuration
        sms_config = {
            "provider": input.provider,
            "isActive": input.isActive,
            "apiKey": input.apiKey,
            "apiSecret": input.apiSecret,
            "accountSid": input.accountSid,
            "authToken": input.authToken,
            "username": input.username,
            "partnerID": input.partnerID,
            "senderId": input.senderId,
            "environment": input.environment,
            "password": input.password,
            "msgType": input.msgType,
            "updatedAt": datetime.now(timezone.utc)
        }
        
        # Generate callback URL if needed
        base_url = settings.API_URL
        callback_url = f"{base_url}/api/sms/callback/{organization_id}"
        sms_config["callbackUrl"] = callback_url
        
        # Preserve creation date if it exists
        if organization.get("smsConfig") and organization["smsConfig"].get("createdAt"):
            sms_config["createdAt"] = organization["smsConfig"]["createdAt"]
        else:
            sms_config["createdAt"] = datetime.now(timezone.utc)

        # Update organization with SMS configuration
        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {
                "$set": {
                    "smsConfig": sms_config,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"updated SMS configuration for the organization"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message=f"SMS configuration updated successfully for provider {input.provider}",
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def update_kopokopo_configuration(self, organization_id: str, input: KopoKopoConfigurationInput, info: strawberry.Info) -> OrganizationResponse:
        """Update KopoKopo configuration for an organization"""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to update organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_KOPOKOPO_CONFIG.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Create KopoKopo configuration
        kopokopo_config = {
            "clientId": input.clientId,
            "clientSecret": input.clientSecret,
            "isActive": input.isActive,
            "environment": input.environment,
            "businessName": input.businessName,
            "tillNumber": input.tillNumber,
            "webhookSecret": input.webhookSecret,
            "defaultCurrency": input.defaultCurrency,
            "defaultNetwork": input.defaultNetwork,
            "updatedAt": datetime.now(timezone.utc)
        }
        
        # Generate callback URLs
        base_url = settings.API_URL
        kopokopo_config["callbackUrl"] = f"{base_url}/api/payments/kopokopo/callback/{organization_id}"
        kopokopo_config["buygoodsCallbackUrl"] = f"{base_url}/api/payments/kopokopo/callback/{organization_id}/buygoods"
        kopokopo_config["b2bCallbackUrl"] = f"{base_url}/api/payments/kopokopo/callback/{organization_id}/b2b"
        kopokopo_config["settlementCallbackUrl"] = f"{base_url}/api/payments/kopokopo/callback/{organization_id}/settlement"
        kopokopo_config["webhookUrl"] = f"{base_url}/api/payments/kopokopo/webhook/{organization_id}"
        
        # Preserve creation date if it exists
        if organization.get("kopokopoConfig") and organization["kopokopoConfig"].get("createdAt"):
            kopokopo_config["createdAt"] = organization["kopokopoConfig"]["createdAt"]
        else:
            kopokopo_config["createdAt"] = datetime.now(timezone.utc)

        # Update organization with KopoKopo configuration
        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {
                "$set": {
                    "kopokopoConfig": kopokopo_config,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"updated KopoKopo configuration for the organization"
        )

        # Try to automatically register webhooks with KopoKopo API
        webhook_registration_result = False
        registration_message = ""
        if input.clientId and input.clientSecret:
            try:
                from app.api.kopokopo import KopoKopoService
                
                logger.info(f"Starting KopoKopo webhook registration for org {organization_id}")
                logger.info(f"Client ID: {input.clientId[:8]}...")
                logger.info(f"Environment: {input.environment or 'sandbox'}")
                
                # Get access token
                access_token = await KopoKopoService.get_access_token(
                    input.clientId,
                    input.clientSecret,
                    input.environment or "sandbox"
                )
                
                logger.info(f"Access token: {access_token}")
                if access_token:
                    # Register webhooks
                    webhook_registration_result = await KopoKopoService.create_webhook_subscription(
                        organization_id,
                        input.clientId,
                        access_token,
                        input.environment or "sandbox",
                        input.tillNumber
                    )
                    logger.info(f"Webhook registration result: {webhook_registration_result}")
                    
                    if webhook_registration_result:
                        registration_message = " and webhooks registered with KopoKopo"
                        # Add activity for successful registration
                        await record_activity(
                            current_user.id,
                            ObjectId(organization_id),
                            "registered KopoKopo webhooks"
                        )
                    else:
                        registration_message = " but webhook registration failed"
                else:
                    registration_message = " but couldn't obtain KopoKopo token"
            except Exception as e:
                logger.error(f"Error registering KopoKopo webhooks: {str(e)}")
                registration_message = f" but webhook registration failed: {str(e)}"
        elif not input.clientId or not input.clientSecret:
            registration_message = " (webhook registration requires credentials)"

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message="KopoKopo configuration updated successfully" + registration_message,
            organization=await Organization.from_db(updated_org)
        )

    @strawberry.mutation
    async def set_payment_method(self, organization_id: str, input: PaymentMethodInput, info: strawberry.Info) -> OrganizationResponse:
        """Set the active payment method for an organization."""
        context = info.context
        current_user = await context.authenticate()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage payment methods
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role:
            raise HTTPException(status_code=403, detail="User role not found")

        # Determine required permission based on the payment method
        required_permission = None
        if input.paymentMethod == PaymentMethodType.MPESA:
            required_permission = OrganizationPermission.MANAGE_MPESA_CONFIG
        elif input.paymentMethod == PaymentMethodType.KOPOKOPO:
            required_permission = OrganizationPermission.MANAGE_KOPOKOPO_CONFIG
        elif input.paymentMethod == PaymentMethodType.SMS:
            required_permission = OrganizationPermission.MANAGE_SMS_CONFIG

        if not required_permission or required_permission not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions to manage this payment method")

        # Verify the payment method is configured (but not necessarily active yet)
        if input.paymentMethod == PaymentMethodType.MPESA:
            if not organization.get("mpesaConfig"):
                raise HTTPException(status_code=400, detail="M-Pesa is not configured")
        elif input.paymentMethod == PaymentMethodType.KOPOKOPO:
            if not organization.get("kopokopoConfig"):
                raise HTTPException(status_code=400, detail="KopoKopo is not configured")
        elif input.paymentMethod == PaymentMethodType.SMS:
            if not organization.get("smsConfig"):
                raise HTTPException(status_code=400, detail="SMS is not configured")

        # Update payment method and automatically activate it
        update_data = {
            "paymentMethod": input.paymentMethod.value,
            "updatedAt": datetime.now(timezone.utc)
        }

        # Automatically activate the selected payment method
        if input.paymentMethod == PaymentMethodType.MPESA:
            update_data["mpesaConfig.isActive"] = True
        elif input.paymentMethod == PaymentMethodType.KOPOKOPO:
            update_data["kopokopoConfig.isActive"] = True
        elif input.paymentMethod == PaymentMethodType.SMS:
            update_data["smsConfig.isActive"] = True

        await organizations.update_one(
            {"_id": ObjectId(organization_id)},
            {"$set": update_data}
        )

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(organization_id),
            f"set payment method to {input.paymentMethod.name}"
        )

        updated_org = await organizations.find_one({"_id": ObjectId(organization_id)})
        return OrganizationResponse(
            success=True,
            message=f"Payment method updated successfully to {input.paymentMethod.name}",
            organization=await Organization.from_db(updated_org)
        )

