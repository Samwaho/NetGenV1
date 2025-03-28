import strawberry
from typing import Optional, List
from datetime import datetime
from dataclasses import field
from app.models.user import DBUser
from app.schemas.enums import UserRole

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
    def from_db(cls, user: DBUser) -> "User":
        from app.schemas.organization import Organization
        
        # Create a dictionary from user object attributes manually
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
        
        # Handle organizations if present
        if hasattr(user, 'organizations') and user.organizations:
            converted_user["organizations"] = [Organization.from_db(organization) for organization in user.organizations]

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
