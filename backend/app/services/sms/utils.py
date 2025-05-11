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
        
        # Send bulk SMS using the configured provider
        result = await SMSService.send_bulk_sms(
            provider_name=provider,
            config=sms_config,
            to=to,
            message=message,
            **kwargs
        )
        
        # Standardize response format across all providers
        successful = result.get("successful", 0)
        failed = result.get("failed", 0)
        total = len(to)
        
        # If provider doesn't return successful/failed counts, try to calculate them
        if successful == 0 and failed == 0:
            # Check if we have results array
            results = result.get("results", [])
            if results:
                successful = sum(1 for r in results if r.get("success", False))
                failed = len(results) - successful
            elif "total" in result and "successful" in result:
                successful = result.get("successful", 0)
                failed = result.get("failed", total - successful)
        
        # Consider it a success if at least one message was sent
        standardized_success = successful > 0
        
        # For TextSMS provider, check specific response format
        if provider == "textsms":
            responses = result.get("responses", [])
            if responses:
                textsms_successful = sum(1 for r in responses if r.get("respose-code") == 200 or r.get("response-code") == 200)
                if textsms_successful > 0:
                    standardized_success = True
                    successful = textsms_successful
                    failed = total - successful
        
        # Update the result with standardized values
        result.update({
            "success": standardized_success,
            "message": f"Sent {successful}/{total} messages successfully",
            "total": total,
            "successful": successful,
            "failed": failed or (total - successful),
            "provider": provider
        })
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending bulk SMS: {str(e)}")
        return {
            "success": False,
            "message": f"Error sending bulk SMS: {str(e)}",
            "provider": provider if 'provider' in locals() else "unknown",
            "failed": len(to),
            "successful": 0,
            "total": len(to)
        } 
