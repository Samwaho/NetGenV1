from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from datetime import datetime
from typing import Dict, Any, Optional, Union
from app.models import AuthorizeRequest, AuthenticateRequest, AccountingRequest, RadiusResponse, IspManagerPackageType, IspManagerCustomerStatus
from app.config.database import isp_customers, isp_customers_accounting, connect_to_database

from bson.objectid import ObjectId
import secrets
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("radius_api")

# Set up router
router = APIRouter(prefix="/api/radius", tags=["radius"])
security = HTTPBasic()

# Helper functions
def ensure_object_id(id_value: Union[str, ObjectId]) -> ObjectId:
    """
    Ensures that an ID is an ObjectId instance
    
    Args:
        id_value: ID value that could be a string or ObjectId
        
    Returns:
        ObjectId instance
    """
    if isinstance(id_value, ObjectId):
        return id_value
    
    if isinstance(id_value, str) and ObjectId.is_valid(id_value):
        return ObjectId(id_value)
    
    # If we can't convert it, return it as is and let MongoDB handle any errors
    return id_value

async def get_customer_by_username(username: str):
    """Get customer by username"""
    return await isp_customers.find_one({"username": username})

async def verify_credentials(username: str, password: str) -> bool:
    """Verify username and password"""
    customer = await get_customer_by_username(username)
    if not customer:
        return False
    return secrets.compare_digest(customer.get("password", ""), password)

async def check_customer_status(customer: Dict[str, Any]) -> Optional[str]:
    """
    Check if customer is active and not expired
    Returns error message if customer is not valid, None otherwise
    """
    if not customer:
        return "Customer not found"
    
    if customer.get("status") != IspManagerCustomerStatus.ACTIVE.value:
        return "Customer account is not active"
    
    expiration_date = customer.get("expirationDate")
    if expiration_date and expiration_date < datetime.now():
        return "Customer account has expired"
    
    return None

async def get_radius_attributes(customer: Dict[str, Any]) -> Dict[str, Any]:
    """Get RADIUS attributes based on customer package"""
    # Default attributes
    attributes = {
        "Service-Type": "Framed-User",
        "Framed-Protocol": "PPP",
    }
    
    # Get package details
    package_id = customer.get("packageId")
    if not package_id:
        return attributes
    
    from app.config.database import isp_packages
    
    # Handle package_id which could be string or ObjectId
    package_id_obj = ensure_object_id(package_id)
    
    package = await isp_packages.find_one({"_id": package_id_obj})
    if not package:
        return attributes
    
    # Add rate limiting attributes based on package
    if package.get("serviceType") == IspManagerPackageType.PPPOE.value:
        # Mikrotik rate limiting attributes
        # Format: rx-rate/tx-rate rx-burst-rate/tx-burst-rate rx-burst-threshold/tx-burst-threshold rx-burst-time/tx-burst-time
        rate_limit_parts = []
        
        # Download/Upload speeds in kbps (convert from Mbps)
        down_speed = int(package.get("downloadSpeed", 0) * 1024)
        up_speed = int(package.get("uploadSpeed", 0) * 1024)
        rate_limit_parts.append(f"{down_speed}/{up_speed}")
        
        # Burst rates if specified
        if package.get("burstDownload") and package.get("burstUpload"):
            burst_down = int(package.get("burstDownload", 0) * 1024)
            burst_up = int(package.get("burstUpload", 0) * 1024)
            rate_limit_parts.append(f"{burst_down}/{burst_up}")
            
            # Threshold rates if specified
            if package.get("thresholdDownload") and package.get("thresholdUpload"):
                threshold_down = int(package.get("thresholdDownload", 0) * 1024)
                threshold_up = int(package.get("thresholdUpload", 0) * 1024)
                rate_limit_parts.append(f"{threshold_down}/{threshold_up}")
                
                # Burst time if specified
                if package.get("burstTime"):
                    burst_time = package.get("burstTime")
                    rate_limit_parts.append(f"{burst_time}/{burst_time}")
        
        # Add Mikrotik vendor specific attributes
        if rate_limit_parts:
            rate_limit_str = " ".join(rate_limit_parts)
            attributes["Mikrotik-Rate-Limit"] = rate_limit_str
        
        # Add address pool if specified
        if package.get("addressPool"):
            attributes["Framed-Pool"] = package.get("addressPool")
    
    return attributes

