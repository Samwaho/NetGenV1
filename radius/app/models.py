from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from enum import Enum


class RadiusRequestType(str, Enum):
    AUTHORIZE = "authorize"
    AUTHENTICATE = "authenticate"
    ACCOUNTING = "accounting"
    POST_AUTH = "post-auth"


class RadiusRequest(BaseModel):
    """Base model for RADIUS requests"""
    request_type: RadiusRequestType
    username: Optional[str] = None
    password: Optional[str] = None
    reply: Dict[str, Any] = {}
    config: Dict[str, Any] = {}


class AuthorizeRequest(RadiusRequest):
    """Model for RADIUS authorization requests"""
    username: str
    password: Optional[str] = None


class AuthenticateRequest(RadiusRequest):
    """Model for RADIUS authentication requests"""
    username: str
    password: str


class AccountingRequest(RadiusRequest):
    """Model for RADIUS accounting requests"""
    username: str
    acct_status_type: str
    acct_session_id: str
    acct_session_time: Optional[int] = None
    acct_input_octets: Optional[int] = None
    acct_output_octets: Optional[int] = None
    acct_input_gigawords: Optional[int] = None
    acct_output_gigawords: Optional[int] = None
    acct_terminate_cause: Optional[str] = None
    nas_ip_address: Optional[str] = None
    framed_ip_address: Optional[str] = None


class RadiusReply(BaseModel):
    """Model for RADIUS replies"""
    reply_attributes: Dict[str, Any] = {}
    config_attributes: Dict[str, Any] = {}


class RadiusResponse(BaseModel):
    """Model for RADIUS API responses"""
    success: bool
    message: str
    control: Dict[str, Any] = {}
    reply: Dict[str, Any] = {}

class IspManagerPackageType(str, Enum):
    PPPOE = "PPPOE"
    HOTSPOT = "HOTSPOT"
    STATIC = "STATIC"
    DHCP = "DHCP" 
    
class IspManagerCustomerStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    EXPIRED = "EXPIRED"
    BLOCKED = "BLOCKED"
    PENDING = "PENDING"
    CANCELLED = "CANCELLED"