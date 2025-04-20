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
class MpesaConfiguration:
    shortCode: Optional[str] = None
    businessName: Optional[str] = None
    accountReference: Optional[str] = None
    isActive: bool = False
    consumerKey: Optional[str] = None
    consumerSecret: Optional[str] = None
    passKey: Optional[str] = None
    environment: Optional[str] = "sandbox"
    
    # Callback URLs
    callbackUrl: Optional[str] = None
    stkPushCallbackUrl: Optional[str] = None
    c2bCallbackUrl: Optional[str] = None
    b2cResultUrl: Optional[str] = None
    b2cTimeoutUrl: Optional[str] = None
    
    # Transaction configuration
    transactionType: Optional[str] = "CustomerPayBillOnline"
    stkPushShortCode: Optional[str] = None
    stkPushPassKey: Optional[str] = None
    
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

@strawberry.type
class DBOrganization:
    _id: str
    name: str
    description: Optional[str] = None
    ownerId: str
    members: List[DBOrganizationMember]
    roles: List[OrganizationRole]
    status: OrganizationStatus
    mpesaConfig: Optional[MpesaConfiguration] = None
    createdAt: datetime
    updatedAt: datetime
