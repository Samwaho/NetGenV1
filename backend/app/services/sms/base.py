from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List

class SMSProvider(ABC):
    """Base class for SMS providers"""
    
    @abstractmethod
    async def send_sms(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send an SMS message to a recipient
        
        Args:
            to: Recipient phone number
            message: Message content
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        pass
    
    @abstractmethod
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients
        
        Args:
            to: List of recipient phone numbers
            message: Message content
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        pass
    
    @abstractmethod
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status of a message
        
        Args:
            message_id: The ID of the message to check
            
        Returns:
            Dict containing status information
        """
        pass

class SMSService:
    """SMS service to handle sending SMS through different providers"""
    
    @staticmethod
    def get_provider(provider_name: str, config: Dict[str, Any]) -> SMSProvider:
        """Factory method to get a specific SMS provider
        
        Args:
            provider_name: Name of the SMS provider (twilio, africas_talking, etc.)
            config: Configuration for the provider
            
        Returns:
            An instance of the specified SMS provider
        """
        from .providers.twilio import TwilioProvider
        from .providers.africas_talking import AfricasTalkingProvider
        from .providers.textsms import TextSMSProvider
        from .providers.zettatel import ZettatelProvider
        from .providers.mock import MockSMSProvider
        
        # Convert provider name to lowercase for case-insensitive match
        provider_name = provider_name.lower()
        
        if provider_name == 'twilio':
            return TwilioProvider(config)
        elif provider_name == 'africas_talking':
            return AfricasTalkingProvider(config)
        elif provider_name == 'textsms':
            return TextSMSProvider(config)
        elif provider_name == 'zettatel':
            return ZettatelProvider(config)
        elif provider_name == 'mock' or provider_name == 'sandbox':
            return MockSMSProvider(config)
        else:
            # Default to mock provider for testing
            return MockSMSProvider(config)

    @staticmethod
    async def send_sms(provider_name: str, config: Dict[str, Any], 
                      to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send an SMS message
        
        Args:
            provider_name: Name of the SMS provider
            config: Configuration for the provider
            to: Recipient phone number
            message: Message content
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        provider = SMSService.get_provider(provider_name, config)
        return await provider.send_sms(to=to, message=message, **kwargs)
    
    @staticmethod
    async def send_bulk_sms(provider_name: str, config: Dict[str, Any],
                           to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients
        
        Args:
            provider_name: Name of the SMS provider
            config: Configuration for the provider
            to: List of recipient phone numbers
            message: Message content
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing status and response details
        """
        provider = SMSService.get_provider(provider_name, config)
        return await provider.send_bulk_sms(to=to, message=message, **kwargs)
    
    @staticmethod
    async def get_delivery_status(provider_name: str, config: Dict[str, Any],
                                 message_id: str) -> Dict[str, Any]:
        """Get delivery status of a message
        
        Args:
            provider_name: Name of the SMS provider
            config: Configuration for the provider
            message_id: The ID of the message to check
            
        Returns:
            Dict containing status information
        """
        provider = SMSService.get_provider(provider_name, config)
        return await provider.get_delivery_status(message_id=message_id) 
