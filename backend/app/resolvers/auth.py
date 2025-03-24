from app.config.deps import get_current_user
from app.schemas.user import User, UserRole
from app.schemas.auth import LoginInput, RegisterInput, AuthResponse
from app.config.database import users
from app.config.utils import verify_password, hash_password, create_token, create_verification_token
import strawberry
from fastapi import HTTPException
from datetime import datetime, timezone
from app.config.settings import settings
from app.config.email import email_manager
import logging

logger = logging.getLogger(__name__)


@strawberry.type
class AuthResolver:
    @strawberry.mutation
    async def login(self, input: LoginInput) -> str:
        try:
            user = await users.find_one({"email": input.email})
            if not user or not verify_password(input.password, user["password"]):
                return AuthResponse(success=False, message="Invalid credentials")
            if not user["isVerified"]:
                return AuthResponse(success=False, message="Please verify your email first")
            token = create_token(user["_id"])
            return AuthResponse(success=True, message="Login successful", token=token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to login: {str(e)}")
    
    @strawberry.mutation
    async def register(self, input: RegisterInput) -> AuthResponse:
        try:
            existing_user = await users.find_one({"email": input.email})
            if existing_user:
                return AuthResponse(success=False, message="User already exists")
            hashed_password = hash_password(input.password)
            
            user_id = await users.insert_one({
                "email": input.email,
                "password": hashed_password,
                "firstName": input.firstName,
                "lastName": input.lastName,
                "phone": input.phone,
                "role": UserRole.USER,
                "isVerified": False,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            })

            verification_token = create_verification_token(input.email)
            verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

            email_sent = await email_manager.send_verification_email(
                to_email=input.email,
                username=input.firstName,
                verification_url=verification_url
            )

            if not email_sent:
                logger.warning(f"Failed to send verification email to {input.email}")

            return AuthResponse(success=True, message="User registered successfully")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to register: {str(e)}")
