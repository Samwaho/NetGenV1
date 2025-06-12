from app.config.deps import get_current_user
from app.schemas.user import User, UserRole
from app.schemas.auth import LoginInput, RegisterInput, AuthResponse
from app.config.database import users
from app.config.utils import verify_password, hash_password, create_token, create_verification_token, create_password_reset_token
import strawberry
from fastapi import HTTPException
from datetime import datetime, timezone
from app.config.settings import settings
from app.config.email import email_manager
import logging
from jose import jwt
import httpx
from typing import Optional
from strawberry import Info
from app.config.deps import Context

logger = logging.getLogger(__name__)


@strawberry.type
class AuthResolver:
    
    @strawberry.field
    async def current_user(self, info: Info) -> Optional[User]:
        """Get current user"""
        context: Context = info.context
        return await context.authenticate()
    
    @strawberry.mutation
    async def login(self, input: LoginInput) -> AuthResponse:
        user = await users.find_one({"email": input.email})
        if not user:
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        if not user.get("password"):
            raise HTTPException(status_code=400, detail="Invalid credentials")
            
        if not verify_password(input.password, user["password"]):
            raise HTTPException(status_code=400, detail="Invalid credentials")
            
        if not user["isVerified"]:
            raise HTTPException(status_code=400, detail="Please verify your email first")
            
        token = create_token(user["_id"])
        return AuthResponse(success=True, message="Login successful", token=token)
    
    @strawberry.mutation
    async def register(self, input: RegisterInput) -> AuthResponse:
        existing_user = await users.find_one({"email": input.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
            
        hashed_password = hash_password(input.password)
        
        result = await users.insert_one({
            "email": input.email,
            "password": hashed_password,
            "firstName": input.firstName,
            "lastName": input.lastName,
            "phone": input.phone,
            "role": UserRole.USER.value,
            "isVerified": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
        user_id = result.inserted_id

        verification_token = create_verification_token(input.email)
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

        email_sent = await email_manager.send_verification_email(
            to_email=input.email,
            username=input.firstName,
            verification_url=verification_url
        )

        if not email_sent:
            logger.warning(f"Failed to send verification email to {input.email}")

        return AuthResponse(success=True, message="User registered successfully", userEmail=input.email)

    @strawberry.mutation
    async def verifyEmail(self, token: str) -> AuthResponse:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except jwt.JWTError:
            raise HTTPException(status_code=400, detail="Invalid token")

        if payload.get("type") != "email_verification":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        email = payload.get("email")
        user = await users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        await users.update_one(
            {"email": email},
            {"$set": {"isVerified": True, "updatedAt": datetime.now(timezone.utc)}}
        )
        
        return AuthResponse(success=True, message="Email verified successfully")
            
    @strawberry.mutation
    async def resendVerificationEmail(self, email: str) -> AuthResponse:
        user = await users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        if user["isVerified"]:
            raise HTTPException(status_code=400, detail="User already verified")

        verification_token = create_verification_token(email)
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
        
        email_sent = await email_manager.send_verification_email(
            to_email=email,
            username=user["firstName"],
            verification_url=verification_url
        )

        if not email_sent:
            raise HTTPException(status_code=400, detail="Failed to send verification email")

        return AuthResponse(success=True, message="Verification email sent successfully")
            
    @strawberry.mutation
    async def forgotPassword(self, email: str) -> AuthResponse:
        user = await users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        password_reset_token = create_password_reset_token(email)
        password_reset_url = f"{settings.FRONTEND_URL}/reset-password?token={password_reset_token}"
        
        email_sent = await email_manager.send_password_reset_email(
            to_email=email,
            username=user["firstName"],
            reset_url=password_reset_url
        )

        if not email_sent:
            logger.warning(f"Failed to send password reset email to {email}")
            raise HTTPException(status_code=400, detail="Failed to send password reset email")

        return AuthResponse(success=True, message="Password reset email sent successfully")
        
    @strawberry.mutation
    async def resetPassword(self, token: str, new_password: str) -> AuthResponse:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except jwt.JWTError:
            raise HTTPException(status_code=400, detail="Invalid token")

        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        email = payload.get("email")
        user = await users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        hashed_password = hash_password(new_password)
        await users.update_one(
            {"email": email},
            {"$set": {"password": hashed_password, "updatedAt": datetime.now(timezone.utc)}}
        )
        
        return AuthResponse(success=True, message="Password reset successfully")

    @strawberry.mutation
    async def google_auth_url(self) -> str:
        google_client_id = settings.GOOGLE_CLIENT_ID
        redirect_uri = f"{settings.FRONTEND_URL}/sign-in"
        scope = "openid email profile"
        state = "google-auth"

        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={google_client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&state={state}"

        return auth_url
            
    @strawberry.mutation
    async def google_auth_callback(self, code: str) -> AuthResponse:
        google_client_id = settings.GOOGLE_CLIENT_ID
        google_client_secret = settings.GOOGLE_CLIENT_SECRET
        redirect_uri = f"{settings.FRONTEND_URL}/sign-in"

        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": google_client_id,
            "client_secret": google_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(token_url, data=data)
                response.raise_for_status()
                token_data = response.json()
            except httpx.HTTPError:
                raise HTTPException(status_code=400, detail="Failed to authenticate with Google")

            if "access_token" not in token_data:
                raise HTTPException(status_code=400, detail="Invalid Google response")

            access_token = token_data["access_token"]
            user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}

            try:
                user_info_response = await client.get(user_info_url, headers=headers)
                user_info_response.raise_for_status()
                user_info = user_info_response.json()
            except httpx.HTTPError:
                raise HTTPException(status_code=400, detail="Failed to get user info from Google")

            email = user_info.get("email")
            first_name = user_info.get("given_name")
            last_name = user_info.get("family_name")

            if not email:
                raise HTTPException(status_code=400, detail="Email not provided by Google")

            existing_user = await users.find_one({"email": email})
            if existing_user:
                token = create_token(existing_user["_id"])
                return AuthResponse(success=True, message="Login successful", token=token)
                
            result = await users.insert_one({
                "email": email,
                "firstName": first_name,
                "lastName": last_name,
                "role": UserRole.USER.value,
                "isVerified": True,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            })
            user_id = result.inserted_id
            
            token = create_token(user_id)
            return AuthResponse(success=True, message="Login successful", token=token)
            
            
            
            

