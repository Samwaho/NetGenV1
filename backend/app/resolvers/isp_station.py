from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
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
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging

logger = logging.getLogger(__name__)

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
    async def stations(self, info: strawberry.Info, organization_id: str) -> ISPStationsResponse:
        """Get all ISP stations for a specific organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify user has access to the organization this station belongs to
        org = await organizations.find_one({
            "_id": ObjectId(organization_id),
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        # Try both ObjectId and string formats
        all_stations = await isp_stations.find({
            "$or": [
                {"organizationId": ObjectId(organization_id)},
                {"organizationId": organization_id}
            ]
        }).to_list(None)

        station_list = []
        for station in all_stations:
            converted_station = await ISPStation.from_db(station)
            station_list.append(converted_station)

        return ISPStationsResponse(
            success=True,
            message="Stations retrieved successfully",
            stations=station_list
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







