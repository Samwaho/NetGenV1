import strawberry
from datetime import datetime
from typing import Optional, List, Dict, Any, ClassVar, Union, cast
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.isp_package import ISPPackage
from app.schemas.isp_station import ISPStation
from app.schemas.enums import IspManagerCustomerStatus
from bson.objectid import ObjectId
import functools


@strawberry.type
class ISPCustomer:
    """ISP Customer model representing a customer of an internet service provider."""
    
    id: str
    firstName: str
    lastName: str
    email: str
    phone: str
    username: str
    password: str
    organization: Optional[Organization] = None
    package: Optional[ISPPackage] = None
    station: Optional[ISPStation] = None
    expirationDate: Optional[datetime] = None
    status: IspManagerCustomerStatus = IspManagerCustomerStatus.INACTIVE
    online: bool = False
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    initialAmount: float = 0.0
    isNew: bool = True
    reminderDaysSent: Optional[List[int]] = None
    
    # Class variable to cache related data fetching
    _related_cache: ClassVar[Dict[str, Dict[str, Any]]] = {
        "organizations": {},
        "packages": {},
        "stations": {},
    }

    @classmethod
    async def from_db(cls, customer: Union[Dict[str, Any], Any]) -> "ISPCustomer":
        """
        Convert a database customer record to an ISPCustomer object.
        
        Args:
            customer: A customer record from the database (dict or object)
            
        Returns:
            ISPCustomer: A properly formatted ISPCustomer object
        """
        from app.schemas.organization import Organization
        from app.schemas.isp_package import ISPPackage
        from app.schemas.isp_station import ISPStation
        from app.config.database import organizations, isp_packages, isp_stations

        # Handle both dictionary and object types
        if isinstance(customer, dict):
            org_id = customer.get("organizationId")
            package_id = customer.get("packageId")
            station_id = customer.get("stationId")
            
            converted_customer = {
                "id": str(customer["_id"]),
                "firstName": customer["firstName"],
                "lastName": customer["lastName"],
                "email": customer["email"],
                "phone": customer["phone"],
                "username": customer["username"],
                "password": customer["password"],
                "expirationDate": customer["expirationDate"],
                "status": customer.get("status", IspManagerCustomerStatus.INACTIVE),
                "online": customer.get("online", False),
                "createdAt": customer["createdAt"],
                "updatedAt": customer["updatedAt"],
                "initialAmount": customer.get("initialAmount", 0.0),
                "isNew": customer.get("isNew", True),
                "reminderDaysSent": customer.get("reminderDaysSent", []),
            }
        else:
            org_id = customer.organizationId
            package_id = customer.packageId
            station_id = customer.stationId
            
            converted_customer = {
                "id": str(customer._id),
                "firstName": customer.firstName,
                "lastName": customer.lastName,
                "email": customer.email,
                "phone": customer.phone,
                "username": customer.username,
                "password": customer.password,
                "expirationDate": customer.expirationDate,
                "status": getattr(customer, 'status', IspManagerCustomerStatus.INACTIVE),
                "online": getattr(customer, 'online', False),
                "createdAt": customer.createdAt,
                "updatedAt": customer.updatedAt,
                "initialAmount": getattr(customer, 'initialAmount', 0.0),
                "isNew": getattr(customer, 'isNew', True),
                "reminderDaysSent": getattr(customer, 'reminderDaysSent', []),
            }

        # Convert ObjectIds to strings for cache keys
        org_id_str = str(org_id)
        package_id_str = str(package_id)
        station_id_str = str(station_id)
        
        # Fetch organization from cache or database
        org_data = cls._related_cache["organizations"].get(org_id_str)
        if not org_data:
            org_data = await organizations.find_one({"_id": org_id})
            if org_data:
                cls._related_cache["organizations"][org_id_str] = org_data
                
        # Fetch package from cache or database
        package_data = cls._related_cache["packages"].get(package_id_str)
        if not package_data:
            package_data = await isp_packages.find_one({"_id": package_id})
            if package_data:
                cls._related_cache["packages"][package_id_str] = package_data
                
        # Fetch station from cache or database
        station_data = cls._related_cache["stations"].get(station_id_str)
        if not station_data:
            station_data = await isp_stations.find_one({"_id": station_id})
            if station_data:
                cls._related_cache["stations"][station_id_str] = station_data

        # Convert related entities to their proper types
        converted_customer["organization"] = await Organization.from_db(org_data) if org_data else None
        converted_customer["package"] = await ISPPackage.from_db(package_data) if package_data else None
        converted_customer["station"] = await ISPStation.from_db(station_data) if station_data else None

        return cls(**converted_customer)
    
    @property
    def full_name(self) -> str:
        """Get the customer's full name."""
        return f"{self.firstName} {self.lastName}".strip()
    
    @property
    def is_active(self) -> bool:
        """Check if the customer has an active subscription."""
        return self.status == IspManagerCustomerStatus.ACTIVE
    
    @property
    def expiration_status(self) -> str:
        """Get the subscription expiration status."""
        now = datetime.now(self.expirationDate.tzinfo)
        if self.expirationDate < now:
            return "expired"
        
        days_left = (self.expirationDate - now).days
        if days_left < 7:
            return "expiring_soon"
            
        return "active"


@strawberry.input
class CreateISPCustomerInput:
    """Input type for creating a new ISP customer. Added initialAmount and isNew."""
    firstName: str
    lastName: str
    email: str
    phone: str
    username: str
    password: str
    organizationId: str
    packageId: str
    stationId: str
    expirationDate: datetime
    initialAmount: float = 0.0
    isNew: bool = True


@strawberry.input
class UpdateISPCustomerInput:
    """Input type for updating an existing ISP customer. Added initialAmount and isNew."""
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    packageId: Optional[str] = None
    stationId: Optional[str] = None
    expirationDate: Optional[datetime] = None
    status: Optional[IspManagerCustomerStatus] = None
    initialAmount: Optional[float] = None
    isNew: Optional[bool] = None


@strawberry.type
class ISPCustomerResponse:
    """Response type for ISP customer operations."""
    success: bool
    message: str
    customer: Optional[ISPCustomer] = None


@strawberry.type
class ISPCustomersResponse:
    """Response type for querying multiple ISP customers."""
    success: bool
    message: str
    customers: List[ISPCustomer] = field(default_factory=list)
    total_count: int = 0  # Total count for pagination
