import strawberry
from typing import Optional
from app.schemas.user import User

@strawberry.input
class LoginInput:
    email: str
    password: str

@strawberry.input
class RegisterInput:
    firstName: str
    lastName: str
    email: str
    phone: str
    password: str
    
@strawberry.type
class AuthResponse:
    success: bool
    message: str
    token: Optional[str] = None
    userEmail: Optional[str] = None

