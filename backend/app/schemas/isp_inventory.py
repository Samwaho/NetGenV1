import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.enums import EquipmentCategory, EquipmentStatus

@strawberry.type
class ISPInventory:
    id: str
    name: str
    category: EquipmentCategory
    organization: Organization
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    serialNumber: Optional[str] = None
    macAddress: Optional[str] = None
    ipAddress: Optional[str] = None
    quantity: int
    quantityThreshold: Optional[int] = None  # For low stock alerts
    unitPrice: float
    status: EquipmentStatus
    location: Optional[str] = None  # Storage location or assigned station
    assignedTo: Optional[str] = None  # Customer or staff ID if equipment is assigned
    warrantyExpirationDate: Optional[datetime] = None
    purchaseDate: Optional[datetime] = None
    specifications: Optional[str] = None  # Technical specifications
    notes: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, inventory) -> "ISPInventory":
        from app.schemas.organization import Organization
        from app.config.database import organizations
        
        org = await organizations.find_one({"_id": inventory["organizationId"]})
        organization = await Organization.from_db(org)

        return cls(
            id=str(inventory["_id"]),
            name=inventory["name"],
            category=inventory["category"],
            organization=organization,
            model=inventory.get("model"),
            manufacturer=inventory.get("manufacturer"),
            serialNumber=inventory.get("serialNumber"),
            macAddress=inventory.get("macAddress"),
            ipAddress=inventory.get("ipAddress"),
            quantity=inventory["quantity"],
            quantityThreshold=inventory.get("quantityThreshold"),
            unitPrice=inventory["unitPrice"],
            status=inventory["status"],
            location=inventory.get("location"),
            assignedTo=inventory.get("assignedTo"),
            warrantyExpirationDate=inventory.get("warrantyExpirationDate"),
            purchaseDate=inventory.get("purchaseDate"),
            specifications=inventory.get("specifications"),
            notes=inventory.get("notes"),
            createdAt=inventory["createdAt"],
            updatedAt=inventory["updatedAt"]
        )

@strawberry.input
class CreateISPInventoryInput:
    name: str
    category: EquipmentCategory
    organizationId: str
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    serialNumber: Optional[str] = None
    macAddress: Optional[str] = None
    ipAddress: Optional[str] = None
    quantity: int
    quantityThreshold: Optional[int] = None
    unitPrice: float
    location: Optional[str] = None
    warrantyExpirationDate: Optional[datetime] = None
    purchaseDate: Optional[datetime] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None

@strawberry.input
class UpdateISPInventoryInput:
    name: Optional[str] = None
    category: Optional[EquipmentCategory] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    serialNumber: Optional[str] = None
    macAddress: Optional[str] = None
    ipAddress: Optional[str] = None
    quantity: Optional[int] = None
    quantityThreshold: Optional[int] = None
    unitPrice: Optional[float] = None
    status: Optional[EquipmentStatus] = None
    location: Optional[str] = None
    assignedTo: Optional[str] = None
    warrantyExpirationDate: Optional[datetime] = None
    purchaseDate: Optional[datetime] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None

@strawberry.type
class ISPInventoryResponse:
    success: bool
    message: str
    inventory: Optional[ISPInventory] = None

@strawberry.type
class ISPInventoriesResponse:
    success: bool
    message: str
    inventories: List[ISPInventory] = field(default_factory=list)
