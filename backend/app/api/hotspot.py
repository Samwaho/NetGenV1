from fastapi import APIRouter, HTTPException, Query
from app.config.database import organizations, isp_packages
from bson.objectid import ObjectId
import logging
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/packages")
async def get_hotspot_packages(
    organization_id: str = Query(..., description="Organization ID")
):
    """
    Get available hotspot packages for an organization
    
    This endpoint returns all active packages that can be displayed
    in a hotspot captive portal for a specific organization.
    """
    try:
        # Verify organization exists
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get packages for this organization
        cursor = isp_packages.find({
            "organizationId": ObjectId(organization_id),
            "showInHotspot": True  # Assuming you have this field
        })
        
        # Convert to list and format for frontend
        packages = []
        async for package in cursor:
            packages.append({
                "id": str(package["_id"]),
                "name": package.get("name", ""),
                "description": package.get("description", ""),
                "price": package.get("price", 0),
                "duration": package.get("duration", 0),
                "durationUnit": package.get("durationUnit", "days"),
                "dataLimit": package.get("dataLimit", 0),
                "dataLimitUnit": package.get("dataLimitUnit", "MB"),
                "speedLimit": package.get("speedLimit", 0),
                "speedLimitUnit": package.get("speedLimitUnit", "Mbps")
            })
        
        return {"packages": packages}
    
    except Exception as e:
        logger.error(f"Error fetching hotspot packages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch packages: {str(e)}")