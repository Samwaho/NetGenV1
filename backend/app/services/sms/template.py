import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson.objectid import ObjectId
from app.config.database import sms_templates, organizations
from app.schemas.sms_template import TemplateCategory

logger = logging.getLogger(__name__)

# Common variables that can be used in any SMS template
COMMON_VARIABLES = [
    # Customer/User variables
    "firstName",
    "lastName",
    "phoneNumber",
    "username",
    "email",
    
    # Organization basic info
    "organizationName",
    "organizationDescription",
    
    # Organization contact information
    "orgEmail",
    "orgPhone",
    "orgWebsite",
    "orgAddress",
    "orgCity",
    "orgState",
    "orgCountry",
    "orgPostalCode",
    "orgTimezone",
    
    # Organization business information
    "orgLegalName",
    "orgTaxId",
    "orgRegistrationNumber",
    "orgIndustry",
    "orgBusinessType",
    "orgFoundedDate",
    "orgEmployeeCount",
    "orgAnnualRevenue",
    
    # Mpesa configuration
    "paybillNumber",
    "mpesaBusinessName",
    "mpesaAccountReference",
    "mpesaShortCode",
    "mpesaStkPushShortCode",
    
    # Service/Package variables
    "packageName",
    "expirationDate",
    "amountDue",
    "dueDate",
    "voucherCode",
    
    # Support/Contact variables
    "supportEmail",
    "supportPhone",
]

