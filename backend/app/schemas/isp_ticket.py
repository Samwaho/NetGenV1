from datetime import datetime
from typing import Optional, List, Dict, Any, ClassVar
import strawberry
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.isp_customer import ISPCustomer
from app.schemas.user import User
from app.schemas.enums import TicketStatus, TicketPriority
from bson.objectid import ObjectId

@strawberry.type
class ISPTicket:
    id: str
    title: str
    description: str
    organization: Organization
    customer: Optional[ISPCustomer] = None
    status: TicketStatus
    priority: TicketPriority
    assignedTo: Optional[User] = None
    category: str
    dueDate: Optional[datetime] = None
    resolution: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    
    # Class variable to cache related data fetching
    _related_cache: ClassVar[Dict[str, Dict[str, Any]]] = {
        "organizations": {},
        "customers": {},
        "users": {},
    }

    @classmethod
    async def from_db(cls, ticket) -> "ISPTicket":
        from app.schemas.organization import Organization
        from app.schemas.isp_customer import ISPCustomer
        from app.schemas.user import User
        from app.config.database import organizations, isp_customers, users
        
        # Convert ObjectIds to strings for cache keys
        org_id = ticket["organizationId"]
        org_id_str = str(org_id)
        
        # Fetch organization from cache or database
        org_data = cls._related_cache["organizations"].get(org_id_str)
        if not org_data:
            org_data = await organizations.find_one({"_id": org_id})
            if org_data:
                cls._related_cache["organizations"][org_id_str] = org_data
        
        organization = await Organization.from_db(org_data) if org_data else None

        # Handle customer if it exists
        customer = None
        if ticket.get("customerId"):
            customer_id_str = str(ticket["customerId"])
            customer_data = cls._related_cache["customers"].get(customer_id_str)
            if not customer_data:
                customer_data = await isp_customers.find_one({"_id": ticket["customerId"]})
                if customer_data:
                    cls._related_cache["customers"][customer_id_str] = customer_data
            
            if customer_data:
                customer = await ISPCustomer.from_db(customer_data)

        # Handle assigned user if it exists
        assigned_to = None
        if ticket.get("assignedTo"):
            user_id = (
                ObjectId(ticket["assignedTo"]) 
                if isinstance(ticket["assignedTo"], str) 
                else ticket["assignedTo"]
            )
            user_id_str = str(user_id)
            user_data = cls._related_cache["users"].get(user_id_str)
            if not user_data:
                user_data = await users.find_one({"_id": user_id})
                if user_data:
                    cls._related_cache["users"][user_id_str] = user_data
        
            if user_data:
                assigned_to = await User.from_db(user_data)

        return cls(
            id=str(ticket["_id"]),
            title=ticket["title"],
            description=ticket["description"],
            organization=organization,
            customer=customer,
            status=ticket["status"],
            priority=ticket["priority"],
            assignedTo=assigned_to,
            category=ticket["category"],
            dueDate=ticket.get("dueDate"),
            resolution=ticket.get("resolution"),
            createdAt=ticket["createdAt"],
            updatedAt=ticket["updatedAt"]
        )
    
    @property
    def is_open(self) -> bool:
        """Check if the ticket is open."""
        return self.status == TicketStatus.OPEN
    
    @property
    def is_resolved(self) -> bool:
        """Check if the ticket is resolved."""
        return self.status == TicketStatus.RESOLVED

@strawberry.type
class ISPTicketResponse:
    success: bool
    message: str
    ticket: Optional[ISPTicket] = None

@strawberry.type
class ISPTicketsResponse:
    success: bool
    message: str
    tickets: List[ISPTicket] = field(default_factory=list)
    total_count: int = 0  # Total count for pagination

@strawberry.input
class CreateISPTicketInput:
    title: str
    description: str
    organizationId: str
    customerId: Optional[str] = None
    priority: TicketPriority
    category: str
    dueDate: Optional[datetime] = None
    assignedTo: Optional[str] = None

@strawberry.input
class UpdateISPTicketInput:
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category: Optional[str] = None
    dueDate: Optional[datetime] = None
    assignedTo: Optional[str] = None
    resolution: Optional[str] = None
