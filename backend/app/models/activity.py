from datetime import datetime
import strawberry

@strawberry.type
class DBActivity:
    _id: str
    userId: str
    organizationId: str
    action: str
    createdAt: datetime
    updatedAt: datetime