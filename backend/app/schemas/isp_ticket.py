from datetime import datetime
from typing import Optional, List
import strawberry
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.isp_customer import ISPCustomer
from app.schemas.user import User
from app.schemas.enums import TicketStatus, TicketPriority

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

    @classmethod
    async def from_db(cls, ticket) -> "ISPTicket":
        from app.schemas.organization import Organization
        from app.schemas.isp_customer import ISPCustomer
        from app.schemas.user import User
        from app.config.database import organizations, isp_customers, users
        from bson import ObjectId

        org = await organizations.find_one({"_id": ticket["organizationId"]})
        organization = await Organization.from_db(org)

        customer = None
        if ticket.get("customerId"):
            customer_doc = await isp_customers.find_one({"_id": ObjectId(ticket["customerId"])})
            if customer_doc:
                customer = await ISPCustomer.from_db(customer_doc)

        assigned_to = None
        if ticket.get("assignedTo"):
            user_doc = await users.find_one({"_id": ObjectId(ticket["assignedTo"])})
            if user_doc:
                assigned_to = await User.from_db(user_doc)

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
