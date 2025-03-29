import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.config.database import users
from app.schemas.enums import OrganizationPermission, OrganizationStatus, OrganizationMemberStatus
from app.schemas.user import User
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class OrganizationRole:
    name: str
    description: Optional[str] = None
    permissions: List[OrganizationPermission] = field(default_factory=list)
    isSystemRole: bool = False

@strawberry.type
class OrganizationMember:
    user: "User"
    role: OrganizationRole
    status: OrganizationMemberStatus

    @classmethod
    async def from_db(cls, member, roles: List[OrganizationRole]):
        from app.schemas.user import User  # Import here to avoid circular import

        # Handle both dictionary and object types
        if isinstance(member, dict):
            user_id = member.get("userId")
            role_name = member.get("roleName")
            status = member.get("status")
        else:
            user_id = member.userId
            role_name = member.roleName
            status = member.status

        # Find the role
        role = None
        for r in roles:
            if isinstance(r, dict) and r.get("name", "") == role_name:
                role = r
                break
            elif hasattr(r, 'name') and r.name == role_name:
                role = r
                break

        # Fetch user data
        user_data = await users.find_one({"_id": user_id}) if user_id else None
        user = await User.from_db(user_data) if user_data else None

        return cls(
            user=user,
            role=role,
            status=status
        )

@strawberry.type
class Organization:
    id: str
    name: str
    description: Optional[str] = None
    owner: User
    members: List[OrganizationMember] = field(default_factory=list)
    roles: List[OrganizationRole] = field(default_factory=list)
    status: OrganizationStatus
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, organization):
        from app.schemas.user import User  # Import here to avoid circular import

        # Handle both dictionary and object types
        if isinstance(organization, dict):
            org_id = organization.get("_id")
            owner_id = organization.get("ownerId")
            name = organization.get("name")
            description = organization.get("description")
            members = organization.get("members", [])
            roles = organization.get("roles", [])
            status = organization.get("status")
            created_at = organization.get("createdAt")
            updated_at = organization.get("updatedAt")
        else:
            org_id = organization._id
            owner_id = organization.ownerId
            name = organization.name
            description = organization.description
            members = organization.members
            roles = organization.roles
            status = organization.status
            created_at = organization.createdAt
            updated_at = organization.updatedAt

        # Fetch owner data
        owner_data = await users.find_one({"_id": owner_id}) if owner_id else None
        owner = await User.from_db(owner_data) if owner_data else None

        # Process roles
        processed_roles = []
        for role in roles:
            if isinstance(role, dict):
                # Convert dictionary to OrganizationRole object
                processed_role = OrganizationRole(
                    name=role.get("name", ""),
                    description=role.get("description"),
                    permissions=role.get("permissions", []),
                    isSystemRole=role.get("isSystemRole", False)
                )
                processed_roles.append(processed_role)
            else:
                processed_roles.append(role)

        # Process members
        processed_members = []
        for member in members:
            processed_members.append(await OrganizationMember.from_db(member, processed_roles))

        return cls(
            id=org_id,
            name=name,
            description=description,
            owner=owner,
            members=processed_members,
            roles=processed_roles,
            status=status,
            createdAt=created_at,
            updatedAt=updated_at
        )

@strawberry.type
class OrganizationResponse:
    success: bool
    message: str
    organization: Organization

@strawberry.type
class OrganizationsResponse:
    success: bool
    message: str
    organizations: List[Organization] = field(default_factory=list)

@strawberry.input
class CreateOrganizationInput:
    name: str
    description: Optional[str] = None



