from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from pydantic import EmailStr
from app.schemas.user import UserRole
from typing import List, Optional

class DBUser(BaseModel):
    _id: str
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    password: str
    role: UserRole
    isVerified: bool
    organizations: Optional[List[str]] = None
    createdAt: datetime
    updatedAt: datetime
