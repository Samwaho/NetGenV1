import strawberry
from datetime import datetime
from typing import Optional, List
from app.schemas.enums import OrganizationStatus, OrganizationMemberStatus, OrganizationPermission
from dataclasses import field

@strawberry.type
class OrganizationRole:
    name: str
    description: Optional[str] = None
    permissions: List[OrganizationPermission] = field(default_factory=list)
    isSystemRole: bool = False

@strawberry.type
class DBOrganizationMember:
    userId: str
    roleName: str
    status: OrganizationMemberStatus

@strawberry.type
class DBOrganization:
    _id: str
    name: str
    description: Optional[str] = None
    ownerId: str
    members: List[DBOrganizationMember]
    roles: List[OrganizationRole]
    status: OrganizationStatus
    createdAt: datetime
    updatedAt: datetime
