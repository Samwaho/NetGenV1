from fastapi import APIRouter, HTTPException, Response, Request, Depends
from typing import Dict, Optional, Union
from .models import RadiusProfile, ServiceType
from datetime import datetime, timedelta
from bson import ObjectId
from .config.database import isp_customers, isp_customers_accounting, isp_packages
import logging
import json
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("radius_routes")

router = APIRouter(prefix="/radius", tags=["radius"])

# FreeRADIUS expects attributes in specific format
CONTROL_ATTRS = {
    "Cleartext-Password",
    "NT-Password",
    "LM-Password",
    "Password-With-Header",
    "Auth-Type"
}

# Define RADIUS accounting status types
class AccountingStatusType:
    START = "Start"
    STOP = "Stop"
    INTERIM_UPDATE = "Interim-Update"
    ACCOUNTING_ON = "Accounting-On"
    ACCOUNTING_OFF = "Accounting-Off"

def format_radius_response(data: Dict) -> Dict:
    """Format response according to FreeRADIUS REST module specs"""
    response = {}
    
    for key, value in data.items():
        prefix = "control:" if key in CONTROL_ATTRS else "reply:"
        if isinstance(value, dict):
            response[f"{prefix}{key}"] = value
        else:
            response[f"{prefix}{key}"] = {"value": [str(value)], "op": ":="}
    
    return response

async def get_request_data(request: Request) -> Dict:
    """Extract data from request (JSON or form)"""
    try:
        return await request.json()
    except:
        try:
            form = await request.form()
            return dict(form)
        except:
            return {}

async def get_customer(username: str) -> Optional[Dict]:
    """Get customer by username with validation"""
    if not username:
        logger.warning("No username provided")
        return None
        
    logger.info(f"Looking up customer: {username}")
    return await isp_customers.find_one({"username": username})

async def update_customer_online_status(customer_id, is_online: bool):
    """Update customer online status (only field in customer model)"""
    result = await isp_customers.update_one(
        {"_id": customer_id},
        {"$set": {"online": is_online}}
    )
    
    return result.modified_count > 0

def is_expired(expiry_date) -> bool:
    """Check if date is expired"""
    if not expiry_date:
        return False
        
    current_time = datetime.utcnow()
    
    if isinstance(expiry_date, str):
        try:
            expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        except ValueError:
            try:
                expiry_date = datetime.fromisoformat(expiry_date)
            except:
                logger.error(f"Invalid expiry date format: {expiry_date}")
                return False
    
    return current_time > expiry_date

def safe_int(value, default=0) -> int:
    """Safely convert value to int, return default if empty or invalid"""
    if not value or value == "":
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def map_service_type(service_type_str: str) -> Optional[ServiceType]:
    """Map service type string to ServiceType enum"""
    if not service_type_str:
        return ServiceType.PPPOE  # Default value
        
    # Convert to lowercase for case-insensitive comparison
    service_type_lower = service_type_str.lower()
    
    # Map to enum values
    mapping = {
        "pppoe": ServiceType.PPPOE,
        "hotspot": ServiceType.HOTSPOT,
        "static": ServiceType.STATIC,
        "dhcp": ServiceType.DHCP
    }
    
    # Return mapped value or default
    return mapping.get(service_type_lower, ServiceType.PPPOE)

