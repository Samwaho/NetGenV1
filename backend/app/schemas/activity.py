import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from bson.objectid import ObjectId
from app.schemas.organization import Organization
from app.config.database import organizations

@strawberry.type
class UserDetails:
    firstName: str
    lastName: str
    email: str
    role: str

@strawberry.type
class Activity:
    id: str
    action: str
    userDetails: Optional[UserDetails]
    organization: Optional[Organization]
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, activity_data: dict, organization: Optional[Organization] = None) -> "Activity":
        """Convert DB activity to Activity type"""
        # Create UserDetails from embedded data
        user_details = None
        if "userDetails" in activity_data:
            user_details = UserDetails(
                firstName=activity_data["userDetails"]["firstName"],
                lastName=activity_data["userDetails"]["lastName"],
                email=activity_data["userDetails"]["email"],
                role=activity_data["userDetails"]["role"]
            )

        # Use provided organization if available, otherwise fetch
        org_obj = organization
        if not org_obj and "organizationId" in activity_data:
            org_data = await organizations.find_one({"_id": activity_data["organizationId"]})
            if org_data:
                org_obj = await Organization.from_db(org_data)

        return cls(
            id=str(activity_data["_id"]),
            action=activity_data["action"],
            userDetails=user_details,
            organization=org_obj,
            createdAt=activity_data["createdAt"],
            updatedAt=activity_data["updatedAt"]
        )

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
    totalCount: int = 0

