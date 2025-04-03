import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.schemas.organization import Organization
from enum import Enum


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

    @classmethod
    async def from_db(cls, package) -> "ISPPackage":
        from app.config.database import organizations

        if isinstance(package, dict):
            org_data = await organizations.find_one({"_id": package["organizationId"]})
            organization = await Organization.from_db(org_data) if org_data else None

            return cls(
                id=str(package["_id"]),
                name=package["name"],
                description=package["description"],
                price=package["price"],
                organization=organization,
                downloadSpeed=package["downloadSpeed"],
                uploadSpeed=package["uploadSpeed"],
                burstDownload=package.get("burstDownload"),
                burstUpload=package.get("burstUpload"),
                thresholdDownload=package.get("thresholdDownload"),
                thresholdUpload=package.get("thresholdUpload"),
                burstTime=package.get("burstTime"),
                serviceType=package.get("serviceType", IspManagerPackageType.PPPOE),
                addressPool=package.get("addressPool"),
                createdAt=package["createdAt"],
                updatedAt=package["updatedAt"]
            )
        else:
            org_data = await organizations.find_one({"_id": package.organizationId})
            organization = await Organization.from_db(org_data) if org_data else None

            return cls(
                id=str(package._id),
                name=package.name,
                description=package.description,
                price=package.price,
                organization=organization,
                downloadSpeed=package.downloadSpeed,
                uploadSpeed=package.uploadSpeed,
                burstDownload=package.burstDownload if hasattr(package, 'burstDownload') else None,
                burstUpload=package.burstUpload if hasattr(package, 'burstUpload') else None,
                thresholdDownload=package.thresholdDownload if hasattr(package, 'thresholdDownload') else None,
                thresholdUpload=package.thresholdUpload if hasattr(package, 'thresholdUpload') else None,
                burstTime=package.burstTime if hasattr(package, 'burstTime') else None,
                serviceType=package.serviceType if hasattr(package, 'serviceType') else IspManagerPackageType.PPPOE,
                addressPool=package.addressPool if hasattr(package, 'addressPool') else None,
                createdAt=package.createdAt,
                updatedAt=package.updatedAt
            )


@strawberry.input
class CreateISPPackageInput:
    name: str
    description: str
    price: float
    organizationId: str
    downloadSpeed: float
    uploadSpeed: float
    burstDownload: Optional[float] = None
    burstUpload: Optional[float] = None
    thresholdDownload: Optional[float] = None
    thresholdUpload: Optional[float] = None
    burstTime: Optional[int] = None
    serviceType: IspManagerPackageType = IspManagerPackageType.PPPOE
    addressPool: Optional[str] = None


@strawberry.input
class UpdateISPPackageInput:
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


