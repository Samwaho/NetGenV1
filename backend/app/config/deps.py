from app.schemas.user import User
from app.models.user import DBUser
from typing import Optional
from app.config.utils import verify_token
from app.config.database import users
import logging
from strawberry.fastapi import BaseContext
from fastapi import Request, HTTPException
from functools import cached_property
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

async def get_current_user(token: str = None) -> Optional[User]:
    """Get current user from token"""
    try:
        payload = await verify_token(token)
        user_id = payload.get("sub")

        if not user_id:
            return None

        # Make sure we have the correct ID format for MongoDB
        try:
            object_id = ObjectId(user_id)
            # Get user with organizations
            user = await users.find_one({"_id": object_id})
        except Exception as e:
            logger.error(f"Error converting user ID to ObjectId: {str(e)}")
            user = await users.find_one({"_id": user_id})

        if not user:
            return None
        # Convert to DBUser model
        db_user = DBUser(**user)
        # Convert to User schema
        return await User.from_db(db_user)

    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


class Context(BaseContext):
    def __init__(self, request: Optional[Request] = None):
        super().__init__()
        self.request = request
        self._user: Optional[User] = None
        self._token: Optional[str] = None
        self._authenticated_user: Optional[User] = None

    @cached_property
    async def token(self) -> Optional[str]:
        """Get the authorization token from request headers"""
        if not self.request:
            return None

        auth_header = self.request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"}
            )

        return parts[1]

    @cached_property
    async def user(self) -> Optional[User]:
        """Get the authenticated user from the request context"""
        if self._user:
            return self._user

        try:
            token = await self.token
            if not token:
                return None

            self._user = await get_current_user(token)
            return self._user

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Authentication error: {str(e)}"
            )

    async def authenticate(self) -> User:
        """Enforce authentication and return user"""
        if self._authenticated_user:
            return self._authenticated_user

        user = await self.user
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )

        self._authenticated_user = user
        return user

    async def is_authenticated(self) -> bool:
        """Check if request is authenticated"""
        try:
            return await self.user is not None
        except HTTPException:
            return False


async def get_context(request: Request) -> Context:
    """Return Context instance instead of dict"""
    return Context(request=request)