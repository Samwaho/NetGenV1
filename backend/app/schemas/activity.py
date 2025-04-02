import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.schemas.user import User
from app.schemas.organization import Organization
from app.config.database import users, organizations

@strawberry.type
class Activity:
    id: str
    user: User
    organization: Organization
    action: str
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, activity) -> "Activity":
        # Handle both dictionary and object types
        if isinstance(activity, dict):
            user_id = activity.get("userId")
            org_id = activity.get("organizationId")
            converted_activity = {
                "id": activity["_id"],
                "action": activity["action"],
                "createdAt": activity["createdAt"],
                "updatedAt": activity["updatedAt"]
            }
        else:
            user_id = activity.userId
            org_id = activity.organizationId
            converted_activity = {
                "id": activity._id,
                "action": activity.action,
                "createdAt": activity.createdAt,
                "updatedAt": activity.updatedAt
            }

        # Fetch user data
        user_data = await users.find_one({"_id": user_id})
        user = await User.from_db(user_data) if user_data else None
        converted_activity["user"] = user

        # Fetch organization data
        org_data = await organizations.find_one({"_id": org_id})
        organization = await Organization.from_db(org_data) if org_data else None
        converted_activity["organization"] = organization

        return cls(**converted_activity)

@strawberry.type
class ActivityResponse:
    success: bool
    message: str
    activity: Optional[Activity] = None

@strawberry.type
class ActivitiesResponse:
    success: bool
    message: str
    activities: List[Activity] = field(default_factory=list)

