import strawberry
from enum import Enum

@strawberry.enum
class UserRole(Enum):
    ADMIN = "ADMIN"
    USER = "USER"
    SUPERUSER = "SUPERUSER" 

@strawberry.enum
class OrganizationPermission(str, Enum):
    # Organization permissions
    VIEW_ORGANIZATION = "VIEW_ORGANIZATION"
    MANAGE_ORGANIZATION = "MANAGE_ORGANIZATION"
    MANAGE_MEMBERS = "MANAGE_MEMBERS"
    MANAGE_ROLES = "MANAGE_ROLES"
    VIEW_ANALYTICS = "VIEW_ANALYTICS"
    MANAGE_BILLING = "MANAGE_BILLING"
    MANAGE_SUBSCRIPTIONS = "MANAGE_SUBSCRIPTIONS"
    
    # ISP Manager permissions
    ACCESS_ISP_MANAGER = "ACCESS_ISP_MANAGER"
    VIEW_ISP_MANAGER_DASHBOARD = "VIEW_ISP_MANAGER_DASHBOARD"
    VIEW_ISP_MANAGER_PACKAGES = "VIEW_ISP_MANAGER_PACKAGES"
    MANAGE_ISP_MANAGER_PACKAGES = "MANAGE_ISP_MANAGER_PACKAGES"
    VIEW_ISP_MANAGER_CUSTOMERS = "VIEW_ISP_MANAGER_CUSTOMERS"
    MANAGE_ISP_MANAGER_CUSTOMERS = "MANAGE_ISP_MANAGER_CUSTOMERS"
    VIEW_ISP_MANAGER_STATIONS = "VIEW_ISP_MANAGER_STATIONS"
    MANAGE_ISP_MANAGER_STATIONS = "MANAGE_ISP_MANAGER_STATIONS"
    VIEW_ISP_MANAGER_INVENTORY = "VIEW_ISP_MANAGER_INVENTORY"
    MANAGE_ISP_MANAGER_INVENTORY = "MANAGE_ISP_MANAGER_INVENTORY"
    VIEW_ISP_MANAGER_TICKETS = "VIEW_ISP_MANAGER_TICKETS"
    MANAGE_ISP_MANAGER_TICKETS = "MANAGE_ISP_MANAGER_TICKETS"
    
    # Mpesa integration permissions
    VIEW_MPESA_CONFIG = "VIEW_MPESA_CONFIG"
    MANAGE_MPESA_CONFIG = "MANAGE_MPESA_CONFIG"
    VIEW_MPESA_TRANSACTIONS = "VIEW_MPESA_TRANSACTIONS"
    
    # SMS integration permissions
    VIEW_SMS_CONFIG = "VIEW_SMS_CONFIG"
    MANAGE_SMS_CONFIG = "MANAGE_SMS_CONFIG"
    
    # Customer payments permissions
    VIEW_CUSTOMER_PAYMENTS = "VIEW_CUSTOMER_PAYMENTS"
    MANAGE_CUSTOMER_PAYMENTS = "MANAGE_CUSTOMER_PAYMENTS"

    # Activity permissions
    VIEW_ACTIVITY = "VIEW_ACTIVITY"
    CLEAR_ACTIVITY = "CLEAR_ACTIVITY"

@strawberry.enum
class OrganizationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"
    ARCHIVED = "ARCHIVED"

@strawberry.enum
class OrganizationMemberStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"

@strawberry.enum
class IspManagerCustomerStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"

@strawberry.enum
class BuildingType(str, Enum):
    APARTMENT = "APARTMENT"
    OFFICE = "OFFICE"
    SCHOOL = "SCHOOL"
    HOSPITAL = "HOSPITAL"
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    INDUSTRIAL = "INDUSTRIAL"
    GOVERNMENT = "GOVERNMENT"
    OTHER = "OTHER"

@strawberry.enum
class StationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"

@strawberry.enum
class EquipmentCategory(str, Enum):
    ROUTER = "ROUTER"
    SWITCH = "SWITCH"
    ACCESS_POINT = "ACCESS_POINT"
    ANTENNA = "ANTENNA"
    CABLE = "CABLE"
    CONNECTOR = "CONNECTOR"
    POWER_SUPPLY = "POWER_SUPPLY"
    SERVER = "SERVER"
    CPE = "CPE"  # Customer Premises Equipment
    TOOLS = "TOOLS"
    OTHER = "OTHER"

@strawberry.enum
class EquipmentStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    IN_USE = "IN_USE"
    DEFECTIVE = "DEFECTIVE"
    IN_REPAIR = "IN_REPAIR"
    RESERVED = "RESERVED"
    DISPOSED = "DISPOSED"

@strawberry.enum
class TicketStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

@strawberry.enum
class TicketPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

