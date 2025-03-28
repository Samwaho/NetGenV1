from datetime import datetime
from typing import List, Optional
from app.schemas.enums import UserRole
import strawberry

@strawberry.type
class DBUser():
    _id: str
    firstName: str
    lastName: str
    email: str
    phone: str
    password: str
    role: UserRole
    isVerified: bool
    organizations: Optional[List[str]] = None
    createdAt: datetime
    updatedAt: datetime
