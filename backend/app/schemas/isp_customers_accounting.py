import strawberry
from datetime import datetime
from typing import Optional, List, ClassVar, Dict, Any
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.isp_customer import ISPCustomer
from enum import Enum

# Add BigInt scalar
@strawberry.scalar(description="Big integer as string")
class BigInt:
    @staticmethod
    def serialize(value):
        return str(value) if value is not None else None

    @staticmethod
    def parse_value(value):
        return int(value) if value is not None else None


@strawberry.enum
class AccountingStatusType(str, Enum):
    START = "Start"
    STOP = "Stop"
    INTERIM_UPDATE = "Interim-Update"
    ACCOUNTING_ON = "Accounting-On"
    ACCOUNTING_OFF = "Accounting-Off"
    SESSION_SUMMARY = "session_summary"


@strawberry.type
class AccountingSession:
    """Represents a single accounting session with details"""
    startTime: datetime
    endTime: datetime
    duration: int
    inputBytes: Optional[BigInt] = None
    outputBytes: Optional[BigInt] = None
    framedIp: Optional[str] = None
    terminateCause: Optional[str] = None
    nasIpAddress: Optional[str] = None
    serviceType: Optional[str] = None
    nasPortType: Optional[str] = None
    nasPort: Optional[str] = None
    nasIdentifier: Optional[str] = None
    mikrotikRateLimit: Optional[str] = None
    calledStationId: Optional[str] = None
    callingStationId: Optional[str] = None


