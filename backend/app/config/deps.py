from app.schemas.user import User
from typing import Optional
from app.config.utils import verify_token
from app.config.database import users
import logging
from strawberry.fastapi import BaseContext
from fastapi import Request, HTTPException
from functools import cached_property

async def get_current_user(token: str = None) -> Optional[User]:
    if not token:
        return None
        
    try:
        payload = await verify_token(token)
        user = users.find_one({"_id": payload["sub"]})
        return User.from_db(user) if user else None
    except Exception as e:
        logging.error(f"Error getting current user: {e}")
        return None

class Context(BaseContext):
    def __init__(self, request: Optional[Request] = None):
        super().__init__()
        self.request = request
        self._user: Optional[User] = None
        self._token: Optional[str] = None

    @cached_property
    async def token(self) -> Optional[str]:
        if self._token is None and self.request:
            auth_header = self.request.headers.get("Authorization")
            if auth_header:
                parts = auth_header.split()
                self._token = parts[1] if len(parts) == 2 and parts[0].lower() == "bearer" else None
        return self._token
    
    @cached_property
    async def user(self) -> Optional[User]:
        if self._user is None and self.token:
            self._user = await get_current_user(self.token)
        return self._user
    
    async def current_user(self) -> Optional[User]:
        if self._user is None:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        return self._user

async def get_context(request: Request) -> Context:
    """Return Context instance instead of dict"""
    return Context(request=request)
