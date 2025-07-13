from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import plans
from app.schemas.plan import (
    Plan,
    PlanResponse,
    PlansResponse,
    CreatePlanInput
)
from app.config.deps import Context
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class PlanResolver:

    @strawberry.field
    async def plan(self, id: str, info: strawberry.Info) -> Plan:
        """Get plan by ID"""
        context: Context = info.context
        current_user = await context.authenticate()

        plan = await plans.find_one({"_id": ObjectId(id)})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return await Plan.from_db(plan)

    @strawberry.field
    async def plans(self, info: strawberry.Info) -> PlansResponse:
        """Get all plans - accessible without authentication"""
        all_plans = await plans.find().to_list(None)
        plan_list = []
        for plan in all_plans:
            plan_list.append(await Plan.from_db(plan))

        return PlansResponse(
            success=True,
            message="Plans retrieved successfully",
            plans=plan_list
        )

    @strawberry.mutation
    async def create_plan(self, input: CreatePlanInput, info: strawberry.Info) -> PlanResponse:
        """Create a new plan"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Check if user has admin role
        if current_user.role != "SUPERUSER":
            raise HTTPException(status_code=403, detail="Only administrators can create plans")

        plan_data = {
            "name": input.name,
            "description": input.description,
            "price": input.price,
            "currency": input.currency,
            "features": input.features,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await plans.insert_one(plan_data)
        plan_data["_id"] = result.inserted_id

        return PlanResponse(
            success=True,
            message="Plan created successfully",
            plan=await Plan.from_db(plan_data)
        )

    @strawberry.mutation
    async def update_plan(self, id: str, input: CreatePlanInput, info: strawberry.Info) -> PlanResponse:
        """Update plan details"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Check if user has admin role
        if current_user.role != "SUPERUSER":
            raise HTTPException(status_code=403, detail="Only administrators can update plans")

        plan = await plans.find_one({"_id": ObjectId(id)})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        update_data = {
            "name": input.name,
            "description": input.description,
            "price": input.price,
            "currency": input.currency,
            "features": input.features,
            "updatedAt": datetime.now(timezone.utc)
        }

        await plans.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        updated_plan = await plans.find_one({"_id": ObjectId(id)})
        return PlanResponse(
            success=True,
            message="Plan updated successfully",
            plan=await Plan.from_db(updated_plan)
        )

    @strawberry.mutation
    async def delete_plan(self, id: str, info: strawberry.Info) -> PlanResponse:
        """Delete a plan"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Check if user has admin role
        if current_user.role != "SUPERUSER":
            raise HTTPException(status_code=403, detail="Only administrators can delete plans")

        plan = await plans.find_one({"_id": ObjectId(id)})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        # TODO: Add check if plan is being used by any subscriptions
        # If needed, prevent deletion of plans that are actively used

        await plans.delete_one({"_id": ObjectId(id)})

        return PlanResponse(
            success=True,
            message="Plan deleted successfully",
            plan=await Plan.from_db(plan)
        )