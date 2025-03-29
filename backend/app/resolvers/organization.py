from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import organizations, users
from app.schemas.organization import (
    Organization,
    OrganizationResponse,
    OrganizationsResponse,
    CreateOrganizationInput,
    OrganizationMember
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

logger = logging.getLogger(__name__)

@strawberry.type
class OrganizationResolver:

    @strawberry.field
    async def organization(self, id: str, info: strawberry.Info) -> Organization:
        context : Context = info.context
        current_user = await context.authenticate()

        """Get organization by ID"""
        organization = await organizations.find_one({"_id": ObjectId(id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        return await Organization.from_db(organization)

    @strawberry.field
    async def organizations(self, info: strawberry.Info) -> OrganizationsResponse:
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
                    OrganizationPermission.MANAGE_ORGANIZATION.value,
                    OrganizationPermission.VIEW_ANALYTICS.value
                ],
                "isSystemRole": True
            },
            {
                "name": "Member",
                "description": "Regular organization member",
                "permissions": [],
                "isSystemRole": True
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

        await organizations.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
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

        # Check if user has permission to invite members
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or OrganizationPermission.MANAGE_MEMBERS.value not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Check if role exists
        role = next((role for role in organization["roles"] if role["name"] == role_name), None)
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role")

        # Check if user is already a member
        if any(member["userId"] == email for member in organization["members"]):
            raise HTTPException(status_code=400, detail="User is already a member")

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

        return OrganizationResponse(
            success=True,
            message="Invitation sent successfully",
            organization=await Organization.from_db(organization)
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

            # Update user's organizations list
            await users.update_one(
                {"_id": current_user.id},
                {"$push": {"organizations": organization_id}}
            )

            return OrganizationResponse(
                success=True,
                message="Invitation accepted successfully",
                organization=await Organization.from_db(organization)
            )

        except jwt.JWTError:
            raise HTTPException(status_code=400, detail="Invalid token")


