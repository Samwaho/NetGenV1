from datetime import datetime
from typing import Optional, List
from app.schemas.enums import IspManagerCustomerStatus
import strawberry

@strawberry.type
class DBISPCustomer:
    _id: str
    firstName: str
    lastName: str
    email: str
    phone: str
    username: str
    password: str
    organizationId: str
    packageId: str
    stationId: str
    expirationDate: datetime
    status: IspManagerCustomerStatus
    online: bool
    createdAt: datetime
    updatedAt: datetime
    reminderDaysSent: Optional[List[int]] = None