import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field

@strawberry.type
class Plan:
    id: str
    name: str
    description: Optional[str] = None
    price: float
    currency: str
    features: List[str] = field(default_factory=list)
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, plan) -> "Plan":
        # Handle both dictionary and object types
        if isinstance(plan, dict):
            converted_plan = {
                "id": plan["_id"],
                "name": plan["name"],
                "description": plan.get("description"),
                "price": plan["price"],
                "currency": plan["currency"],
                "features": plan.get("features", []),
                "createdAt": plan["createdAt"],
                "updatedAt": plan["updatedAt"]
            }
        else:
            converted_plan = {
                "id": plan._id,
                "name": plan.name,
                "description": plan.description if hasattr(plan, 'description') else None,
                "price": plan.price,
                "currency": plan.currency,
                "features": plan.features if hasattr(plan, 'features') else [],
                "createdAt": plan.createdAt,
                "updatedAt": plan.updatedAt
            }

        return cls(**converted_plan)

@strawberry.type
class PlanResponse:
    success: bool
    message: str
    plan: Optional[Plan] = None

@strawberry.type
class PlansResponse:
    success: bool
    message: str
    plans: List[Plan] = field(default_factory=list)

@strawberry.input
class CreatePlanInput:
    name: str
    description: Optional[str] = None
    price: float
    currency: str
    features: List[str] = field(default_factory=list)

    
