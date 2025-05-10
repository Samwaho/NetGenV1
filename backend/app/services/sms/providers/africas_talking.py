import logging
from typing import Dict, Any, List
from ..base import SMSProvider

logger = logging.getLogger(__name__)

try:
    import africastalking
    AFRICAS_TALKING_AVAILABLE = True
except ImportError:
    logger.warning("AfricasTalking package not installed. Install with 'pip install africastalking'")
    AFRICAS_TALKING_AVAILABLE = False

class AfricasTalkingProvider(SMSProvider):
    """AfricasTalking SMS provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the AfricasTalking SMS provider
        
        Args:
            config: Provider configuration containing username and api_key
        """
        self.config = config
        
        if not AFRICAS_TALKING_AVAILABLE:
            logger.error("AfricasTalking package not installed. Cannot initialize provider.")
            return
        
        self.username = config.get('username')
        self.api_key = config.get('apiKey')
        self.sender_id = config.get('senderId')
        
        if not all([self.username, self.api_key]):
            logger.error("Missing required AfricasTalking credentials")
            return
        
        try:
            # Initialize the SDK
            africastalking.initialize(self.username, self.api_key)
            self.sms = africastalking.SMS
            logger.info("Initialized AfricasTalking SMS Provider")
        except Exception as e:
            logger.error(f"Failed to initialize AfricasTalking client: {str(e)}")
            self.sms = None
    
    async def send_sms(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send an SMS message using AfricasTalking
        
        Args:
            to: Recipient phone number
            message: Message content
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        if not AFRICAS_TALKING_AVAILABLE or not self.sms:
            logger.error("AfricasTalking client not available")
            return {
                "success": False,
                "message": "AfricasTalking client not available",
                "provider": "africas_talking"
            }
        
        try:
            # Format the recipient properly - AT prefers numbers with country code without +
            # If it starts with +, remove it
            if to.startswith('+'):
                to = to[1:]
            
            sender_id = kwargs.get('from', self.sender_id)
            
            # Send the message
            response = self.sms.send(
                message=message,
                recipients=[to],
                sender_id=sender_id
            )
            
            # Extract the message data
            message_data = response.get('SMSMessageData', {})
            recipients = message_data.get('Recipients', [])
            
            if not recipients:
                return {
                    "success": False,
                    "message": "No recipient data returned",
                    "provider": "africas_talking",
                    "raw_response": response
                }
            
            recipient = recipients[0]
            
            return {
                "success": recipient.get('status') == 'Success',
                "message_id": recipient.get('messageId'),
                "provider": "africas_talking",
                "status": recipient.get('status'),
                "to": recipient.get('number'),
                "cost": recipient.get('cost')
            }
            
        except Exception as e:
            logger.error(f"Error sending SMS via AfricasTalking: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending SMS: {str(e)}",
                "provider": "africas_talking"
            }
    
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients using AfricasTalking
        
        Args:
            to: List of recipient phone numbers
            message: Message content
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        if not AFRICAS_TALKING_AVAILABLE or not self.sms:
            logger.error("AfricasTalking client not available")
            return {
                "success": False,
                "message": "AfricasTalking client not available",
                "provider": "africas_talking"
            }
        
        try:
            # Format recipients properly - AT prefers numbers with country code without +
            recipients = [r[1:] if r.startswith('+') else r for r in to]
            
            sender_id = kwargs.get('from', self.sender_id)
            
            # Send the message
            response = self.sms.send(
                message=message,
                recipients=recipients,
                sender_id=sender_id
            )
            
            # Extract the message data
            message_data = response.get('SMSMessageData', {})
            recipients_response = message_data.get('Recipients', [])
            
            successful = 0
            failed = 0
            for recipient in recipients_response:
                if recipient.get('status') == 'Success':
                    successful += 1
                else:
                    failed += 1
            
            return {
                "success": failed == 0,
                "message": f"Sent to {successful}/{len(recipients)} recipients",
                "provider": "africas_talking",
                "total": len(recipients),
                "successful": successful,
                "failed": failed,
                "raw_response": recipients_response
            }
            
        except Exception as e:
            logger.error(f"Error sending bulk SMS via AfricasTalking: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending bulk SMS: {str(e)}",
                "provider": "africas_talking"
            }
    
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status of a message from AfricasTalking
        
        Args:
            message_id: The message ID
            
        Returns:
            Dict containing status information
        """
        # Unfortunately, AfricasTalking doesn't provide a direct way to check
        # message status by ID in their API. Delivery reports are handled through
        # callbacks instead. We'll return a generic response.
        
        return {
            "success": False,
            "message": "AfricasTalking doesn't support direct status checks. Use delivery report callbacks.",
            "provider": "africas_talking"
        } 