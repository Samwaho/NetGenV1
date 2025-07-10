from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, cast
import strawberry
from fastapi import HTTPException, BackgroundTasks
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
from pymongo import ASCENDING, DESCENDING
from functools import lru_cache
from app.services.sms.template import SmsTemplateService
from app.services.sms.utils import send_sms_for_organization
from app.schemas.sms_template import TemplateCategory
import json
from app.api.mpesa import process_customer_payment

logger = logging.getLogger(__name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

def ensure_utc(dt: datetime) -> datetime:
    """Ensure a datetime is timezone-aware and in UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Assume naive datetimes are in local time, convert to UTC
        return dt.astimezone(timezone.utc)
    return dt.astimezone(timezone.utc)

@lru_cache(maxsize=128)
def validate_pppoe_credentials(username: str, password: str) -> None:
    """
    Validate PPPoE username and password according to common PPPoE requirements.
    
    Args:
        username: PPPoE username to validate
        password: PPPoE password to validate
        
    Raises:
        HTTPException: If validation fails
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
    """Resolver for ISP customer operations."""

    @strawberry.field
    async def customer(self, id: str, info: strawberry.Info) -> ISPCustomer:
        """
        Get ISP customer by ID.
        
        Args:
            id: Customer ID
            info: GraphQL info object
            
        Returns:
            ISPCustomer: The requested customer
            
        Raises:
            HTTPException: If customer not found or user not authorized
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            object_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")

        customer = await isp_customers.find_one({"_id": object_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return await ISPCustomer.from_db(customer)

    @strawberry.field
    async def customers(
        self, 
        info: strawberry.Info, 
        organization_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = DEFAULT_PAGE_SIZE,
        sort_by: Optional[str] = "createdAt",
        sort_direction: Optional[str] = "desc",
        filter_status: Optional[str] = None,
        search: Optional[str] = None
    ) -> ISPCustomersResponse:
        """
        Get all ISP customers for a specific organization with pagination and filtering.
        
        Args:
            info: GraphQL info object
            organization_id: Organization ID to fetch customers for
            page: Page number (starting from 1)
            page_size: Number of items per page
            sort_by: Field to sort by
            sort_direction: Sort direction ('asc' or 'desc')
            filter_status: Filter by status (ACTIVE/INACTIVE)
            search: Search term for username, name, or email
            
        Returns:
            ISPCustomersResponse: List of customers with pagination info
        """
        context: Context = info.context
        current_user = await context.authenticate()

        # Validate parameters
        try:
            org_object_id = ObjectId(organization_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid organization ID format")
            
        # Verify user has access to this organization
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
        
        # Add status filter if provided
        if filter_status:
            query_filter["status"] = filter_status
            
        # Add search filter if provided
        if search:
            search_regex = {"$regex": f".*{re.escape(search)}.*", "$options": "i"}
            search_conditions = [
                {"username": search_regex},
                {"firstName": search_regex},
                {"lastName": search_regex}
            ]
            # Only add email search if email field exists and is not null
            search_conditions.append({"email": search_regex})
            query_filter["$or"] = search_conditions
        
        # Determine sort order
        sort_order = DESCENDING if sort_direction.lower() == "desc" else ASCENDING
        
        # Count total matching documents for pagination
        total_count = await isp_customers.count_documents(query_filter)
        
        # Calculate skip amount for pagination
        skip_amount = (page - 1) * page_size
        
        # Get customers with pagination and sorting
        all_customers = await isp_customers.find(query_filter)\
            .sort(sort_by, sort_order)\
            .skip(skip_amount)\
            .limit(page_size)\
            .to_list(None)
        
        # Convert database records to ISPCustomer objects
        customer_list = []
        for customer in all_customers:
            customer_list.append(await ISPCustomer.from_db(customer))

        return ISPCustomersResponse(
            success=True,
            message="Customers retrieved successfully",
            customers=customer_list,
            total_count=total_count
        )

    @strawberry.mutation
    async def create_customer(
        self, 
        input: CreateISPCustomerInput, 
        info: strawberry.Info
    ) -> ISPCustomerResponse:
        """
        Create a new ISP customer.
        
        Args:
            input: Customer creation input
            info: GraphQL info object
            
        Returns:
            ISPCustomerResponse: The created customer
        """
        context: Context = info.context
        current_user = await context.authenticate()

        # Validate PPPoE credentials
        validate_pppoe_credentials(input.username, input.password)

        try:
            # Verify organization exists
            org_id = ObjectId(input.organizationId)
            organization = await organizations.find_one({"_id": org_id})
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")

            # Check if user has permission
            user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
            if not user_member:
                raise HTTPException(status_code=403, detail="Not authorized to create customers in this organization")

            # Verify package exists
            package_id = ObjectId(input.packageId)
            package = await isp_packages.find_one({"_id": package_id})
            if not package:
                raise HTTPException(status_code=404, detail="Package not found")

            # Verify station exists
            station_id = ObjectId(input.stationId)
            station = await isp_stations.find_one({"_id": station_id})
            if not station:
                raise HTTPException(status_code=404, detail="Station not found")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid ID format")

        # Check for existing username or email (case-insensitive)
        existing_customer = await isp_customers.find_one({
            "$or": [
                {"username": {"$regex": f"^{re.escape(input.username)}$", "$options": "i"}},
                {"email": input.email.lower()} if input.email else {"email": {"$exists": False}}
            ]
        })
        if existing_customer:
            raise HTTPException(status_code=400, detail="Username or email already exists")

        # Prepare customer data
        current_time = datetime.now(timezone.utc)
        customer_data = {
            "firstName": input.firstName,
            "lastName": input.lastName,
            "email": input.email.lower() if input.email else None,
            "phone": input.phone,
            "username": input.username,
            "password": input.password,
            "organizationId": org_id,
            "packageId": package_id,
            "stationId": station_id,
            "expirationDate": ensure_utc(input.expirationDate),
            "status": "ACTIVE",
            "online": False,
            "createdAt": current_time,
            "updatedAt": current_time,
            "initialAmount": input.initialAmount,
            "isNew": True
        }

        # Insert the new customer
        try:
            result = await isp_customers.insert_one(customer_data)
            customer_data["_id"] = result.inserted_id
        except Exception as e:
            logger.error(f"Database error when creating customer: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Send onboarding SMS (do not block on error)
        try:
            # Fetch onboarding template for the organization
            template_result = await SmsTemplateService.list_templates(
                organization_id=input.organizationId,
                category=TemplateCategory.CUSTOMER_ONBOARDING,
                is_active=True
            )
            template_doc = None
            if template_result.get("success") and template_result.get("templates"):
                template_doc = template_result["templates"][0]
            if template_doc:
                # Prepare variables for template rendering (dynamic)
                sms_vars = SmsTemplateService.build_sms_vars([
                    input, organization
                ])
                message = SmsTemplateService.render_template(template_doc["content"], sms_vars)
                await send_sms_for_organization(
                    organization_id=input.organizationId,
                    to=input.phone,
                    message=message
                )
        except Exception as sms_exc:
            logger.error(f"Failed to send onboarding SMS: {sms_exc}")

        # Send invoice payment SMS (do not block on error)
        try:
            invoice_template_result = await SmsTemplateService.list_templates(
                organization_id=input.organizationId,
                category=TemplateCategory.INVOICE_PAYMENT,
                is_active=True
            )
            invoice_template_doc = None
            if invoice_template_result.get("success") and invoice_template_result.get("templates"):
                invoice_template_doc = invoice_template_result["templates"][0]
            if invoice_template_doc:
                org_name = organization.get("name", "Provider")
                paybill_number = None
                if organization.get("mpesaConfig"):
                    paybill_number = organization["mpesaConfig"].get("shortCode")
                amount_due = input.initialAmount
                invoice_vars = SmsTemplateService.build_sms_vars([
                    input, organization, {"amountDue": amount_due, "paybillNumber": paybill_number or ""}
                ])
                invoice_message = SmsTemplateService.render_template(invoice_template_doc["content"], invoice_vars)
                await send_sms_for_organization(
                    organization_id=input.organizationId,
                    to=input.phone,
                    message=invoice_message
                )
        except Exception as invoice_sms_exc:
            logger.error(f"Failed to send invoice payment SMS: {invoice_sms_exc}")

        # Record activity
        activity_message = f"created ISP customer {input.username}"
        await record_activity(
            current_user.id,
            org_id,
            activity_message
        )

        return ISPCustomerResponse(
            success=True,
            message="Customer created successfully",
            customer=await ISPCustomer.from_db(customer_data)
        )

    @strawberry.mutation
    async def update_customer(
        self, 
        id: str, 
        input: UpdateISPCustomerInput, 
        info: strawberry.Info
    ) -> ISPCustomerResponse:
        """
        Update ISP customer details.
        
        Args:
            id: Customer ID to update
            input: Update data
            info: GraphQL info object
            
        Returns:
            ISPCustomerResponse: The updated customer
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            customer_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")

        customer = await isp_customers.find_one({"_id": customer_id})
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
                    "_id": {"$ne": customer_id},
                    "username": {"$regex": f"^{re.escape(input.username)}$", "$options": "i"}
                })
                if existing:
                    raise HTTPException(status_code=400, detail="Username already exists")
        
        # Verify related entities if updating them
        if input.packageId:
            try:
                package_id = ObjectId(input.packageId)
                package = await isp_packages.find_one({"_id": package_id})
                if not package:
                    raise HTTPException(status_code=404, detail="Package not found")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid package ID format")

        if input.stationId:
            try:
                station_id = ObjectId(input.stationId)
                station = await isp_stations.find_one({"_id": station_id})
                if not station:
                    raise HTTPException(status_code=404, detail="Station not found")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid station ID format")

        # Build update data
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
                "expirationDate": ensure_utc(input.expirationDate),
                "status": input.status,
                "updatedAt": datetime.now(timezone.utc)
            }.items() if value is not None
        }

        try:
            # Update the customer
            await isp_customers.update_one(
                {"_id": customer_id},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Database error when updating customer: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record activity
        activity_message = f"updated ISP customer {customer['username']}"
        await record_activity(
            current_user.id,
            customer["organizationId"],
            activity_message
        )

        # Fetch the updated customer
        updated_customer = await isp_customers.find_one({"_id": customer_id})

        return ISPCustomerResponse(
            success=True,
            message="Customer updated successfully",
            customer=await ISPCustomer.from_db(updated_customer)
        )

    @strawberry.mutation
    async def delete_customer(
        self, 
        id: str, 
        info: strawberry.Info
    ) -> ISPCustomerResponse:
        """
        Delete an ISP customer.
        
        Args:
            id: Customer ID to delete
            info: GraphQL info object
            
        Returns:
            ISPCustomerResponse: The deleted customer
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            customer_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")

        customer = await isp_customers.find_one({"_id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Verify user has permission to delete this customer
        organization = await organizations.find_one({"_id": customer["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to delete this customer")

        # Create a snapshot of customer data before deletion
        customer_data = await ISPCustomer.from_db(customer)
        
        # Record activity before deletion
        activity_message = f"deleted ISP customer {customer['username']}"
        await record_activity(
            current_user.id,
            customer["organizationId"],
            activity_message
        )

        try:
            # Delete the customer
            await isp_customers.delete_one({"_id": customer_id})
        except Exception as e:
            logger.error(f"Database error when deleting customer: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        return ISPCustomerResponse(
            success=True,
            message="Customer deleted successfully",
            customer=customer_data
        )

    @strawberry.mutation
    async def process_manual_payment(
        self, 
        customer_id: str, 
        amount: float, 
        info: strawberry.Info,
        payment_method: str = "manual",
        transaction_id: Optional[str] = None,
        phone_number: Optional[str] = None
    ) -> ISPCustomerResponse:
        """
        Process a manual payment for a customer.
        
        Args:
            customer_id: Customer ID to process payment for
            amount: Payment amount
            info: GraphQL info object
            payment_method: Method of payment (default: "manual")
            transaction_id: Optional transaction ID
            phone_number: Optional phone number
            
        Returns:
            ISPCustomerResponse: The updated customer
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            customer_object_id = ObjectId(customer_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")

        customer = await isp_customers.find_one({"_id": customer_object_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Verify user has permission to process payments for this customer
        organization = await organizations.find_one({"_id": customer["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to process payments for this customer")

        # Validate amount
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")

        # Check if customer is active
        if customer.get("status") != "ACTIVE":
            logger.warning(f"Processing payment for inactive customer {customer['username']}")

        # Get package information for validation
        package = await isp_packages.find_one({"_id": customer.get("packageId")})
        if package:
            package_price = package.get("price", 0)
            if package_price > 0:
                # Validate that amount is reasonable (at least 1 day worth)
                min_amount = package_price / 30  # 1 day worth
                if amount < min_amount:
                    logger.warning(f"Payment amount {amount} is less than minimum daily rate {min_amount} for customer {customer['username']}")

        # Generate transaction ID if not provided
        if not transaction_id:
            import uuid
            transaction_id = f"MANUAL_{uuid.uuid4().hex[:8].upper()}"

        # Process the payment using the existing function
        success = await process_customer_payment(
            organization_id=str(customer["organizationId"]),
            username=customer["username"],
            amount=amount,
            phone=phone_number or customer.get("phone"),
            transaction_id=transaction_id
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to process payment")

        # Record activity
        activity_message = f"processed manual payment of {amount} for customer {customer['username']}"
        await record_activity(
            current_user.id,
            customer["organizationId"],
            activity_message
        )

        # Fetch the updated customer
        updated_customer = await isp_customers.find_one({"_id": customer_object_id})

        return ISPCustomerResponse(
            success=True,
            message=f"Manual payment of {amount} processed successfully",
            customer=await ISPCustomer.from_db(updated_customer)
        )


