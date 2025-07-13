from fastapi import APIRouter, HTTPException
from app.config.database import organizations
from bson.objectid import ObjectId
import logging
from app.schemas.organization import Organization

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def list_organizations():
    """
    List all organizations (for debugging purposes)
    """
    try:
        logger.info("Listing all organizations")
        orgs = await organizations.find({}, {"_id": 1, "name": 1, "description": 1}).to_list(None)
        
        organizations_list = []
        for org in orgs:
            organizations_list.append({
                "id": str(org["_id"]),
                "name": org.get("name", "Unknown"),
                "description": org.get("description", "")
            })
        
        logger.info(f"Found {len(organizations_list)} organizations")
        return {
            "success": True,
            "message": f"Found {len(organizations_list)} organizations",
            "organizations": organizations_list
        }
        
    except Exception as e:
        logger.error(f"Error listing organizations: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{organization_id}")
async def get_organization(organization_id: str):
    """
    Get organization details by ID
    
    This endpoint is used by hotspot pages to fetch organization branding information
    including logo, banner, name, description, and contact details.
    """
    try:
        logger.info(f"Organization API called with ID: {organization_id}")
        
        # Validate ObjectId format
        if not ObjectId.is_valid(organization_id):
            logger.error(f"Invalid ObjectId format: {organization_id}")
            raise HTTPException(status_code=400, detail="Invalid organization ID format")
        
        # Find organization
        logger.info(f"Searching for organization with ObjectId: {ObjectId(organization_id)}")
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        
        if not organization:
            logger.error(f"Organization not found with ID: {organization_id}")
            raise HTTPException(status_code=404, detail="Organization not found")
        
        logger.info(f"Organization found: {organization.get('name', 'Unknown')}")
        
        # Convert to Organization schema
        org_schema = await Organization.from_db(organization)
        logger.info(f"Organization schema created successfully")
        
        # Return organization data with safe attribute access
        try:
            response_data = {
                "success": True,
                "message": "Organization retrieved successfully",
                "organization": {
                    "id": getattr(org_schema, 'id', None),
                    "name": getattr(org_schema, 'name', 'Unknown'),
                    "description": getattr(org_schema, 'description', None),
                    "contact": {
                        "email": org_schema.contact.email if org_schema.contact else None,
                        "phone": org_schema.contact.phone if org_schema.contact else None,
                        "website": org_schema.contact.website if org_schema.contact else None,
                        "address": org_schema.contact.address if org_schema.contact else None,
                        "city": org_schema.contact.city if org_schema.contact else None,
                        "state": org_schema.contact.state if org_schema.contact else None,
                        "country": org_schema.contact.country if org_schema.contact else None,
                        "postalCode": org_schema.contact.postalCode if org_schema.contact else None,
                        "timezone": org_schema.contact.timezone if org_schema.contact else None,
                    } if org_schema.contact else None,
                    "business": {
                        "legalName": org_schema.business.legalName if org_schema.business else None,
                        "taxId": org_schema.business.taxId if org_schema.business else None,
                        "registrationNumber": org_schema.business.registrationNumber if org_schema.business else None,
                        "industry": org_schema.business.industry if org_schema.business else None,
                        "businessType": org_schema.business.businessType if org_schema.business else None,
                        "foundedDate": org_schema.business.foundedDate.isoformat() if org_schema.business and org_schema.business.foundedDate else None,
                        "employeeCount": org_schema.business.employeeCount if org_schema.business else None,
                        "annualRevenue": org_schema.business.annualRevenue if org_schema.business else None,
                        "logo": org_schema.business.logo if org_schema.business else None,
                        "banner": org_schema.business.banner if org_schema.business else None,
                        "socialMedia": org_schema.business.socialMedia if org_schema.business else None,
                    } if org_schema.business else None,
                    "status": getattr(org_schema, 'status', None),
                    "createdAt": org_schema.createdAt.isoformat() if org_schema.createdAt else None,
                    "updatedAt": org_schema.updatedAt.isoformat() if org_schema.updatedAt else None,
                }
            }
        except Exception as e:
            logger.error(f"Error creating response data: {str(e)}")
            # Fallback to basic organization data
            response_data = {
                "success": True,
                "message": "Organization retrieved successfully (basic data)",
                "organization": {
                    "id": str(organization.get("_id")),
                    "name": organization.get("name", "Unknown"),
                    "description": organization.get("description"),
                    "contact": organization.get("contact"),
                    "business": organization.get("business"),
                    "status": organization.get("status"),
                    "createdAt": organization.get("createdAt"),
                    "updatedAt": organization.get("updatedAt"),
                }
            }
        
        logger.info(f"Returning organization data for: {response_data['organization']['name']}")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching organization {organization_id}: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Internal server error") 