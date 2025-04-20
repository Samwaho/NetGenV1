from datetime import datetime
from typing import Optional
from bson.objectid import ObjectId
import strawberry

@strawberry.type
class DBISPCustomerPayment:
    _id: str
    customerId: str
    organizationId: str
    amount: float
    transactionId: Optional[str]
    phoneNumber: Optional[str]
    packageId: Optional[str]
    daysAdded: int
    paidAt: datetime
    createdAt: datetime
    updatedAt: datetime
