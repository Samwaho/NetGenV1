import strawberry
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.schemas.user import User

@strawberry.input
class LoginInput(BaseModel):
    email: EmailStr
    password: str

@strawberry.input
class RegisterInput(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    password: str
    
@strawberry.type
class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[User] = None

