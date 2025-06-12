from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, cast
import strawberry
from fastapi import HTTPException
from app.config.database import isp_customers_accounting, isp_customers, organizations
from app.schemas.isp_customers_accounting import (
    ISPCustomerAccounting,
    ISPCustomerAccountingResponse,
    ISPCustomerAccountingsResponse,
    AccountingFilterInput,
    AccountingStatusType,
    AccountingStatsPeriod,
    BandwidthStats,
    CustomerBandwidthStatsResponse
)
from app.config.deps import Context
from bson.objectid import ObjectId
import logging
from pymongo import ASCENDING, DESCENDING

logger = logging.getLogger(__name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@strawberry.type
class ISPCustomerAccountingResolver:
    """Resolver for ISP customer accounting operations"""

    @strawberry.field
    async def customer_accountings(
        self, 
        info: strawberry.Info,
        customerId: str,
        page: Optional[int] = 1,
        pageSize: Optional[int] = DEFAULT_PAGE_SIZE
    ) -> ISPCustomerAccountingsResponse:
        """
        Get ISP customer accounting records for a specific customer
        
        Args:
            info: GraphQL info with request context
            customerId: ID of the customer to get accounting records for
            page: Page number (default: 1)
            pageSize: Items per page (default: 20)
            
        Returns:
            ISPCustomerAccountingsResponse with success status, message, and accounting records
        """
        context: Context = info.context
        current_user = await context.authenticate()
        
        # Validate pagination parameters
        page = max(1, page)  # Ensure page is at least 1
        pageSize = min(max(1, pageSize), MAX_PAGE_SIZE)  # Limit page size
        
        try:
            # First try to find customer by _id
            try:
                customer_id = ObjectId(customerId)
                customer = await isp_customers.find_one({"_id": customer_id})
            except:
                # If not a valid ObjectId, try to find by username
                customer = await isp_customers.find_one({"username": customerId})
                
            if not customer:
                raise HTTPException(
                    status_code=404, 
                    detail="Customer not found"
                )

            # Verify user has access to the customer's organization
            organization = await organizations.find_one({
                "_id": customer["organizationId"],
                "members.userId": current_user.id
            })
            
            if not organization:
                raise HTTPException(
                    status_code=403, 
                    detail="Not authorized to access this customer"
                )
            
            # Build query to match either customer ID or username
            query = {
                "$or": [
                    {"customerId": str(customer["_id"])},
                    {"username": customer["username"]}
                ]
            }
            
            # Count total matching documents for pagination
            total_count = await isp_customers_accounting.count_documents(query)
            
            # Calculate skip amount for pagination
            skip_amount = (page - 1) * pageSize
            
            # Get accounting records with pagination and sorting by timestamp descending
            all_records = await isp_customers_accounting.find(query)\
                .sort("timestamp", DESCENDING)\
                .skip(skip_amount)\
                .limit(pageSize)\
                .to_list(None)
            
            # Convert database records to ISPCustomerAccounting objects
            accounting_list = []
            for record in all_records:
                # Ensure customer data is included
                record["customer"] = {
                    "id": str(customer["_id"]),
                    "firstName": customer.get("firstName", ""),
                    "lastName": customer.get("lastName", ""),
                    "username": customer["username"],
                    "status": customer.get("status", "ACTIVE")
                }
                accounting_list.append(await ISPCustomerAccounting.from_db(record))
            
            return ISPCustomerAccountingsResponse(
                success=True,
                message="Accounting records retrieved successfully",
                accountings=accounting_list,
                totalCount=total_count
            )
        except Exception as e:
            logger.error(f"Error retrieving customer accountings: {e}")
            raise HTTPException(
                status_code=500,
                detail="Internal server error"
            )
        
    @strawberry.field
    async def customer_session_summary(
        self, 
        customerId: str, 
        info: strawberry.Info
    ) -> ISPCustomerAccountingResponse:
        """Get customer's current accounting record"""
        context: Context = info.context
        await context.authenticate()
        
        # Get the accounting record for this customer
        accounting_record = await isp_customers_accounting.find_one({
            "customerId": customerId
        })
        
        if not accounting_record:
            return ISPCustomerAccountingResponse(
                success=True,
                message="No session data available",
                accounting=None
            )

        # Get the customer info
        customer = await isp_customers.find_one({"_id": ObjectId(customerId)})
        if customer:
            accounting_record["customer"] = {
                "id": str(customer["_id"]),
                "firstName": customer["firstName"],
                "lastName": customer["lastName"],
                "username": customer["username"],
                "status": customer["status"]
            }
        
        return ISPCustomerAccountingResponse(
            success=True,
            message="Session data retrieved successfully",
            accounting=await ISPCustomerAccounting.from_db(accounting_record)
        )
    
    @strawberry.field
    async def customer_bandwidth_stats(
        self,
        customerId: str,
        info: strawberry.Info,
        period: AccountingStatsPeriod = AccountingStatsPeriod.DAILY,
        days: int = 30
    ) -> CustomerBandwidthStatsResponse:
        """
        Get bandwidth usage statistics for a customer over time
        
        Args:
            customerId: Customer ID
            period: Time period for grouping (daily, weekly, monthly, yearly)
            days: Number of days to look back
            info: GraphQL info with request context
            
        Returns:
            CustomerBandwidthStatsResponse with bandwidth statistics
        """
        context: Context = info.context
        current_user = await context.authenticate()
        
        try:
            # Validate customer ID format
            customer_id = ObjectId(customerId)
        except:
            logger.warning(f"Invalid customer ID format: {customerId}")
            raise HTTPException(
                status_code=400,
                detail="Invalid customer ID format"
            )
        
        # Get the customer to verify organization access
        customer = await isp_customers.find_one({"_id": customer_id})
        if not customer:
            logger.info(f"Customer not found: {customerId}")
            raise HTTPException(
                status_code=404, 
                detail="Customer not found"
            )
        
        # Verify user has access to the organization
        organization = await organizations.find_one({
            "_id": customer["organizationId"],
            "members.userId": current_user.id
        })
        
        if not organization:
            logger.warning(f"User {current_user.id} not authorized to access customer {customerId}")
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to access this customer"
            )
        
        # Calculate the start date based on days parameter
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Define the date format and group by expression based on period
        date_format = "%Y-%m-%d"
        group_by_format = {"$dateToString": {"format": date_format, "date": "$timestamp"}}
        
        if period == AccountingStatsPeriod.WEEKLY:
            # Group by week (first day of week)
            group_by_format = {
                "$dateToString": {
                    "format": date_format,
                    "date": {
                        "$subtract": [
                            "$timestamp",
                            {"$multiply": [{"$dayOfWeek": "$timestamp"}, 86400000]}
                        ]
                    }
                }
            }
        elif period == AccountingStatsPeriod.MONTHLY:
            # Group by month
            date_format = "%Y-%m"
            group_by_format = {"$dateToString": {"format": date_format, "date": "$timestamp"}}
        elif period == AccountingStatsPeriod.YEARLY:
            # Group by year
            date_format = "%Y"
            group_by_format = {"$dateToString": {"format": date_format, "date": "$timestamp"}}
        
        # Get accounting records for STOP events as they contain the full session data
        pipeline = [
            {
                "$match": {
                    "customerId": str(customer_id),
                    "status": AccountingStatusType.STOP,
                    "timestamp": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": group_by_format,
                    "download": {"$sum": "$totalInputBytes"},
                    "upload": {"$sum": "$totalOutputBytes"},
                    "total": {"$sum": "$totalBytes"}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        # Execute aggregation pipeline
        stats_data = await isp_customers_accounting.aggregate(pipeline).to_list(None)
        
        # Convert aggregation results to BandwidthStats objects
        stats = []
        for data in stats_data:
            stats.append(
                BandwidthStats(
                    period=data["_id"],
                    download=data["download"],
                    upload=data["upload"],
                    total=data["total"]
                )
            )
        
        return CustomerBandwidthStatsResponse(
            success=True,
            message="Bandwidth statistics retrieved successfully",
            customerId=str(customer_id),
            username=customer["username"],
            stats=stats
        )
