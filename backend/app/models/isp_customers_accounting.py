from datetime import datetime
from typing import Optional, Dict, Any
import strawberry

@strawberry.type
class AccountingSessionDB:
    """Database representation of an accounting session"""
    startTime: datetime
    endTime: datetime
    duration: int
    inputBytes: int
    outputBytes: int
    framedIp: Optional[str]
    terminateCause: Optional[str]
    nasIpAddress: Optional[str]
    serviceType: Optional[str]
    nasPortType: Optional[str]
    nasPort: Optional[str]
    nasIdentifier: Optional[str]
    mikrotikRateLimit: Optional[str]
    calledStationId: Optional[str]
    callingStationId: Optional[str]

@strawberry.type
class DBISPCustomerAccounting:
    """Database model for ISP customer accounting records"""
    _id: str
    username: str
    customerId: str
    sessionId: Optional[str]
    status: str
    timestamp: datetime
    lastUpdate: datetime
    type: Optional[str]
    
    # Session data (for non-summary records)
    sessionTime: Optional[int]
    totalInputBytes: Optional[int]
    totalOutputBytes: Optional[int]
    totalBytes: Optional[int]
    framedIpAddress: Optional[str]
    nasIpAddress: Optional[str]
    terminateCause: Optional[str]
    serviceType: Optional[str]
    nasPortType: Optional[str]
    nasPort: Optional[str]
    nasIdentifier: Optional[str]
    mikrotikRateLimit: Optional[str]
    calledStationId: Optional[str]
    callingStationId: Optional[str]
    
    # Delta values (incremental changes)
    deltaInputBytes: Optional[int]
    deltaOutputBytes: Optional[int]
    deltaSessionTime: Optional[int]
    startTime: Optional[datetime]
    
    # Session summary data (for summary records)
    totalSessions: Optional[int]
    totalOnlineTime: Optional[int]
    lastSeen: Optional[datetime]
    lastSessionId: Optional[str]
    lastSession: Optional[Dict[str, Any]]
