import strawberry
from datetime import datetime
from typing import Optional, List, ClassVar, Dict, Any
from dataclasses import field
from app.schemas.organization import Organization
from enum import Enum
from functools import lru_cache


@strawberry.enum
class IspManagerPackageType(str, Enum):
    PPPOE = "PPPOE"
    HOTSPOT = "HOTSPOT"
    STATIC = "STATIC"
    DHCP = "DHCP"


@strawberry.type
class ISPPackage:
    id: str
    name: str
    description: str
    price: float
    organization: Organization
    downloadSpeed: float
    uploadSpeed: float
    burstDownload: Optional[float] = None
    burstUpload: Optional[float] = None
    thresholdDownload: Optional[float] = None
    thresholdUpload: Optional[float] = None
    burstTime: Optional[int] = None
    serviceType: IspManagerPackageType = IspManagerPackageType.PPPOE
    addressPool: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    
    # Class variable for field mapping to avoid duplication
    _field_map: ClassVar[Dict[str, str]] = {
        "_id": "id",
        "organizationId": "organization",
        "name": "name",
        "description": "description",
        "price": "price",
        "downloadSpeed": "downloadSpeed",
        "uploadSpeed": "uploadSpeed",
        "burstDownload": "burstDownload",
        "burstUpload": "burstUpload",
        "thresholdDownload": "thresholdDownload",
        "thresholdUpload": "thresholdUpload",
        "burstTime": "burstTime",
        "serviceType": "serviceType",
        "addressPool": "addressPool",
        "createdAt": "createdAt",
        "updatedAt": "updatedAt"
    }

    @classmethod
    async def from_db(cls, package) -> "ISPPackage":
        """
        Convert a database record to an ISPPackage object.
        
        Args:
            package: Database record (dict or object)
            
        Returns:
            ISPPackage instance
        """
        from app.config.database import organizations

        # Determine if input is a dict or object
        is_dict = isinstance(package, dict)
        
        # Get organization ID based on input type
        org_id = package["organizationId"] if is_dict else package.organizationId
        
        # Fetch organization data - this could be optimized with DataLoader in a real app
        org_data = await organizations.find_one({"_id": org_id})
        organization = await Organization.from_db(org_data) if org_data else None

        # Create kwargs for constructor
        kwargs: Dict[str, Any] = {"organization": organization}
        
        # Process all fields based on input type
        for db_field, class_field in cls._field_map.items():
            if db_field == "_id":
                kwargs["id"] = str(package["_id"] if is_dict else package._id)
            elif db_field == "organizationId":
                # Already handled above
                continue
            elif is_dict:
                kwargs[class_field] = package.get(db_field)
            else:
                kwargs[class_field] = getattr(package, db_field, None)
                
        return cls(**kwargs)


@strawberry.input
class BaseISPPackageInput:
    """Base input type for common ISP package fields"""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    downloadSpeed: Optional[float] = None
    uploadSpeed: Optional[float] = None
    burstDownload: Optional[float] = None
    burstUpload: Optional[float] = None
    thresholdDownload: Optional[float] = None
    thresholdUpload: Optional[float] = None
    burstTime: Optional[int] = None
    serviceType: Optional[IspManagerPackageType] = None
    addressPool: Optional[str] = None


@strawberry.input
class CreateISPPackageInput(BaseISPPackageInput):
    """Input type for creating a new ISP package"""
    name: str
    description: str
    price: float
    organizationId: str
    downloadSpeed: float
    uploadSpeed: float
    serviceType: IspManagerPackageType = IspManagerPackageType.PPPOE


@strawberry.input
class UpdateISPPackageInput(BaseISPPackageInput):
    """Input type for updating an existing ISP package"""
    pass


@strawberry.type
class ISPPackageResponse:
    success: bool
    message: str
    package: Optional[ISPPackage] = None


@strawberry.type
class ISPPackagesResponse:
    success: bool
    message: str
    packages: List[ISPPackage] = field(default_factory=list)
    totalCount: Optional[int] = None


