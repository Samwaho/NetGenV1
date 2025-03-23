from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.organization import  OrganizationPermission, OrganizationStatus, OrganizationMemberStatus, OrganizationRole

class DBOrganizationMember(BaseModel):
    userId: str
    roleName: str
    status: OrganizationMemberStatus


class DBOrganization(BaseModel):
    _id: str
    name: str
    description: Optional[str] = None
    ownerId: str
    members: List[DBOrganizationMember]
    roles: List[OrganizationRole]
    status: OrganizationStatus
    createdAt: datetime
    updatedAt: datetime
