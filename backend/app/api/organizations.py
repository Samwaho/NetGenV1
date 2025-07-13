from fastapi import APIRouter, HTTPException
from app.config.database import organizations
from bson.objectid import ObjectId
import logging
from app.schemas.organization import Organization

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{organization_id}")
async def get_organization(organization_id: str):
    """
    Get organization details by ID
    
    This endpoint is used by hotspot pages to fetch organization branding information
    including logo, banner, name, description, and contact details.
    """
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(organization_id):
            raise HTTPException(status_code=400, detail="Invalid organization ID format")
        
        # Find organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Convert to Organization schema
        org_schema = await Organization.from_db(organization)
        
        # Return organization data
        return {
            "success": True,
            "message": "Organization retrieved successfully",
            "organization": {
                "id": org_schema.id,
                "name": org_schema.name,
                "description": org_schema.description,
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
                "status": org_schema.status.value if org_schema.status else None,
                "createdAt": org_schema.createdAt.isoformat() if org_schema.createdAt else None,
                "updatedAt": org_schema.updatedAt.isoformat() if org_schema.updatedAt else None,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching organization {organization_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 