from datetime import datetime, timezone
from typing import Optional, List
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
from app.schemas.enums import EquipmentStatus
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging

logger = logging.getLogger(__name__)

@strawberry.type
class ISPInventoryResolver:

    @strawberry.field
    async def inventory(self, id: str, info: strawberry.Info) -> ISPInventoryResponse:
        """Get a specific inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        inventory = await isp_inventories.find_one({"_id": ObjectId(id)})
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
    async def inventories(self, info: strawberry.Info, organization_id: str) -> ISPInventoriesResponse:
        """Get all inventory items for a specific organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # First verify the user has access to this organization
        org = await organizations.find_one({
            "_id": ObjectId(organization_id),
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        # Get inventory items only for this specific organization
        all_items = await isp_inventories.find(
            {"organizationId": ObjectId(organization_id)}
        ).to_list(None)

        inventory_list = []
        for item in all_items:
            inventory_list.append(await ISPInventory.from_db(item))

        return ISPInventoriesResponse(
            success=True,
            message="Inventory items retrieved successfully",
            inventories=inventory_list
        )

    @strawberry.mutation
    async def create_inventory(self, input: CreateISPInventoryInput, info: strawberry.Info) -> ISPInventoryResponse:
        """Create a new inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify organization exists
        organization = await organizations.find_one({"_id": ObjectId(input.organizationId)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to create inventory items in this organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to create inventory items in this organization")

        inventory_data = {
            "name": input.name,
            "category": input.category,
            "organizationId": ObjectId(input.organizationId),
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
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await isp_inventories.insert_one(inventory_data)
        created_inventory = await isp_inventories.find_one({"_id": result.inserted_id})

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(input.organizationId),
            f"created inventory item {input.name}"
        )

        return ISPInventoryResponse(
            success=True,
            message="Inventory item created successfully",
            inventory=await ISPInventory.from_db(created_inventory)
        )

    @strawberry.mutation
    async def update_inventory(self, id: str, input: UpdateISPInventoryInput, info: strawberry.Info) -> ISPInventoryResponse:
        """Update an inventory item"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Find the inventory item
        inventory = await isp_inventories.find_one({"_id": ObjectId(id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Verify user has access to the organization
        org = await organizations.find_one({
            "_id": inventory["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to update this inventory item")

        # Prepare update data
        update_data = {
            "updatedAt": datetime.now(timezone.utc)
        }

        # Add all provided fields to update_data
        if input.name is not None:
            update_data["name"] = input.name
        if input.category is not None:
            update_data["category"] = input.category
        if input.model is not None:
            update_data["model"] = input.model
        if input.manufacturer is not None:
            update_data["manufacturer"] = input.manufacturer
        if input.serialNumber is not None:
            update_data["serialNumber"] = input.serialNumber
        if input.macAddress is not None:
            update_data["macAddress"] = input.macAddress
        if input.ipAddress is not None:
            update_data["ipAddress"] = input.ipAddress
        if input.quantity is not None:
            update_data["quantity"] = input.quantity
        if input.quantityThreshold is not None:
            update_data["quantityThreshold"] = input.quantityThreshold
        if input.unitPrice is not None:
            update_data["unitPrice"] = input.unitPrice
        if input.status is not None:
            update_data["status"] = input.status
        if input.location is not None:
            update_data["location"] = input.location
        if input.assignedTo is not None:
            update_data["assignedTo"] = input.assignedTo
        if input.specifications is not None:
            update_data["specifications"] = input.specifications
        if input.notes is not None:
            update_data["notes"] = input.notes
        if input.warrantyExpirationDate is not None:
            update_data["warrantyExpirationDate"] = input.warrantyExpirationDate
        if input.purchaseDate is not None:
            update_data["purchaseDate"] = input.purchaseDate

        await isp_inventories.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        # Record activity
        await record_activity(
            current_user.id,
            inventory["organizationId"],
            f"updated inventory item {inventory['name']}"
        )

        updated_inventory = await isp_inventories.find_one({"_id": ObjectId(id)})
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

        # Find the inventory item
        inventory = await isp_inventories.find_one({"_id": ObjectId(id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Verify user has access to the organization
        org = await organizations.find_one({
            "_id": inventory["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to delete this inventory item")

        # Delete the inventory item
        await isp_inventories.delete_one({"_id": ObjectId(id)})

        # Record activity
        await record_activity(
            current_user.id,
            inventory["organizationId"],
            f"deleted inventory item {inventory['name']}"
        )

        return ISPInventoryResponse(
            success=True,
            message="Inventory item deleted successfully",
            inventory=await ISPInventory.from_db(inventory)
        )