@strawberry.type
class ISPCustomerAccounting:
    """Customer accounting record that tracks bandwidth usage and session information"""
    id: str
    username: str
    customer: ISPCustomer
    sessionId: Optional[str] = None
    status: AccountingStatusType
    timestamp: datetime
    lastUpdate: datetime
    type: Optional[str] = None
    
    # Session data (for non-summary records)
    sessionTime: Optional[int] = None
    totalInputBytes: Optional[BigInt] = None
    totalOutputBytes: Optional[BigInt] = None
    totalBytes: Optional[BigInt] = None
    framedIpAddress: Optional[str] = None
    nasIpAddress: Optional[str] = None
    terminateCause: Optional[str] = None
    serviceType: Optional[str] = None
    nasPortType: Optional[str] = None
    nasPort: Optional[str] = None
    nasIdentifier: Optional[str] = None
    mikrotikRateLimit: Optional[str] = None
    calledStationId: Optional[str] = None
    callingStationId: Optional[str] = None
    
    # Delta values (incremental changes)
    deltaInputBytes: Optional[BigInt] = None
    deltaOutputBytes: Optional[BigInt] = None
    deltaSessionTime: Optional[int] = None
    startTime: Optional[datetime] = None
    
    # Session summary data (for summary records)
    totalSessions: Optional[int] = None
    totalOnlineTime: Optional[int] = None
    lastSeen: Optional[datetime] = None
    lastSessionId: Optional[str] = None
    lastSession: Optional[AccountingSession] = None
    
    # Class variable for field mapping to avoid duplication
    _field_map: ClassVar[Dict[str, str]] = {
        "_id": "id",
        "username": "username",
        "customerId": "customer",
        "sessionId": "sessionId", 
        "status": "status",
        "timestamp": "timestamp",
        "lastUpdate": "lastUpdate",
        "type": "type",
        "sessionTime": "sessionTime",
        "totalInputBytes": "totalInputBytes",
        "totalOutputBytes": "totalOutputBytes",
        "totalBytes": "totalBytes",
        "framedIpAddress": "framedIpAddress",
        "nasIpAddress": "nasIpAddress",
        "terminateCause": "terminateCause",
        "serviceType": "serviceType",
        "nasPortType": "nasPortType",
        "nasPort": "nasPort",
        "nasIdentifier": "nasIdentifier",
        "mikrotikRateLimit": "mikrotikRateLimit",
        "calledStationId": "calledStationId",
        "callingStationId": "callingStationId",
        "deltaInputBytes": "deltaInputBytes",
        "deltaOutputBytes": "deltaOutputBytes",
        "deltaSessionTime": "deltaSessionTime",
        "startTime": "startTime",
        "totalSessions": "totalSessions",
        "totalOnlineTime": "totalOnlineTime",
        "lastSeen": "lastSeen",
        "lastSessionId": "lastSessionId",
        "lastSession": "lastSession"
    }

    @classmethod
    async def from_db(cls, record) -> "ISPCustomerAccounting":
        """
        Convert a database record to an ISPCustomerAccounting object.
        
        Args:
            record: Database record (dict or object)
            
        Returns:
            ISPCustomerAccounting instance
        """
        from app.config.database import isp_customers
        from app.schemas.isp_customer import ISPCustomer

        # Determine if input is a dict or object
        is_dict = isinstance(record, dict)
        
        # Get customer_id based on input type
        customer_id = record["customerId"] if is_dict else record.customerId
        
        # Fetch customer data
        customer_data = None
        if customer_id:
            try:
                from bson.objectid import ObjectId
                if not isinstance(customer_id, ObjectId):
                    customer_id = ObjectId(customer_id)
                customer_data = await isp_customers.find_one({"_id": customer_id})
            except Exception as e:
                # Log but continue even if customer fetch fails
                print(f"Error fetching customer for accounting record: {str(e)}")

        # Create kwargs for constructor
        kwargs: Dict[str, Any] = {}
        
        # Process all fields based on input type
        for db_field, class_field in cls._field_map.items():
            if db_field == "_id":
                kwargs["id"] = str(record["_id"] if is_dict else record._id)
            elif db_field == "customerId":
                # Use the customer object instead of just the ID
                kwargs["customer"] = await ISPCustomer.from_db(customer_data) if customer_data else None
            elif db_field == "lastSession" and is_dict and record.get("lastSession"):
                # Convert last session dictionary to AccountingSession type
                session_data = record["lastSession"]
                kwargs["lastSession"] = AccountingSession(
                    startTime=session_data.get("startTime"),
                    endTime=session_data.get("endTime"),
                    duration=session_data.get("duration", 0),
                    inputBytes=session_data.get("inputBytes", 0),
                    outputBytes=session_data.get("outputBytes", 0),
                    framedIp=session_data.get("framedIp"),
                    terminateCause=session_data.get("terminateCause"),
                    nasIpAddress=session_data.get("nasIpAddress"),
                    serviceType=session_data.get("serviceType"),
                    nasPortType=session_data.get("nasPortType"),
                    nasPort=session_data.get("nasPort"),
                    nasIdentifier=session_data.get("nasIdentifier"),
                    mikrotikRateLimit=session_data.get("mikrotikRateLimit"),
                    calledStationId=session_data.get("calledStationId"),
                    callingStationId=session_data.get("callingStationId")
                )
            # For all other fields, get directly from the record
            elif is_dict:
                kwargs[class_field] = record.get(db_field)
            else:
                kwargs[class_field] = getattr(record, db_field, None)
                
        return cls(**kwargs)


@strawberry.input
class AccountingFilterInput:
    """Input type for filtering accounting records"""
    customerId: Optional[str] = None
    username: Optional[str] = None
    fromDate: Optional[datetime] = None
    toDate: Optional[datetime] = None
    status: Optional[AccountingStatusType] = None
    sessionType: Optional[str] = None


@strawberry.type
class ISPCustomerAccountingResponse:
    """Response type for a single ISP customer accounting record"""
    success: bool
    message: str
    accounting: Optional[ISPCustomerAccounting] = None


@strawberry.type
class ISPCustomerAccountingsResponse:
    """Response type for multiple ISP customer accounting records"""
    success: bool
    message: str
    accountings: List[ISPCustomerAccounting] = field(default_factory=list)
    totalCount: Optional[int] = None


@strawberry.input
class AccountingStatsPeriod(str, Enum):
    """Time periods for accounting statistics"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


@strawberry.type
class BandwidthStats:
    """Statistics about bandwidth usage for a specific time period"""
    period: str
    download: BigInt
    upload: BigInt
    total: BigInt


@strawberry.type
class CustomerBandwidthStatsResponse:
    """Response with bandwidth statistics for a customer"""
    success: bool
    message: str
    customerId: Optional[str] = None
    username: Optional[str] = None
    stats: List[BandwidthStats] = field(default_factory=list)
