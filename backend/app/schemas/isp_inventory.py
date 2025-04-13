import strawberry
from datetime import datetime
from typing import Optional, List, Dict, Any, ClassVar, Union
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
    
    # Class variable to cache related data fetching
    _related_cache: ClassVar[Dict[str, Dict[str, Any]]] = {
        "organizations": {},
    }

    @classmethod
    async def from_db(cls, inventory: Union[Dict[str, Any], Any]) -> "ISPInventory":
        """
        Convert a database inventory record to an ISPInventory object.
        
        Args:
            inventory: An inventory record from the database (dict or object)
            
        Returns:
            ISPInventory: A properly formatted ISPInventory object
        """
        from app.schemas.organization import Organization
        from app.config.database import organizations
        
        # Handle both dictionary and object types
        if isinstance(inventory, dict):
            org_id = inventory.get("organizationId")
            
            converted_inventory = {
                "id": str(inventory["_id"]),
                "name": inventory["name"],
                "category": inventory["category"],
                "model": inventory.get("model"),
                "manufacturer": inventory.get("manufacturer"),
                "serialNumber": inventory.get("serialNumber"),
                "macAddress": inventory.get("macAddress"),
                "ipAddress": inventory.get("ipAddress"),
                "quantity": inventory["quantity"],
                "quantityThreshold": inventory.get("quantityThreshold"),
                "unitPrice": inventory["unitPrice"],
                "status": inventory["status"],
                "location": inventory.get("location"),
                "assignedTo": inventory.get("assignedTo"),
                "warrantyExpirationDate": inventory.get("warrantyExpirationDate"),
                "purchaseDate": inventory.get("purchaseDate"),
                "specifications": inventory.get("specifications"),
                "notes": inventory.get("notes"),
                "createdAt": inventory["createdAt"],
                "updatedAt": inventory["updatedAt"]
            }
        else:
            org_id = inventory.organizationId
            
            converted_inventory = {
                "id": str(inventory._id),
                "name": inventory.name,
                "category": inventory.category,
                "model": getattr(inventory, 'model', None),
                "manufacturer": getattr(inventory, 'manufacturer', None),
                "serialNumber": getattr(inventory, 'serialNumber', None),
                "macAddress": getattr(inventory, 'macAddress', None),
                "ipAddress": getattr(inventory, 'ipAddress', None),
                "quantity": inventory.quantity,
                "quantityThreshold": getattr(inventory, 'quantityThreshold', None),
                "unitPrice": inventory.unitPrice,
                "status": inventory.status,
                "location": getattr(inventory, 'location', None),
                "assignedTo": getattr(inventory, 'assignedTo', None),
                "warrantyExpirationDate": getattr(inventory, 'warrantyExpirationDate', None),
                "purchaseDate": getattr(inventory, 'purchaseDate', None),
                "specifications": getattr(inventory, 'specifications', None),
                "notes": getattr(inventory, 'notes', None),
                "createdAt": inventory.createdAt,
                "updatedAt": inventory.updatedAt
            }

        # Convert ObjectIds to strings for cache keys
        org_id_str = str(org_id)
        
        # Fetch organization from cache or database
        org_data = cls._related_cache["organizations"].get(org_id_str)
        if not org_data:
            org_data = await organizations.find_one({"_id": org_id})
            if org_data:
                cls._related_cache["organizations"][org_id_str] = org_data

        # Convert related entities to their proper types
        converted_inventory["organization"] = await Organization.from_db(org_data) if org_data else None

        return cls(**converted_inventory)

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
    total_count: int = 0  # Total count for pagination