@router.post("/authorize")
async def radius_authorize(request: Request):
    """FreeRADIUS authorization endpoint"""
    logger.info("Processing authorization request")
    
    try:
        # Get request data
        body = await get_request_data(request)
        
        # Get username from various possible sources
        username = body.get("username", body.get("User-Name", ""))
        
        # Get additional RADIUS fields
        service_type = body.get("service_type", body.get("Service-Type", ""))
        nas_port_type = body.get("nas_port_type", body.get("NAS-Port-Type", ""))
        nas_port = body.get("nas_port", body.get("NAS-Port", ""))
        nas_identifier = body.get("nas_identifier", body.get("NAS-Identifier", ""))
        nas_ip = body.get("nas_ip_address", body.get("NAS-IP-Address", ""))
        called_station = body.get("called_station_id", body.get("Called-Station-Id", ""))
        calling_station = body.get("calling_station_id", body.get("Calling-Station-Id", ""))
        
        logger.debug(f"RADIUS fields - Service-Type: {service_type}, NAS-Port-Type: {nas_port_type}, NAS-Port: {nas_port}, NAS-Identifier: {nas_identifier}, NAS-IP: {nas_ip}, Called-Station: {called_station}, Calling-Station: {calling_station}")
        
        # Find customer
        customer = await get_customer(username)
        if not customer:
            return format_radius_response({"Reply-Message": "Login invalid"})
        
        # Check if customer is active
        if customer.get("status") != "ACTIVE":
            logger.warning(f"Customer {username} not active. Status: {customer.get('status')}")
            return format_radius_response({"Reply-Message": "Login disabled"})
        
        # Check if customer's package has expired
        if is_expired(customer.get("expirationDate")):
            logger.warning(f"Customer {username} package expired")
            return format_radius_response({"Reply-Message": "Access time expired"})

        # Build response
        reply = {
            "Cleartext-Password": customer["password"]
        }
        
        # If customer has a package, get package details
        if customer.get("packageId"):
            package = await isp_packages.find_one({"_id": ObjectId(customer["packageId"])})
            if package:
                # Get service type with proper case handling
                service_type_raw = package.get("serviceType", package.get("service_type", "PPPOE"))
                service_type = map_service_type(service_type_raw)
                
                # Convert package to RadiusProfile
                profile = RadiusProfile(
                    name=package.get("name", "default"),
                    downloadSpeed=package.get("downloadSpeed", package.get("download_speed", 0)),
                    uploadSpeed=package.get("uploadSpeed", package.get("upload_speed", 0)),
                    burstDownload=package.get("burstDownload", package.get("burst_download")),
                    burstUpload=package.get("burstUpload", package.get("burst_upload")),
                    thresholdDownload=package.get("thresholdDownload", package.get("threshold_download")),
                    thresholdUpload=package.get("thresholdUpload", package.get("threshold_upload")),
                    burstTime=package.get("burstTime", package.get("burst_time")),
                    serviceType=service_type,
                    addressPool=package.get("addressPool", package.get("address_pool")),
                    sessionTimeout=package.get("sessionTimeout", package.get("session_timeout")),
                    idleTimeout=package.get("idleTimeout", package.get("idle_timeout")),
                    priority=package.get("priority"),
                    vlanId=package.get("vlanId", package.get("vlan_id"))
                )
                
                # Add Mikrotik-specific rate limiting
                reply["Mikrotik-Rate-Limit"] = profile.get_rate_limit()
                
                # Add all other profile attributes
                for attr in profile.to_radius_attributes():
                    if attr.name not in reply:
                        reply[attr.name] = attr.value
            else:
                logger.warning(f"Package not found for customer {username}: {customer['packageId']}")
        
        logger.info(f"Authorization successful for {username}")
        return format_radius_response(reply)
    except Exception as e:
        logger.error(f"Authorization error: {str(e)}")
        # Return a basic response that won't break FreeRADIUS
        return format_radius_response({"Reply-Message": "Internal server error"})

@router.post("/auth")
async def radius_authenticate(request: Request):
    """FreeRADIUS authentication endpoint"""
    logger.info("Processing authentication request")
    
    try:
        # Get request data
        body = await get_request_data(request)
        
        # Get credentials
        username = body.get("username", body.get("User-Name", ""))
        password = body.get("password", body.get("User-Password", ""))
        
        if not username or not password:
            logger.warning("Missing username or password")
            return format_radius_response({"Reply-Message": "Login invalid"})
        
        # Find customer
        customer = await get_customer(username)
        if not customer:
            return format_radius_response({"Reply-Message": "Login invalid"})
        
        # Check password
        if customer["password"] != password:
            logger.warning(f"Invalid password for customer: {username}")
            return format_radius_response({"Reply-Message": "Wrong Password"})
        
        # Check if customer's package has expired
        if is_expired(customer.get("expirationDate")):
            logger.warning(f"Customer {username} package expired")
            return format_radius_response({"Reply-Message": "Access time expired"})
        
        # Set customer status to online (only update the online field)
        await update_customer_online_status(customer["_id"], True)
        logger.info(f"Set customer {username} status to online")
        
        # Return empty response with 204 status code (success)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        return format_radius_response({"Reply-Message": "Internal server error"})