class SmsTemplateService:
    """Service for managing SMS templates"""
    
    @staticmethod
    async def create_template(
        organization_id: str,
        name: str,
        content: str,
        category: TemplateCategory,
        description: Optional[str] = None,
        variables: List[str] = None,
        is_active: bool = True,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new SMS template for an organization
        
        Args:
            organization_id: ID of the organization
            name: Template name
            content: Template content with variable placeholders
            category: Template category
            description: Optional description
            variables: List of variable names used in the template
            is_active: Whether the template is active
            created_by: User ID who created the template
            
        Returns:
            The created template document
        """
        try:
            # Validate organization exists
            organization = await organizations.find_one({"_id": ObjectId(organization_id)})
            if not organization:
                logger.error(f"Organization not found: {organization_id}")
                return {"success": False, "message": "Organization not found"}
            
            # Extract variables from content if not provided
            if variables is None:
                variables = SmsTemplateService._extract_variables(content)
            
            # Create template document
            now = datetime.now(timezone.utc)
            template_doc = {
                "organization_id": ObjectId(organization_id),
                "name": name,
                "content": content,
                "category": category.value,
                "description": description,
                "variables": variables,
                "is_active": is_active,
                "created_at": now,
                "updated_at": now,
                "created_by": ObjectId(created_by) if created_by else None
            }
            
            result = await sms_templates.insert_one(template_doc)
            
            if result.inserted_id:
                template_doc["_id"] = result.inserted_id
                return {"success": True, "template": template_doc}
            else:
                return {"success": False, "message": "Failed to create template"}
                
        except Exception as e:
            logger.error(f"Error creating SMS template: {str(e)}")
            return {"success": False, "message": f"Error creating template: {str(e)}"}
    
    @staticmethod
    async def update_template(
        template_id: str,
        organization_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update an existing SMS template
        
        Args:
            template_id: ID of the template to update
            organization_id: ID of the organization (for validation)
            **kwargs: Fields to update
            
        Returns:
            Dict with update status
        """
        try:
            # Validate template exists and belongs to organization
            template = await sms_templates.find_one({
                "_id": ObjectId(template_id),
                "organization_id": ObjectId(organization_id)
            })
            
            if not template:
                return {"success": False, "message": "Template not found or access denied"}
            
            # Prepare update document
            update_doc = {k: v for k, v in kwargs.items() if k != "template_id" and k != "organization_id"}
            
            # Convert category enum to string if present
            if "category" in update_doc and hasattr(update_doc["category"], "value"):
                update_doc["category"] = update_doc["category"].value
                
            # Update variables if content was updated but variables weren't
            if "content" in update_doc and "variables" not in update_doc:
                update_doc["variables"] = SmsTemplateService._extract_variables(update_doc["content"])
            
            # Add updated timestamp
            update_doc["updated_at"] = datetime.now(timezone.utc)
            
            # Update the template
            result = await sms_templates.update_one(
                {"_id": ObjectId(template_id)},
                {"$set": update_doc}
            )
            
            if result.modified_count:
                return {"success": True, "message": "Template updated successfully"}
            else:
                return {"success": False, "message": "No changes made to template"}
                
        except Exception as e:
            logger.error(f"Error updating SMS template: {str(e)}")
            return {"success": False, "message": f"Error updating template: {str(e)}"}
    
    @staticmethod
    async def delete_template(template_id: str, organization_id: str) -> Dict[str, Any]:
        """Delete an SMS template
        
        Args:
            template_id: ID of the template to delete
            organization_id: ID of the organization (for validation)
            
        Returns:
            Dict with deletion status
        """
        try:
            result = await sms_templates.delete_one({
                "_id": ObjectId(template_id),
                "organization_id": ObjectId(organization_id)
            })
            
            if result.deleted_count:
                return {"success": True, "message": "Template deleted successfully"}
            else:
                return {"success": False, "message": "Template not found or access denied"}
                
        except Exception as e:
            logger.error(f"Error deleting SMS template: {str(e)}")
            return {"success": False, "message": f"Error deleting template: {str(e)}"}
    
    @staticmethod
    async def get_template(template_id: str, organization_id: str) -> Dict[str, Any]:
        """Get a specific SMS template
        
        Args:
            template_id: ID of the template
            organization_id: ID of the organization (for validation)
            
        Returns:
            The template document if found
        """
        try:
            template = await sms_templates.find_one({
                "_id": ObjectId(template_id),
                "organization_id": ObjectId(organization_id)
            })
            
            if template:
                return {"success": True, "template": template}
            else:
                return {"success": False, "message": "Template not found or access denied"}
                
        except Exception as e:
            logger.error(f"Error retrieving SMS template: {str(e)}")
            return {"success": False, "message": f"Error retrieving template: {str(e)}"}
    
    @staticmethod
    async def list_templates(
        organization_id: str,
        category: Optional[TemplateCategory] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """List SMS templates for an organization
        
        Args:
            organization_id: ID of the organization
            category: Optional filter by category
            is_active: Optional filter by active status
            
        Returns:
            List of template documents
        """
        try:
            # Build query
            query = {"organization_id": ObjectId(organization_id)}
            
            if category:
                query["category"] = category.value
                
            if is_active is not None:
                query["is_active"] = is_active
            
            # Execute query
            cursor = sms_templates.find(query).sort("name", 1)
            templates = await cursor.to_list(length=100)
            
            return {"success": True, "templates": templates}
                
        except Exception as e:
            logger.error(f"Error listing SMS templates: {str(e)}")
            return {"success": False, "message": f"Error listing templates: {str(e)}"}
    
    @staticmethod
    def render_template(template_content: str, variables: Dict[str, Any]) -> str:
        """Render an SMS template by replacing variables with values
        
        Args:
            template_content: Template content with placeholders
            variables: Dictionary of variable names and values
            
        Returns:
            Rendered template text
        """
        rendered_content = template_content
        
        for var_name, var_value in variables.items():
            placeholder = f"{{{{{var_name}}}}}"
            rendered_content = rendered_content.replace(placeholder, str(var_value))
            
        return rendered_content
    
    @staticmethod
    def _extract_variables(content: str) -> List[str]:
        """Extract variable names from template content
        
        Args:
            content: Template content with {{variable}} placeholders
            
        Returns:
            List of variable names
        """
        import re
        
        # Find all {{variable}} patterns
        pattern = r'\{\{([a-zA-Z0-9_]+)\}\}'
        matches = re.findall(pattern, content)
        
        # Return unique variable names
        return list(set(matches))
    
    @staticmethod
    def build_sms_vars(context_sources: list) -> dict:
        """
        Dynamically build the variables dictionary for an SMS template using COMMON_VARIABLES.
        Args:
            context_sources: List of dict-like objects to search for variable values (in order of priority)
        Returns:
            Dict of variable names to values (missing variables get empty string)
        """
        result = {}
        
        # First pass: collect all basic variables
        for var in COMMON_VARIABLES:
            value = None
            for source in context_sources:
                if isinstance(source, dict) and var in source:
                    value = source[var]
                    break
                elif hasattr(source, var):
                    value = getattr(source, var)
                    break
            result[var] = value if value is not None else ""
        
        # Second pass: map organization data to specific variables
        for source in context_sources:
            if isinstance(source, dict):
                # Map organization basic info
                if "name" in source:
                    result["organizationName"] = source["name"]
                if "description" in source:
                    result["organizationDescription"] = source["description"]
                
                # Map organization contact info
                contact = source.get("contact", {})
                if contact:
                    result["orgEmail"] = contact.get("email", "")
                    result["orgPhone"] = contact.get("phone", "")
                    result["orgWebsite"] = contact.get("website", "")
                    result["orgAddress"] = contact.get("address", "")
                    result["orgCity"] = contact.get("city", "")
                    result["orgState"] = contact.get("state", "")
                    result["orgCountry"] = contact.get("country", "")
                    result["orgPostalCode"] = contact.get("postalCode", "")
                    result["orgTimezone"] = contact.get("timezone", "")
                
                # Map organization business info
                business = source.get("business", {})
                if business:
                    result["orgLegalName"] = business.get("legalName", "")
                    result["orgTaxId"] = business.get("taxId", "")
                    result["orgRegistrationNumber"] = business.get("registrationNumber", "")
                    result["orgIndustry"] = business.get("industry", "")
                    result["orgBusinessType"] = business.get("businessType", "")
                    result["orgFoundedDate"] = business.get("foundedDate", "")
                    result["orgEmployeeCount"] = business.get("employeeCount", "")
                    result["orgAnnualRevenue"] = business.get("annualRevenue", "")
                
                # Map Mpesa configuration
                mpesa_config = source.get("mpesaConfig", {})
                if mpesa_config:
                    result["mpesaBusinessName"] = mpesa_config.get("businessName", "")
                    result["mpesaAccountReference"] = mpesa_config.get("accountReference", "")
                    result["mpesaShortCode"] = mpesa_config.get("shortCode", "")
                    result["mpesaStkPushShortCode"] = mpesa_config.get("stkPushShortCode", "")
                    # Also map to legacy paybillNumber for backward compatibility
                    if "paybillNumber" not in result or not result["paybillNumber"]:
                        result["paybillNumber"] = mpesa_config.get("shortCode", "")
                
                # Map SMS configuration for support contact
                sms_config = source.get("smsConfig", {})
                if sms_config:
                    # Use senderId as support phone if available
                    if "supportPhone" not in result or not result["supportPhone"]:
                        result["supportPhone"] = sms_config.get("senderId", "")
        
        return result