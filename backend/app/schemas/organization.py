from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import strawberry
from app.schemas.user import User
from enum import Enum
from app.models.organization import DBOrganization, DBOrganizationMember
from app.config.database import users

@strawberry.enum
class OrganizationPermission(str, Enum):
    MANAGE_MEMBERS = "MANAGE_MEMBERS"
    MANAGE_ROLES = "MANAGE_ROLES"
    MANAGE_ORGANIZATION = "MANAGE_ORGANIZATION"
    VIEW_ANALYTICS = "VIEW_ANALYTICS"
    MANAGE_BILLING = "MANAGE_BILLING"
    MANAGE_SUBSCRIPTIONS = "MANAGE_SUBSCRIPTIONS"
    ACCESS_ISP_MANAGER = "ACCESS_ISP_MANAGER"
    VIEW_ISP_MANAGER_DASHBOARD = "VIEW_ISP_MANAGER_DASHBOARD"
    VIEW_ISP_MANAGER_PACKAGES = "VIEW_ISP_MANAGER_PACKAGES"
    MANAGE_ISP_MANAGER_PACKAGES = "MANAGE_ISP_MANAGER_PACKAGES"
    
@strawberry.enum
class OrganizationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"
    ARCHIVED = "ARCHIVED"

@strawberry.enum
class OrganizationMemberStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

@strawberry.type
class OrganizationRole:
    name: str
    description: Optional[str] = None
    permissions: List[OrganizationPermission]
    isSystemRole: bool = False



@strawberry.type
class OrganizationMember:
    user: User
    role: OrganizationRole
    status: OrganizationMemberStatus

    @classmethod
    def from_db(cls, member: DBOrganizationMember, roles: List[OrganizationRole]):
        role = next((role for role in roles if role.name == member.roleName), None)
        converted_member = member.model_dump()
        converted_member["user"] = User.from_db(users.find_one({"_id": member.userId}))
        converted_member["role"] = role
        converted_member["status"] = member.status
        return cls(**converted_member)

@strawberry.type
class Organization(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner: User
    members: List[OrganizationMember]
    roles: List[OrganizationRole]
    status: OrganizationStatus
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    def from_db(cls, organization: DBOrganization):
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
    organizations: List[Organization]




