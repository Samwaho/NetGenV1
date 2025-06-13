from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, cast
import strawberry
from fastapi import HTTPException
from app.config.database import isp_mpesa_transactions, organizations, isp_customers
from app.schemas.isp_transactions import (
    ISPTransaction,
    ISPTransactionResponse,
    ISPTransactionsResponse,
    CreateISPTransactionInput,
    TransactionType,
    TransactionStatus
)
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
from app.api.mpesa import process_customer_payment
import logging
from pymongo import ASCENDING, DESCENDING
from app.config.redis import redis
import json

logger = logging.getLogger(__name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

CACHE_TTL = 300  # 5 minutes

def transaction_cache_key(transaction_id: str) -> str:
    return f"isp_transaction:{transaction_id}"

def transactions_cache_key(user_id: str, org_id: str, page: int, page_size: int, sort_by: str, sort_direction: str, search: str) -> str:
    return f"isp_transactions:{user_id}:{org_id}:{page}:{page_size}:{sort_by}:{sort_direction}:{search or 'none'}"

def serialize(obj):
    return json.dumps(obj, default=str)

def deserialize(s):
    return json.loads(s)

def parse_transaction_datetimes(transaction_dict):
    datetime_fields = ["createdAt", "updatedAt", "transTime", "expiresAt"]
    for field in datetime_fields:
        if field in transaction_dict and isinstance(transaction_dict[field], str):
            try:
                transaction_dict[field] = datetime.fromisoformat(transaction_dict[field])
            except Exception:
                pass
    return transaction_dict

@strawberry.type
class ISPTransactionResolver:
    """Resolver for ISP transaction operations."""

    @strawberry.field
    async def transaction(self, id: str, info: strawberry.Info) -> ISPTransaction:
        """
        Get ISP transaction by ID.
        
        Args:
            id: Transaction ID
            info: GraphQL info object
            
        Returns:
            ISPTransaction: The requested transaction
            
        Raises:
            HTTPException: If transaction not found or user not authorized
        """
        context: Context = info.context
        current_user = await context.authenticate()

        cache_key = transaction_cache_key(id)
        cached = await redis.get(cache_key)
        if cached:
            data = deserialize(cached)
            data = parse_transaction_datetimes(data)
            return await ISPTransaction.from_db(data)

        try:
            object_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid transaction ID format")

        transaction = await isp_mpesa_transactions.find_one({"_id": object_id})
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": transaction["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this transaction")
            
        await redis.set(cache_key, serialize(transaction), ex=CACHE_TTL)
        return await ISPTransaction.from_db(transaction)

    @strawberry.field
    async def transactions(
        self, 
        info: strawberry.Info, 
        organization_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = DEFAULT_PAGE_SIZE,
        sort_by: Optional[str] = "createdAt",
        sort_direction: Optional[str] = "desc",
        search: Optional[str] = None,
        transaction_type: Optional[str] = None
    ) -> ISPTransactionsResponse:
        try:
            context: Context = info.context
            current_user = await context.authenticate()
            logger.info(f"=== TRANSACTIONS QUERY STARTED ===")
            logger.info(f"Organization ID: {organization_id}")
            logger.info(f"User ID: {current_user.id}")
            logger.info(f"Page: {page}, Page Size: {page_size}")
            logger.info(f"Sort By: {sort_by}, Sort Direction: {sort_direction}")

            # Verify organization exists and user has access
            org = await organizations.find_one({"_id": ObjectId(organization_id)})
            if not org:
                logger.error(f"Organization not found: {organization_id}")
                return ISPTransactionsResponse(
                    success=False,
                    message="Organization not found",
                    transactions=[],
                    total_count=0
                )

            user_member = next((m for m in org.get("members", []) if m.get("userId") == current_user.id), None)
            if not user_member:
                logger.error(f"User {current_user.id} is not a member of organization {organization_id}")
                return ISPTransactionsResponse(
                    success=False,
                    message="Not authorized to view transactions",
                    transactions=[],
                    total_count=0
                )

            logger.info(f"User is a member of the organization with role: {user_member.get('roleName')}")

            cache_key = transactions_cache_key(current_user.id, organization_id, page, page_size, sort_by, sort_direction, search)
            cached = await redis.get(cache_key)
            if cached:
                logger.info("Returning cached transactions")
                data = deserialize(cached)
                transaction_list = [await ISPTransaction.from_db(parse_transaction_datetimes(t)) for t in data["transactions"]]
                return ISPTransactionsResponse(
                    success=True,
                    message="Transactions retrieved successfully (cache)",
                    transactions=transaction_list,
                    total_count=data["total_count"]
                )

            org_object_id = ObjectId(organization_id)
            query_filter = {"organizationId": org_object_id}
            
            # Add transaction type filter if specified
            if transaction_type and transaction_type != "all":
                query_filter["transactionType"] = transaction_type
                logger.info(f"Filtering by transaction type: {transaction_type}")
            
            if search:
                import re
                search_regex = {"$regex": f".*{re.escape(search)}.*", "$options": "i"}
                query_filter["$or"] = [
                    {"billRefNumber": search_regex},
                    {"phoneNumber": search_regex},
                    {"firstName": search_regex},
                    {"lastName": search_regex},
                    {"transactionId": search_regex},
                    {"voucherCode": search_regex},
                    {"packageName": search_regex}
                ]
                logger.info(f"Search filter applied: {search}")
            
            logger.info(f"Final query filter: {json.dumps(query_filter, default=str)}")
            
            # First, let's check if there are any transactions at all for this org
            all_transactions_count = await isp_mpesa_transactions.count_documents({"organizationId": org_object_id})
            logger.info(f"Total transactions for organization (no filters): {all_transactions_count}")
            
            total_count = await isp_mpesa_transactions.count_documents(query_filter)
            logger.info(f"Total count with filters: {total_count}")
            
            cursor = isp_mpesa_transactions.find(query_filter)
        
            sort_order = DESCENDING if sort_direction.lower() == "desc" else ASCENDING
            cursor = cursor.sort(sort_by, sort_order)
            cursor = cursor.skip((page - 1) * page_size).limit(page_size)
        
            transactions = await cursor.to_list(None)
            logger.info(f"Found {len(transactions)} transactions")
            
            if transactions:
                logger.info(f"Sample transaction: {json.dumps(transactions[0], default=str)}")
            
            await redis.set(cache_key, serialize({"transactions": transactions, "total_count": total_count}), ex=CACHE_TTL)
            transformed_transactions = []
            for t in transactions:
                t['id'] = str(t['_id'])
                t['organizationId'] = str(t['organizationId'])
                if 'packageId' in t and t['packageId']:
                    t['packageId'] = str(t['packageId'])
                transformed_transactions.append(await ISPTransaction.from_db(t))
            
            logger.info(f"Returning {len(transformed_transactions)} transformed transactions")
            return ISPTransactionsResponse(
                success=True,
                message="Transactions retrieved successfully",
                transactions=transformed_transactions,
                total_count=total_count
            )
        except Exception as e:
            logger.error(f"Error fetching transactions: {str(e)}")
            logger.exception("Full traceback:")
            return ISPTransactionsResponse(
                success=False,
                message=f"Failed to fetch transactions: {str(e)}",
                transactions=[],
                total_count=0
            )

    @strawberry.mutation
    async def create_transaction(
        self, 
        input: CreateISPTransactionInput, 
        info: strawberry.Info
    ) -> ISPTransactionResponse:
        """
        Create a new ISP transaction.
        
        Args:
            input: Transaction creation input
            info: GraphQL info object
            
        Returns:
            ISPTransactionResponse: The created transaction
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Verify organization exists and user has permission
            organization = await organizations.find_one({"_id": ObjectId(input.organizationId)})
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")

            # Check if user has permission
            user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
            if not user_member:
                raise HTTPException(status_code=403, detail="Not authorized to create transactions in this organization")

        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid organization ID format")

        # Prepare transaction data
        current_time = datetime.now(timezone.utc)
        transaction_data = {
            "organizationId": ObjectId(input.organizationId),
            "transactionType": input.transactionType,
            "callbackType": input.callbackType,
            "status": input.status,
            "amount": input.amount,
            "phoneNumber": input.phoneNumber,
            "createdAt": current_time,
            "updatedAt": current_time,
            
            # Common fields
            "transactionId": input.transactionId,
            "paymentMethod": input.paymentMethod,
            
            # Customer payment specific fields
            "firstName": input.firstName,
            "middleName": input.middleName,
            "lastName": input.lastName,
            "businessShortCode": input.businessShortCode,
            "billRefNumber": input.billRefNumber,
            "invoiceNumber": input.invoiceNumber,
            "orgAccountBalance": input.orgAccountBalance,
            "thirdPartyTransID": input.thirdPartyTransID,
            "transTime": input.transTime,
            
            # Hotspot voucher specific fields
            "voucherCode": input.voucherCode,
            "packageId": ObjectId(input.packageId) if input.packageId else None,
            "packageName": input.packageName,
            "duration": input.duration,
            "dataLimit": input.dataLimit,
            "expiresAt": input.expiresAt
        }

        # Remove None values
        transaction_data = {k: v for k, v in transaction_data.items() if v is not None}

        # Insert the new transaction
        try:
            result = await isp_mpesa_transactions.insert_one(transaction_data)
            transaction_data["_id"] = result.inserted_id
        except Exception as e:
            logger.error(f"Database error when creating transaction: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Record activity
        activity_message = f"manually created {input.transactionType} transaction"
        if input.transactionId:
            activity_message += f" {input.transactionId}"
        await record_activity(
            current_user.id,
            ObjectId(input.organizationId),
            activity_message
        )

        # Invalidate all isp_transactions:* cache keys for this org
        await redis.delete(*[key async for key in redis.scan_iter(f"isp_transactions:*{input.organizationId}*")])

        return ISPTransactionResponse(
            success=True,
            message="Transaction created successfully",
            transaction=await ISPTransaction.from_db(transaction_data)
        )

    @strawberry.mutation
    async def delete_transaction(
        self, 
        id: str, 
        info: strawberry.Info
    ) -> ISPTransactionResponse:
        """
        Delete an ISP transaction.
        
        Args:
            id: Transaction ID to delete
            info: GraphQL info object
            
        Returns:
            ISPTransactionResponse: The deleted transaction
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            transaction_id = ObjectId(id)
        except:
            raise HTTPException(status_code=400, detail="Invalid transaction ID format")

        transaction = await isp_mpesa_transactions.find_one({"_id": transaction_id})
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Verify user has permission to delete this transaction
        organization = await organizations.find_one({"_id": transaction["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to delete this transaction")

        # Create a snapshot of transaction data before deletion
        transaction_data = await ISPTransaction.from_db(transaction)
        
        # Record activity before deletion
        activity_message = f"deleted {transaction.get('transactionType', 'unknown')} transaction"
        if transaction.get('transactionId'):
            activity_message += f" {transaction['transactionId']}"
        await record_activity(
            current_user.id,
            transaction["organizationId"],
            activity_message
        )

        try:
            # Delete the transaction
            await isp_mpesa_transactions.delete_one({"_id": transaction_id})
        except Exception as e:
            logger.error(f"Database error when deleting transaction: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

        # Invalidate cache for this transaction and all transactions lists for this org
        await redis.delete(transaction_cache_key(id))
        await redis.delete(*[key async for key in redis.scan_iter(f"isp_transactions:*{transaction['organizationId']}*")])

        return ISPTransactionResponse(
            success=True,
            message="Transaction deleted successfully",
            transaction=transaction_data
        )

    @strawberry.field
    async def unmatched_transactions(
        self,
        info: strawberry.Info,
        organization_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = DEFAULT_PAGE_SIZE,
        sort_by: Optional[str] = "createdAt",
        sort_direction: Optional[str] = "desc"
    ) -> ISPTransactionsResponse:
        try:
            context: Context = info.context
            current_user = await context.authenticate()
            
            org_id = ObjectId(organization_id)
            
            # Get all customer usernames for the organization
            customer_usernames = await isp_customers.distinct(
                "username", 
                {"organizationId": org_id}
            )
            
            # Base query
            query = {
                "organizationId": org_id,
                "transactionType": TransactionType.CUSTOMER_PAYMENT.value,
                "billRefNumber": {"$nin": customer_usernames}
            }
            
            # Get total count
            total_count = await isp_mpesa_transactions.count_documents(query)
            
            # Apply sorting
            sort_order = DESCENDING if sort_direction.lower() == "desc" else ASCENDING
            cursor = isp_mpesa_transactions.find(query)
            cursor = cursor.sort(sort_by, sort_order)
            
            # Apply pagination
            cursor = cursor.skip((page - 1) * page_size).limit(page_size)
            
            # Get results
            unmatched = await cursor.to_list(None)
            
            # Convert transactions
            formatted_transactions = [
                await ISPTransaction.from_db(t) for t in unmatched
            ]

            return ISPTransactionsResponse(
                success=True,
                message="Unmatched transactions retrieved successfully",
                transactions=formatted_transactions,
                total_count=total_count
            )
        
        except Exception as e:
            logger.error(f"Error retrieving unmatched transactions: {str(e)}")
            return ISPTransactionsResponse(
                success=False,
                message=f"Failed to retrieve unmatched transactions: {str(e)}",
                transactions=[],
                total_count=0
            )

    @strawberry.mutation
    async def update_transaction_bill_ref(
        self,
        info: strawberry.Info,
        transaction_id: str,
        new_bill_ref: str,
    ) -> ISPTransactionResponse:
        """Update transaction's bill reference number and update customer payment"""
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Validate transaction exists
            transaction = await isp_mpesa_transactions.find_one(
                {"_id": ObjectId(transaction_id)}
            )
            if not transaction:
                raise HTTPException(status_code=404, detail="Transaction not found")

            # Validate new bill ref matches a customer
            customer = await isp_customers.find_one({
                "username": new_bill_ref,
                "organizationId": transaction["organizationId"]
            })
            if not customer:
                raise HTTPException(
                    status_code=400, 
                    detail="No customer found with this username"
                )

            # Update transaction
            await isp_mpesa_transactions.update_one(
                {"_id": ObjectId(transaction_id)},
                {"$set": {
                    "billRefNumber": new_bill_ref,
                    "updatedAt": datetime.now(timezone.utc)
                }}
            )

            # Record activity for bill ref update
            await record_activity(
                current_user.id,
                transaction["organizationId"],
                f"updated transaction {transaction.get('transactionId')} bill reference to {new_bill_ref}"
            )

            # Process customer payment
            try:
                success = await process_customer_payment(
                    organization_id=str(transaction["organizationId"]),
                    username=new_bill_ref,
                    amount=float(transaction.get("amount", 0)),
                    phone=transaction.get("phoneNumber"),
                    transaction_id=transaction.get("transactionId")
                )

                if success:
                    logger.info(f"Successfully processed customer payment for {new_bill_ref}")
                    return ISPTransactionResponse(
                        success=True,
                        message=f"Successfully updated bill reference and processed payment for {new_bill_ref}"
                    )
                else:
                    logger.error(f"Failed to process customer payment for {new_bill_ref}")
                    return ISPTransactionResponse(
                        success=False,
                        message=f"Updated bill reference but failed to process payment for {new_bill_ref}"
                    )
            except Exception as e:
                logger.error(f"Error processing customer payment: {str(e)}")
                return ISPTransactionResponse(
                    success=False,
                    message=f"Updated bill reference but failed to process payment: {str(e)}"
                )

        except HTTPException as e:
            return ISPTransactionResponse(success=False, message=str(e.detail))
        except Exception as e:
            logger.error(f"Error updating transaction bill ref: {str(e)}")
            return ISPTransactionResponse(success=False, message=str(e))
