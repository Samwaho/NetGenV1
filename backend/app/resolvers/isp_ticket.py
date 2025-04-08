from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException, Depends
from app.config.database import isp_tickets, organizations
from app.schemas.isp_ticket import (
    ISPTicket,
    ISPTicketResponse,
    ISPTicketsResponse,
    CreateISPTicketInput,
    UpdateISPTicketInput
)
from app.config.deps import Context, get_current_user
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class ISPTicketResolver:
    @strawberry.field
    async def ticket(self, id: str, info: strawberry.Info) -> ISPTicket:
        """Get ISP ticket by ID"""
        context: Context = info.context
        current_user = await context.authenticate()

        ticket = await isp_tickets.find_one({"_id": ObjectId(id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return await ISPTicket.from_db(ticket)

    @strawberry.field
    async def tickets(self, info: strawberry.Info, organization_id: str) -> ISPTicketsResponse:
        """Get all ISP tickets for a specific organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": ObjectId(organization_id),
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        all_tickets = await isp_tickets.find(
            {"organizationId": ObjectId(organization_id)}
        ).to_list(None)

        return ISPTicketsResponse(
            success=True,
            message="Tickets retrieved successfully",
            tickets=[await ISPTicket.from_db(ticket) for ticket in all_tickets]
        )

    @strawberry.mutation
    async def create_ticket(
        self, info: strawberry.Info, input: CreateISPTicketInput
    ) -> ISPTicketResponse:
        """Create a new ISP ticket"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Create ticket document
        now = datetime.now(timezone.utc)
        ticket_doc = {
            "title": input.title,
            "description": input.description,
            "organizationId": ObjectId(input.organizationId),
            "customerId": ObjectId(input.customerId) if input.customerId else None,
            "status": "OPEN",
            "priority": input.priority,
            "category": input.category,
            "dueDate": input.dueDate,
            "assignedTo": input.assignedTo,
            "createdAt": now,
            "updatedAt": now
        }

        result = await isp_tickets.insert_one(ticket_doc)
        ticket = await isp_tickets.find_one({"_id": result.inserted_id})

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(input.organizationId),
            action=f"created ticket '{input.title}'"
        )

        return ISPTicketResponse(
            success=True,
            message="Ticket created successfully",
            ticket=await ISPTicket.from_db(ticket)
        )

    @strawberry.mutation
    async def update_ticket(
        self, info: strawberry.Info, input: UpdateISPTicketInput
    ) -> ISPTicketResponse:
        """Update an existing ISP ticket"""
        context: Context = info.context
        current_user = await context.authenticate()

        update_data = {
            k: v for k, v in input.__dict__.items()
            if v is not None and k != "id"
        }
        update_data["updatedAt"] = datetime.now(timezone.utc)

        result = await isp_tickets.update_one(
            {"_id": ObjectId(input.id)},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")

        ticket = await isp_tickets.find_one({"_id": ObjectId(input.id)})

        return ISPTicketResponse(
            success=True,
            message="Ticket updated successfully",
            ticket=await ISPTicket.from_db(ticket)
        )

    @strawberry.mutation
    async def delete_ticket(self, info: strawberry.Info, id: str) -> bool:
        """Delete an ISP ticket"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Find the ticket
        ticket = await isp_tickets.find_one({"_id": ObjectId(id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Verify user has access to the organization
        organization = await organizations.find_one({
            "_id": ticket["organizationId"],
            "members.userId": current_user.id
        })
        
        if not organization:
            raise HTTPException(status_code=403, detail="Not authorized to delete this ticket")

        # Record activity before deletion
        await record_activity(
            current_user.id,
            ticket["organizationId"],
            f"deleted ticket {ticket['title']}"
        )

        # Delete the ticket
        result = await isp_tickets.delete_one({"_id": ObjectId(id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")

        return True

    @strawberry.mutation
    async def update_ticket_status(
        self, info: strawberry.Info, ticket_id: str, status: str
    ) -> ISPTicketResponse:
        """Update only the status of an ISP ticket"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Find the ticket
        ticket = await isp_tickets.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": ticket["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to update this ticket")

        # Update only the status
        update_data = {
            "status": status,
            "updatedAt": datetime.now(timezone.utc)
        }

        await isp_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_data}
        )

        # Record the activity
        await record_activity(
            current_user.id,
            ticket["organizationId"],
            f"updated ticket status to {status}"
        )

        updated_ticket = await isp_tickets.find_one({"_id": ObjectId(ticket_id)})
        return ISPTicketResponse(
            success=True,
            message="Ticket status updated successfully",
            ticket=await ISPTicket.from_db(updated_ticket)
        )

