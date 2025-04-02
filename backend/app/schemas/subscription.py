import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from enum import Enum
from app.schemas.organization import Organization
from app.schemas.plan import Plan


@strawberry.enum
class SubscriptionStatus(Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    PENDING = "PENDING"
    SUSPENDED = "SUSPENDED"


@strawberry.type
class Subscription:
    id: str
    organization: Organization
    plan: Plan
    status: SubscriptionStatus
    startDate: datetime
    endDate: datetime
    autoRenew: bool = False
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, subscription) -> "Subscription":
        from app.schemas.organization import Organization
        from app.schemas.plan import Plan
        from app.config.database import organizations, plans

        org_id = subscription.get("organizationId")
        plan_id = subscription.get("planId")
        converted_subscription = {
            "id": subscription["_id"],
            "status": subscription["status"],
            "startDate": subscription["startDate"],
            "endDate": subscription["endDate"],
            "autoRenew": subscription.get("autoRenew", False),
            "createdAt": subscription["createdAt"],
            "updatedAt": subscription["updatedAt"]
        }

        # Fetch organization data
        org_data = await organizations.find_one({"_id": org_id})
        organization = await Organization.from_db(org_data) if org_data else None
        converted_subscription["organization"] = organization

        # Fetch plan data
        plan_data = await plans.find_one({"_id": plan_id})
        plan = await Plan.from_db(plan_data) if plan_data else None
        converted_subscription["plan"] = plan

        return cls(**converted_subscription)


@strawberry.type
class SubscriptionResponse:
    success: bool
    message: str
    subscription: Optional[Subscription] = None


@strawberry.type
class SubscriptionsResponse:
    success: bool
    message: str
    subscriptions: List[Subscription] = field(default_factory=list)


@strawberry.input
class CreateSubscriptionInput:
    organizationId: str
    planId: str
    startDate: datetime
    endDate: datetime
    autoRenew: bool = False


@strawberry.input
class UpdateSubscriptionInput:
    status: Optional[SubscriptionStatus] = None
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    autoRenew: Optional[bool] = None
