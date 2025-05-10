import logging
from fastapi import APIRouter, Request, Depends, HTTPException, Path
from app.config.database import organizations
from app.config.utils import record_activity
from bson.objectid import ObjectId
import json

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/callback/{organization_id}")
async def sms_callback(
    request: Request,
    organization_id: str = Path(..., description="Organization ID")
):
    """Handle SMS delivery report callbacks from various providers
    
    This endpoint accepts webhook callbacks from SMS providers to update message delivery statuses.
    Each provider has its own callback format, so we detect the provider from request headers 
    or payload and process accordingly.
    """
    try:
        # Get organization to check provider
        organization = await organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        if not organization.get("smsConfig"):
            raise HTTPException(status_code=400, detail="Organization has no SMS configuration")
        
        provider = organization["smsConfig"].get("provider", "").lower()
        
        # Get the request data
        body = await request.body()
        
        # Log the callback for debugging
        logger.info(f"SMS callback from {provider} for organization {organization_id}")
        logger.debug(f"SMS callback headers: {request.headers}")
        logger.debug(f"SMS callback body: {body.decode('utf-8')}")
        
        if provider == "twilio":
            return await handle_twilio_callback(request, organization_id)
        elif provider == "africas_talking":
            return await handle_africas_talking_callback(request, organization_id)
        elif provider == "textsms":
            return await handle_textsms_callback(request, organization_id)
        else:
            # For unknown providers, just log the payload
            try:
                json_data = await request.json()
                logger.info(f"SMS callback data: {json_data}")
                return {"success": True, "message": "Callback received but provider is unknown"}
            except:
                # If not JSON, try to get form data
                form_data = await request.form()
                logger.info(f"SMS callback form data: {form_data}")
                return {"success": True, "message": "Callback received but provider is unknown"}
    except Exception as e:
        logger.error(f"Error processing SMS callback: {str(e)}")
        return {"success": False, "error": str(e)}

async def handle_twilio_callback(request: Request, organization_id: str):
    """Handle Twilio delivery report callback"""
    try:
        form_data = await request.form()
        message_sid = form_data.get("MessageSid")
        message_status = form_data.get("MessageStatus")
        to = form_data.get("To")
        
        logger.info(f"Twilio message {message_sid} to {to} status: {message_status}")
        
        # Here you would update your database with the message status
        # For example, if you have a SMS messages collection:
        # await sms_messages.update_one(
        #     {"provider_id": message_sid},
        #     {"$set": {"status": message_status}}
        # )
        
        return {
            "success": True,
            "message": "Twilio callback processed",
            "status": message_status
        }
    except Exception as e:
        logger.error(f"Error processing Twilio callback: {str(e)}")
        return {"success": False, "error": str(e)}

async def handle_africas_talking_callback(request: Request, organization_id: str):
    """Handle AfricasTalking delivery report callback"""
    try:
        form_data = await request.form()
        
        # AfricasTalking delivery reports include these fields
        message_id = form_data.get("id")
        status = form_data.get("status")
        phone_number = form_data.get("phoneNumber")
        
        logger.info(f"AfricasTalking message {message_id} to {phone_number} status: {status}")
        
        # Here you would update your database with the message status
        # For example, if you have a SMS messages collection:
        # await sms_messages.update_one(
        #     {"provider_id": message_id},
        #     {"$set": {"status": status}}
        # )
        
        return {
            "success": True,
            "message": "AfricasTalking callback processed",
            "status": status
        }
    except Exception as e:
        logger.error(f"Error processing AfricasTalking callback: {str(e)}")
        return {"success": False, "error": str(e)}

async def handle_textsms_callback(request: Request, organization_id: str):
    """Handle TextSMS delivery report callback"""
    try:
        # TextSMS can send callbacks in various formats, we'll try to handle them all
        try:
            # Try JSON format first
            json_data = await request.json()
            message_id = json_data.get("messageid") or json_data.get("messageId")
            status = json_data.get("status")
            phone_number = json_data.get("mobile") or json_data.get("phoneNumber")
        except:
            # If not JSON, try form data
            form_data = await request.form()
            message_id = form_data.get("messageid") or form_data.get("messageId")
            status = form_data.get("status")
            phone_number = form_data.get("mobile") or form_data.get("phoneNumber")
        
        logger.info(f"TextSMS message {message_id} to {phone_number} status: {status}")
        
        # Here you would update your database with the message status
        # For example, if you have a SMS messages collection:
        # await sms_messages.update_one(
        #     {"provider_id": message_id},
        #     {"$set": {"status": status}}
        # )
        
        return {
            "success": True,
            "message": "TextSMS callback processed",
            "status": status
        }
    except Exception as e:
        logger.error(f"Error processing TextSMS callback: {str(e)}")
        return {"success": False, "error": str(e)} 