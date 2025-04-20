import strawberry
from datetime import datetime
from typing import Optional, List, Dict, Any, ClassVar, Union, cast
from dataclasses import field
from app.schemas.organization import Organization
from app.schemas.isp_package import ISPPackage
from app.schemas.isp_customer import ISPCustomer
from bson.objectid import ObjectId


@strawberry.type
class ISPCustomerPayment:
    """ISP Customer Payment model representing a payment made by a customer."""
    
    id: str
    customer: ISPCustomer
    amount: float
    transactionId: Optional[str] = None
    phoneNumber: Optional[str] = None
    package: Optional[ISPPackage] = None
    daysAdded: int
    paidAt: datetime
    createdAt: datetime
    updatedAt: datetime
    
    # Class variable to cache related data fetching
    _related_cache: ClassVar[Dict[str, Dict[str, Any]]] = {
        "customers": {},
        "packages": {},
    }

    @classmethod
    async def from_db(cls, payment: Union[Dict[str, Any], Any]) -> "ISPCustomerPayment":
        """
        Convert a database payment record to an ISPCustomerPayment object.
        
        Args:
            payment: A payment record from the database (dict or object)
            
        Returns:
            ISPCustomerPayment: A properly formatted ISPCustomerPayment object
        """
        from app.schemas.isp_customer import ISPCustomer
        from app.schemas.isp_package import ISPPackage
        from app.config.database import isp_customers, isp_packages

        # Handle both dictionary and object types
        if isinstance(payment, dict):
            customer_id = payment.get("customerId")
            package_id = payment.get("packageId")
            
            converted_payment = {
                "id": str(payment["_id"]),
                "amount": payment["amount"],
                "transactionId": payment.get("transactionId"),
                "phoneNumber": payment.get("phoneNumber"),
                "daysAdded": payment.get("daysAdded", 0),
                "paidAt": payment["paidAt"],
                "createdAt": payment["createdAt"],
                "updatedAt": payment["updatedAt"]
            }
        else:
            customer_id = payment.customerId
            package_id = payment.packageId
            
            converted_payment = {
                "id": str(payment._id),
                "amount": payment.amount,
                "transactionId": getattr(payment, 'transactionId', None),
                "phoneNumber": getattr(payment, 'phoneNumber', None),
                "daysAdded": getattr(payment, 'daysAdded', 0),
                "paidAt": payment.paidAt,
                "createdAt": payment.createdAt,
                "updatedAt": payment.updatedAt
            }

        # Convert ObjectIds to strings for cache keys
        customer_id_str = str(customer_id)
        package_id_str = str(package_id) if package_id else None
        
        # Fetch customer from cache or database
        customer_data = cls._related_cache["customers"].get(customer_id_str)
        if not customer_data:
            customer_data = await isp_customers.find_one({"_id": customer_id})
            if customer_data:
                cls._related_cache["customers"][customer_id_str] = customer_data
                
        # Fetch package from cache or database if packageId exists
        package_data = None
        if package_id_str:
            package_data = cls._related_cache["packages"].get(package_id_str)
            if not package_data:
                package_data = await isp_packages.find_one({"_id": package_id})
                if package_data:
                    cls._related_cache["packages"][package_id_str] = package_data

        # Convert related entities to their proper types
        converted_payment["customer"] = await ISPCustomer.from_db(customer_data) if customer_data else None
        converted_payment["package"] = await ISPPackage.from_db(package_data) if package_data else None

        return cls(**converted_payment)


@strawberry.input
class CreateISPCustomerPaymentInput:
    """Input type for creating a new ISP customer payment."""
    customerId: str
    amount: float
    transactionId: Optional[str] = None
    phoneNumber: Optional[str] = None
    packageId: Optional[str] = None
    daysAdded: int


@strawberry.type
class ISPCustomerPaymentResponse:
    """Response type for ISP customer payment operations."""
    success: bool
    message: str
    payment: Optional[ISPCustomerPayment] = None


@strawberry.type
class ISPCustomerPaymentsResponse:
    """Response type for querying multiple ISP customer payments."""
    success: bool
    message: str
    payments: List[ISPCustomerPayment] = field(default_factory=list)
    total_count: int = 0  # Total count for pagination
