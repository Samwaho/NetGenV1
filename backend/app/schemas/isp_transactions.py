import strawberry
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, ClassVar, Union, cast
from dataclasses import field
from bson.objectid import ObjectId


@strawberry.type
class ISPTransaction:
    """ISP Transaction model representing a transaction in the system."""
    
    id: str
    transactionId: str
    transactionType: str
    transTime: str
    amount: float
    businessShortCode: str
    billRefNumber: str
    invoiceNumber: str
    orgAccountBalance: str
    thirdPartyTransID: str
    phoneNumber: str
    firstName: str
    middleName: Optional[str] = None
    lastName: str
    createdAt: datetime
    updatedAt: datetime

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
                "transactionId": transaction.get("transactionId", ""),
                "transactionType": transaction.get("transactionType", ""),
                "transTime": transaction.get("transTime", ""),
                "amount": transaction.get("amount", 0.0),
                "businessShortCode": transaction.get("businessShortCode", ""),
                "billRefNumber": transaction.get("billRefNumber", ""),
                "invoiceNumber": transaction.get("invoiceNumber", ""),
                "orgAccountBalance": transaction.get("orgAccountBalance", ""),
                "thirdPartyTransID": transaction.get("thirdPartyTransID", ""),
                "phoneNumber": transaction.get("phoneNumber", ""),
                "firstName": transaction.get("firstName", ""),
                "middleName": transaction.get("middleName"),
                "lastName": transaction.get("lastName", ""),
                "createdAt": transaction.get("createdAt", current_time),
                "updatedAt": transaction.get("updatedAt", current_time)
            }
        else:
            converted_transaction = {
                "id": str(transaction._id),
                "transactionId": getattr(transaction, 'transactionId', ''),
                "transactionType": getattr(transaction, 'transactionType', ''),
                "transTime": getattr(transaction, 'transTime', ''),
                "amount": getattr(transaction, 'amount', 0.0),
                "businessShortCode": getattr(transaction, 'businessShortCode', ''),
                "billRefNumber": getattr(transaction, 'billRefNumber', ''),
                "invoiceNumber": getattr(transaction, 'invoiceNumber', ''),
                "orgAccountBalance": getattr(transaction, 'orgAccountBalance', ''),
                "thirdPartyTransID": getattr(transaction, 'thirdPartyTransID', ''),
                "phoneNumber": getattr(transaction, 'phoneNumber', ''),
                "firstName": getattr(transaction, 'firstName', ''),
                "middleName": getattr(transaction, 'middleName', None),
                "lastName": getattr(transaction, 'lastName', ''),
                "createdAt": getattr(transaction, 'createdAt', current_time),
                "updatedAt": getattr(transaction, 'updatedAt', current_time)
            }

        return cls(**converted_transaction)


@strawberry.input
class CreateISPTransactionInput:
    """Input type for creating a new ISP transaction."""
    transactionId: str
    transactionType: str
    transTime: str
    amount: float
    businessShortCode: str
    billRefNumber: str
    invoiceNumber: str
    orgAccountBalance: str
    thirdPartyTransID: str
    phoneNumber: str
    firstName: str
    middleName: Optional[str] = None
    lastName: str


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
