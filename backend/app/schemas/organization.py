import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.models.organization import DBOrganization, DBOrganizationMember
from app.config.database import users
from app.schemas.enums import OrganizationPermission, OrganizationStatus, OrganizationMemberStatus
from app.schemas.user import User

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
    def from_db(cls, member: DBOrganizationMember, roles: List[OrganizationRole]):
        from app.schemas.user import User  # Import here to avoid circular import
        role = next((role for role in roles if role.name == member.roleName), None)
        converted_member = member.model_dump()
        converted_member["user"] = User.from_db(users.find_one({"_id": member.userId}))
        converted_member["role"] = role
        converted_member["status"] = member.status
        return cls(**converted_member)

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
    def from_db(cls, organization: DBOrganization):
        from app.schemas.user import User  # Import here to avoid circular import
        converted_organization = organization.model_dump()
        converted_organization["id"] = organization._id
        converted_organization["owner"] = User.from_db(users.find_one({"_id": organization.ownerId}))
        converted_organization["members"] = [OrganizationMember.from_db(member, organization.roles) for member in organization.members]
        return cls(**converted_organization)

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






