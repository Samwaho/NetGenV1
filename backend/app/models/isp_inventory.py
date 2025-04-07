from datetime import datetime
from typing import Optional
from app.schemas.enums import EquipmentCategory, EquipmentStatus
import strawberry

@strawberry.type
class DBISPInventory:
    _id: str
    name: str
    category: EquipmentCategory
    organizationId: str
    model: Optional[str]
    manufacturer: Optional[str]
    serialNumber: Optional[str]
    macAddress: Optional[str]
    ipAddress: Optional[str]
    quantity: int
    quantityThreshold: Optional[int]
    unitPrice: float
    status: EquipmentStatus
    location: Optional[str]
    assignedTo: Optional[str]
    warrantyExpirationDate: Optional[datetime]
    purchaseDate: Optional[datetime]
    specifications: Optional[str]
    notes: Optional[str]
    createdAt: datetime
    updatedAt: datetime
