from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import activities, organizations, users
from app.schemas.activity import (
    Activity,
    ActivityResponse,
    ActivitiesResponse
)
from app.config.deps import Context
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class ActivityResolver:

    @strawberry.field
    async def activity(self, id: str, info: strawberry.Info) -> ActivityResponse:
        """Get activity by ID"""
        context: Context = info.context
        current_user = await context.authenticate()

        activity = await activities.find_one({"_id": ObjectId(id)})
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        # Verify user has access to the organization this activity belongs to
        org = await organizations.find_one({
            "_id": activity["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this activity")

        return ActivityResponse(
            success=True,
            message="Activity retrieved successfully",
            activity=await Activity.from_db(activity)
        )

    @strawberry.field
    async def activities(
        self,
        info: strawberry.Info,
        organization_id: Optional[str] = None,
        limit: Optional[int] = 50,
        skip: Optional[int] = 0
    ) -> ActivitiesResponse:
        """Get activities with optional filtering by organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # If organization_id is provided, verify access
        if organization_id:
            org = await organizations.find_one({
                "_id": ObjectId(organization_id),
                "members.userId": current_user.id
            })
            if not org:
                raise HTTPException(status_code=403, detail="Not authorized to access this organization")
            
            query = {"organizationId": ObjectId(organization_id)}
        else:
            # Get all organizations where user is a member
            user_orgs = await organizations.find(
                {"members.userId": current_user.id},
                {"_id": 1}
            ).to_list(None)
            org_ids = [org["_id"] for org in user_orgs]
            query = {"organizationId": {"$in": org_ids}}

        # Get activities with pagination
        all_activities = await activities.find(query) \
            .sort("createdAt", -1) \
            .skip(skip) \
            .limit(limit) \
            .to_list(None)

        activity_list = []
        for activity in all_activities:
            activity_list.append(await Activity.from_db(activity))

        return ActivitiesResponse(
            success=True,
            message="Activities retrieved successfully",
            activities=activity_list
        )

    @strawberry.mutation
    async def create_activity(
        self,
        organization_id: str,
        action: str,
        info: strawberry.Info
    ) -> ActivityResponse:
        """Create a new activity record"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify user has access to the organization
        org = await organizations.find_one({
            "_id": ObjectId(organization_id),
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to create activities in this organization")

        # Get user details for embedding
        user_data = await users.find_one({"_id": current_user.id})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")

        activity_data = {
            "userDetails": {
                "firstName": user_data["firstName"],
                "lastName": user_data["lastName"],
                "email": user_data["email"],
                "role": user_data["role"]
            },
            "organizationId": ObjectId(organization_id),
            "action": action,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await activities.insert_one(activity_data)
        activity_data["_id"] = result.inserted_id

        return ActivityResponse(
            success=True,
            message="Activity created successfully",
            activity=await Activity.from_db(activity_data)
        )

    @strawberry.mutation
    async def delete_activity(self, id: str, info: strawberry.Info) -> ActivityResponse:
        """Delete an activity record (admin only)"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Only allow superusers to delete activities
        if current_user.role != "SUPERUSER":
            raise HTTPException(status_code=403, detail="Only administrators can delete activities")

        activity = await activities.find_one({"_id": ObjectId(id)})
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        await activities.delete_one({"_id": ObjectId(id)})

        return ActivityResponse(
            success=True,
            message="Activity deleted successfully",
            activity=await Activity.from_db(activity)
        )












