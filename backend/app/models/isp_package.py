from datetime import datetime
from typing import Optional
from app.schemas.isp_package import IspManagerPackageType
import strawberry

@strawberry.type
class DBISPPackage:
    _id: str
    name: str
    description: str
    price: float
    organizationId: str  # Just the ID in the database model
    downloadSpeed: float
    uploadSpeed: float
    burstDownload: Optional[float]
    burstUpload: Optional[float]
    thresholdDownload: Optional[float]
    thresholdUpload: Optional[float]
    burstTime: Optional[int]
    serviceType: IspManagerPackageType
    addressPool: Optional[str]
    createdAt: datetime
    updatedAt: datetime