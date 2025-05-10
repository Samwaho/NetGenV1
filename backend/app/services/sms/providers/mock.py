import uuid
import logging
from typing import Dict, Any, List
from ..base import SMSProvider

logger = logging.getLogger(__name__)

class MockSMSProvider(SMSProvider):
    """Mock SMS provider for testing"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the mock SMS provider
        
        Args:
            config: Provider configuration
        """
        self.config = config
        self.messages = {}  # Store sent messages for testing
        logger.info("Initialized Mock SMS Provider")
    
    async def send_sms(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send a mock SMS message
        
        Args:
            to: Recipient phone number
            message: Message content
            **kwargs: Additional parameters
            
        Returns:
            Dict containing status and response details
        """
        message_id = str(uuid.uuid4())
        
        # Log the message for debugging
        logger.info(f"MOCK SMS to {to}: {message}")
        
        # Store message for later retrieval
        self.messages[message_id] = {
            "to": to,
            "message": message,
            "status": "sent",
            "params": kwargs
        }
        
        return {
            "success": True,
            "message_id": message_id,
            "provider": "mock",
            "status": "sent",
            "to": to,
            "cost": "0.00"
        }
    
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send mock SMS messages to multiple recipients
        
        Args:
            to: List of recipient phone numbers
            message: Message content
            **kwargs: Additional parameters
            
        Returns:
            Dict containing status and response details
        """
        results = []
        
        for recipient in to:
            result = await self.send_sms(to=recipient, message=message, **kwargs)
            results.append(result)
        
        return {
            "success": True,
            "message": f"Sent to {len(results)} recipients",
            "results": results
        }
    
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get mock delivery status of a message
        
        Args:
            message_id: The ID of the message to check
            
        Returns:
            Dict containing status information
        """
        if message_id in self.messages:
            return {
                "success": True,
                "message_id": message_id,
                "status": "delivered",
                "delivered_at": "2023-08-01T12:00:00Z"
            }
        
        return {
            "success": False,
            "message": "Message not found",
            "status": "unknown"
        } 