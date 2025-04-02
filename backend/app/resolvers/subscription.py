from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import subscriptions, organizations, plans
from app.schemas.subscription import (
    Subscription,
    SubscriptionResponse,
    SubscriptionsResponse,
    CreateSubscriptionInput,
    UpdateSubscriptionInput,
    SubscriptionStatus
)
from app.config.deps import Context
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class SubscriptionResolver:

    @strawberry.field
    async def subscription(self, id: str, info: strawberry.Info) -> Subscription:
        """Get subscription by ID"""
        context: Context = info.context
        current_user = await context.authenticate()

        subscription = await subscriptions.find_one({"_id": ObjectId(id)})
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")

        # Check if user has access to this subscription
        org = await organizations.find_one({"_id": subscription["organizationId"]})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user is member of the organization
        if not any(member["userId"] == current_user.id for member in org["members"]):
            raise HTTPException(status_code=403, detail="Access denied")

        return await Subscription.from_db(subscription)

    @strawberry.field
    async def subscriptions(self, info: strawberry.Info) -> SubscriptionsResponse:
        """Get all subscriptions for organizations where user is a member"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Get all organizations where user is a member
        user_orgs = await organizations.find(
            {"members.userId": current_user.id}
        ).to_list(None)
        
        org_ids = [org["_id"] for org in user_orgs]
        
        # Get all subscriptions for these organizations
        all_subscriptions = await subscriptions.find(
            {"organizationId": {"$in": org_ids}}
        ).to_list(None)

        subscription_list = []
        for subscription in all_subscriptions:
            subscription_list.append(await Subscription.from_db(subscription))

        return SubscriptionsResponse(
            success=True,
            message="Subscriptions retrieved successfully",
            subscriptions=subscription_list
        )

    @strawberry.mutation
    async def create_subscription(self, input: CreateSubscriptionInput, info: strawberry.Info) -> SubscriptionResponse:
        """Create a new subscription"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify organization exists and user has permission
        organization = await organizations.find_one({"_id": ObjectId(input.organizationId)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to manage subscriptions
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or "MANAGE_SUBSCRIPTIONS" not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Verify plan exists
        plan = await plans.find_one({"_id": ObjectId(input.planId)})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        # Check if organization already has an active subscription
        existing_subscription = await subscriptions.find_one({
            "organizationId": ObjectId(input.organizationId),
            "status": SubscriptionStatus.ACTIVE.value
        })
        if existing_subscription:
            raise HTTPException(status_code=400, detail="Organization already has an active subscription")

        subscription_data = {
            "organizationId": ObjectId(input.organizationId),
            "planId": ObjectId(input.planId),
            "status": SubscriptionStatus.ACTIVE.value,
            "startDate": input.startDate,
            "endDate": input.endDate,
            "autoRenew": input.autoRenew,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await subscriptions.insert_one(subscription_data)
        subscription_data["_id"] = result.inserted_id

        return SubscriptionResponse(
            success=True,
            message="Subscription created successfully",
            subscription=await Subscription.from_db(subscription_data)
        )

    @strawberry.mutation
    async def update_subscription(self, id: str, input: UpdateSubscriptionInput, info: strawberry.Info) -> SubscriptionResponse:
        """Update subscription details"""
        context: Context = info.context
        current_user = await context.authenticate()

        subscription = await subscriptions.find_one({"_id": ObjectId(id)})
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")

        # Verify organization and permissions
        organization = await organizations.find_one({"_id": subscription["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or "MANAGE_SUBSCRIPTIONS" not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        update_data = {
            "updatedAt": datetime.now(timezone.utc)
        }

        if input.status is not None:
            update_data["status"] = input.status
        if input.startDate is not None:
            update_data["startDate"] = input.startDate
        if input.endDate is not None:
            update_data["endDate"] = input.endDate
        if input.autoRenew is not None:
            update_data["autoRenew"] = input.autoRenew

        await subscriptions.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        updated_subscription = await subscriptions.find_one({"_id": ObjectId(id)})
        return SubscriptionResponse(
            success=True,
            message="Subscription updated successfully",
            subscription=await Subscription.from_db(updated_subscription)
        )

    @strawberry.mutation
    async def cancel_subscription(self, id: str, info: strawberry.Info) -> SubscriptionResponse:
        """Cancel a subscription"""
        context: Context = info.context
        current_user = await context.authenticate()

        subscription = await subscriptions.find_one({"_id": ObjectId(id)})
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")

        # Verify organization and permissions
        organization = await organizations.find_one({"_id": subscription["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        user_role = next((role for role in organization["roles"] if role["name"] == user_member["roleName"]), None)
        if not user_role or "MANAGE_SUBSCRIPTIONS" not in user_role["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        if subscription["status"] == SubscriptionStatus.CANCELLED.value:
            raise HTTPException(status_code=400, detail="Subscription is already cancelled")

        update_data = {
            "status": SubscriptionStatus.CANCELLED.value,
            "autoRenew": False,
            "updatedAt": datetime.now(timezone.utc)
        }

        await subscriptions.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        updated_subscription = await subscriptions.find_one({"_id": ObjectId(id)})
        return SubscriptionResponse(
            success=True,
            message="Subscription cancelled successfully",
            subscription=await Subscription.from_db(updated_subscription)
        )