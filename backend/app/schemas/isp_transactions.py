import strawberry
from datetime import datetime
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
        # Handle both dictionary and object types
        if isinstance(transaction, dict):
            converted_transaction = {
                "id": str(transaction["_id"]),
                "transactionId": transaction["transactionId"],
                "transactionType": transaction["transactionType"],
                "transTime": transaction["transTime"],
                "amount": transaction["amount"],
                "businessShortCode": transaction["businessShortCode"],
                "billRefNumber": transaction["billRefNumber"],
                "invoiceNumber": transaction["invoiceNumber"],
                "orgAccountBalance": transaction["orgAccountBalance"],
                "thirdPartyTransID": transaction["thirdPartyTransID"],
                "phoneNumber": transaction["phoneNumber"],
                "firstName": transaction["firstName"],
                "middleName": transaction.get("middleName"),
                "lastName": transaction["lastName"],
                "createdAt": transaction["createdAt"],
                "updatedAt": transaction["updatedAt"]
            }
        else:
            converted_transaction = {
                "id": str(transaction._id),
                "transactionId": transaction.transactionId,
                "transactionType": transaction.transactionType,
                "transTime": transaction.transTime,
                "amount": transaction.amount,
                "businessShortCode": transaction.businessShortCode,
                "billRefNumber": transaction.billRefNumber,
                "invoiceNumber": transaction.invoiceNumber,
                "orgAccountBalance": transaction.orgAccountBalance,
                "thirdPartyTransID": transaction.thirdPartyTransID,
                "phoneNumber": transaction.phoneNumber,
                "firstName": transaction.firstName,
                "middleName": getattr(transaction, 'middleName', None),
                "lastName": transaction.lastName,
                "createdAt": transaction.createdAt,
                "updatedAt": transaction.updatedAt
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
