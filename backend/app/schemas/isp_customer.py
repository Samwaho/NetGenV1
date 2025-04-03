import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.isp_package import ISPPackage
from app.schemas.isp_station import ISPStation
from app.schemas.enums import IspManagerCustomerStatus


@strawberry.type
class ISPCustomer:
    id: str
    firstName: str
    lastName: str
    email: str
    phone: str
    username: str
    organization: Organization
    package: ISPPackage
    station: ISPStation
    expirationDate: datetime
    status: IspManagerCustomerStatus = IspManagerCustomerStatus.INACTIVE
    online: bool = False
    createdAt: datetime
    updatedAt: datetime

    @classmethod
    async def from_db(cls, customer) -> "ISPCustomer":
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
                "expirationDate": customer["expirationDate"],
                "status": customer.get("status", IspManagerCustomerStatus.INACTIVE),
                "online": customer.get("online", False),
                "createdAt": customer["createdAt"],
                "updatedAt": customer["updatedAt"]
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
                "expirationDate": customer.expirationDate,
                "status": getattr(customer, 'status', IspManagerCustomerStatus.INACTIVE),
                "online": getattr(customer, 'online', False),
                "createdAt": customer.createdAt,
                "updatedAt": customer.updatedAt
            }

        # Fetch related data
        org_data = await organizations.find_one({"_id": org_id})
        package_data = await isp_packages.find_one({"_id": package_id})
        station_data = await isp_stations.find_one({"_id": station_id})

        converted_customer["organization"] = await Organization.from_db(org_data) if org_data else None
        converted_customer["package"] = await ISPPackage.from_db(package_data) if package_data else None
        converted_customer["station"] = await ISPStation.from_db(station_data) if station_data else None

        return cls(**converted_customer)


@strawberry.input
class CreateISPCustomerInput:
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


@strawberry.input
class UpdateISPCustomerInput:
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


@strawberry.type
class ISPCustomerResponse:
    success: bool
    message: str
    customer: Optional[ISPCustomer] = None


@strawberry.type
class ISPCustomersResponse:
    success: bool
    message: str
    customers: List[ISPCustomer] = field(default_factory=list)
