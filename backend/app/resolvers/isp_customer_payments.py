from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, cast
import strawberry
from fastapi import HTTPException
from app.config.database import isp_customer_payments, isp_customers, organizations
from app.schemas.isp_customer_payments import (
    ISPCustomerPayment,
    ISPCustomerPaymentResponse,
    ISPCustomerPaymentsResponse,
    CreateISPCustomerPaymentInput
)
from app.config.deps import Context
from bson.objectid import ObjectId
import logging
from pymongo import ASCENDING, DESCENDING
from functools import lru_cache

logger = logging.getLogger(__name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@lru_cache(maxsize=20)
def get_sort_field(field: str) -> str:
    """Map GraphQL sort fields to database fields"""
    field_map = {
        "paidAt": "paidAt",
        "amount": "amount",
        "createdAt": "createdAt",
        "updatedAt": "updatedAt",
    }
    return field_map.get(field, "paidAt")


@strawberry.type
class ISPCustomerPaymentResolver:
    """Resolver for ISP customer payment operations"""

    @strawberry.field
    async def customer_payments(
        self, 
        info: strawberry.Info,
        customerId: str,
        page: Optional[int] = 1,
        pageSize: Optional[int] = DEFAULT_PAGE_SIZE,
        sortBy: Optional[str] = "paidAt",
        sortDirection: Optional[str] = "desc"
    ) -> ISPCustomerPaymentsResponse:
        """
        Get ISP customer payment records for a specific customer
        
        Args:
            info: GraphQL info with request context
            customerId: ID of the customer to get payment records for
            page: Page number (default: 1)
            pageSize: Items per page (default: 20)
            sortBy: Field to sort by (default: "paidAt")
            sortDirection: Sort direction (asc/desc, default: "desc")
            
        Returns:
            ISPCustomerPaymentsResponse with success status, message, and payment records
        """
        context: Context = info.context
        current_user = await context.authenticate()
        
        # Validate pagination parameters
        page = max(1, page)  # Ensure page is at least 1
        pageSize = min(max(1, pageSize), MAX_PAGE_SIZE)
        skip = (page - 1) * pageSize
        
        try:
            customer_id = ObjectId(customerId)
        except:
            return ISPCustomerPaymentsResponse(
                success=False,
                message="Invalid customer ID",
                payments=[],
                total_count=0
            )
        
        # Get customer to verify organization access
        customer = await isp_customers.find_one({"_id": customer_id})
        if not customer:
            return ISPCustomerPaymentsResponse(
                success=False,
                message="Customer not found",
                payments=[],
                total_count=0
            )
        
        # Verify user has access to the organization
        org_id = customer.get("organizationId")
        org = await organizations.find_one({
            "_id": org_id,
            "members.userId": current_user.id
        })
        
        if not org:
            return ISPCustomerPaymentsResponse(
                success=False,
                message="Not authorized to access this organization's data",
                payments=[],
                total_count=0
            )
        
        # Determine sort direction
        sort_dir = DESCENDING if sortDirection.lower() == "desc" else ASCENDING
        sort_field = get_sort_field(sortBy)
        
        # Query payments for the customer
        filter_query = {"customerId": customer_id}
        
        # Get total count for pagination
        total_count = await isp_customer_payments.count_documents(filter_query)
        
        # Get payments with pagination
        cursor = isp_customer_payments.find(filter_query)
        cursor = cursor.sort(sort_field, sort_dir)
        cursor = cursor.skip(skip).limit(pageSize)
        
        payment_records = await cursor.to_list(length=pageSize)
        
        # Convert to ISPCustomerPayment objects
        payments = []
        for payment in payment_records:
            try:
                payment_obj = await ISPCustomerPayment.from_db(payment)
                payments.append(payment_obj)
            except Exception as e:
                logger.error(f"Error converting payment: {str(e)}")
        
        return ISPCustomerPaymentsResponse(
            success=True,
            message=f"Retrieved {len(payments)} payment records",
            payments=payments,
            total_count=total_count
        )
    
    @strawberry.field
    async def organization_payments(
        self, 
        info: strawberry.Info,
        organizationId: str,
        page: Optional[int] = 1,
        pageSize: Optional[int] = DEFAULT_PAGE_SIZE,
        sortBy: Optional[str] = "paidAt",
        sortDirection: Optional[str] = "desc"
    ) -> ISPCustomerPaymentsResponse:
        """
        Get all ISP customer payment records for an organization
        
        Args:
            info: GraphQL info with request context
            organizationId: ID of the organization
            page: Page number (default: 1)
            pageSize: Items per page (default: 20)
            sortBy: Field to sort by (default: "paidAt")
            sortDirection: Sort direction (asc/desc, default: "desc")
            
        Returns:
            ISPCustomerPaymentsResponse with success status, message, and payment records
        """
        context: Context = info.context
        current_user = await context.authenticate()
        
        # Validate pagination parameters
        page = max(1, page)  # Ensure page is at least 1
        pageSize = min(max(1, pageSize), MAX_PAGE_SIZE)
        skip = (page - 1) * pageSize
        
        try:
            org_id = ObjectId(organizationId)
        except:
            return ISPCustomerPaymentsResponse(
                success=False,
                message="Invalid organization ID",
                payments=[],
                total_count=0
            )
        
        # Verify user has access to the organization
        org = await organizations.find_one({
            "_id": org_id,
            "members.userId": current_user.id
        })
        
        if not org:
            return ISPCustomerPaymentsResponse(
                success=False,
                message="Not authorized to access this organization's data",
                payments=[],
                total_count=0
            )
        
        # Determine sort direction
        sort_dir = DESCENDING if sortDirection.lower() == "desc" else ASCENDING
        sort_field = get_sort_field(sortBy)
        
        # Query payments for the organization
        filter_query = {"organizationId": org_id}
        
        # Get total count for pagination
        total_count = await isp_customer_payments.count_documents(filter_query)
        
        # Get payments with pagination
        cursor = isp_customer_payments.find(filter_query)
        cursor = cursor.sort(sort_field, sort_dir)
        cursor = cursor.skip(skip).limit(pageSize)
        
        payment_records = await cursor.to_list(length=pageSize)
        
        # Convert to ISPCustomerPayment objects
        payments = []
        for payment in payment_records:
            try:
                payment_obj = await ISPCustomerPayment.from_db(payment)
                payments.append(payment_obj)
            except Exception as e:
                logger.error(f"Error converting payment: {str(e)}")
        
        return ISPCustomerPaymentsResponse(
            success=True,
            message=f"Retrieved {len(payments)} payment records",
            payments=payments,
            total_count=total_count
        )
    
    @strawberry.mutation
    async def create_customer_payment(
        self, 
        input: CreateISPCustomerPaymentInput, 
        info: strawberry.Info
    ) -> ISPCustomerPaymentResponse:
        """
        Create a new customer payment record
        
        Args:
            input: Payment input data
            info: GraphQL info with request context
            
        Returns:
            ISPCustomerPaymentResponse with success status, message, and payment record
        """
        context: Context = info.context
        current_user = await context.authenticate()
        
        try:
            customer_id = ObjectId(input.customerId)
        except:
            return ISPCustomerPaymentResponse(
                success=False,
                message="Invalid customer ID"
            )
        
        # Get customer to verify organization access
        customer = await isp_customers.find_one({"_id": customer_id})
        if not customer:
            return ISPCustomerPaymentResponse(
                success=False,
                message="Customer not found"
            )
        
        # Verify user has access to the organization
        org_id = customer.get("organizationId")
        org = await organizations.find_one({
            "_id": org_id,
            "members.userId": current_user.id
        })
        
        if not org:
            return ISPCustomerPaymentResponse(
                success=False,
                message="Not authorized to access this organization's data"
            )
        
        # Create payment record
        now = datetime.now(timezone.utc)
        payment_data = {
            "customerId": customer_id,
            "organizationId": org_id,
            "amount": input.amount,
            "transactionId": input.transactionId,
            "phoneNumber": input.phoneNumber,
            "packageId": ObjectId(input.packageId) if input.packageId else customer.get("packageId"),
            "daysAdded": input.daysAdded,
            "paidAt": now,
            "createdAt": now,
            "updatedAt": now
        }
        
        # Insert payment record
        result = await isp_customer_payments.insert_one(payment_data)
        
        if not result.inserted_id:
            return ISPCustomerPaymentResponse(
                success=False,
                message="Failed to create payment record"
            )
            
        # Get inserted payment
        inserted_payment = await isp_customer_payments.find_one({"_id": result.inserted_id})
        
        # Convert to ISPCustomerPayment object
        payment_obj = await ISPCustomerPayment.from_db(inserted_payment)
        
        return ISPCustomerPaymentResponse(
            success=True,
            message="Payment record created successfully",
            payment=payment_obj
        ) 