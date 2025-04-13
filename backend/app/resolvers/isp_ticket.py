from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import strawberry
from fastapi import HTTPException, Depends
from app.config.database import isp_tickets, organizations, users
from app.schemas.isp_ticket import (
    ISPTicket,
    ISPTicketResponse,
    ISPTicketsResponse,
    CreateISPTicketInput,
    UpdateISPTicketInput
)
from app.schemas.enums import TicketStatus, TicketPriority
from app.config.deps import Context, get_current_user
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging
from pymongo import ASCENDING, DESCENDING
from functools import lru_cache

logger = logging.getLogger(__name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

@strawberry.type
class ISPTicketResolver:
    @strawberry.field
    async def ticket(self, id: str, info: strawberry.Info) -> ISPTicket:
        """
        Get ISP ticket by ID
        
        Args:
            id: Ticket ID
            info: GraphQL info object
            
        Returns:
            ISPTicket: The requested ticket
            
        Raises:
            HTTPException: If ticket not found or user not authorized
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            ticket_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid ticket ID format")

        ticket = await isp_tickets.find_one({"_id": ticket_id})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return await ISPTicket.from_db(ticket)

    @strawberry.field
    async def tickets(
        self, 
        info: strawberry.Info, 
        organization_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = DEFAULT_PAGE_SIZE,
        sort_by: Optional[str] = "createdAt",
        sort_direction: Optional[str] = "desc",
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> ISPTicketsResponse:
        """
        Get all ISP tickets for a specific organization with pagination and filtering
        
        Args:
            info: GraphQL info object
            organization_id: Organization ID to fetch tickets for
            page: Page number (starting from 1)
            page_size: Number of items per page
            sort_by: Field to sort by
            sort_direction: Sort direction ('asc' or 'desc')
            status: Filter by ticket status
            category: Filter by ticket category
            search: Search term for ticket title or description
            
        Returns:
            ISPTicketsResponse: List of tickets with pagination info
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            org_id = ObjectId(organization_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid organization ID format")

        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": org_id,
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        # Validate and adjust pagination parameters
        page = max(1, page)  # Ensure page is at least 1
        page_size = min(max(1, page_size), MAX_PAGE_SIZE)  # Limit page size
        
        # Build query filters
        query_filter: Dict[str, Any] = {"organizationId": org_id}
        
        # Add status filter if provided
        if status:
            query_filter["status"] = status
            
        # Add category filter if provided
        if category:
            query_filter["category"] = category
            
        # Add search filter if provided
        if search:
            import re
            search_regex = {"$regex": f".*{re.escape(search)}.*", "$options": "i"}
            query_filter["$or"] = [
                {"title": search_regex},
                {"description": search_regex}
            ]
        
        # Determine sort order
        sort_order = DESCENDING if sort_direction.lower() == "desc" else ASCENDING
        
        # Count total matching documents for pagination
        total_count = await isp_tickets.count_documents(query_filter)
        
        # Calculate skip amount for pagination
        skip_amount = (page - 1) * page_size
        
        # Get tickets with pagination and sorting
        all_tickets = await isp_tickets.find(query_filter)\
            .sort(sort_by, sort_order)\
            .skip(skip_amount)\
            .limit(page_size)\
            .to_list(None)

        # Convert to ISPTicket objects
        tickets = [await ISPTicket.from_db(ticket) for ticket in all_tickets]

        return ISPTicketsResponse(
            success=True,
            message="Tickets retrieved successfully",
            tickets=tickets,
            total_count=total_count
        )

    @strawberry.mutation
    async def create_ticket(
        self, info: strawberry.Info, input: CreateISPTicketInput
    ) -> ISPTicketResponse:
        """
        Create a new ISP ticket
        
        Args:
            info: GraphQL info object
            input: Ticket creation input
            
        Returns:
            ISPTicketResponse: The created ticket
        """
        context: Context = info.context
        current_user = await context.authenticate()
        
        try:
            org_id = ObjectId(input.organizationId)
        except:
            raise HTTPException(status_code=400, detail="Invalid organization ID format")
            
        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": org_id,
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to create tickets in this organization")

        # Validate customer ID if provided
        customer_id = None
        if input.customerId:
            try:
                customer_id = ObjectId(input.customerId)
            except:
                raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        # Validate assigned user if provided
        assigned_to = None
        if input.assignedTo:
            try:
                assigned_to = ObjectId(input.assignedTo)
                # Verify assigned user exists
                user = await users.find_one({"_id": assigned_to})
                if not user:
                    raise HTTPException(status_code=404, detail="Assigned user not found")
            except:
                raise HTTPException(status_code=400, detail="Invalid user ID format")

        # Create ticket document
        now = datetime.now(timezone.utc)
        ticket_doc = {
            "title": input.title,
            "description": input.description,
            "organizationId": org_id,
            "customerId": customer_id,
            "status": "OPEN",
            "priority": input.priority,
            "category": input.category,
            "dueDate": input.dueDate,
            "assignedTo": assigned_to,
            "createdAt": now,
            "updatedAt": now
        }

        try:
            result = await isp_tickets.insert_one(ticket_doc)
            ticket_doc["_id"] = result.inserted_id
        except Exception as e:
            logger.error(f"Database error when creating ticket: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record activity
        await record_activity(
            current_user.id,
            org_id,
            action=f"created ticket '{input.title}'"
        )
        
        # Get the created ticket
        ticket = await isp_tickets.find_one({"_id": result.inserted_id})

        return ISPTicketResponse(
            success=True,
            message="Ticket created successfully",
            ticket=await ISPTicket.from_db(ticket)
        )

    @strawberry.mutation
    async def update_ticket(
        self, info: strawberry.Info, input: UpdateISPTicketInput
    ) -> ISPTicketResponse:
        """
        Update an existing ISP ticket
        
        Args:
            info: GraphQL info object
            input: Ticket update input
            
        Returns:
            ISPTicketResponse: The updated ticket
            
        Raises:
            HTTPException: If ticket not found or user not authorized
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            ticket_id = ObjectId(input.id)
        except:
            raise HTTPException(status_code=400, detail="Invalid ticket ID format")
            
        # Get the ticket
        ticket = await isp_tickets.find_one({"_id": ticket_id})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
            
        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": ticket["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to update this ticket")
            
        # Validate assigned user if provided
        if input.assignedTo:
            try:
                assigned_to = ObjectId(input.assignedTo)
                # Verify assigned user exists
                user = await users.find_one({"_id": assigned_to})
                if not user:
                    raise HTTPException(status_code=404, detail="Assigned user not found")
            except:
                raise HTTPException(status_code=400, detail="Invalid user ID format")

        # Build update data
        update_data = {
            key: value for key, value in {
                "title": input.title,
                "description": input.description,
                "status": input.status,
                "priority": input.priority,
                "category": input.category,
                "dueDate": input.dueDate,
                "assignedTo": ObjectId(input.assignedTo) if input.assignedTo else None,
                "resolution": input.resolution,
                "updatedAt": datetime.now(timezone.utc)
            }.items() if value is not None
        }

        try:
            result = await isp_tickets.update_one(
                {"_id": ticket_id},
                {"$set": update_data}
            )

            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="Ticket not found")
        except Exception as e:
            logger.error(f"Database error when updating ticket: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record activity
        action = f"updated ticket '{ticket['title']}'"
        await record_activity(
            current_user.id,
            ticket["organizationId"],
            action=action
        )

        updated_ticket = await isp_tickets.find_one({"_id": ticket_id})

        return ISPTicketResponse(
            success=True,
            message="Ticket updated successfully",
            ticket=await ISPTicket.from_db(updated_ticket)
        )

    @strawberry.mutation
    async def delete_ticket(self, info: strawberry.Info, id: str) -> bool:
        """
        Delete an ISP ticket
        
        Args:
            info: GraphQL info object
            id: Ticket ID to delete
            
        Returns:
            bool: True if deleted successfully
            
        Raises:
            HTTPException: If ticket not found or user not authorized
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            ticket_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid ticket ID format")

        # Find the ticket
        ticket = await isp_tickets.find_one({"_id": ticket_id})
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

        try:
            # Delete the ticket
            result = await isp_tickets.delete_one({"_id": ticket_id})
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Ticket not found")
        except Exception as e:
            logger.error(f"Database error when deleting ticket: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        return True

    @strawberry.mutation
    async def update_ticket_status(
        self, 
        info: strawberry.Info, 
        ticket_id: str,  # Changed from ID to str
        status: TicketStatus  # Using the enum type directly
    ) -> ISPTicketResponse:
        """
        Update only the status of an ISP ticket
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            object_id = ObjectId(ticket_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid ticket ID format")

        # Find the ticket
        ticket = await isp_tickets.find_one({"_id": object_id})
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

        try:
            await isp_tickets.update_one(
                {"_id": object_id},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Database error when updating ticket status: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record the activity
        await record_activity(
            current_user.id,
            ticket["organizationId"],
            f"updated ticket status to {status}"
        )

        updated_ticket = await isp_tickets.find_one({"_id": object_id})
        return ISPTicketResponse(
            success=True,
            message="Ticket status updated successfully",
            ticket=await ISPTicket.from_db(updated_ticket)
        )

