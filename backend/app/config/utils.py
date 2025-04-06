from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from app.config.settings import settings
from jose import jwt, JWTError
from fastapi import HTTPException
import bcrypt
from app.config.database import activities, users
from bson.objectid import ObjectId

def create_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT token for user"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_verification_token(email: str) -> str:
    """Create email verification token"""
    expire = datetime.utcnow() + timedelta(minutes=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "email": email,
        "exp": expire,
        "type": "email_verification"
    }
    return jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )


def create_password_reset_token(email: str) -> str:
    """Create password reset token"""
    expire = datetime.utcnow() + timedelta(hours=1)
    to_encode = {
        "email": email,
        "exp": expire,
        "type": "password_reset"
    }
    return jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )


def create_invitation_token(organization_id: str, email: str, role_name: str) -> str:
    """Create a token for organization invitation"""
    to_encode = {
        "type": "organization_invitation",
        "organization_id": organization_id,
        "email": email,
        "role_name": role_name,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)  # Invitation expires in 7 days
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        # Check if token has expired
        exp = payload.get('exp')
        if exp and datetime.utcnow().timestamp() > exp:
            raise HTTPException(status_code=401, detail="Token has expired")
            
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decode token: {str(e)}")
    
def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hashed password"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def hash_password(password: str) -> str:
    """Hash password"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def record_activity(user_id: str, organization_id: ObjectId, action: str):
    """Helper function to record organization-related activities with user details"""
    # Fetch user data first
    user_data = await users.find_one({"_id": ObjectId(user_id)})
    if not user_data:
        return  # Skip recording if user not found

    activity_data = {
        "userId": user_id,
        "userDetails": {
            "firstName": user_data.get("firstName"),
            "lastName": user_data.get("lastName"),
            "email": user_data.get("email"),
            "role": user_data.get("role")
        },
        "organizationId": organization_id,
        "action": action,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    await activities.insert_one(activity_data)
