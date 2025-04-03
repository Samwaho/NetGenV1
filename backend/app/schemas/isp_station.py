from datetime import datetime
from typing import Optional, List
import strawberry
from dataclasses import field
from bson import ObjectId
from app.schemas.organization import Organization
from app.schemas.enums import BuildingType, StationStatus

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
        from bson import ObjectId

        # Handle both dictionary and object types
        if isinstance(station, dict):
            org_id = station.get("organizationId")
            converted_station = {
                "id": str(station["_id"]),  # Convert ObjectId to string
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
                "id": str(station._id),  # Convert ObjectId to string
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
        if org_id:
            org_data = await organizations.find_one({"_id": ObjectId(org_id) if isinstance(org_id, str) else org_id})
            if org_data:
                organization = await Organization.from_db(org_data)
                converted_station["organization"] = organization
            else:
                # Create a placeholder organization if the actual one is not found
                placeholder_org = {
                    "_id": ObjectId(),
                    "name": "Unknown Organization",
                    "status": "INACTIVE",
                    "owner": None,
                    "members": [],
                    "roles": [],
                    "createdAt": datetime.now(),
                    "updatedAt": datetime.now()
                }
                organization = await Organization.from_db(placeholder_org)
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



