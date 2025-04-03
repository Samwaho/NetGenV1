from datetime import datetime
from typing import Optional
from app.schemas.isp_station import StationStatus, BuildingType
import strawberry

@strawberry.type
class DBISPStation:
    _id: str
    name: str
    description: Optional[str]
    organizationId: str
    location: str
    buildingType: BuildingType
    notes: Optional[str]
    status: StationStatus
    coordinates: Optional[str]
    createdAt: datetime
    updatedAt: datetime