@router.post("/authorize", response_model=RadiusResponse)
async def authorize(request: AuthorizeRequest):
    """
    RADIUS authorization endpoint
    Checks if user exists and account is valid
    """
    logger.info(f"Authorization request for user: {request.username}")
    
    customer = await get_customer_by_username(request.username)
    error = await check_customer_status(customer)
    
    if error:
        return RadiusResponse(
            success=False,
            message=error,
            control={"Auth-Type": "Reject"}
        )
    
    # Get RADIUS attributes for the customer
    attributes = await get_radius_attributes(customer)
    
    return RadiusResponse(
        success=True,
        message="Authorization successful",
        control={"Auth-Type": "Accept"},
        reply=attributes
    )

@router.post("/authenticate", response_model=RadiusResponse)
async def authenticate(request: AuthenticateRequest):
    """
    RADIUS authentication endpoint
    Verifies username and password
    """
    logger.info(f"Authentication request for user: {request.username}")
    
    customer = await get_customer_by_username(request.username)
    error = await check_customer_status(customer)
    
    if error:
        return RadiusResponse(
            success=False,
            message=error
        )
    
    if not await verify_credentials(request.username, request.password):
        return RadiusResponse(
            success=False,
            message="Invalid username or password"
        )
    
    # Get RADIUS attributes for the customer
    attributes = await get_radius_attributes(customer)
    
    return RadiusResponse(
        success=True,
        message="Authentication successful",
        reply=attributes
    )

@router.post("/accounting", response_model=RadiusResponse)
async def accounting(request: AccountingRequest):
    """
    RADIUS accounting endpoint
    Records usage statistics
    """
    logger.info(f"Accounting request for user: {request.username}, type: {request.acct_status_type}")
    
    customer = await get_customer_by_username(request.username)
    if not customer:
        return RadiusResponse(
            success=False,
            message="Customer not found"
        )
    
    # Create accounting record
    accounting_data = {
        "customerId": ensure_object_id(customer["_id"]),
        "username": request.username,
        "acctStatusType": request.acct_status_type,
        "acctSessionId": request.acct_session_id,
        "nasIpAddress": request.nas_ip_address,
        "framedIpAddress": request.framed_ip_address,
        "timestamp": datetime.now()
    }
    
    # Add usage metrics if available
    if request.acct_session_time is not None:
        accounting_data["acctSessionTime"] = request.acct_session_time
    
    if request.acct_input_octets is not None:
        accounting_data["acctInputOctets"] = request.acct_input_octets
    
    if request.acct_output_octets is not None:
        accounting_data["acctOutputOctets"] = request.acct_output_octets
    
    if request.acct_input_gigawords is not None:
        accounting_data["acctInputGigawords"] = request.acct_input_gigawords
    
    if request.acct_output_gigawords is not None:
        accounting_data["acctOutputGigawords"] = request.acct_output_gigawords
    
    if request.acct_terminate_cause is not None:
        accounting_data["acctTerminateCause"] = request.acct_terminate_cause
    
    # Insert accounting record into database
    await isp_customers_accounting.insert_one(accounting_data)
    
    # Update online status for start/stop records
    customer_id = ensure_object_id(customer["_id"])
    
    if request.acct_status_type == "Start":
        await isp_customers.update_one(
            {"_id": customer_id},
            {"$set": {"online": True, "updatedAt": datetime.now()}}
        )
    elif request.acct_status_type == "Stop":
        await isp_customers.update_one(
            {"_id": customer_id},
            {"$set": {"online": False, "updatedAt": datetime.now()}}
        )
    
    return RadiusResponse(
        success=True,
        message="Accounting record created"
    )

@router.get("/status", response_model=Dict[str, Any])
async def status():
    """
    Status endpoint to check if API is running
    """
    try:
        await connect_to_database()
        return {
            "status": "ok",
            "message": "RADIUS API is operational",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection error: {str(e)}"
        )
