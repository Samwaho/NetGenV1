import strawberry
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum
from app.models.user import DBUser
from app.schemas.organization import Organization

@strawberry.enum
class UserRole(Enum):
    ADMIN = "ADMIN"
    USER = "USER"
    SUPERUSER = "SUPERUSER"

@strawberry.type
class User(BaseModel):
    id: str
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    role: UserRole 
    isVerified: bool
    organizations: Optional[List[Organization]] = None      
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    def from_db(cls, user: DBUser) -> "User":
        converted_user = user.model_dump()

        converted_user["id"] = user._id

        converted_user.pop("_id")
        converted_user.pop("password")

        if user.organizations:
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
    users: List[User] = []