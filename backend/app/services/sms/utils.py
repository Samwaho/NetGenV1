import logging
from typing import Dict, Any, List, Optional
from app.config.database import organizations
from bson.objectid import ObjectId
from .base import SMSService

logger = logging.getLogger(__name__)

async def send_sms_for_organization(
    organization_id: str, 
    to: str, 
    message: str, 
    **kwargs
) -> Dict[str, Any]:
    """Send an SMS using the organization's configured SMS provider
    
    Args:
        organization_id: The organization ID
        to: Recipient phone number
        message: Message content
        **kwargs: Additional provider-specific parameters
        
    Returns:
        Dict containing status and response details
    """
    try:
        # Get the organization's SMS configuration
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            return {
                "success": False,
                "message": "Organization not found"
            }
        
        sms_config = organization.get("smsConfig")
        if not sms_config:
            return {
                "success": False,
                "message": "Organization has no SMS configuration"
            }
        
        # Check if SMS is active
        if not sms_config.get("isActive", False):
            return {
                "success": False,
                "message": "SMS is not enabled for this organization"
            }
        
        provider = sms_config.get("provider")
        if not provider:
            return {
                "success": False,
                "message": "No SMS provider configured"
            }
        
        # Send SMS using the configured provider
        result = await SMSService.send_sms(
            provider_name=provider,
            config=sms_config,
            to=to,
            message=message,
            **kwargs
        )
        
        # Here you might want to store the message in a database
        # For example:
        # await sms_messages.insert_one({
        #     "organizationId": ObjectId(organization_id),
        #     "to": to,
        #     "message": message,
        #     "provider": provider,
        #     "providerMessageId": result.get("message_id"),
        #     "status": result.get("status"),
        #     "createdAt": datetime.now(timezone.utc)
        # })
        
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
    """Send SMS messages to multiple recipients using the organization's configured SMS provider
    
    Args:
        organization_id: The organization ID
        to: List of recipient phone numbers
        message: Message content
        **kwargs: Additional provider-specific parameters
        
    Returns:
        Dict containing status and response details
    """
    try:
        # Get the organization's SMS configuration
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            return {
                "success": False,
                "message": "Organization not found"
            }
        
        sms_config = organization.get("smsConfig")
        if not sms_config:
            return {
                "success": False,
                "message": "Organization has no SMS configuration"
            }
        
        # Check if SMS is active
        if not sms_config.get("isActive", False):
            return {
                "success": False,
                "message": "SMS is not enabled for this organization"
            }
        
        provider = sms_config.get("provider")
        if not provider:
            return {
                "success": False,
                "message": "No SMS provider configured"
            }
        
        # Send bulk SMS using the configured provider
        result = await SMSService.send_bulk_sms(
            provider_name=provider,
            config=sms_config,
            to=to,
            message=message,
            **kwargs
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending bulk SMS: {str(e)}")
        return {
            "success": False,
            "message": f"Error sending bulk SMS: {str(e)}"
        } 