from pydantic import BaseModel, Field, validator
from typing import Optional, List, Union
from enum import Enum
from datetime import datetime

class RadiusAttribute(BaseModel):
    name: str
    value: str
    op: str = Field(default=":=")

class ServiceType(str, Enum):
    PPPOE = "pppoe"
    HOTSPOT = "hotspot"
    STATIC = "static" 
    DHCP = "dhcp"
    
    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive lookup"""
        if isinstance(value, str):
            # Try to match lowercase version
            for member in cls:
                if member.value == value.lower():
                    return member
        return None

class RadiusProfile(BaseModel):
    _id: Optional[str] = None
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    organizationId: Optional[str] = None
    # Network settings
    downloadSpeed: float  # in Mbps
    uploadSpeed: float    # in Mbps
    # Burst configuration
    burstDownload: Optional[float] = None  # in Mbps
    burstUpload: Optional[float] = None    # in Mbps
    thresholdDownload: Optional[float] = None  # in Mbps
    thresholdUpload: Optional[float] = None    # in Mbps
    burstTime: Optional[int] = None  # in seconds
    # MikroTik service configuration
    serviceType: Optional[ServiceType] = ServiceType.PPPOE
    addressPool: Optional[str] = None  # IP pool name in MikroTik
    # Session management
    sessionTimeout: Optional[int] = None  # in seconds
    idleTimeout: Optional[int] = None     # in seconds
    # QoS and VLAN
    priority: Optional[int] = None  # 1-8 for MikroTik queue priority
    vlanId: Optional[int] = None    # VLAN ID if using VLANs
    # Timestamps
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    @validator('priority')
    def validate_priority(cls, v):
        if v is not None and not (1 <= v <= 8):
            raise ValueError('Priority must be between 1 and 8')
        return v
        
    @validator('serviceType', pre=True)
    def normalize_service_type(cls, v):
        """Convert service type to proper enum value"""
        if isinstance(v, str):
            # Try lowercase version first
            lowercase = v.lower()
            for service_type in ServiceType:
                if service_type.value == lowercase:
                    return service_type
        return v

    def format_speed(self, speed_mbps: float) -> str:
        """Format speed in Mbps to MikroTik format with k/M suffix"""
        if speed_mbps is None:
            return "0k"
            
        speed_kbps = int(float(speed_mbps) * 1024)  # Convert Mbps to kbps
        if speed_kbps >= 1024:
            return f"{speed_kbps // 1024}M"
        return f"{speed_kbps}k"

    def get_rate_limit(self) -> str:
        """Get MikroTik rate limit string"""
        # Format base speeds
        upload = self.format_speed(self.uploadSpeed)
        download = self.format_speed(self.downloadSpeed)
        
        # Check if we have burst settings
        has_burst_settings = (
            self.burstUpload is not None or 
            self.burstDownload is not None or 
            self.thresholdUpload is not None or 
            self.thresholdDownload is not None or 
            self.burstTime is not None
        )
        
        if has_burst_settings:
            # Format burst speeds (use base speeds if not specified)
            burst_up = self.format_speed(self.burstUpload) if self.burstUpload else upload
            burst_down = self.format_speed(self.burstDownload) if self.burstDownload else download
            
            # Format threshold speeds (use base speeds if not specified)
            threshold_up = self.format_speed(self.thresholdUpload) if self.thresholdUpload else upload
            threshold_down = self.format_speed(self.thresholdDownload) if self.thresholdDownload else download
            
            # Get burst time - use 10 seconds as default if not specified but other burst settings exist
            burst_time = str(self.burstTime) if self.burstTime is not None else '10'
            priority = str(self.priority) if self.priority is not None else '8'
            
            # Build rate limit string in MikroTik format with burst:
            # <upload>/<download> <burst-upload>/<burst-download> <threshold-upload>/<threshold-download> <burst-time>/<burst-time> <priority>
            return f"{upload}/{download} {burst_up}/{burst_down} {threshold_up}/{threshold_down} {burst_time}/{burst_time} {priority}"
        else:
            # Simple rate limit without burst settings
            # <upload>/<download>
            return f"{upload}/{download}"

    def to_radius_attributes(self) -> List[RadiusAttribute]:
        attributes = []
        
        # Add rate limit
        attributes.append(RadiusAttribute(name="Mikrotik-Rate-Limit", value=self.get_rate_limit()))
        
        # Service type specific attributes
        if self.serviceType:
            service_type_value = self.serviceType.value
            if service_type_value == 'pppoe':
                attributes.append(RadiusAttribute(name="Service-Type", value="Framed-User"))
                attributes.append(RadiusAttribute(name="Framed-Protocol", value="PPP"))
            elif service_type_value == 'hotspot':
                attributes.append(RadiusAttribute(name="Service-Type", value="Login-User"))
            elif service_type_value == 'dhcp':
                attributes.append(RadiusAttribute(name="Service-Type", value="Framed-User"))
                attributes.append(RadiusAttribute(name="Framed-Protocol", value="DHCP"))
        
        # Address pool
        if self.addressPool:
            attributes.append(RadiusAttribute(name="Framed-Pool", value=self.addressPool))
        
        # Session management
        if self.sessionTimeout:
            attributes.append(RadiusAttribute(name="Session-Timeout", value=str(self.sessionTimeout)))
        if self.idleTimeout:
            attributes.append(RadiusAttribute(name="Idle-Timeout", value=str(self.idleTimeout)))
        
        # QoS settings
        if self.priority:
            attributes.append(RadiusAttribute(name="Mikrotik-Queue-Priority", value=str(self.priority)))
        
        # VLAN configuration
        if self.vlanId:
            attributes.extend([
                RadiusAttribute(name="Tunnel-Type", value="VLAN"),
                RadiusAttribute(name="Tunnel-Medium-Type", value="IEEE-802"),
                RadiusAttribute(name="Tunnel-Private-Group-Id", value=str(self.vlanId))
            ])
        
        return attributes

    @classmethod
    def from_isp_package(cls, package):
        """Convert ISP package to RadiusProfile"""
        service_type_map = {
            "PPPOE": ServiceType.PPPOE,
            "HOTSPOT": ServiceType.HOTSPOT,
            "STATIC": ServiceType.STATIC,
            "DHCP": ServiceType.DHCP
        }
        
        # Try to get service type, applying case conversion
        service_type = None
        if hasattr(package, 'serviceType') and package.serviceType:
            service_type_str = package.serviceType.upper()
            service_type = service_type_map.get(service_type_str)
        
        return cls(
            _id=package._id,
            name=package.name,
            description=package.description,
            price=package.price,
            organizationId=package.organizationId,
            downloadSpeed=package.downloadSpeed,
            uploadSpeed=package.uploadSpeed,
            burstDownload=package.burstDownload,
            burstUpload=package.burstUpload,
            thresholdDownload=package.thresholdDownload,
            thresholdUpload=package.thresholdUpload,
            burstTime=package.burstTime,
            serviceType=service_type or ServiceType.PPPOE,
            addressPool=package.addressPool,
            createdAt=package.createdAt,
            updatedAt=package.updatedAt
        ) 