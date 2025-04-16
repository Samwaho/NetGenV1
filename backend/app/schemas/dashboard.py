from typing import List, Optional, Dict, Any
from datetime import datetime
import strawberry
from dataclasses import field

@strawberry.type
class PackageStats:
    name: str
    count: int
    percentage: float
    revenue: float  # Added revenue field

@strawberry.type
class StationStatusStats:
    status: str
    count: int
    percentage: float
    bandwidth: float  # Added bandwidth field

@strawberry.type
class TicketPriorityStats:
    priority: str
    count: int
    percentage: float
    avg_resolution_time: float = 0.0  # Set default value to 0.0

@strawberry.type
class TicketCategoryStats:
    category: str
    count: int
    percentage: float

@strawberry.type
class InventoryItemStats:
    """Stats for inventory items in the dashboard"""
    name: str
    count: int
    currentStock: int
    minimumRequired: int
    quantity: int
    usageCount: int
    category: str
    value: float

    @classmethod
    async def from_db(cls, data: Dict[str, Any]) -> "InventoryItemStats":
        """Convert database record to InventoryItemStats object"""
        return cls(
            name=data.get("name", ""),
            count=data.get("count", 0),
            currentStock=data.get("currentStock", 0),
            minimumRequired=data.get("minimumRequired", 0),
            quantity=data.get("quantity", 0),
            usageCount=data.get("usageCount", 0),
            category=data.get("category", ""),
            value=data.get("value", 0.0)
        )

@strawberry.type
class BandwidthPackageStats:
    package: str  # Changed from package_name to package
    usage: float
    percentage: float

@strawberry.type
class CustomerStats:
    total: int
    active: int
    inactive: int
    growth: float
    churn_rate: float
    average_revenue: float
    new_this_month: int
    by_package: List[PackageStats]

@strawberry.type
class StationStats:
    total: int
    active: int
    inactive: int
    growth: float
    total_bandwidth: float
    average_uptime: float
    maintenance_needed: int
    by_status: List[StationStatusStats]

@strawberry.type
class TicketStats:
    total: int
    open: int
    closed: int
    growth: float
    average_resolution_time: float
    by_priority: List[TicketPriorityStats]
    by_category: List[TicketCategoryStats]
    satisfaction_rate: float

@strawberry.type
class InventoryStats:
    total: int
    low_stock: int
    out_of_stock: int
    growth: float
    total_value: float
    most_used: List[InventoryItemStats]
    reorder_needed: List[InventoryItemStats]
    by_category: List[InventoryItemStats]

@strawberry.type
class RevenueData:
    date: str
    amount: float
    recurring: float
    one_time: float
    expenses: float

@strawberry.type
class RevenueStats:
    data: List[RevenueData]
    growth: float
    total_revenue: float
    recurring_revenue: float
    average_revenue: float
    projected_revenue: float
    expenses: float
    profit_margin: float

@strawberry.type
class BandwidthUsage:
    total: float
    download: float
    upload: float
    peak_time: str
    by_package: List[BandwidthPackageStats]

@strawberry.type
class ActivityDetailData:
    key: str
    value: str

@strawberry.type
class ActivityDetails:
    details: List[ActivityDetailData]

@strawberry.type
class ActivityItem:
    id: str
    type: str
    description: str
    timestamp: datetime
    user: str
    category: str
    impact: str
    details: Optional[ActivityDetails]

@strawberry.type
class DashboardStats:
    customers: CustomerStats
    stations: StationStats
    tickets: TicketStats
    inventory: InventoryStats
    revenue: RevenueStats
    bandwidth: BandwidthUsage
    recent_activity: List[ActivityItem]









