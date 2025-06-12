import strawberry
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, ClassVar, Union, cast
from dataclasses import field
from bson.objectid import ObjectId
from enum import Enum

@strawberry.enum
class TransactionType(Enum):
    CUSTOMER_PAYMENT = "customer_payment"
    HOTSPOT_VOUCHER = "hotspot_voucher"
    STK_PUSH = "stk_push"
    C2B = "c2b"

@strawberry.enum
class TransactionStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

@strawberry.type
class ISPTransaction:
    """ISP Transaction model representing a transaction in the system."""
    
    id: str
    organizationId: str
    transactionType: str
    callbackType: str
    status: str
    amount: float
    phoneNumber: str
    createdAt: datetime
    updatedAt: datetime
    
    # Common fields
    transactionId: Optional[str] = None
    paymentMethod: Optional[str] = None
    
    # Customer payment specific fields
    firstName: Optional[str] = None
    middleName: Optional[str] = None
    lastName: Optional[str] = None
    businessShortCode: Optional[str] = None
    billRefNumber: Optional[str] = None
    invoiceNumber: Optional[str] = None
    orgAccountBalance: Optional[str] = None
    thirdPartyTransID: Optional[str] = None
    transTime: Optional[str] = None
    
    # Hotspot voucher specific fields
    voucherCode: Optional[str] = None
    packageId: Optional[str] = None
    packageName: Optional[str] = None
    duration: Optional[int] = None
    dataLimit: Optional[float] = None
    expiresAt: Optional[datetime] = None

    @classmethod
    async def from_db(cls, transaction: Union[Dict[str, Any], Any]) -> "ISPTransaction":
        """
        Convert a database transaction record to an ISPTransaction object.
        
        Args:
            transaction: A transaction record from the database (dict or object)
            
        Returns:
            ISPTransaction: A properly formatted ISPTransaction object
        """
        current_time = datetime.now(timezone.utc)
        
        # Handle both dictionary and object types
        if isinstance(transaction, dict):
            converted_transaction = {
                "id": str(transaction["_id"]),
                "organizationId": str(transaction.get("organizationId", "")),
                "transactionType": transaction.get("transactionType", ""),
                "callbackType": transaction.get("callbackType", ""),
                "status": transaction.get("status", TransactionStatus.PENDING.value),
                "amount": transaction.get("amount", 0.0),
                "phoneNumber": transaction.get("phoneNumber", ""),
                "createdAt": transaction.get("createdAt", current_time),
                "updatedAt": transaction.get("updatedAt", current_time),
                
                # Common fields
                "transactionId": transaction.get("transactionId"),
                "paymentMethod": transaction.get("paymentMethod"),
                
                # Customer payment specific fields
                "firstName": transaction.get("firstName"),
                "middleName": transaction.get("middleName"),
                "lastName": transaction.get("lastName"),
                "businessShortCode": transaction.get("businessShortCode"),
                "billRefNumber": transaction.get("billRefNumber"),
                "invoiceNumber": transaction.get("invoiceNumber"),
                "orgAccountBalance": transaction.get("orgAccountBalance"),
                "thirdPartyTransID": transaction.get("thirdPartyTransID"),
                "transTime": transaction.get("transTime"),
                
                # Hotspot voucher specific fields
                "voucherCode": transaction.get("voucherCode"),
                "packageId": str(transaction.get("packageId")) if transaction.get("packageId") else None,
                "packageName": transaction.get("packageName"),
                "duration": transaction.get("duration"),
                "dataLimit": transaction.get("dataLimit"),
                "expiresAt": transaction.get("expiresAt")
            }
        else:
            converted_transaction = {
                "id": str(transaction._id),
                "organizationId": str(getattr(transaction, 'organizationId', '')),
                "transactionType": getattr(transaction, 'transactionType', ''),
                "callbackType": getattr(transaction, 'callbackType', ''),
                "status": getattr(transaction, 'status', TransactionStatus.PENDING.value),
                "amount": getattr(transaction, 'amount', 0.0),
                "phoneNumber": getattr(transaction, 'phoneNumber', ''),
                "createdAt": getattr(transaction, 'createdAt', current_time),
                "updatedAt": getattr(transaction, 'updatedAt', current_time),
                
                # Common fields
                "transactionId": getattr(transaction, 'transactionId', None),
                "paymentMethod": getattr(transaction, 'paymentMethod', None),
                
                # Customer payment specific fields
                "firstName": getattr(transaction, 'firstName', None),
                "middleName": getattr(transaction, 'middleName', None),
                "lastName": getattr(transaction, 'lastName', None),
                "businessShortCode": getattr(transaction, 'businessShortCode', None),
                "billRefNumber": getattr(transaction, 'billRefNumber', None),
                "invoiceNumber": getattr(transaction, 'invoiceNumber', None),
                "orgAccountBalance": getattr(transaction, 'orgAccountBalance', None),
                "thirdPartyTransID": getattr(transaction, 'thirdPartyTransID', None),
                "transTime": getattr(transaction, 'transTime', None),
                
                # Hotspot voucher specific fields
                "voucherCode": getattr(transaction, 'voucherCode', None),
                "packageId": str(getattr(transaction, 'packageId', '')) if getattr(transaction, 'packageId', None) else None,
                "packageName": getattr(transaction, 'packageName', None),
                "duration": getattr(transaction, 'duration', None),
                "dataLimit": getattr(transaction, 'dataLimit', None),
                "expiresAt": getattr(transaction, 'expiresAt', None)
            }

        return cls(**converted_transaction)


@strawberry.input
class CreateISPTransactionInput:
    """Input type for creating a new ISP transaction."""
    organizationId: str
    transactionType: str
    callbackType: str
    status: str
    amount: float
    phoneNumber: str
    
    # Common fields
    transactionId: Optional[str] = None
    paymentMethod: Optional[str] = None
    
    # Customer payment specific fields
    firstName: Optional[str] = None
    middleName: Optional[str] = None
    lastName: Optional[str] = None
    businessShortCode: Optional[str] = None
    billRefNumber: Optional[str] = None
    invoiceNumber: Optional[str] = None
    orgAccountBalance: Optional[str] = None
    thirdPartyTransID: Optional[str] = None
    transTime: Optional[str] = None
    
    # Hotspot voucher specific fields
    voucherCode: Optional[str] = None
    packageId: Optional[str] = None
    packageName: Optional[str] = None
    duration: Optional[int] = None
    dataLimit: Optional[float] = None
    expiresAt: Optional[datetime] = None


@strawberry.type
class ISPTransactionResponse:
    """Response type for ISP transaction operations."""
    success: bool
    message: str
    transaction: Optional[ISPTransaction] = None


@strawberry.type
class ISPTransactionsResponse:
    """Response type for querying multiple ISP transactions."""
    success: bool
    message: str
    transactions: List[ISPTransaction] = field(default_factory=list)
    total_count: int = 0  # Total count for pagination
