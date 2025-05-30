import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.config.database import users
from app.schemas.enums import OrganizationPermission, OrganizationStatus, OrganizationMemberStatus
from app.schemas.user import User
import logging
from bson.objectid import ObjectId

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

        # Convert user_id to ObjectId if needed
        if user_id and not isinstance(user_id, ObjectId):
            try:
                user_id = ObjectId(user_id)
            except Exception:
                pass
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
class MpesaConfiguration:
    shortCode: Optional[str] = None  # Paybill or till number
    businessName: Optional[str] = None
    accountReference: Optional[str] = None
    isActive: bool = False
    consumerKey: Optional[str] = None
    consumerSecret: Optional[str] = None
    passKey: Optional[str] = None  # For STK Push/Lipa Na M-Pesa
    environment: Optional[str] = "sandbox"  # sandbox or production
    
    # Callback URLs - we'll generate these automatically for the organization
    callbackUrl: Optional[str] = None  # General callback
    stkPushCallbackUrl: Optional[str] = None
    c2bCallbackUrl: Optional[str] = None
    b2cResultUrl: Optional[str] = None
    b2cTimeoutUrl: Optional[str] = None
    
    # Transaction configuration
    transactionType: Optional[str] = "CustomerPayBillOnline"  # For STK Push
    stkPushShortCode: Optional[str] = None  # Can be different from main shortCode
    stkPushPassKey: Optional[str] = None
    
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

@strawberry.type
class SmsConfiguration:
    provider: str  # e.g., "twilio", "africas_talking", "vonage"
    isActive: bool = False
    
    # Common API credentials
    apiKey: Optional[str] = None
    apiSecret: Optional[str] = None
    accountSid: Optional[str] = None  # For Twilio
    authToken: Optional[str] = None  # For Twilio
    username: Optional[str] = None  # For AfricasTalking
    partnerID: Optional[str] = None  # For TextSMS
    
    # Sender information
    senderId: Optional[str] = None  # From number or alphanumeric ID
    
    # Optional callback URL for delivery reports
    callbackUrl: Optional[str] = None
    
    # Environment setting
    environment: Optional[str] = "sandbox"  # sandbox or production
    
    # For Zettatel
    userId: Optional[str] = None  # For Zettatel (username field can be reused)
    password: Optional[str] = None  # For Zettatel
    msgType: Optional[str] = None  # For Zettatel (text or unicode)
    
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

@strawberry.type
class Organization:
    id: str
    name: str
    description: Optional[str] = None
    owner: User
    members: List[OrganizationMember] = field(default_factory=list)
    roles: List[OrganizationRole] = field(default_factory=list)
    status: OrganizationStatus
    mpesaConfig: Optional[MpesaConfiguration] = None
    smsConfig: Optional[SmsConfiguration] = None
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
            mpesa_config = organization.get("mpesaConfig")
            sms_config = organization.get("smsConfig")
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
            mpesa_config = getattr(organization, "mpesaConfig", None)
            sms_config = getattr(organization, "smsConfig", None)

        # Fetch owner data - use skip_orgs=True to prevent infinite recursion
        if owner_id and not isinstance(owner_id, ObjectId):
            try:
                owner_id = ObjectId(owner_id)
            except Exception:
                pass
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

        # Process Mpesa configuration
        mpesa_configuration = None
        if mpesa_config:
            mpesa_configuration = MpesaConfiguration(
                shortCode=mpesa_config.get("shortCode"),
                businessName=mpesa_config.get("businessName"),
                accountReference=mpesa_config.get("accountReference"),
                isActive=mpesa_config.get("isActive", False),
                consumerKey=mpesa_config.get("consumerKey"),
                consumerSecret=mpesa_config.get("consumerSecret"),
                passKey=mpesa_config.get("passKey"),
                environment=mpesa_config.get("environment"),
                callbackUrl=mpesa_config.get("callbackUrl"),
                stkPushCallbackUrl=mpesa_config.get("stkPushCallbackUrl"),
                c2bCallbackUrl=mpesa_config.get("c2bCallbackUrl"),
                b2cResultUrl=mpesa_config.get("b2cResultUrl"),
                b2cTimeoutUrl=mpesa_config.get("b2cTimeoutUrl"),
                transactionType=mpesa_config.get("transactionType"),
                stkPushShortCode=mpesa_config.get("stkPushShortCode"),
                stkPushPassKey=mpesa_config.get("stkPushPassKey"),
                createdAt=mpesa_config.get("createdAt"),
                updatedAt=mpesa_config.get("updatedAt")
            )

        # Process SMS configuration
        sms_configuration = None
        if sms_config:
            sms_configuration = SmsConfiguration(
                provider=sms_config.get("provider"),
                isActive=sms_config.get("isActive", False),
                apiKey=sms_config.get("apiKey"),
                apiSecret=sms_config.get("apiSecret"),
                accountSid=sms_config.get("accountSid"),
                authToken=sms_config.get("authToken"),
                username=sms_config.get("username"),
                partnerID=sms_config.get("partnerID"),
                senderId=sms_config.get("senderId"),
                callbackUrl=sms_config.get("callbackUrl"),
                environment=sms_config.get("environment"),
                password=sms_config.get("password"),  # Add password field
                msgType=sms_config.get("msgType"),    # Add msgType field
                userId=sms_config.get("userId"),      # Add userId field if needed
                createdAt=sms_config.get("createdAt"),
                updatedAt=sms_config.get("updatedAt")
            )

        return cls(
            id=org_id,
            name=name,
            description=description,
            owner=owner,
            members=processed_members,
            roles=processed_roles,
            status=status,
            mpesaConfig=mpesa_configuration,
            smsConfig=sms_configuration,
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

@strawberry.input
class MpesaConfigurationInput:
    shortCode: str
    businessName: str
    accountReference: Optional[str] = None
    isActive: bool = True
    consumerKey: Optional[str] = None
    consumerSecret: Optional[str] = None
    passKey: Optional[str] = None
    environment: Optional[str] = "sandbox"
    transactionType: Optional[str] = "CustomerPayBillOnline"
    stkPushShortCode: Optional[str] = None
    stkPushPassKey: Optional[str] = None
    # Callback URLs will be generated by the server

@strawberry.input
class SmsConfigurationInput:
    provider: str
    isActive: bool = True
    apiKey: Optional[str] = None
    apiSecret: Optional[str] = None
    accountSid: Optional[str] = None
    authToken: Optional[str] = None
    username: Optional[str] = None
    partnerID: Optional[str] = None  # For TextSMS
    senderId: Optional[str] = None
    environment: Optional[str] = "sandbox"
    # For Zettatel
    password: Optional[str] = None  # For Zettatel
    msgType: Optional[str] = None  # For Zettatel (text or unicode)
    # Callback URL will be generated by the server

def parse_organization_datetimes(obj):
    # Recursively convert createdAt/updatedAt fields from str to datetime in any dict
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ["createdAt", "updatedAt"] and isinstance(value, str):
                try:
                    obj[key] = datetime.fromisoformat(value)
                except Exception:
                    pass
            elif isinstance(value, dict):
                parse_organization_datetimes(value)
            elif isinstance(value, list):
                for item in value:
                    parse_organization_datetimes(item)
    elif isinstance(obj, list):
        for item in obj:
            parse_organization_datetimes(item)
    return obj



