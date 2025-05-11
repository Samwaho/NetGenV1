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
        self.sender_id = config.get("senderId")
        self.msg_type = config.get("msgType", "text")  # Default to text if not specified
        
        # API endpoints
        self.base_url = "https://portal.zettatel.com/SMSApi"
        self.send_sms_url = f"{self.base_url}/send"
    
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
            # Format phone number to ensure it has the country code
            # Remove the + if present
            if to.startswith('+'):
                to = to[1:]
            # For Kenya numbers: if starts with 0, replace with 254
            elif to.startswith('0'):
                to = "254" + to[1:]
            # If no country code (assuming Kenya), add 254
            elif not to.startswith('254') and len(to) == 9:
                to = "254" + to
            
            # Build the request payload following the exact format from the curl example
            payload = {
                "userid": self.user_id,
                "password": self.password,
                "sendMethod": "quick",
                "senderid": self.sender_id,
                "msgType": self.msg_type,
                "duplicatecheck": "true",
                "output": "json",
                "sms": [
                    {
                        "mobile": [to],
                        "msg": message
                    }
                ]
            }
            
            headers = {"Content-Type": "application/json"}
            
            # Add scheduling if provided
            if 'schedule_time' in kwargs:
                payload["scheduleTime"] = kwargs.get('schedule_time')
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.send_sms_url, json=payload, headers=headers) as response:
                    response_status = response.status
                    response_text = await response.text()
                    
                    try:
                        result = await response.json()
                    except Exception as json_error:
                        return {
                            "success": False,
                            "message": f"Invalid response from Zettatel: {response_text}",
                            "provider": "zettatel"
                        }
                    
                    success = result.get("status") == "success"
                    
                    return {
                        "success": success,
                        "message": result.get("reason", "Unknown status"),
                        "message_id": result.get("transactionId"),
                        "provider": "zettatel",
                        "status": result.get("status"),
                        "to": to,
                        "response": result
                    }
                    
        except aiohttp.ClientError as ce:
            error_msg = f"Zettatel API connection error: {str(ce)}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg,
                "provider": "zettatel"
            }
        except Exception as e:
            error_msg = f"Error sending SMS via Zettatel: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg,
                "provider": "zettatel"
            }
    
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients using Zettatel"""
        try:
            # Format numbers with proper country code
            formatted_numbers = []
            for num in to:
                # Remove the + if present
                if num.startswith('+'):
                    num = num[1:]
                # For Kenya numbers: if starts with 0, replace with 254
                elif num.startswith('0'):
                    num = "254" + num[1:]
                # If no country code (assuming Kenya), add 254
                elif not num.startswith('254') and len(num) == 9:
                    num = "254" + num
                
                formatted_numbers.append(num)
            
            # Build the request payload with the sms array format
            payload = {
                "userid": self.user_id,
                "password": self.password,
                "sendMethod": "quick",
                "senderid": self.sender_id,
                "msgType": self.msg_type,
                "duplicatecheck": "true",
                "output": "json",
                "sms": [
                    {
                        "mobile": formatted_numbers,
                        "msg": message
                    }
                ]
            }
            
            headers = {"Content-Type": "application/json"}
            
            # Add scheduling if provided
            if 'schedule_time' in kwargs:
                payload["scheduleTime"] = kwargs.get('schedule_time')
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.send_sms_url, json=payload, headers=headers) as response:
                    response_status = response.status
                    response_text = await response.text()
                    
                    try:
                        result = await response.json()
                    except Exception as json_error:
                        return {
                            "success": False,
                            "message": f"Invalid response from Zettatel: {response_text}",
                            "provider": "zettatel",
                            "failed": len(to)
                        }
                    
                    # Check if the API response indicates success
                    success = result.get("status") == "success"
                    
                    # For consistency with other providers
                    total_sent = len(to) if success else 0
                    failed = 0 if success else len(to)
                    
                    return {
                        "success": total_sent > 0,  # Success if at least one message was sent
                        "message": result.get("reason", "Unknown status"),
                        "total": len(to),
                        "successful": total_sent,
                        "failed": failed,
                        "provider": "zettatel",
                        "results": [result]
                    }
                    
        except Exception as e:
            logger.error(f"Error sending bulk SMS via Zettatel: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending bulk SMS: {str(e)}",
                "provider": "zettatel",
                "failed": len(to),
                "successful": 0,
                "total": len(to)
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