@router.post("/accounting")
async def radius_accounting(request: Request):
    """FreeRADIUS accounting endpoint"""
    try:
        # Get request data
        body = await get_request_data(request)
        logger.info(f"Received accounting data type: {type(body).__name__}")
        
        # Get required fields - use empty strings as defaults
        username = body.get("username", body.get("User-Name", ""))
        session_id = body.get("session_id", body.get("Acct-Session-Id", ""))
        status = body.get("status", body.get("Acct-Status-Type", ""))
        nas_ip = body.get("nas_ip_address", body.get("NAS-IP-Address", ""))
        
        # Get additional RADIUS fields
        service_type = body.get("service_type", body.get("Service-Type", ""))
        nas_port_type = body.get("nas_port_type", body.get("NAS-Port-Type", ""))
        nas_port = body.get("nas_port", body.get("NAS-Port", ""))
        nas_identifier = body.get("nas_identifier", body.get("NAS-Identifier", ""))
        mikrotik_rate_limit = body.get("mikrotik_rate_limit", body.get("Mikrotik-Rate-Limit", ""))
        called_station = body.get("called_station_id", body.get("Called-Station-Id", ""))
        calling_station = body.get("calling_station_id", body.get("Calling-Station-Id", ""))
        
        logger.debug(f"RADIUS fields - Service-Type: {service_type}, NAS-Port-Type: {nas_port_type}, NAS-Port: {nas_port}, NAS-Identifier: {nas_identifier}, Mikrotik-Rate-Limit: {mikrotik_rate_limit}, Called-Station: {called_station}, Calling-Station: {calling_station}")
        
        # Log basic request info
        logger.info(f"Accounting: user={username}, status={status}")
        
        # Handle NAS status changes (Accounting-On/Off)
        if status == AccountingStatusType.ACCOUNTING_ON:
            logger.info(f"Received Accounting-On from NAS {nas_ip}")
            return Response(status_code=204)
            
        if status == AccountingStatusType.ACCOUNTING_OFF:
            logger.info(f"Received Accounting-Off from NAS {nas_ip}")
            return Response(status_code=204)
        
        # For user-specific packets, we need a username
        if not username:
            logger.error("Missing username in accounting request")
            return Response(status_code=204)  # Return success to avoid FreeRADIUS retries
            
        if not session_id:
            # Generate a dummy session ID if missing
            logger.warning(f"Missing session ID for user {username}, using timestamp")
            session_id = f"auto-{int(datetime.utcnow().timestamp())}"
            
        if not status:
            # Default to Interim-Update if status is missing
            logger.warning(f"Missing accounting status for user {username}, using Interim-Update")
            status = AccountingStatusType.INTERIM_UPDATE
        
        # Get current time
        current_time = datetime.utcnow()
        
        # Get customer details
        customer = await get_customer(username)
        if not customer:
            logger.error(f"Customer not found for accounting: {username}")
            return Response(status_code=204)  # Return success to avoid FreeRADIUS retries
        
        # Calculate usage metrics
        session_time = safe_int(body.get("Acct-Session-Time", body.get("session_time", 0)))
        input_octets = safe_int(body.get("Acct-Input-Octets", body.get("input_octets", 0)))
        output_octets = safe_int(body.get("Acct-Output-Octets", body.get("output_octets", 0)))
        input_gigawords = safe_int(body.get("Acct-Input-Gigawords", body.get("input_gigawords", 0)))
        output_gigawords = safe_int(body.get("Acct-Output-Gigawords", body.get("output_gigawords", 0)))
        
        # Calculate total bytes (including gigawords)
        total_input = (input_gigawords * (2**32)) + input_octets
        total_output = (output_gigawords * (2**32)) + output_octets
        
        # Prepare essential accounting data
        accounting_data = {
            "username": username,
            "customerId": str(customer["_id"]),
            "sessionId": session_id,
            "status": status,
            "timestamp": current_time,
            "lastUpdate": current_time,
            "sessionTime": session_time,
            "totalInputBytes": total_input,
            "totalOutputBytes": total_output,
            "totalBytes": total_input + total_output,
            "framedIpAddress": body.get("Framed-IP-Address", body.get("framed_ip_address", "")),
            "nasIpAddress": nas_ip,
            "terminateCause": body.get("Acct-Terminate-Cause", body.get("terminate_cause", "")),
            "serviceType": service_type,
            "nasPortType": nas_port_type,
            "nasPort": nas_port,
            "nasIdentifier": nas_identifier,
            "mikrotikRateLimit": mikrotik_rate_limit,
            "calledStationId": called_station,
            "callingStationId": calling_station
        }
        
        # Find existing accounting record for this user
        existing_record = await isp_customers_accounting.find_one({
            "username": username,
            "type": {"$ne": "session_summary"}  # Exclude session summary records
        })
        
        if existing_record:
            # Calculate delta values for incremental updates
            delta_input = total_input - existing_record.get("totalInputBytes", 0)
            delta_output = total_output - existing_record.get("totalOutputBytes", 0)
            delta_time = session_time - existing_record.get("sessionTime", 0)
            
            # Update existing record
            result = await isp_customers_accounting.update_one(
                {"username": username, "type": {"$ne": "session_summary"}},
                {
                    "$set": {
                        **accounting_data,
                        "lastUpdate": current_time
                    },
                    "$inc": {
                        "deltaInputBytes": delta_input,
                        "deltaOutputBytes": delta_output,
                        "deltaSessionTime": delta_time
                    }
                }
            )
            logger.info(f"Updated existing accounting record for {username}")
        else:
            # Create new record with initial values
            accounting_data.update({
                "deltaInputBytes": total_input,
                "deltaOutputBytes": total_output,
                "deltaSessionTime": session_time,
                "startTime": current_time - timedelta(seconds=session_time)
            })
            
            result = await isp_customers_accounting.insert_one(accounting_data)
            logger.info(f"Created new accounting record for {username}")
        
        # Handle session summary updates
        if status == AccountingStatusType.STOP:
            # Calculate session start time
            session_start_time = current_time - timedelta(seconds=session_time)
            
            # Update session summary
            await isp_customers_accounting.update_one(
                {"username": username, "type": "session_summary"},
                {
                    "$set": {
                        "username": username,
                        "customerId": str(customer["_id"]),
                        "lastSeen": current_time,
                        "lastSessionId": session_id,
                        "lastSession": {
                            "startTime": session_start_time,
                            "endTime": current_time,
                            "duration": session_time,
                            "inputBytes": total_input,
                            "outputBytes": total_output,
                            "framedIp": accounting_data["framedIpAddress"],
                            "terminateCause": accounting_data["terminateCause"],
                            "nasIpAddress": nas_ip,
                            "serviceType": service_type,
                            "nasPortType": nas_port_type,
                            "nasPort": nas_port,
                            "nasIdentifier": nas_identifier,
                            "mikrotikRateLimit": mikrotik_rate_limit,
                            "calledStationId": called_station,
                            "callingStationId": calling_station
                        }
                    },
                    "$inc": {
                        "totalSessions": 1,
                        "totalOnlineTime": session_time,
                        "totalInputBytes": total_input,
                        "totalOutputBytes": total_output
                    }
                },
                upsert=True
            )
            
            # Mark customer as offline (only update the online field)
            await update_customer_online_status(customer["_id"], False)
            logger.info(f"Set customer {username} status to offline (Stop packet)")
        
        else:  # START or INTERIM_UPDATE
            # Mark customer as online (only update the online field)
            await update_customer_online_status(customer["_id"], True)
            logger.info(f"Updated customer {username} online status (packet type: {status})")
        
        return Response(status_code=204)
        
    except Exception as e:
        logger.error(f"Error processing accounting request: {str(e)}")
        return Response(status_code=204)  # Return success to avoid FreeRADIUS retries

@router.post("/post-auth")
async def radius_post_auth(request: Request):
    """FreeRADIUS post-auth endpoint"""
    try:
        body = await get_request_data(request)
        username = body.get("username", body.get("User-Name", "unknown"))
        logger.info(f"Post-auth request for user: {username}")
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"Error processing post-auth request: {str(e)}")
        return Response(status_code=204)  # Return success to avoid FreeRADIUS retries 