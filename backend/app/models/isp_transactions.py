from datetime import datetime
from typing import Optional
from bson.objectid import ObjectId
import strawberry


@strawberry.type
class DBISPTransaction:
    """Database model for ISP transactions."""
    _id: str
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
    middleName: Optional[str]
    lastName: str
    createdAt: datetime
    updatedAt: datetime
