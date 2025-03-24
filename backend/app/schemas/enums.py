import strawberry
from enum import Enum

@strawberry.enum
class UserRole(Enum):
    ADMIN = "ADMIN"
    USER = "USER"
    SUPERUSER = "SUPERUSER" 

@strawberry.enum
class OrganizationPermission(str, Enum):
    MANAGE_MEMBERS = "MANAGE_MEMBERS"
    MANAGE_ROLES = "MANAGE_ROLES"
    MANAGE_ORGANIZATION = "MANAGE_ORGANIZATION"
    VIEW_ANALYTICS = "VIEW_ANALYTICS"
    MANAGE_BILLING = "MANAGE_BILLING"
    MANAGE_SUBSCRIPTIONS = "MANAGE_SUBSCRIPTIONS"
    ACCESS_ISP_MANAGER = "ACCESS_ISP_MANAGER"
    VIEW_ISP_MANAGER_DASHBOARD = "VIEW_ISP_MANAGER_DASHBOARD"
    VIEW_ISP_MANAGER_PACKAGES = "VIEW_ISP_MANAGER_PACKAGES"
    MANAGE_ISP_MANAGER_PACKAGES = "MANAGE_ISP_MANAGER_PACKAGES"


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