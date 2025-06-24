from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union, cast
from functools import lru_cache
import strawberry
from fastapi import HTTPException, status
from pymongo import ASCENDING, DESCENDING
from bson.objectid import ObjectId
from app.config.database import isp_stations, organizations
from app.schemas.isp_station import (
    ISPStation,
    ISPStationResponse,
    ISPStationsResponse,
    CreateISPStationInput,
    UpdateISPStationInput,
    StationStatus
)
from app.config.deps import Context
from app.config.utils import record_activity
import logging
import re

logger = logging.getLogger(__name__)

# Constants
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
NOT_AUTHORIZED = "Not authorized to access this organization"

# Cache for organization permissions
permission_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

def station_cache_key(station_id: str) -> str:
    return f"isp_station:{station_id}"

def stations_cache_key(user_id: str, org_id: str, page: int, page_size: int, sort_by: str, sort_direction: str, filter_status: str, search: str) -> str:
    return f"isp_stations:{user_id}:{org_id}:{page}:{page_size}:{sort_by}:{sort_direction}:{filter_status or 'all'}:{search or 'none'}"

async def clear_station_cache(org_id: Optional[str] = None):
    """Clear relevant caches when stations are modified"""
    if org_id and org_id in permission_cache:
        del permission_cache[org_id]

@lru_cache(maxsize=20)
def get_sort_field(field: str) -> str:
    """Map GraphQL sort fields to database fields"""
    field_map = {
        "name": "name",
        "location": "location",
        "status": "status",
        "createdAt": "createdAt",
        "updatedAt": "updatedAt",
    }
    return field_map.get(field, "createdAt")

async def validate_organization_access(org_id: Union[str, ObjectId], user_id: str) -> Dict[str, Any]:
    """
    Validate user access to an organization with caching.
    
    Args:
        org_id: Organization ID
        user_id: User ID
        
    Returns:
        Organization document
        
    Raises:
        HTTPException: If user doesn't have access
    """
    org_id_str = str(org_id)
    cache_key = f"{org_id_str}:{user_id}"
    
    if org_id_str in permission_cache and user_id in permission_cache[org_id_str]:
        cached_data = permission_cache[org_id_str][user_id]
        if cached_data["timestamp"] > datetime.now(timezone.utc).timestamp() - 300:  # 5 min TTL
            return cached_data["org"]
    
    org = await organizations.find_one({
        "_id": ObjectId(org_id),
        "members.userId": user_id
    })
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=NOT_AUTHORIZED
        )
    
    if org_id_str not in permission_cache:
        permission_cache[org_id_str] = {}
    
    permission_cache[org_id_str][user_id] = {
        "timestamp": datetime.now(timezone.utc).timestamp(),
        "org": org
    }
    
    return org

