from datetime import datetime, timezone
from typing import Optional, List
import strawberry
from fastapi import HTTPException
from app.config.database import isp_packages, organizations
from app.schemas.isp_package import (
    ISPPackage,
    ISPPackageResponse,
    ISPPackagesResponse,
    CreateISPPackageInput,
    UpdateISPPackageInput
)
from app.config.deps import Context
from bson.objectid import ObjectId
from app.config.utils import record_activity
import logging

logger = logging.getLogger(__name__)


@strawberry.type
class ISPPackageResolver:

    @strawberry.field
    async def package(self, id: str, info: strawberry.Info) -> ISPPackageResponse:
        """Get a specific ISP package"""
        context: Context = info.context
        current_user = await context.authenticate()

        package = await isp_packages.find_one({"_id": ObjectId(id)})
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")

        # Verify user has access to the organization this package belongs to
        org = await organizations.find_one({
            "_id": package["organizationId"],
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this package")

        return ISPPackageResponse(
            success=True,
            message="Package retrieved successfully",
            package=await ISPPackage.from_db(package)
        )

    @strawberry.field
    async def packages(self, info: strawberry.Info, organization_id: str) -> ISPPackagesResponse:
        """Get all ISP packages for a specific organization"""
        context: Context = info.context
        current_user = await context.authenticate()

        # First verify the user has access to this organization
        org = await organizations.find_one({
            "_id": ObjectId(organization_id),
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")

        # Get packages only for this specific organization
        all_packages = await isp_packages.find(
            {"organizationId": ObjectId(organization_id)}
        ).to_list(None)
        
        package_list = []
        for package in all_packages:
            package_list.append(await ISPPackage.from_db(package))

        return ISPPackagesResponse(
            success=True,
            message="Packages retrieved successfully",
            packages=package_list
        )

    @strawberry.mutation
    async def create_package(self, input: CreateISPPackageInput, info: strawberry.Info) -> ISPPackageResponse:
        """Create a new ISP package"""
        context: Context = info.context
        current_user = await context.authenticate()

        # Verify organization exists
        organization = await organizations.find_one({"_id": ObjectId(input.organizationId)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check if user has permission to create packages in this organization
        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to create packages in this organization")

        package_data = {
            "name": input.name,
            "description": input.description,
            "price": input.price,
            "organizationId": ObjectId(input.organizationId),
            "downloadSpeed": input.downloadSpeed,
            "uploadSpeed": input.uploadSpeed,
            "burstDownload": input.burstDownload,
            "burstUpload": input.burstUpload,
            "thresholdDownload": input.thresholdDownload,
            "thresholdUpload": input.thresholdUpload,
            "burstTime": input.burstTime,
            "serviceType": input.serviceType,
            "addressPool": input.addressPool,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = await isp_packages.insert_one(package_data)
        package_data["_id"] = result.inserted_id

        # Record activity
        await record_activity(
            current_user.id,
            ObjectId(input.organizationId),
            f"created ISP package {input.name}"
        )

        return ISPPackageResponse(
            success=True,
            message="Package created successfully",
            package=await ISPPackage.from_db(package_data)
        )

    @strawberry.mutation
    async def update_package(self, id: str, input: UpdateISPPackageInput, info: strawberry.Info) -> ISPPackageResponse:
        """Update ISP package details"""
        context: Context = info.context
        current_user = await context.authenticate()

        package = await isp_packages.find_one({"_id": ObjectId(id)})
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")

        # Verify user has permission to update this package
        organization = await organizations.find_one({"_id": package["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to update this package")

        update_data = {
            key: value for key, value in {
                "name": input.name,
                "description": input.description,
                "price": input.price,
                "downloadSpeed": input.downloadSpeed,
                "uploadSpeed": input.uploadSpeed,
                "burstDownload": input.burstDownload,
                "burstUpload": input.burstUpload,
                "thresholdDownload": input.thresholdDownload,
                "thresholdUpload": input.thresholdUpload,
                "burstTime": input.burstTime,
                "serviceType": input.serviceType,
                "addressPool": input.addressPool,
                "updatedAt": datetime.now(timezone.utc)
            }.items() if value is not None
        }

        await isp_packages.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        # Record activity
        await record_activity(
            current_user.id,
            package["organizationId"],
            f"updated ISP package {package['name']}"
        )

        updated_package = await isp_packages.find_one({"_id": ObjectId(id)})
        return ISPPackageResponse(
            success=True,
            message="Package updated successfully",
            package=await ISPPackage.from_db(updated_package)
        )

    @strawberry.mutation
    async def delete_package(self, id: str, info: strawberry.Info) -> ISPPackageResponse:
        """Delete an ISP package"""
        context: Context = info.context
        current_user = await context.authenticate()

        package = await isp_packages.find_one({"_id": ObjectId(id)})
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")

        # Verify user has permission to delete this package
        organization = await organizations.find_one({"_id": package["organizationId"]})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        user_member = next((member for member in organization["members"] if member["userId"] == current_user.id), None)
        if not user_member:
            raise HTTPException(status_code=403, detail="Not authorized to delete this package")

        # TODO: Add check if package is being used by any subscribers
        # If needed, prevent deletion of packages that are actively used

        # Record activity before deletion
        await record_activity(
            current_user.id,
            package["organizationId"],
            f"deleted ISP package {package['name']}"
        )

        await isp_packages.delete_one({"_id": ObjectId(id)})

        return ISPPackageResponse(
            success=True,
            message="Package deleted successfully",
            package=await ISPPackage.from_db(package)
        )

