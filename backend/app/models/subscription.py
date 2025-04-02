from datetime import datetime
from typing import Optional
from app.schemas.subscription import SubscriptionStatus
import strawberry

@strawberry.type
class DBSubscription:
    _id: str
    organizationId: str
    planId: str
    status: SubscriptionStatus
    startDate: datetime
    endDate: datetime
    autoRenew: bool
    createdAt: datetime
    updatedAt: datetime