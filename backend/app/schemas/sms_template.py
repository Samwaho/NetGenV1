import strawberry
from typing import Optional, List
from datetime import datetime
from enum import Enum

@strawberry.enum
class TemplateCategory(Enum):
    CUSTOMER_ONBOARDING = "customer_onboarding"
    PAYMENT_REMINDER = "payment_reminder"
    SERVICE_OUTAGE = "service_outage"
    PLAN_UPGRADE = "plan_upgrade"
    TECHNICAL_SUPPORT = "technical_support"
    GENERAL_NOTIFICATION = "general_notification"
    MARKETING = "marketing"
    CUSTOM = "custom"

@strawberry.type
class SmsTemplate:
    id: str
    organization_id: str
    name: str
    content: str
    category: TemplateCategory
    description: Optional[str] = None
    variables: List[str] = strawberry.field(default_factory=list)
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

@strawberry.input
class SmsTemplateInput:
    name: str
    content: str
    category: TemplateCategory
    description: Optional[str] = None
    variables: List[str] = strawberry.field(default_factory=list)
    is_active: bool = True