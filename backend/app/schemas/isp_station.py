from datetime import datetime
from typing import Optional, List, Dict, Any, ClassVar, Union
import strawberry
from dataclasses import field
from bson import ObjectId
from app.schemas.organization import Organization
from app.schemas.enums import BuildingType, StationStatus

@strawberry.type
class ISPStation:
    """ISP Station model representing a network station/access point."""
    
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
    
    # Class variable to cache related data fetching
    _related_cache: ClassVar[Dict[str, Dict[str, Any]]] = {
        "organizations": {},
    }

    @classmethod
    async def from_db(cls, station: Union[Dict[str, Any], Any]) -> "ISPStation":
        """
        Convert a database station record to an ISPStation object.
        
        Args:
            station: A station record from the database (dict or object)
            
        Returns:
            ISPStation: A properly formatted ISPStation object
        """
        from app.schemas.organization import Organization
        from app.config.database import organizations
        
        # Handle both dictionary and object types
        if isinstance(station, dict):
            org_id = station.get("organizationId")
            converted_station = {
                "id": str(station["_id"]),
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
                "id": str(station._id),
                "name": station.name,
                "description": getattr(station, 'description', None),
                "location": station.location,
                "buildingType": station.buildingType,
                "notes": getattr(station, 'notes', None),
                "status": station.status,
                "coordinates": getattr(station, 'coordinates', None),
                "createdAt": station.createdAt,
                "updatedAt": station.updatedAt
            }

        # Convert ObjectId to string for cache key
        org_id_str = str(org_id)
        
        # Fetch organization from cache or database
        org_data = cls._related_cache["organizations"].get(org_id_str)
        if not org_data:
            org_data = await organizations.find_one({"_id": ObjectId(org_id) if isinstance(org_id, str) else org_id})
            if org_data:
                cls._related_cache["organizations"][org_id_str] = org_data

        # Convert organization to proper type
        if org_data:
            converted_station["organization"] = await Organization.from_db(org_data)
        else:
            # Create a placeholder organization if not found
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
            converted_station["organization"] = await Organization.from_db(placeholder_org)

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
    totalCount: int = 0  # Add this field

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



