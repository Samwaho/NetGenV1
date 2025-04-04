from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import isp_customers, organizations, isp_packages, isp_stations
from app.schemas.isp_customer import (
    ISPCustomer,
    ISPCustomerResponse,
    ISPCustomersResponse,
    CreateISPCustomerInput,
    UpdateISPCustomerInput
)
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging
import re

logger = logging.getLogger(__name__)


def validate_pppoe_credentials(username: str, password: str) -> None:
    """
    Validate PPPoE username and password according to common PPPoE requirements
    """
    # Username validation
    if not re.match(r'^[a-zA-Z0-9_-]{3,32}$', username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-32 characters long and contain only letters, numbers, underscores, and hyphens"
        )
    
    # Password validation - only check for minimum length
    if len(password) < 1:
        raise HTTPException(
            status_code=400,
            detail="Password cannot be empty"
        )


@strawberry.type
class ISPCustomerResolver:

    @strawberry.field
    async def customer(self, id: str, info: strawberry.Info) -> ISPCustomer:
        """Get ISP customer by ID"""
        context: Context = info.context
        current_user = await context.authenticate()

        customer = await isp_customers.find_one({"_id": ObjectId(id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return await ISPCustomer.from_db(customer)

    @strawberry.field
    async def customers(self, info: strawberry.Info, organization_id: str) -> ISPCustomersResponse:
        """Get all ISP customers for a specific organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": ObjectId(organization_id),
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        # Get customers only for this specific organization
        all_customers = await isp_customers.find(
            {"organizationId": ObjectId(organization_id)}
        ).to_list(None)
        
        customer_list = []
        for customer in all_customers:
            customer_list.append(await ISPCustomer.from_db(customer))

        return ISPCustomersResponse(
            success=True,
            message="Customers retrieved successfully",
            customers=customer_list
        )

    @strawberry.mutation
    async def create_customer(self, input: CreateISPCustomerInput, info: strawberry.Info) -> ISPCustomerResponse:
        """Create a new ISP customer"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Validate PPPoE credentials
        validate_pppoe_credentials(input.username, input.password)

        # Verify organization exists
        organization = await organizations.find_one({"_id": ObjectId(input.organizationId)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to create customers in this organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to create customers in this organization")

        # Verify package exists and check service type
        package = await isp_packages.find_one({"_id": ObjectId(input.packageId)})
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")

        # Verify station exists
        station = await isp_stations.find_one({"_id": ObjectId(input.stationId)})
        if not station:
            raise HTTPException(status_code=404, detail="Station not found")

        # Check if username already exists (case-insensitive)
        existing_customer = await isp_customers.find_one({
            "$or": [
                {"username": {"$regex": f"^{input.username}$", "$options": "i"}},
                {"email": input.email.lower()}
            ]
        })
        if existing_customer:
            raise HTTPException(status_code=400, detail="Username or email already exists")

        customer_data = {
            "firstName": input.firstName,
            "lastName": input.lastName,
            "email": input.email.lower(),
            "phone": input.phone,
            "username": input.username,  # Store original username for PPPoE
            "password": input.password,  # Store plain password for PPPoE
            "organizationId": ObjectId(input.organizationId),
            "packageId": ObjectId(input.packageId),
            "stationId": ObjectId(input.stationId),
            "expirationDate": input.expirationDate,
            "status": "INACTIVE",
            "online": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await isp_customers.insert_one(customer_data)
        customer_data["_id"] = result.inserted_id

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(input.organizationId),
            f"created ISP customer {input.username}"
        )

        return ISPCustomerResponse(
            success=True,
            message="Customer created successfully",
            customer=await ISPCustomer.from_db(customer_data)
        )

    @strawberry.mutation
    async def update_customer(self, id: str, input: UpdateISPCustomerInput, info: strawberry.Info) -> ISPCustomerResponse:
        """Update ISP customer details"""
        context: Context = info.context
        current_user = await context.authenticate()

        customer = await isp_customers.find_one({"_id": ObjectId(id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Verify user has permission to update this customer
        organization = await organizations.find_one({"_id": customer["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to update this customer")

        # Validate PPPoE credentials if updating
        if input.username or input.password:
            new_username = input.username or customer["username"]
            new_password = input.password or customer["password"]
            validate_pppoe_credentials(new_username, new_password)

            # Check username uniqueness if changing
            if input.username and input.username != customer["username"]:
                existing = await isp_customers.find_one({
                    "_id": {"$ne": ObjectId(id)},
                    "username": {"$regex": f"^{input.username}$", "$options": "i"}
                })
                if existing:
                    raise HTTPException(status_code=400, detail="Username already exists")

        # Verify package if updating
        if input.packageId:
            package = await isp_packages.find_one({"_id": ObjectId(input.packageId)})
            if not package:
                raise HTTPException(status_code=404, detail="Package not found")

        # Verify station if updating
        if input.stationId:
            station = await isp_stations.find_one({"_id": ObjectId(input.stationId)})
            if not station:
                raise HTTPException(status_code=404, detail="Station not found")

        update_data = {
            key: value for key, value in {
                "firstName": input.firstName,
                "lastName": input.lastName,
                "email": input.email.lower() if input.email else None,
                "phone": input.phone,
                "username": input.username,
                "password": input.password,
                "packageId": ObjectId(input.packageId) if input.packageId else None,
                "stationId": ObjectId(input.stationId) if input.stationId else None,
                "expirationDate": input.expirationDate,
                "status": input.status,
                "updatedAt": datetime.now(timezone.utc)
            }.items() if value is not None
        }

        await isp_customers.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        # Record activity
        await record_activity(
            current_user.id,
            customer["organizationId"],
            f"updated ISP customer {customer['username']}"
        )

        updated_customer = await isp_customers.find_one({"_id": ObjectId(id)})
        return ISPCustomerResponse(
            success=True,
            message="Customer updated successfully",
            customer=await ISPCustomer.from_db(updated_customer)
        )

    @strawberry.mutation
    async def delete_customer(self, id: str, info: strawberry.Info) -> ISPCustomerResponse:
        """Delete an ISP customer"""
        context: Context = info.context
        current_user = await context.authenticate()

        customer = await isp_customers.find_one({"_id": ObjectId(id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Verify user has permission to delete this customer
        organization = await organizations.find_one({"_id": customer["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to delete this customer")

        # Record activity before deletion
        await record_activity(
            current_user.id,
            customer["organizationId"],
            f"deleted ISP customer {customer['username']}"
        )

        await isp_customers.delete_one({"_id": ObjectId(id)})

        return ISPCustomerResponse(
            success=True,
            message="Customer deleted successfully",
            customer=await ISPCustomer.from_db(customer)
        )


