import strawberry
from typing import Optional, List
from datetime import datetime
from dataclasses import field
from app.models.user import DBUser
from app.schemas.enums import UserRole
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class User:
    id: str
    firstName: str
    lastName: str
    email: str
    phone: str
    role: UserRole
    isVerified: bool
    organizations: Optional[List["Organization"]] = field(default_factory=list)
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, user) -> "User":
        from app.schemas.organization import Organization
        from app.config.database import organizations

        # Handle both dictionary and object types
        if isinstance(user, dict):
            # Access dictionary keys
            converted_user = {
                "id": user["_id"],
                "firstName": user["firstName"],
                "lastName": user["lastName"],
                "email": user["email"],
                "phone": user["phone"],
                "role": user["role"],
                "isVerified": user["isVerified"],
                "createdAt": user["createdAt"],
                "updatedAt": user["updatedAt"]
            }
            user_orgs = user.get("organizations", [])
        else:
            # Access object attributes
            converted_user = {
                "id": user._id,
                "firstName": user.firstName,
                "lastName": user.lastName,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "isVerified": user.isVerified,
                "createdAt": user.createdAt,
                "updatedAt": user.updatedAt
            }
            user_orgs = user.organizations if hasattr(user, 'organizations') else []

        # Handle organizations if present
        if user_orgs:
            # Fetch organization objects from database using the IDs
            org_objects = []
            for org_id in user_orgs:
                org = await organizations.find_one({"_id": org_id})
                if org:
                    org_objects.append(org)

            # Use list comprehension with await
            orgs = []
            for organization in org_objects:
                orgs.append(await Organization.from_db(organization))
            converted_user["organizations"] = orgs

        return cls(**converted_user)

@strawberry.type
class UserResponse:
    success: bool
    message: str
    user: Optional[User] = None

@strawberry.type
class UsersResponse:
    success: bool
    message: str
    users: List[User] = field(default_factory=list)

from app.schemas.organization import Organization
