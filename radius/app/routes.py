from fastapi import APIRouter, HTTPException, Response, Request, Depends
from typing import Dict, Optional, Union
from .models import RadiusProfile, ServiceType
from datetime import datetime, timedelta
from bson import ObjectId
from .config.database import isp_customers, isp_customers_accounting, isp_packages, hotspot_vouchers, hotspot_vouchers_accounting
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

def convert_to_bytes(value, unit="MB"):
    """Convert data value to bytes based on unit"""
    if not value:
        return 0
        
    unit = unit.upper() if unit else "MB"
    multipliers = {
        "B": 1,
        "KB": 1024,
        "MB": 1024 * 1024,
        "GB": 1024 * 1024 * 1024,
        "TB": 1024 * 1024 * 1024 * 1024
    }
    
    return int(float(value) * multipliers.get(unit, multipliers["MB"]))

@router.post("/authorize")
async def radius_authorize(request: Request):
    """FreeRADIUS authorization endpoint"""
    logger.info("Processing authorization request")
    try:
        # Get request data
        body = await get_request_data(request)
        
        # Get username and service info
        username = body.get("username", body.get("User-Name", ""))
        service_type = body.get("service_type", body.get("Service-Type", ""))
        nas_port_type = body.get("nas_port_type", body.get("NAS-Port-Type", ""))
        
        # Check if this is a hotspot login
        is_hotspot = service_type == "Login-User" or nas_port_type == "Wireless-802.11"
        
        if is_hotspot:
            # Handle hotspot voucher authentication
            logger.info(f"Processing hotspot voucher authentication for: {username}")
            
            # Check if username is a valid voucher code
            voucher = await hotspot_vouchers.find_one({"code": username})
            
            if not voucher:
                logger.warning(f"Voucher not found: {username}")
                return format_radius_response({"Reply-Message": "Invalid voucher code"})
            
            # Check if voucher is active
            if voucher.get("status") not in ["active", "in_use"]:
                logger.warning(f"Voucher not active: {username}, status: {voucher.get('status')}")
                return format_radius_response({"Reply-Message": "Voucher is not active"})
            
            # Check if voucher has expired
            if is_expired(voucher.get("expiresAt")):
                logger.warning(f"Voucher expired: {username}")
                return format_radius_response({"Reply-Message": "Voucher has expired"})
            
            # Get package details
            package = await isp_packages.find_one({"_id": voucher.get("packageId")})
            if not package:
                logger.warning(f"Package not found for voucher: {username}")
                return format_radius_response({"Reply-Message": "Invalid package"})
            
            # Build response with CHAP authentication
            reply = {
                "Auth-Type": "CHAP",  # Force CHAP authentication
                "Cleartext-Password": username,  # Use voucher code as password
                "Service-Type": "Login-User",  # Specify service type for hotspot
                "CHAP-Password": username  # Add CHAP-Password attribute
            }
            
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
                serviceType=ServiceType.HOTSPOT,
                addressPool=package.get("addressPool", package.get("address_pool")),
                sessionTimeout=package.get("sessionTimeout", package.get("session_timeout")),
                idleTimeout=package.get("idleTimeout", package.get("idle_timeout")),
                priority=package.get("priority"),
                vlanId=package.get("vlanId", package.get("vlan_id"))
            )
            
            # Add Mikrotik-specific rate limiting
            reply["Mikrotik-Rate-Limit"] = profile.get_rate_limit()
            
            # Add data limit if present
            if voucher.get("dataLimit"):
                data_limit_bytes = convert_to_bytes(
                    voucher.get("dataLimit", 0), 
                    voucher.get("dataLimitUnit", "MB")
                )
                reply["Mikrotik-Total-Limit"] = str(data_limit_bytes)
            
            # Add duration-based session timeout
            if voucher.get("duration"):
                # Calculate session timeout in seconds based on duration and unit
                duration = voucher.get("duration", 0)
                duration_unit = voucher.get("durationUnit", "hours").lower()
                
                if duration_unit == "minutes":
                    session_timeout = duration * 60
                elif duration_unit == "hours":
                    session_timeout = duration * 3600
                elif duration_unit == "days":
                    session_timeout = duration * 86400
                else:  # Default to hours
                    session_timeout = duration * 3600
                
                # If this is the first use, set the full duration
                if voucher.get("status") == "active" and not voucher.get("usedAt"):
                    reply["Session-Timeout"] = str(session_timeout)
                    
                    # Store the session start time and calculated end time
                    now = datetime.utcnow()
                    session_end = now + timedelta(seconds=session_timeout)
                    
                    await hotspot_vouchers.update_one(
                        {"_id": voucher["_id"]},
                        {"$set": {
                            "status": "in_use",
                            "usedAt": now,
                            "sessionStart": now,
                            "sessionEnd": session_end
                        }}
                    )
                    logger.info(f"Started new session for voucher {username}, duration: {duration} {duration_unit}")
                else:
                    # For subsequent logins, calculate remaining time
                    now = datetime.utcnow()
                    session_end = voucher.get("sessionEnd")
                    
                    if session_end:
                        remaining_seconds = max(0, int((session_end - now).total_seconds()))
                        reply["Session-Timeout"] = str(remaining_seconds)
                        logger.info(f"Resuming session for voucher {username}, remaining time: {remaining_seconds} seconds")
                    else:
                        # Fallback if sessionEnd is not set
                        reply["Session-Timeout"] = str(session_timeout)
            
            # Add all other profile attributes
            for attr in profile.to_radius_attributes():
                if attr.name not in reply:
                    reply[attr.name] = attr.value
            
            # Mark voucher as in use if it's the first use
            if voucher.get("status") == "active" and not voucher.get("usedAt"):
                await hotspot_vouchers.update_one(
                    {"_id": voucher["_id"]},
                    {"$set": {"status": "in_use", "usedAt": datetime.utcnow()}}
                )
            
            logger.info(f"Hotspot authorization successful for voucher: {username}")
            return format_radius_response(reply)
        else:
            # Handle regular PPPoE customer authentication (existing code)
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
            
            logger.info(f"PPPoE authorization successful for {username}")
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
            # Check if this is a hotspot voucher
            voucher = await hotspot_vouchers.find_one({"code": username})
            if voucher:
                # For hotspot vouchers, the code is both username and password
                # In CHAP authentication, we need to compare the plain text password
                if username == password:
                    logger.info(f"Hotspot voucher authentication successful: {username}")
                    return Response(status_code=204)
                else:
                    logger.warning(f"Invalid voucher authentication: {username}")
                    return format_radius_response({"Reply-Message": "Invalid voucher"})
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
        
        # Get accounting data
        username = body.get("username", body.get("User-Name", ""))
        acct_status_type = body.get("status", body.get("Acct-Status-Type", ""))
        session_id = body.get("session_id", body.get("Acct-Session-Id", ""))
        session_time = safe_int(body.get("session_time", body.get("Acct-Session-Time", 0)))
        input_octets = safe_int(body.get("input_octets", body.get("Acct-Input-Octets", 0)))
        output_octets = safe_int(body.get("output_octets", body.get("Acct-Output-Octets", 0)))
        input_gigawords = safe_int(body.get("input_gigawords", body.get("Acct-Input-Gigawords", 0)))
        output_gigawords = safe_int(body.get("output_gigawords", body.get("Acct-Output-Gigawords", 0)))
        framed_ip = body.get("framed_ip_address", body.get("Framed-IP-Address", ""))
        nas_ip = body.get("nas_ip_address", body.get("NAS-IP-Address", ""))
        terminate_cause = body.get("terminate_cause", body.get("Acct-Terminate-Cause", ""))
        service_type = body.get("service_type", body.get("Service-Type", ""))
        nas_port_type = body.get("nas_port_type", body.get("NAS-Port-Type", ""))
        nas_port = body.get("nas_port", body.get("NAS-Port", ""))
        nas_identifier = body.get("nas_identifier", body.get("NAS-Identifier", ""))
        mikrotik_rate_limit = body.get("mikrotik_rate_limit", body.get("Mikrotik-Rate-Limit", ""))
        called_station_id = body.get("called_station_id", body.get("Called-Station-Id", ""))
        calling_station_id = body.get("calling_station_id", body.get("Calling-Station-Id", ""))
        
        # Calculate total bytes (handling gigawords)
        input_bytes = input_octets + (input_gigawords * 4294967296)
        output_bytes = output_octets + (output_gigawords * 4294967296)
        total_bytes = input_bytes + output_bytes
        
        logger.info(f"Accounting request for {username}, status: {acct_status_type}, session: {session_id}")
        
        # Check if this is a voucher (hotspot) or regular customer
        voucher = await hotspot_vouchers.find_one({"code": username})
        
        if voucher:
            # This is a hotspot voucher
            if acct_status_type.lower() == "start":
                # Session start - update voucher status if needed
                if voucher.get("status") == "active":
                    await hotspot_vouchers.update_one(
                        {"_id": voucher["_id"]},
                        {"$set": {"status": "in_use", "usedAt": datetime.utcnow()}}
                    )
                    logger.info(f"Marked voucher {username} as in_use")
            
            # Find existing accounting record for this session
            existing_record = await hotspot_vouchers_accounting.find_one({
                "voucherId": voucher["_id"],
                "sessionId": session_id
            })
            
            now = datetime.utcnow()
            
            if existing_record:
                # Calculate delta values
                delta_input = input_bytes - existing_record.get("totalInputBytes", 0)
                delta_output = output_bytes - existing_record.get("totalOutputBytes", 0)
                delta_time = session_time - existing_record.get("sessionTime", 0)
                
                # Update existing record
                update_data = {
                    "acctStatusType": acct_status_type,
                    "sessionTime": session_time,
                    "totalInputBytes": input_bytes,
                    "totalOutputBytes": output_bytes,
                    "totalBytes": total_bytes,
                    "framedIpAddress": framed_ip,
                    "nasIpAddress": nas_ip,
                    "terminateCause": terminate_cause,
                    "serviceType": service_type,
                    "nasPortType": nas_port_type,
                    "nasPort": nas_port,
                    "nasIdentifier": nas_identifier,
                    "mikrotikRateLimit": mikrotik_rate_limit,
                    "calledStationId": called_station_id,
                    "callingStationId": calling_station_id,
                    "deltaInputBytes": delta_input,
                    "deltaOutputBytes": delta_output,
                    "deltaSessionTime": delta_time,
                    "lastUpdate": now,
                    "timestamp": now
                }
                
                # For start status, set startTime
                if acct_status_type.lower() == "start":
                    update_data["startTime"] = now
                
                await hotspot_vouchers_accounting.update_one(
                    {"_id": existing_record["_id"]},
                    {"$set": update_data}
                )
                logger.info(f"Updated accounting record for voucher {username}, session {session_id}")
            else:
                # Create new record
                accounting_data = {
                    "voucherId": voucher["_id"],
                    "code": username,
                    "sessionId": session_id,
                    "acctStatusType": acct_status_type,
                    "sessionTime": session_time,
                    "totalInputBytes": input_bytes,
                    "totalOutputBytes": output_bytes,
                    "totalBytes": total_bytes,
                    "framedIpAddress": framed_ip,
                    "nasIpAddress": nas_ip,
                    "terminateCause": terminate_cause,
                    "serviceType": service_type,
                    "nasPortType": nas_port_type,
                    "nasPort": nas_port,
                    "nasIdentifier": nas_identifier,
                    "mikrotikRateLimit": mikrotik_rate_limit,
                    "calledStationId": called_station_id,
                    "callingStationId": calling_station_id,
                    "deltaInputBytes": input_bytes,
                    "deltaOutputBytes": output_bytes,
                    "deltaSessionTime": session_time,
                    "startTime": now if acct_status_type.lower() == "start" else None,
                    "timestamp": now,
                    "lastUpdate": now
                }
                
                await hotspot_vouchers_accounting.insert_one(accounting_data)
                logger.info(f"Created new accounting record for voucher {username}, session {session_id}")
            
            # Update voucher usage data
            if acct_status_type.lower() in ["stop", "interim-update"]:
                update_data = {}
                
                # Update data usage
                if total_bytes > 0:
                    current_data_used = voucher.get("dataUsed", 0)
                    new_data_used = current_data_used + total_bytes
                    update_data["dataUsed"] = new_data_used
                    
                    # Check if data limit is reached
                    if voucher.get("dataLimit"):
                        data_limit_bytes = convert_to_bytes(
                            voucher.get("dataLimit", 0), 
                            voucher.get("dataLimitUnit", "MB")
                        )
                        
                        if new_data_used >= data_limit_bytes:
                            update_data["status"] = "depleted"
                            logger.info(f"Voucher {username} data limit reached")
                
                # Update session time for duration-based vouchers
                if voucher.get("duration") and session_time > 0:
                    current_time_used = voucher.get("timeUsed", 0)
                    new_time_used = current_time_used + session_time
                    update_data["timeUsed"] = new_time_used
                    
                    # Calculate total duration in seconds
                    duration = voucher.get("duration", 0)
                    duration_unit = voucher.get("durationUnit", "hours").lower()
                    
                    if duration_unit == "minutes":
                        total_duration = duration * 60
                    elif duration_unit == "hours":
                        total_duration = duration * 3600
                    elif duration_unit == "days":
                        total_duration = duration * 86400
                    else:  # Default to hours
                        total_duration = duration * 3600
                    
                    # Check if duration limit is reached
                    if new_time_used >= total_duration:
                        update_data["status"] = "expired"
                        logger.info(f"Voucher {username} duration limit reached")
                
                if update_data:
                    await hotspot_vouchers.update_one(
                        {"_id": voucher["_id"]},
                        {"$set": update_data}
                    )
                    logger.info(f"Updated voucher {username} usage data")
        else:
            # This is a regular PPPoE customer
            customer = await get_customer(username)
            
            if customer:
                now = datetime.utcnow()
                
                if acct_status_type.lower() == "start":
                    # Set customer status to online
                    await update_customer_online_status(customer["_id"], True)
                    logger.info(f"Set customer {username} status to online")
                
                elif acct_status_type.lower() == "stop":
                    # Set customer status to offline
                    await update_customer_online_status(customer["_id"], False)
                    logger.info(f"Set customer {username} status to offline")
                
                # Find existing accounting record for this session
                existing_record = await isp_customers_accounting.find_one({
                    "customerId": customer["_id"],
                    "sessionId": session_id
                })
                
                if existing_record:
                    # Calculate delta values
                    delta_input = input_bytes - existing_record.get("totalInputBytes", 0)
                    delta_output = output_bytes - existing_record.get("totalOutputBytes", 0)
                    delta_time = session_time - existing_record.get("sessionTime", 0)
                    
                    # Update existing record
                    update_data = {
                        "acctStatusType": acct_status_type,
                        "sessionTime": session_time,
                        "totalInputBytes": input_bytes,
                        "totalOutputBytes": output_bytes,
                        "totalBytes": total_bytes,
                        "framedIpAddress": framed_ip,
                        "nasIpAddress": nas_ip,
                        "terminateCause": terminate_cause,
                        "serviceType": service_type,
                        "nasPortType": nas_port_type,
                        "nasPort": nas_port,
                        "nasIdentifier": nas_identifier,
                        "mikrotikRateLimit": mikrotik_rate_limit,
                        "calledStationId": called_station_id,
                        "callingStationId": calling_station_id,
                        "deltaInputBytes": delta_input,
                        "deltaOutputBytes": delta_output,
                        "deltaSessionTime": delta_time,
                        "lastUpdate": now,
                        "timestamp": now
                    }
                    
                    # For start status, set startTime
                    if acct_status_type.lower() == "start":
                        update_data["startTime"] = now
                    
                    await isp_customers_accounting.update_one(
                        {"_id": existing_record["_id"]},
                        {"$set": update_data}
                    )
                    logger.info(f"Updated accounting record for customer {username}, session {session_id}")
                else:
                    # Create new record
                    accounting_data = {
                        "customerId": customer["_id"],
                        "username": username,
                        "sessionId": session_id,
                        "acctStatusType": acct_status_type,
                        "sessionTime": session_time,
                        "totalInputBytes": input_bytes,
                        "totalOutputBytes": output_bytes,
                        "totalBytes": total_bytes,
                        "framedIpAddress": framed_ip,
                        "nasIpAddress": nas_ip,
                        "terminateCause": terminate_cause,
                        "serviceType": service_type,
                        "nasPortType": nas_port_type,
                        "nasPort": nas_port,
                        "nasIdentifier": nas_identifier,
                        "mikrotikRateLimit": mikrotik_rate_limit,
                        "calledStationId": called_station_id,
                        "callingStationId": calling_station_id,
                        "deltaInputBytes": input_bytes,
                        "deltaOutputBytes": output_bytes,
                        "deltaSessionTime": session_time,
                        "startTime": now if acct_status_type.lower() == "start" else None,
                        "timestamp": now,
                        "lastUpdate": now
                    }
                    
                    await isp_customers_accounting.insert_one(accounting_data)
                    logger.info(f"Created new accounting record for customer {username}, session {session_id}")
        
        # Return success
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











