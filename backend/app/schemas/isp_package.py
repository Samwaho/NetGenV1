import strawberry
from datetime import datetime
from typing import Optional, List, ClassVar, Dict, Any
from dataclasses import field
from app.schemas.organization import Organization
from enum import Enum
from functools import lru_cache
from bson import ObjectId


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
    # Session management
    sessionTimeout: Optional[int] = None  # in seconds
    idleTimeout: Optional[int] = None     # in seconds
    # QoS and VLAN
    priority: Optional[int] = None  # 1-8 for MikroTik queue priority
    vlanId: Optional[int] = None    # VLAN ID if using VLANs
    # Hotspot specific fields
    showInHotspot: Optional[bool] = None
    duration: Optional[int] = None
    durationUnit: Optional[str] = None
    dataLimit: Optional[int] = None
    dataLimitUnit: Optional[str] = None
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
        "sessionTimeout": "sessionTimeout",
        "idleTimeout": "idleTimeout",
        "priority": "priority",
        "vlanId": "vlanId",
        "showInHotspot": "showInHotspot",
        "duration": "duration",
        "durationUnit": "durationUnit",
        "dataLimit": "dataLimit",
        "dataLimitUnit": "dataLimitUnit",
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

        is_dict = isinstance(package, dict)
        org_id = package["organizationId"] if is_dict else package.organizationId

        # Ensure org_id is an ObjectId
        if not isinstance(org_id, ObjectId):
            try:
                org_id = ObjectId(org_id)
            except Exception:
                import logging
                logging.getLogger(__name__).warning(f"Invalid organizationId for package: {package}")
                org_id = None

        org_data = await organizations.find_one({"_id": org_id}) if org_id else None
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
    # Session management
    sessionTimeout: Optional[int] = None
    idleTimeout: Optional[int] = None
    # QoS and VLAN
    priority: Optional[int] = None
    vlanId: Optional[int] = None
    # Hotspot specific fields
    showInHotspot: Optional[bool] = None
    duration: Optional[int] = None
    durationUnit: Optional[str] = None
    dataLimit: Optional[int] = None
    dataLimitUnit: Optional[str] = None


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


@strawberry.type
class HotspotPackage:
    """Simplified package type for hotspot portal display"""
    id: str
    name: str
    description: str
    price: float
    duration: Optional[int] = None
    durationUnit: str = "days"
    dataLimit: Optional[int] = None
    dataLimitUnit: str = "MB"
    downloadSpeed: float
    uploadSpeed: float
    
    @classmethod
    async def from_isp_package(cls, package: ISPPackage) -> "HotspotPackage":
        """Convert an ISPPackage to a HotspotPackage"""
        return cls(
            id=package.id,
            name=package.name,
            description=package.description,
            price=package.price,
            duration=package.duration,
            durationUnit=package.durationUnit,
            dataLimit=package.dataLimit,
            dataLimitUnit=package.dataLimitUnit,
            downloadSpeed=package.downloadSpeed,
            uploadSpeed=package.uploadSpeed
        )


@strawberry.type
class HotspotPackagesResponse:
    """Response type for hotspot packages API"""
    success: bool
    message: str
    packages: List[HotspotPackage] = field(default_factory=list)


