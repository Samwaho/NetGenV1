import logging
import aiohttp
from typing import Dict, Any, List
from ..base import SMSProvider

logger = logging.getLogger(__name__)

class ZettatelProvider(SMSProvider):
    """Provider for Zettatel SMS service"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Zettatel provider with configuration
        
        Args:
            config: Configuration dictionary with Zettatel credentials
        """
        self.user_id = config.get("username")
        self.password = config.get("password")
        self.api_key = config.get("apiKey")
        self.sender_id = config.get("senderId")
        self.msg_type = config.get("msgType", "text")  # Default to text if not specified
        
        # API endpoints
        self.base_url = "https://portal.zettatel.com/SMSApi"
        self.send_sms_url = f"{self.base_url}/send"
        
        logger.info("Initialized Zettatel Provider")
    
    async def send_sms(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send an SMS message using Zettatel
        
        Args:
            to: Recipient phone number
            message: Message content
            **kwargs: Additional parameters
            
        Returns:
            Dict containing status and response details
        """
        try:
            # Ensure phone number format is correct (should include country code)
            if to.startswith('+'):
                to = to[1:]  # Remove the + if present
            
            # Build the request payload
            payload = {
                "sendMethod": "quick",
                "mobile": to,
                "msg": message,
                "senderid": self.sender_id,
                "msgType": self.msg_type,
                "output": "json",
                "duplicatecheck": "true"
            }
            
            # Add credentials - either userId/password or apiKey
            headers = {}
            if self.api_key:
                headers["apikey"] = self.api_key
            else:
                payload["userId"] = self.user_id
                payload["password"] = self.password
            
            # Add scheduling if provided
            if 'schedule_time' in kwargs:
                payload["scheduleTime"] = kwargs.get('schedule_time')
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.send_sms_url, data=payload, headers=headers) as response:
                    result = await response.json()
                    
                    success = result.get("status") == "success"
                    
                    return {
                        "success": success,
                        "message_id": result.get("transactionId"),
                        "provider": "zettatel",
                        "status": result.get("status"),
                        "to": to,
                        "response": result
                    }
                    
        except Exception as e:
            logger.error(f"Error sending SMS via Zettatel: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending SMS: {str(e)}",
                "provider": "zettatel"
            }
    
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients using Zettatel
        
        Args:
            to: List of recipient phone numbers
            message: Message content
            **kwargs: Additional parameters
            
        Returns:
            Dict containing status and response details
        """
        # For Zettatel, we can send comma-separated numbers in a single API call
        try:
            # Format numbers and remove any + prefix
            formatted_numbers = [num[1:] if num.startswith('+') else num for num in to]
            
            # Join all numbers with commas
            mobile_numbers = ",".join(formatted_numbers)
            
            # Use the single SMS endpoint with multiple numbers
            result = await self.send_sms(to=mobile_numbers, message=message, **kwargs)
            
            return {
                "success": result.get("success", False),
                "message": result.get("message", "Unknown error"),
                "total_sent": len(to) if result.get("success", False) else 0,
                "failed": 0 if result.get("success", False) else len(to),
                "results": [result]
            }
            
        except Exception as e:
            logger.error(f"Error sending bulk SMS via Zettatel: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending bulk SMS: {str(e)}",
                "provider": "zettatel",
                "failed": len(to)
            }
    
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status of a message
        
        Args:
            message_id: The ID of the message to check
            
        Returns:
            Dict containing status information
        """
        # Zettatel doesn't have a documented delivery status API in the provided info
        # This would need to be implemented if they provide such an endpoint
        return {
            "success": False,
            "message": "Delivery status check not implemented for Zettatel",
            "provider": "zettatel"
        }