from datetime import datetime
from typing import Optional
from app.schemas.enums import TicketStatus, TicketPriority
import strawberry

@strawberry.type
class DBISPTicket:
    _id: str
    title: str
    description: str
    organizationId: str
    customerId: Optional[str]
    status: TicketStatus
    priority: TicketPriority
    assignedTo: Optional[str]
    category: str
    dueDate: Optional[datetime]
    resolution: Optional[str]
    createdAt: datetime
    updatedAt: datetime