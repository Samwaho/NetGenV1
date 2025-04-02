from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import activities, organizations
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
    async def activity(self, id: str, info: strawberry.Info) -> Activity:
        """Get activity by ID"""
        context: Context = info.context
        current_user = await context.authenticate()

        activity = await activities.find_one({"_id": ObjectId(id)})
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        # Check if user has access to this activity
        org = await organizations.find_one({"_id": activity["organizationId"]})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user is member of the organization
        if not any(member["userId"] == current_user.id for member in org["members"]):
            raise HTTPException(status_code=403, detail="Access denied")

        return await Activity.from_db(activity)

    @strawberry.field
    async def activities(
        self,
        info: strawberry.Info,
        organizationId: Optional[str] = None,  # Changed from organization_id to organizationId
    ) -> ActivitiesResponse:
        """Get activities with optional filtering by organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Build query based on parameters
        query = {}
        if organizationId:  # Update variable name here too
            # Verify organization exists and user has access
            org = await organizations.find_one({"_id": ObjectId(organizationId)})
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Check if user is member of the organization
            if not any(member["userId"] == current_user.id for member in org["members"]):
                raise HTTPException(status_code=403, detail="Access denied")
            
            query["organizationId"] = ObjectId(organizationId)
        else:
            # Get all organizations where user is a member
            user_orgs = await organizations.find(
                {"members.userId": current_user.id}
            ).to_list(None)
            org_ids = [org["_id"] for org in user_orgs]
            query["organizationId"] = {"$in": org_ids}

        # Fetch activities
        all_activities = await activities.find(query).sort("createdAt", -1).to_list(None)
        
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

        # Verify organization exists and user has access
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user is member of the organization
        if not any(member["userId"] == current_user.id for member in organization["members"]):
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        activity_data = {
            "userId": current_user.id,
            "organizationId": ObjectId(organization_id),
            "action": action,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await activities.insert_one(activity_data)
        activity_data["_id"] = result.inserted_id

        return ActivityResponse(
            success=True,
            message="Activity recorded successfully",
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



