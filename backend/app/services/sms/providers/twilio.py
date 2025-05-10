import logging
from typing import Dict, Any, List
from ..base import SMSProvider

logger = logging.getLogger(__name__)

try:
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioRestException
    TWILIO_AVAILABLE = True
except ImportError:
    logger.warning("Twilio package not installed. Install with 'pip install twilio'")
    TWILIO_AVAILABLE = False

class TwilioProvider(SMSProvider):
    """Twilio SMS provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the Twilio SMS provider
        
        Args:
            config: Provider configuration containing account_sid, auth_token, and from_number
        """
        self.config = config
        
        if not TWILIO_AVAILABLE:
            logger.error("Twilio package not installed. Cannot initialize Twilio provider.")
            return
        
        self.account_sid = config.get('accountSid')
        self.auth_token = config.get('authToken')
        self.from_number = config.get('senderId')
        
        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.error("Missing required Twilio credentials")
            return
        
        try:
            self.client = Client(self.account_sid, self.auth_token)
            logger.info("Initialized Twilio SMS Provider")
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {str(e)}")
            self.client = None
    
    async def send_sms(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send an SMS message using Twilio
        
        Args:
            to: Recipient phone number (E.164 format: +1XXXXXXXXXX)
            message: Message content
            **kwargs: Additional Twilio-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        if not TWILIO_AVAILABLE or not self.client:
            logger.error("Twilio client not available")
            return {
                "success": False,
                "message": "Twilio client not available",
                "provider": "twilio"
            }
        
        try:
            # Ensure phone number is in E.164 format (e.g., +1234567890)
            if not to.startswith('+'):
                to = f"+{to}"
            
            # Create the message
            twilio_message = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to,
                **kwargs
            )
            
            return {
                "success": True,
                "message_id": twilio_message.sid,
                "provider": "twilio",
                "status": twilio_message.status,
                "to": to,
                "cost": twilio_message.price or "0.00"
            }
            
        except TwilioRestException as e:
            logger.error(f"Twilio API error: {str(e)}")
            return {
                "success": False,
                "message": f"Twilio API error: {str(e)}",
                "provider": "twilio",
                "error_code": e.code
            }
        
        except Exception as e:
            logger.error(f"Error sending SMS via Twilio: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending SMS: {str(e)}",
                "provider": "twilio"
            }
    
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients using Twilio
        
        Args:
            to: List of recipient phone numbers
            message: Message content
            **kwargs: Additional Twilio-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        # Twilio doesn't have a native bulk send API for standard SMS,
        # so we send messages individually
        results = []
        failures = 0
        
        for recipient in to:
            result = await self.send_sms(to=recipient, message=message, **kwargs)
            results.append(result)
            if not result.get("success", False):
                failures += 1
        
        return {
            "success": failures == 0,
            "message": f"Sent to {len(results) - failures}/{len(results)} recipients",
            "results": results
        }
    
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status of a message from Twilio
        
        Args:
            message_id: The Twilio message SID
            
        Returns:
            Dict containing status information
        """
        if not TWILIO_AVAILABLE or not self.client:
            logger.error("Twilio client not available")
            return {
                "success": False,
                "message": "Twilio client not available",
                "provider": "twilio"
            }
        
        try:
            message = self.client.messages(message_id).fetch()
            
            return {
                "success": True,
                "message_id": message_id,
                "status": message.status,
                "to": message.to,
                "sent_at": message.date_sent.isoformat() if message.date_sent else None,
                "updated_at": message.date_updated.isoformat() if message.date_updated else None,
                "error_code": message.error_code,
                "error_message": message.error_message
            }
            
        except TwilioRestException as e:
            logger.error(f"Twilio API error: {str(e)}")
            return {
                "success": False,
                "message": f"Twilio API error: {str(e)}",
                "provider": "twilio",
                "error_code": e.code
            }
        
        except Exception as e:
            logger.error(f"Error getting SMS status from Twilio: {str(e)}")
            return {
                "success": False,
                "message": f"Error getting SMS status: {str(e)}",
                "provider": "twilio"
            } 