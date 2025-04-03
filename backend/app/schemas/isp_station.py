import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.schemas.organization import Organization
from enum import Enum

@strawberry.enum
class StationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"

@strawberry.enum
class BuildingType(str, Enum):
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    INDUSTRIAL = "INDUSTRIAL"
    GOVERNMENT = "GOVERNMENT"
    EDUCATIONAL = "EDUCATIONAL"
    OTHER = "OTHER"

@strawberry.type
class ISPStation:
    id: str
    name: str
    description: Optional[str] = None
    organization: Organization
    location: str
    buildingType: BuildingType
    notes: Optional[str] = None
    status: StationStatus
    coordinates: Optional[str] = None  # Format: "latitude,longitude"
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, station) -> "ISPStation":
        from app.schemas.organization import Organization
        from app.config.database import organizations

        # Handle both dictionary and object types
        if isinstance(station, dict):
            org_id = station.get("organizationId")
            converted_station = {
                "id": station["_id"],
                "name": station["name"],
                "description": station.get("description"),
                "location": station["location"],
                "buildingType": station["buildingType"],
                "notes": station.get("notes"),
                "status": station["status"],
                "coordinates": station.get("coordinates"),
                "createdAt": station["createdAt"],
                "updatedAt": station["updatedAt"]
            }
        else:
            org_id = station.organizationId
            converted_station = {
                "id": station._id,
                "name": station.name,
                "description": station.description if hasattr(station, 'description') else None,
                "location": station.location,
                "buildingType": station.buildingType,
                "notes": station.notes if hasattr(station, 'notes') else None,
                "status": station.status,
                "coordinates": station.coordinates if hasattr(station, 'coordinates') else None,
                "createdAt": station.createdAt,
                "updatedAt": station.updatedAt
            }

        # Fetch organization data
        org_data = await organizations.find_one({"_id": org_id})
        organization = await Organization.from_db(org_data) if org_data else None
        converted_station["organization"] = organization

        return cls(**converted_station)

@strawberry.type
class ISPStationResponse:
    success: bool
    message: str
    station: Optional[ISPStation] = None

@strawberry.type
class ISPStationsResponse:
    success: bool
    message: str
    stations: List[ISPStation] = field(default_factory=list)

@strawberry.input
class CreateISPStationInput:
    name: str
    description: Optional[str] = None
    organizationId: str
    location: str
    buildingType: BuildingType
    notes: Optional[str] = None
    coordinates: Optional[str] = None

@strawberry.input
class UpdateISPStationInput:
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    buildingType: Optional[BuildingType] = None
    notes: Optional[str] = None
    status: Optional[StationStatus] = None
    coordinates: Optional[str] = None
