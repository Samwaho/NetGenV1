from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union, cast
import strawberry
from fastapi import HTTPException, status
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
from functools import lru_cache
from pymongo import ASCENDING, DESCENDING
from motor.motor_asyncio import AsyncIOMotorClientSession

logger = logging.getLogger(__name__)

# Constants to avoid magic strings
PACKAGE_NOT_FOUND = "Package not found"
ORG_NOT_FOUND = "Organization not found"
NOT_AUTHORIZED = "Not authorized to access this resource"

# Cache for organization permissions check - 5 minute TTL
permission_cache: Dict[str, Dict[str, Any]] = {}

def package_cache_key(package_id: str) -> str:
    return f"isp_package:{package_id}"

def packages_cache_key(user_id: str, org_id: str, page: int, page_size: int, sort_by: str, sort_direction: str, search: str) -> str:
    return f"isp_packages:{user_id}:{org_id}:{page}:{page_size}:{sort_by}:{sort_direction}:{search or 'none'}"

async def clear_package_cache(org_id: Optional[str] = None):
    """Clear relevant caches when packages are modified"""
    # Clear the permission cache for this organization
    if org_id and org_id in permission_cache:
        del permission_cache[org_id]


@lru_cache(maxsize=20)
def get_sort_field(field: str) -> str:
    """Map GraphQL sort fields to database fields"""
    field_map = {
        "name": "name",
        "price": "price",
        "downloadSpeed": "downloadSpeed",
        "uploadSpeed": "uploadSpeed",
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
    # Convert to string for caching
    org_id_str = str(org_id)
    cache_key = f"{org_id_str}:{user_id}"
    
    # Check permission cache first (simple time-based cache)
    if org_id_str in permission_cache and user_id in permission_cache[org_id_str]:
        cached_data = permission_cache[org_id_str][user_id]
        if cached_data["timestamp"] > datetime.now(timezone.utc).timestamp() - 300:  # 5 min TTL
            return cached_data["org"]
    
    # Verify user has access to the organization
    org = await organizations.find_one({
        "_id": ObjectId(org_id),
        "members.userId": user_id
    })
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=NOT_AUTHORIZED
        )
    
    # Update cache
    if org_id_str not in permission_cache:
        permission_cache[org_id_str] = {}
    
    permission_cache[org_id_str][user_id] = {
        "timestamp": datetime.now(timezone.utc).timestamp(),
        "org": org
    }
    
    return org