@strawberry.type
class ISPStationResolver:

    @strawberry.field
    async def station(self, id: str, info: strawberry.Info) -> ISPStationResponse:
        """Get a specific ISP station"""
        context: Context = info.context
        current_user = await context.authenticate()

        station = await isp_stations.find_one({"_id": ObjectId(id)})
        if not station:
            raise HTTPException(status_code=404, detail="Station not found")

        # Verify user has access to the organization this station belongs to
        org_id = station["organizationId"]
        org = await organizations.find_one({
            "$and": [
                {
                    "$or": [
                        {"_id": ObjectId(org_id) if isinstance(org_id, str) else org_id},
                        {"_id": str(org_id) if isinstance(org_id, ObjectId) else org_id}
                    ]
                },
                {"members.userId": current_user.id}
            ]
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this station")

        return ISPStationResponse(
            success=True,
            message="Station retrieved successfully",
            station=await ISPStation.from_db(station)
        )

    @strawberry.field
    async def stations(
        self, 
        info: strawberry.Info, 
        organization_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = DEFAULT_PAGE_SIZE,
        sort_by: Optional[str] = "createdAt",
        sort_direction: Optional[str] = "desc",
        search: Optional[str] = None,
        filter_status: Optional[str] = None
    ) -> ISPStationsResponse:
        """Get all ISP stations for a specific organization with pagination and filtering"""
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Verify organization access first
            org = await validate_organization_access(organization_id, current_user.id)

            # Build the query filter with flexible organizationId matching
            query_filter = {
                "$or": [
                    {"organizationId": ObjectId(organization_id)},
                    {"organizationId": organization_id}
                ]
            }
            
            if search:
                query_filter["$or"] = [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"description": {"$regex": search, "$options": "i"}},
                    {"location": {"$regex": search, "$options": "i"}}
                ]
            
            if filter_status:
                query_filter["status"] = filter_status

            # Log the query for debugging
            logger.debug(f"Query filter: {query_filter}")
            logger.debug(f"Organization ID: {organization_id}")

            # Get total count before pagination
            total_count = await isp_stations.count_documents(query_filter)
            logger.debug(f"Total count: {total_count}")

            # Apply sorting with proper field mapping
            sort_field = get_sort_field(sort_by)
            sort_direction_value = DESCENDING if sort_direction == "desc" else ASCENDING
            sort_options = [(sort_field, sort_direction_value)]

            # Get paginated results
            cursor = isp_stations.find(query_filter)
            cursor = cursor.sort(sort_options)
            cursor = cursor.skip((page - 1) * page_size).limit(page_size)
            
            stations = []
            async for station in cursor:
                logger.debug(f"Found station: {station['name']}")
                stations.append(station)

            logger.debug(f"Returning {len(stations)} stations")

            station_objs = [await ISPStation.from_db(s) for s in stations]
            return ISPStationsResponse(
                success=True,
                message="Stations retrieved successfully",
                stations=station_objs,
                totalCount=total_count
            )

        except Exception as e:
            logger.error(f"Error fetching stations: {str(e)}")
            return ISPStationsResponse(
                success=False,
                message=f"Error fetching stations: {str(e)}",
                stations=[],
                totalCount=0
            )

    @strawberry.mutation
    async def create_station(self, input: CreateISPStationInput, info: strawberry.Info) -> ISPStationResponse:
        """Create a new ISP station"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify organization exists
        organization = await organizations.find_one({"_id": ObjectId(input.organizationId)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to create stations in this organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to create stations in this organization")

        station_data = {
            "name": input.name,
            "description": input.description,
            "organizationId": input.organizationId,
            "location": input.location,
            "buildingType": input.buildingType,
            "notes": input.notes,
            "status": StationStatus.ACTIVE.value,
            "coordinates": input.coordinates,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await isp_stations.insert_one(station_data)
        station_data["_id"] = result.inserted_id

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(input.organizationId),
            f"created ISP station {input.name}"
        )

        return ISPStationResponse(
            success=True,
            message="Station created successfully",
            station=await ISPStation.from_db(station_data)
        )

    @strawberry.mutation
    async def update_station(self, id: str, input: UpdateISPStationInput, info: strawberry.Info) -> ISPStationResponse:
        """Update ISP station details"""
        context: Context = info.context
        current_user = await context.authenticate()

        station = await isp_stations.find_one({"_id": ObjectId(id)})
        if not station:
            raise HTTPException(status_code=404, detail="Station not found")

        # Verify user has permission to update this station
        organization = await organizations.find_one({"_id": ObjectId(station["organizationId"])})  # Convert to ObjectId
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to update this station")

        update_data = {
            key: value for key, value in {
                "name": input.name,
                "description": input.description,
                "location": input.location,
                "buildingType": input.buildingType,
                "notes": input.notes,
                "status": input.status,
                "coordinates": input.coordinates,
                "updatedAt": datetime.now(timezone.utc)
            }.items() if value is not None
        }

        await isp_stations.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        # Record activity
        await record_activity(
            current_user.id,
            station["organizationId"],
            f"updated ISP station {station['name']}"
        )

        updated_station = await isp_stations.find_one({"_id": ObjectId(id)})

        return ISPStationResponse(
            success=True,
            message="Station updated successfully",
            station=await ISPStation.from_db(updated_station)
        )

    @strawberry.mutation
    async def delete_station(self, id: str, info: strawberry.Info) -> ISPStationResponse:
        """Delete an ISP station"""
        context: Context = info.context
        current_user = await context.authenticate()

        station = await isp_stations.find_one({"_id": ObjectId(id)})
        if not station:
            raise HTTPException(status_code=404, detail="Station not found")

        # Verify user has permission to delete this station
        organization = await organizations.find_one({"_id": ObjectId(station["organizationId"])})  # Convert to ObjectId
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to delete this station")

        # Record activity before deletion
        await record_activity(
            current_user.id,
            station["organizationId"],
            f"deleted ISP station {station['name']}"
        )

        await isp_stations.delete_one({"_id": ObjectId(id)})

        return ISPStationResponse(
            success=True,
            message="Station deleted successfully",
            station=await ISPStation.from_db(station)
        )







