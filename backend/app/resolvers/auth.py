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

logger = logging.getLogger(__name__)


@strawberry.type
class AuthResolver:
    @strawberry.mutation
    async def login(self, input: LoginInput) -> AuthResponse:
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

    @strawberry.mutation
    async def verifyEmail(self, token: str) -> AuthResponse:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

            if payload.get("type") != "email_verification":
                return AuthResponse(success=False, message="Invalid token type")
            
            email = payload.get("email")

            user = await users.find_one({"email": email})
            if not user:
                return AuthResponse(success=False, message="User not found")
            
            await users.update_one(
                {"email": email},
                {"$set": {"isVerified": True, "updatedAt": datetime.now(timezone.utc)}}
            )
            
            return AuthResponse(success=True, message="Email verified successfully")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to verify email: {str(e)}")
            
    @strawberry.mutation
    async def resendVerificationEmail(self, email: str) -> AuthResponse:
        try:
            user = await users.find_one({"email": email})
            if not user:
                return AuthResponse(success=False, message="User not found")

            if user["isVerified"]:
                return AuthResponse(success=False, message="User already verified")

            verification_token = create_verification_token(email)
            verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
            
            email_sent = await email_manager.send_verification_email(
                to_email=email,
                username=user["firstName"],
                verification_url=verification_url
            )

            if not email_sent:
                return AuthResponse(success=False, message="Failed to send verification email")

            return AuthResponse(success=True, message="Verification email sent successfully")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to resend verification email: {str(e)}")
            
    @strawberry.mutation
    async def forgotPassword(self, email: str) -> AuthResponse:
        try:
            user = await users.find_one({"email": email})
            if not user:
                return True
            
            password_reset_token = create_password_reset_token(email)
            password_reset_url = f"{settings.FRONTEND_URL}/reset-password?token={password_reset_token}"
            
            email_sent = await email_manager.send_password_reset_email(
                to_email=email,
                username=user["firstName"],
                reset_url=password_reset_url
            )

            if not email_sent:
                logger.warning(f"Failed to send password reset email to {email}")
                return AuthResponse(success=False, message="Failed to send password reset email")

            return AuthResponse(success=True, message="Password reset email sent successfully")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send password reset email: {str(e)}")
        
    @strawberry.mutation
    async def resetPassword(self, token: str, new_password: str) -> AuthResponse:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

            if payload.get("type") != "password_reset":
                return AuthResponse(success=False, message="Invalid token type")
            
            email = payload.get("email")

            user = await users.find_one({"email": email})
            if not user:
                return AuthResponse(success=False, message="User not found")
            
            hashed_password = hash_password(new_password)

            await users.update_one(
                {"email": email},
                {"$set": {"password": hashed_password, "updatedAt": datetime.now(timezone.utc)}}
            )
            
            return AuthResponse(success=True, message="Password reset successfully")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")

    @strawberry.mutation
    async def google_auth_url(self) -> str:
        try:
            google_client_id = settings.GOOGLE_CLIENT_ID
            redirect_uri = f"{settings.FRONTEND_URL}/sign-in"
            scope = "openid email profile"
            state = "google-auth"

            auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={google_client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&state={state}"

            return auth_url
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate Google auth URL: {str(e)}")
            
    @strawberry.mutation
    async def google_auth_callback(self, code: str) -> AuthResponse:
        try:
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
                response = await client.post(token_url, data=data)
                response.raise_for_status()
                token_data = response.json()

                if "access_token" in token_data:
                    access_token = token_data["access_token"]

                    user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
                    headers = {"Authorization": f"Bearer {token_data['access_token']}"}

                    user_info_response = await client.get(user_info_url, headers=headers)
                    user_info_response.raise_for_status()
                    user_info = user_info_response.json()

                    email = user_info.get("email")
                    first_name = user_info.get("given_name")
                    last_name = user_info.get("family_name")

                    existing_user = await users.find_one({"email": email})
                    if existing_user:
                        token = create_token(existing_user["_id"])
                        return AuthResponse(success=True, message="Login successful", token=token)
                        
                    else:
                        user_id = await users.insert_one({
                            "email": email,
                            "firstName": first_name,
                            "lastName": last_name,
                            "role": UserRole.USER,
                            "isVerified": True,
                            "createdAt": datetime.now(timezone.utc),
                            "updatedAt": datetime.now(timezone.utc)
                        })
                        
                        token = create_token(user_id)
                        return AuthResponse(success=True, message="Login successful", token=token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process Google auth callback: {str(e)}")
            
            
            
            