@strawberry.type
class ISPPackageResolver:

    @strawberry.field
    async def package(self, id: str, info: strawberry.Info) -> ISPPackageResponse:
        """
        Get a specific ISP package by ID
        
        Args:
            id: Package ID
            info: GraphQL info with request context
            
        Returns:
            Package response with success status and message
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Validate ID format
            package_id = ObjectId(id)
        except:
            logger.warning(f"Invalid package ID format: {id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid package ID format"
            )

        try:
            package = await isp_packages.find_one({"_id": package_id})
            if not package:
                logger.info(f"Package not found: {id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail=PACKAGE_NOT_FOUND
                )

            # Verify user has access to the organization this package belongs to
            await validate_organization_access(package["organizationId"], current_user.id)

            return ISPPackageResponse(
                success=True,
                message="Package retrieved successfully",
                package=await ISPPackage.from_db(package)
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving package {id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error retrieving package: {str(e)}"
            )

    @strawberry.field
    async def packages(
        self, 
        info: strawberry.Info, 
        organizationId: str,
        page: Optional[int] = 1,
        pageSize: Optional[int] = 20,
        sortBy: Optional[str] = "createdAt",
        sortDirection: Optional[str] = "desc",
        search: Optional[str] = None,
    ) -> ISPPackagesResponse:
        """
        Get ISP packages for a specific organization with pagination and sorting
        
        Args:
            info: GraphQL info with request context
            organizationId: Organization ID
            page: Page number (default: 1)
            pageSize: Items per page (default: 20)
            sortBy: Field to sort by (default: createdAt)
            sortDirection: Sort direction (asc/desc)
            search: Optional search term for package name
            
        Returns:
            Packages response with success status, message, and paginated packages
        """
        context: Context = info.context
        current_user = await context.authenticate()
        logger = logging.getLogger(__name__)

        try:
            # Validate ID format
            org_id = ObjectId(organizationId)
        except:
            logger.warning(f"Invalid organization ID format: {organizationId}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization ID format"
            )
            
        try:
            # First verify the user has access to this organization
            await validate_organization_access(org_id, current_user.id)
            
            # Build query
            query: Dict[str, Any] = {"organizationId": org_id}
            
            # Add search if provided
            if search:
                query["name"] = {"$regex": search, "$options": "i"}
                
            # Get sort field and direction
            sort_field = get_sort_field(sortBy)
            sort_dir = DESCENDING if sortDirection.lower() == "desc" else ASCENDING
            
            # Count total documents for pagination
            total_count = await isp_packages.count_documents(query)
            
            # Calculate skip for pagination
            skip = (page - 1) * pageSize
            
            # Get packages with pagination and sorting
            all_packages = await isp_packages.find(query) \
                .sort(sort_field, sort_dir) \
                .skip(skip) \
                .limit(pageSize) \
                .to_list(None)
            
            # Convert to ISPPackage objects
            package_list = []
            for package in all_packages:
                pkg_obj = await ISPPackage.from_db(package)
                if pkg_obj.organization is None:
                    continue
                package_list.append(pkg_obj)

            return ISPPackagesResponse(
                success=True,
                message="Packages retrieved successfully",
                packages=package_list,
                totalCount=total_count
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving packages for organization {organizationId}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error retrieving packages: {str(e)}"
            )

    @strawberry.mutation
    async def create_package(self, input: CreateISPPackageInput, info: strawberry.Info) -> ISPPackageResponse:
        """
        Create a new ISP package
        
        Args:
            input: Package details
            info: GraphQL info with request context
            
        Returns:
            Package response with success status, message, and created package
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Verify organization exists
            await validate_organization_access(input.organizationId, current_user.id)

            # Create package data
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
                "sessionTimeout": input.sessionTimeout,
                "idleTimeout": input.idleTimeout,
                "priority": input.priority,
                "vlanId": input.vlanId,
                # Add hotspot specific fields
                "showInHotspot": input.showInHotspot,
                "duration": input.duration,
                "durationUnit": input.durationUnit,
                "dataLimit": input.dataLimit,
                "dataLimitUnit": input.dataLimitUnit,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }

            # Insert with transaction if available
            client = isp_packages.database.client
            async with await client.start_session() as session:
                async with session.start_transaction():
                    result = await isp_packages.insert_one(package_data, session=cast(AsyncIOMotorClientSession, session))
                    package_data["_id"] = result.inserted_id

                    # Record activity - remove the session parameter
                    await record_activity(
                        current_user.id,
                        ObjectId(input.organizationId),
                        f"created ISP package {input.name}"
                    )

            # Clear cache for this organization
            await clear_package_cache(org_id=input.organizationId)

            return ISPPackageResponse(
                success=True,
                message="Package created successfully",
                package=await ISPPackage.from_db(package_data)
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating package: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating package: {str(e)}"
            )

    @strawberry.mutation
    async def update_package(self, id: str, input: UpdateISPPackageInput, info: strawberry.Info) -> ISPPackageResponse:
        """
        Update ISP package details
        
        Args:
            id: Package ID
            input: Updated package details
            info: GraphQL info with request context
            
        Returns:
            Package response with success status, message, and updated package
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Validate ID format
            package_id = ObjectId(id)
        except:
            logger.warning(f"Invalid package ID format: {id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid package ID format"
            )

        try:
            package = await isp_packages.find_one({"_id": package_id})
            if not package:
                logger.info(f"Package not found: {id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail=PACKAGE_NOT_FOUND
                )

            # Verify user has access to the organization this package belongs to
            await validate_organization_access(package["organizationId"], current_user.id)

            # Prepare update data
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
                    "sessionTimeout": input.sessionTimeout,
                    "idleTimeout": input.idleTimeout,
                    "priority": input.priority,
                    "vlanId": input.vlanId,
                    # Hotspot specific fields
                    "showInHotspot": input.showInHotspot,
                    "duration": input.duration,
                    "durationUnit": input.durationUnit,
                    "dataLimit": input.dataLimit,
                    "dataLimitUnit": input.dataLimitUnit,
                    "updatedAt": datetime.now(timezone.utc)
                }.items() if value is not None
            }

            # Only update if there are changes
            if not update_data:
                return ISPPackageResponse(
                    success=True,
                    message="No changes to update",
                    package=await ISPPackage.from_db(package)
                )

            # Update with transaction if available
            client = isp_packages.database.client
            async with await client.start_session() as session:
                async with session.start_transaction():
                    await isp_packages.update_one(
                        {"_id": package_id},
                        {"$set": update_data},
                        session=cast(AsyncIOMotorClientSession, session)
                    )

                    # Record activity - remove the session parameter
                    await record_activity(
                        current_user.id,
                        package["organizationId"],
                        f"updated ISP package {package['name']}"
                    )

            # Clear cache for this organization
            await clear_package_cache(org_id=str(package["organizationId"]))

            updated_package = await isp_packages.find_one({"_id": package_id})
            return ISPPackageResponse(
                success=True,
                message="Package updated successfully",
                package=await ISPPackage.from_db(updated_package)
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating package {id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error updating package: {str(e)}"
            )

    @strawberry.mutation
    async def delete_package(self, id: str, info: strawberry.Info) -> ISPPackageResponse:
        """
        Delete an ISP package
        
        Args:
            id: Package ID
            info: GraphQL info with request context
            
        Returns:
            Package response with success status, message, and deleted package data
        """
        context: Context = info.context
        current_user = await context.authenticate()

        try:
            # Validate ID format
            package_id = ObjectId(id)
        except:
            logger.warning(f"Invalid package ID format: {id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid package ID format"
            )

        try:
            package = await isp_packages.find_one({"_id": package_id})
            if not package:
                logger.info(f"Package not found: {id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail=PACKAGE_NOT_FOUND
                )

            # Verify user has access to the organization this package belongs to
            await validate_organization_access(package["organizationId"], current_user.id)

            # TODO: Add check if package is being used by any subscribers
            # If needed, prevent deletion of packages that are actively used

            # Save package for response before deletion
            package_response = await ISPPackage.from_db(package)
            
            # Delete with transaction if available
            client = isp_packages.database.client
            async with await client.start_session() as session:
                async with session.start_transaction():
                    # Record activity before deletion - remove the session parameter
                    await record_activity(
                        current_user.id,
                        package["organizationId"],
                        f"deleted ISP package {package['name']}"
                    )
                    
                    await isp_packages.delete_one(
                        {"_id": package_id},
                        session=cast(AsyncIOMotorClientSession, session)
                    )

            # Clear cache for this organization
            await clear_package_cache(org_id=str(package["organizationId"]))

            return ISPPackageResponse(
                success=True,
                message="Package deleted successfully",
                package=package_response
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting package {id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error deleting package: {str(e)}"
            )







