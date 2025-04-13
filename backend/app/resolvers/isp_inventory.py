from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import strawberry
from fastapi import HTTPException
from app.config.database import isp_inventories, organizations
from app.schemas.isp_inventory import (
    ISPInventory,
    ISPInventoryResponse,
    ISPInventoriesResponse,
    CreateISPInventoryInput,
    UpdateISPInventoryInput
)
from app.schemas.enums import EquipmentStatus, EquipmentCategory
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging
import re
from pymongo import ASCENDING, DESCENDING
from functools import lru_cache

logger = logging.getLogger(__name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

@strawberry.type
class ISPInventoryResolver:

    @strawberry.field
    async def inventory(self, id: str, info: strawberry.Info) -> ISPInventoryResponse:
        """Get a specific inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            object_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid inventory ID format")

        inventory = await isp_inventories.find_one({"_id": object_id})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Verify user has access to the organization this inventory belongs to
        org = await organizations.find_one({
            "_id": inventory["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this inventory item")

        return ISPInventoryResponse(
            success=True,
            message="Inventory item retrieved successfully",
            inventory=await ISPInventory.from_db(inventory)
        )

    @strawberry.field
    async def inventories(
        self, 
        info: strawberry.Info, 
        organization_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = DEFAULT_PAGE_SIZE,
        sort_by: Optional[str] = "createdAt",
        sort_direction: Optional[str] = "desc",
        filter_category: Optional[EquipmentCategory] = None,
        filter_status: Optional[EquipmentStatus] = None,
        search: Optional[str] = None
    ) -> ISPInventoriesResponse:
        """
        Get all inventory items for a specific organization with pagination and filtering.
        
        Args:
            info: GraphQL info object
            organization_id: Organization ID to fetch inventory for
            page: Page number (starting from 1)
            page_size: Number of items per page
            sort_by: Field to sort by
            sort_direction: Sort direction ('asc' or 'desc')
            filter_category: Filter by equipment category
            filter_status: Filter by equipment status
            search: Search term for name, model, or serial number
            
        Returns:
            ISPInventoriesResponse: List of inventory items with pagination info
        """
        context: Context = info.context
        current_user = await context.authenticate()

        # Validate parameters
        try:
            org_object_id = ObjectId(organization_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid organization ID format")
            
        # First verify the user has access to this organization
        org = await organizations.find_one({
            "_id": org_object_id,
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        # Validate and adjust pagination parameters
        page = max(1, page)  # Ensure page is at least 1
        page_size = min(max(1, page_size), MAX_PAGE_SIZE)  # Limit page size
        
        # Build query filters
        query_filter: Dict[str, Any] = {"organizationId": org_object_id}
        
        # Add category filter if provided
        if filter_category:
            query_filter["category"] = filter_category
            
        # Add status filter if provided
        if filter_status:
            query_filter["status"] = filter_status
            
        # Add search filter if provided
        if search:
            search_regex = {"$regex": f".*{re.escape(search)}.*", "$options": "i"}
            query_filter["$or"] = [
                {"name": search_regex},
                {"model": search_regex},
                {"serialNumber": search_regex},
                {"manufacturer": search_regex}
            ]
        
        # Determine sort order
        sort_order = DESCENDING if sort_direction.lower() == "desc" else ASCENDING
        
        # Count total matching documents for pagination
        total_count = await isp_inventories.count_documents(query_filter)
        
        # Calculate skip amount for pagination
        skip_amount = (page - 1) * page_size
        
        # Get inventory items with pagination and sorting
        all_items = await isp_inventories.find(query_filter)\
            .sort(sort_by, sort_order)\
            .skip(skip_amount)\
            .limit(page_size)\
            .to_list(None)

        # Convert database records to ISPInventory objects
        inventory_list = []
        for item in all_items:
            inventory_list.append(await ISPInventory.from_db(item))

        return ISPInventoriesResponse(
            success=True,
            message="Inventory items retrieved successfully",
            inventories=inventory_list,
            total_count=total_count
        )

    @strawberry.mutation
    async def create_inventory(self, input: CreateISPInventoryInput, info: strawberry.Info) -> ISPInventoryResponse:
        """Create a new inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Verify organization exists
            org_id = ObjectId(input.organizationId)
            organization = await organizations.find_one({"_id": org_id})
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")

            # Check if user has permission to create inventory items in this organization
            user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
            if not user_member:
                raise HTTPException(status_code=403, detail="Not authorized to create inventory items in this organization")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid organization ID format")

        # Check for duplicate serial number if provided
        if input.serialNumber:
            existing_item = await isp_inventories.find_one({
                "organizationId": org_id,
                "serialNumber": input.serialNumber
            })
            if existing_item:
                raise HTTPException(status_code=400, detail="Item with this serial number already exists")

        current_time = datetime.now(timezone.utc)
        inventory_data = {
            "name": input.name,
            "category": input.category,
            "organizationId": org_id,
            "model": input.model,
            "manufacturer": input.manufacturer,
            "serialNumber": input.serialNumber,
            "macAddress": input.macAddress,
            "ipAddress": input.ipAddress,
            "quantity": input.quantity,
            "quantityThreshold": input.quantityThreshold,
            "unitPrice": input.unitPrice,
            "status": EquipmentStatus.AVAILABLE,
            "location": input.location,
            "specifications": input.specifications,
            "notes": input.notes,
            "warrantyExpirationDate": input.warrantyExpirationDate,
            "purchaseDate": input.purchaseDate,
            "createdAt": current_time,
            "updatedAt": current_time
        }

        try:
            result = await isp_inventories.insert_one(inventory_data)
            inventory_data["_id"] = result.inserted_id
        except Exception as e:
            logger.error(f"Database error when creating inventory item: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record activity
        await record_activity(
            current_user.id,
            org_id,
            f"created inventory item {input.name}"
        )

        return ISPInventoryResponse(
            success=True,
            message="Inventory item created successfully",
            inventory=await ISPInventory.from_db(inventory_data)
        )

    @strawberry.mutation
    async def update_inventory(self, id: str, input: UpdateISPInventoryInput, info: strawberry.Info) -> ISPInventoryResponse:
        """Update an inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            object_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid inventory ID format")

        # Find the inventory item
        inventory = await isp_inventories.find_one({"_id": object_id})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Verify user has access to the organization
        org = await organizations.find_one({
            "_id": inventory["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to update this inventory item")

        # Check for duplicate serial number if updating serial number
        if input.serialNumber and input.serialNumber != inventory.get("serialNumber"):
            existing_item = await isp_inventories.find_one({
                "_id": {"$ne": object_id},  # Not this item
                "organizationId": inventory["organizationId"],
                "serialNumber": input.serialNumber
            })
            if existing_item:
                raise HTTPException(status_code=400, detail="Item with this serial number already exists")

        # Prepare update data
        update_data = {
            key: value for key, value in {
                "name": input.name,
                "category": input.category,
                "model": input.model,
                "manufacturer": input.manufacturer,
                "serialNumber": input.serialNumber,
                "macAddress": input.macAddress,
                "ipAddress": input.ipAddress,
                "quantity": input.quantity,
                "quantityThreshold": input.quantityThreshold,
                "unitPrice": input.unitPrice,
                "status": input.status,
                "location": input.location,
                "assignedTo": input.assignedTo,
                "specifications": input.specifications,
                "notes": input.notes,
                "warrantyExpirationDate": input.warrantyExpirationDate,
                "purchaseDate": input.purchaseDate,
                "updatedAt": datetime.now(timezone.utc)
            }.items() if value is not None
        }

        try:
            await isp_inventories.update_one(
                {"_id": object_id},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Database error when updating inventory item: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record activity
        await record_activity(
            current_user.id,
            inventory["organizationId"],
            f"updated inventory item {inventory['name']}"
        )

        updated_inventory = await isp_inventories.find_one({"_id": object_id})
        return ISPInventoryResponse(
            success=True,
            message="Inventory item updated successfully",
            inventory=await ISPInventory.from_db(updated_inventory)
        )

    @strawberry.mutation
    async def delete_inventory(self, id: str, info: strawberry.Info) -> ISPInventoryResponse:
        """Delete an inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            object_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid inventory ID format")

        # Find the inventory item
        inventory = await isp_inventories.find_one({"_id": object_id})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Verify user has access to the organization
        org = await organizations.find_one({
            "_id": inventory["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to delete this inventory item")

        # Create a snapshot of inventory data before deletion
        inventory_data = await ISPInventory.from_db(inventory)
        
        # Record activity before deletion
        await record_activity(
            current_user.id,
            inventory["organizationId"],
            f"deleted inventory item {inventory['name']}"
        )

        try:
            # Delete the inventory item
            await isp_inventories.delete_one({"_id": object_id})
        except Exception as e:
            logger.error(f"Database error when deleting inventory item: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        return ISPInventoryResponse(
            success=True,
            message="Inventory item deleted successfully",
            inventory=inventory_data
        )
