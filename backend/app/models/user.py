from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional
from app.schemas.enums import UserRole

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
