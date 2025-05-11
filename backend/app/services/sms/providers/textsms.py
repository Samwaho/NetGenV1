import logging
import aiohttp
import json
from typing import Dict, Any, List
from ..base import SMSProvider

logger = logging.getLogger(__name__)

class TextSMSProvider(SMSProvider):
    """TextSMS (Kenya) SMS provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the TextSMS provider
        
        Args:
            config: Provider configuration containing apiKey, partnerID, and senderId
        """
        self.config = config
        
        self.api_key = config.get('apiKey')
        self.partner_id = config.get('partnerID')
        self.sender_id = config.get('senderId')  # This is the shortcode in TextSMS
        
        if not all([self.api_key, self.partner_id, self.sender_id]):
            logger.error("Missing required TextSMS credentials (apiKey, partnerID, or senderId)")
            return
        
        # API endpoints
        self.base_url = "https://sms.textsms.co.ke/api/services"
        self.send_sms_url = f"{self.base_url}/sendsms/"
        self.send_bulk_url = f"{self.base_url}/sendbulk/"
        self.get_dlr_url = f"{self.base_url}/getdlr/"
        self.get_balance_url = f"{self.base_url}/getbalance/"
    
    async def send_sms(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Send an SMS message using TextSMS
        
        Args:
            to: Recipient phone number
            message: Message content
            **kwargs: Additional parameters including schedule time
            
        Returns:
            Dict containing status and response details
        """
        try:
            # Ensure phone number format is correct for Kenya (should start with 254)
            if to.startswith('+'):
                to = to[1:]  # Remove the + if present
            
            # Build the request payload
            payload = {
                "apikey": self.api_key,
                "partnerID": self.partner_id,
                "message": message,
                "shortcode": self.sender_id,
                "mobile": to
            }
            
            # Add scheduling if provided
            if 'schedule_time' in kwargs:
                payload["timeToSend"] = kwargs.get('schedule_time')
            
            # Send the request
            async with aiohttp.ClientSession() as session:
                async with session.post(self.send_sms_url, json=payload) as response:
                    response_text = await response.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON response from TextSMS: {response_text}")
                        return {
                            "success": False,
                            "message": f"Invalid response from TextSMS: {response_text}",
                            "provider": "textsms"
                        }
            
            # Process the response
            responses = response_data.get('responses', [])
            if not responses:
                return {
                    "success": False,
                    "message": "No response data returned",
                    "provider": "textsms",
                    "raw_response": response_data
                }
            
            sms_response = responses[0]
            # Note the typo in their API ('respose-code') and check both possible spellings
            response_code = sms_response.get('respose-code', sms_response.get('response-code'))
            success = response_code == 200
            
            return {
                "success": success,
                "message": sms_response.get('response-description', 'Unknown status'),
                "message_id": sms_response.get('messageid'),
                "provider": "textsms",
                "status": "sent" if success else "failed",
                "to": sms_response.get('mobile'),
                "network_id": sms_response.get('networkid'),
                "raw_response": sms_response
            }
            
        except Exception as e:
            logger.error(f"Error sending SMS via TextSMS: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending SMS: {str(e)}",
                "provider": "textsms"
            }
    
    async def send_bulk_sms(self, to: List[str], message: str, **kwargs) -> Dict[str, Any]:
        """Send SMS messages to multiple recipients using TextSMS"""
        try:
            # TextSMS supports native bulk sending through their API
            sms_list = []
            
            for recipient in to:
                # Ensure phone number format is correct
                if recipient.startswith('+'):
                    recipient = recipient[1:]  # Remove the + if present
                
                sms_item = {
                    "apikey": self.api_key,
                    "partnerID": self.partner_id,
                    "message": message,
                    "shortcode": self.sender_id,
                    "mobile": recipient,
                    "pass_type": "plain"
                }
                
                # Add scheduling if provided
                if 'schedule_time' in kwargs:
                    sms_item["timeToSend"] = kwargs.get('schedule_time')
                
                sms_list.append(sms_item)
            
            # Build the bulk request payload
            payload = {
                "count": len(sms_list),
                "smslist": sms_list
            }
            
            # Send the bulk request
            async with aiohttp.ClientSession() as session:
                async with session.post(self.send_bulk_url, json=payload) as response:
                    response_text = await response.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON response from TextSMS: {response_text}")
                        return {
                            "success": False,
                            "message": f"Invalid response from TextSMS: {response_text}",
                            "provider": "textsms"
                        }
            
            # Process the response
            responses = response_data.get('responses', [])
            
            if not responses:
                return {
                    "success": False,
                    "message": "No response data returned",
                    "provider": "textsms",
                    "raw_response": response_data
                }
            
            # Count successful and failed messages
            successful = 0
            failed = 0
            results = []
            
            for response in responses:
                # Note the typo in their API ('respose-code')
                response_code = response.get('respose-code', response.get('response-code'))
                is_success = response_code == 200
                
                if is_success:
                    successful += 1
                else:
                    failed += 1
                
                results.append({
                    "success": is_success,
                    "message": response.get('response-description', 'Unknown status'),
                    "message_id": response.get('messageid'),
                    "to": response.get('mobile'),
                    "network_id": response.get('networkid'),
                    "client_sms_id": response.get('clientsmsid')
                })
            
            # Consider it a success if at least one message was sent successfully
            overall_success = successful > 0
            
            return {
                "success": overall_success,
                "message": f"Sent {successful}/{len(to)} messages successfully",
                "provider": "textsms",
                "total": len(to),
                "successful": successful,
                "failed": failed,
                "results": results,
                "responses": responses  # Include original responses for debugging
            }
            
        except Exception as e:
            logger.error(f"Error sending bulk SMS via TextSMS: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending bulk SMS: {str(e)}",
                "provider": "textsms",
                "failed": len(to),
                "successful": 0,
                "total": len(to)
            }
    
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status of a message from TextSMS
        
        Args:
            message_id: The message ID
            
        Returns:
            Dict containing status information
        """
        try:
            # Build the request payload
            payload = {
                "apikey": self.api_key,
                "partnerID": self.partner_id,
                "messageID": message_id
            }
            
            # Send the request
            async with aiohttp.ClientSession() as session:
                async with session.post(self.get_dlr_url, json=payload) as response:
                    response_text = await response.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON response from TextSMS: {response_text}")
                        return {
                            "success": False,
                            "message": f"Invalid response from TextSMS: {response_text}",
                            "provider": "textsms"
                        }
            
            # TextSMS doesn't document their delivery report response format,
            # so we'll return the raw response and process it based on common patterns
            if response_data.get('respose-code') == 200 or response_data.get('status') == 'success':
                return {
                    "success": True,
                    "message_id": message_id,
                    "status": response_data.get('status', 'unknown'),
                    "provider": "textsms",
                    "raw_response": response_data
                }
            else:
                return {
                    "success": False,
                    "message": response_data.get('message', 'Failed to get delivery status'),
                    "provider": "textsms",
                    "raw_response": response_data
                }
            
        except Exception as e:
            logger.error(f"Error getting SMS delivery status from TextSMS: {str(e)}")
            return {
                "success": False,
                "message": f"Error getting SMS delivery status: {str(e)}",
                "provider": "textsms"
            }
    
    async def get_balance(self) -> Dict[str, Any]:
        """Get account balance from TextSMS
        
        Returns:
            Dict containing balance information
        """
        try:
            # Build the request payload
            payload = {
                "apikey": self.api_key,
                "partnerID": self.partner_id
            }
            
            # Send the request
            async with aiohttp.ClientSession() as session:
                async with session.post(self.get_balance_url, json=payload) as response:
                    response_text = await response.text()
                    try:
                        response_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON response from TextSMS: {response_text}")
                        return {
                            "success": False,
                            "message": f"Invalid response from TextSMS: {response_text}",
                            "provider": "textsms"
                        }
            
            # Process the response based on their API
            return {
                "success": True,
                "balance": response_data.get('balance'),
                "provider": "textsms",
                "raw_response": response_data
            }
            
        except Exception as e:
            logger.error(f"Error getting account balance from TextSMS: {str(e)}")
            return {
                "success": False,
                "message": f"Error getting account balance: {str(e)}",
                "provider": "textsms"
            } 
