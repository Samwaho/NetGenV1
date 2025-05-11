import logging
from typing import Dict, Any, List, Optional
from app.config.database import organizations
from bson.objectid import ObjectId
from .base import SMSService
import json

logger = logging.getLogger(__name__)

async def send_sms_for_organization(
    organization_id: str, 
    to: str, 
    message: str, 
    **kwargs
) -> Dict[str, Any]:
    """Send an SMS using the organization's configured SMS provider"""
    try:
        # Get organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            logger.error(f"Organization not found: {organization_id}")
            return {
                "success": False,
                "message": "Organization not found"
            }
        
        # Get SMS configuration - check both field names for compatibility
        sms_config = organization.get("smsConfig", organization.get("smsConfiguration", {}))
        
        if not sms_config:
            logger.error(f"SMS configuration not found for organization: {organization_id}")
            return {
                "success": False,
                "message": "SMS configuration not found"
            }
        
        # Check if SMS is active
        is_active = sms_config.get("isActive", False)
        
        if not is_active:
            logger.error(f"SMS is not active for organization: {organization_id}")
            return {
                "success": False,
                "message": "SMS is not active for this organization"
            }
        
        # Get provider
        provider = sms_config.get("provider", "mock")
        
        # Send SMS using the configured provider
        result = await SMSService.send_sms(
            provider_name=provider,
            config=sms_config,
            to=to,
            message=message,
            **kwargs
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending SMS: {str(e)}")
        return {
            "success": False,
            "message": f"Error sending SMS: {str(e)}"
        }

async def send_bulk_sms_for_organization(
    organization_id: str, 
    to: List[str], 
    message: str, 
    **kwargs
) -> Dict[str, Any]:
    """Send SMS messages to multiple recipients using the organization's configured SMS provider"""
    try:
        # Get organization
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            logger.error(f"Organization not found: {organization_id}")
            return {
                "success": False,
                "message": "Organization not found"
            }
        
        # Get SMS configuration - check both field names for compatibility
        sms_config = organization.get("smsConfig", organization.get("smsConfiguration", {}))
        
        if not sms_config:
            logger.error(f"SMS configuration not found for organization: {organization_id}")
            return {
                "success": False,
                "message": "SMS configuration not found"
            }
        
        # Check if SMS is active
        is_active = sms_config.get("isActive", False)
        
        if not is_active:
            logger.error(f"SMS is not active for organization: {organization_id}")
            return {
                "success": False,
                "message": "SMS is not active for this organization"
            }
        
        # Get provider
        provider = sms_config.get("provider", "mock")
        
        # Log the bulk SMS request
        logger.info(f"Sending bulk SMS via {provider} to {len(to)} recipients: {message[:20]}...")
        
        # Send bulk SMS using the configured provider
        result = await SMSService.send_bulk_sms(
            provider_name=provider,
            config=sms_config,
            to=to,
            message=message,
            **kwargs
        )
        
        # Process results and determine overall success
        successful = 0
        failed = 0
        results = []
        
        for result_item in result.get("results", []):
            # Consider a message successful if it has a message_id, regardless of the success flag
            if result_item.get("message_id"):
                successful += 1
                result_item["success"] = True  # Override the provider's success flag
            else:
                failed += 1
            
            results.append(result_item)
        
        # Mark as success if any messages were sent successfully
        overall_success = successful > 0
        
        return {
            "success": overall_success,
            "message": f"Sent to {successful}/{len(to)} recipients",
            "provider": provider,
            "total": len(to),
            "successful": successful,
            "failed": failed,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error sending bulk SMS: {str(e)}")
        return {
            "success": False,
            "message": f"Error sending bulk SMS: {str(e)}"
        } 
