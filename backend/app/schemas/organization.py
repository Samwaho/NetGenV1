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
    user: Optional["User"] = None  # Make user field optional with default None
    role: OrganizationRole
    status: OrganizationMemberStatus
    email: Optional[str] = None  # Add email field for pending invitations

    @classmethod
    async def from_db(cls, member, roles: List[OrganizationRole]):
        from app.schemas.user import User
        from app.config.database import users

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
        role = next((r for r in roles if 
            (isinstance(r, dict) and r.get("name") == role_name) or
            (hasattr(r, 'name') and r.name == role_name)), None)

        # Handle pending invitations where userId is an email
        if isinstance(user_id, str) and '@' in user_id:
            return cls(
                user=None,
                role=role,
                status=status,
                email=user_id
            )

        # Fetch user data for active members - use skip_orgs=True to prevent infinite recursion
        user_data = await users.find_one({"_id": user_id}) if user_id else None
        user = await User.from_db(user_data, skip_orgs=True) if user_data else None

        return cls(
            user=user,
            role=role,
            status=status,
            email=user.email if user else None
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

        # Fetch owner data - use skip_orgs=True to prevent infinite recursion
        owner_data = await users.find_one({"_id": owner_id}) if owner_id else None
        owner = await User.from_db(owner_data, skip_orgs=True) if owner_data else None

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



