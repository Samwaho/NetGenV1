from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
import strawberry
from fastapi import HTTPException
from app.config.database import (
    organizations, 
    isp_customers, 
    isp_stations, 
    isp_tickets,
    isp_customers_accounting,
    isp_inventories,  # Changed from isp_inventory to isp_inventories
    activities
)
from app.config.deps import Context
from bson.objectid import ObjectId
import logging
from app.schemas.dashboard import (
    DashboardStats,
    CustomerStats,
    StationStats,
    TicketStats,
    InventoryStats,
    InventoryItemStats,
    RevenueStats,
    RevenueData,
    ActivityItem,
    BandwidthUsage,
    ActivityDetails,
    ActivityDetailData,
    TicketPriorityStats,
    TicketCategoryStats,
    PackageStats
)

logger = logging.getLogger(__name__)

def calculate_growth(current: float, previous: float) -> float:
    """Calculate growth percentage"""
    if not previous:
        return 0.0
    return ((current - previous) / previous) * 100

def calculate_churn_rate(stats: List[dict]) -> float:
    """Calculate customer churn rate"""
    total = sum(s["count"] for s in stats)
    churned = sum(s["count"] for s in stats if s.get("churned", False))
    return (churned / total * 100) if total > 0 else 0

def calculate_average_revenue(data: List[dict]) -> float:
    """Calculate average revenue"""
    if not data:
        return 0.0
    return sum(d.get("revenue", 0) for d in data) / len(data)

def calculate_uptime(stats: List[dict]) -> float:
    """Calculate average uptime percentage"""
    total_uptime = sum(s.get("uptime", 0) for s in stats)
    return total_uptime / len(stats) if stats else 0

def calculate_avg_resolution_time(stats: List[dict]) -> float:
    """Calculate average ticket resolution time"""
    times = [safe_float(t.get("avg_resolution_time")) for t in stats]
    return sum(times) / len(times) if times else 0.0

def calculate_satisfaction_rate(stats: List[dict]) -> float:
    """Calculate average satisfaction rate"""
    ratings = [t.get("satisfaction", 0) for t in stats if t.get("satisfaction")]
    return sum(ratings) / len(ratings) if ratings else 0

def calculate_inventory_value(stats: List[dict]) -> float:
    """Calculate total inventory value"""
    return sum(
        item.get("value", 0) * item.get("quantity", 0) 
        for item in stats
    )

def get_most_used_items(stats: List[dict], limit: int = 5) -> List[dict]:
    """Get most used inventory items"""
    sorted_items = sorted(stats, key=lambda x: x.get("usage_count", 0), reverse=True)
    return sorted_items[:limit]

def get_reorder_needed(stats: List[dict]) -> List[dict]:
    """Get items that need reordering"""
    return [
        item for item in stats 
        if item.get("quantity", 0) <= item.get("reorder_threshold", 0)
    ]

def calculate_peak_time(stats: List[dict]) -> str:
    """Calculate peak usage time"""
    if not stats:
        return "00:00"
    peak_usage = max(stats, key=lambda x: x.get("peak_usage", 0))
    return peak_usage.get("time", "00:00")

def convert_details_to_list(details_dict: Dict[str, Any]) -> List[ActivityDetailData]:
    return [
        ActivityDetailData(key=str(k), value=str(v))
        for k, v in details_dict.items()
    ]

def safe_float(value, default: float = 0.0) -> float:
    """Safely convert a value to float, returning default if conversion fails"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

async def convert_inventory_stats(inventory_data: List[dict]) -> List[InventoryItemStats]:
    """Convert inventory data to InventoryItemStats objects"""
    return [await InventoryItemStats.from_db(item) for item in inventory_data]

@strawberry.type
class DashboardResolver:
    
    @strawberry.field
    async def dashboard_stats(
        self, 
        organization_id: str,
        info: strawberry.Info
    ) -> DashboardStats:
        """Get comprehensive dashboard statistics for an organization"""
        context: Context = info.context
        current_user = await context.authenticate()
        
        try:
            org_id = ObjectId(organization_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid organization ID")
            
        # Verify user has access to this organization
        org = await organizations.find_one({
            "_id": org_id,
            "members.userId": current_user.id
        })
        
        if not org:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to access this organization"
            )

        # Time ranges
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # Customer Analytics
        customer_pipeline = [
            {"$match": {"organizationId": org_id}},
            {"$group": {
                "_id": "$packageId",
                "count": {"$sum": 1},
                "active": {"$sum": {"$cond": [{"$eq": ["$status", "ACTIVE"]}, 1, 0]}},
                "revenue": {"$sum": "$monthlyFee"}
            }}
        ]
        customer_stats = await isp_customers.aggregate(customer_pipeline).to_list(None)
        total_customers = sum(stat["count"] for stat in customer_stats)

        # Transform the customer package stats to match the schema
        customer_by_package = [
            PackageStats(
                name=str(stat["_id"]),  # Convert packageId to string
                count=stat["count"],
                percentage=(stat["count"] / total_customers * 100) if total_customers > 0 else 0,
                revenue=stat["revenue"]
            )
            for stat in customer_stats
        ]

        current_customers = await isp_customers.count_documents({
            "organizationId": org_id,
            "status": "ACTIVE"
        })

        previous_customers = await isp_customers.count_documents({
            "organizationId": org_id,
            "status": "ACTIVE",
            "createdAt": {"$lt": thirty_days_ago}
        })
        
        total_customers = await isp_customers.count_documents({
            "organizationId": org_id
        })
        
        new_customers = await isp_customers.count_documents({
            "organizationId": org_id,
            "createdAt": {"$gte": thirty_days_ago}
        })

        # Station Analytics
        station_pipeline = [
            {"$match": {"organizationId": org_id}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_bandwidth": {"$sum": "$bandwidth"},
                "maintenance_needed": {"$sum": {"$cond": [{"$eq": ["$needsMaintenance", True]}, 1, 0]}}
            }}
        ]
        station_stats = await isp_stations.aggregate(station_pipeline).to_list(None)

        # Ticket Analytics
        ticket_pipeline = [
            {"$match": {"organizationId": org_id}},
            {"$facet": {
                "by_status": [
                    {"$group": {
                        "_id": "$status",
                        "count": {"$sum": 1}
                    }}
                ],
                "by_priority_category": [
                    {"$group": {
                        "_id": {
                            "priority": "$priority",
                            "category": "$category"
                        },
                        "count": {"$sum": 1},
                        "avg_resolution_time": {"$avg": "$resolutionTime"},
                        "satisfaction": {"$avg": "$satisfactionRating"}
                    }}
                ]
            }}
        ]
        ticket_results = await isp_tickets.aggregate(ticket_pipeline).to_list(None)
        ticket_results = ticket_results[0] if ticket_results else {"by_status": [], "by_priority_category": []}

        # Process ticket statistics
        ticket_status_stats = ticket_results["by_status"]
        ticket_detail_stats = ticket_results["by_priority_category"]

        total_tickets = sum(t["count"] for t in ticket_status_stats)
        open_tickets = next((t["count"] for t in ticket_status_stats if t["_id"] == "OPEN"), 0)
        closed_tickets = next((t["count"] for t in ticket_status_stats if t["_id"] == "CLOSED"), 0)

        # Inventory Analytics
        inventory_pipeline = [
            {"$match": {"organizationId": org_id}},
            {"$group": {
                "_id": "$category",
                "name": {"$first": "$name"},
                "count": {"$sum": 1},
                "currentStock": {"$sum": "$quantity"},
                "minimumRequired": {"$min": "$quantityThreshold"},
                "quantity": {"$sum": "$quantity"},
                "usageCount": {"$sum": {"$ifNull": ["$usageCount", 0]}},
                "category": {"$first": "$category"},
                "value": {"$sum": {"$multiply": ["$quantity", "$unitPrice"]}}
            }}
        ]
        
        inventory_stats = await isp_inventories.aggregate(inventory_pipeline).to_list(None)
        
        # Convert inventory stats
        most_used_items = await convert_inventory_stats(get_most_used_items(inventory_stats))
        reorder_needed_items = await convert_inventory_stats(get_reorder_needed(inventory_stats))
        by_category_items = await convert_inventory_stats(inventory_stats)

        # Update the calculations with safe checks
        total_inventory = sum(item.get("count", 0) for item in inventory_stats)
        low_stock = sum(
            1 for item in inventory_stats 
            if item.get("quantity", 0) <= item.get("reorder_threshold", 0)
        )
        out_of_stock = sum(
            1 for item in inventory_stats 
            if item.get("quantity", 0) == 0
        )

        # Revenue Analytics
        revenue_pipeline = [
            {
                "$match": {
                    "organizationId": org_id,
                    "createdAt": {"$gte": thirty_days_ago}
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$createdAt"},
                        "month": {"$month": "$createdAt"},
                        "day": {"$dayOfMonth": "$createdAt"}
                    },
                    "total": {"$sum": "$amount"},
                    "recurring": {"$sum": {"$cond": [{"$eq": ["$type", "RECURRING"]}, "$amount", 0]}},
                    "one_time": {"$sum": {"$cond": [{"$eq": ["$type", "ONE_TIME"]}, "$amount", 0]}},
                    "expenses": {"$sum": "$expenses"}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        revenue_data = await isp_customers_accounting.aggregate(revenue_pipeline).to_list(None)

        # Bandwidth Usage Analytics
        bandwidth_pipeline = [
            {"$match": {"organizationId": org_id, "timestamp": {"$gte": thirty_days_ago}}},
            {"$group": {
                "_id": "$packageId",
                "total_usage": {"$sum": "$totalBytes"},
                "download": {"$sum": "$totalInputBytes"},
                "upload": {"$sum": "$totalOutputBytes"},
                "peak_usage": {"$max": "$totalBytes"}
            }}
        ]
        bandwidth_stats = await isp_customers_accounting.aggregate(bandwidth_pipeline).to_list(None)

        # Recent Activities with Enhanced Details
        recent_activities = await activities.find({
            "organizationId": org_id,
        }).sort("timestamp", -1).limit(10).to_list(None)

        return DashboardStats(
            customers=CustomerStats(
                total=current_customers,
                active=current_customers,
                inactive=total_customers - current_customers,
                growth=calculate_growth(current_customers, previous_customers),
                churn_rate=calculate_churn_rate(customer_stats),
                average_revenue=calculate_average_revenue(customer_stats),
                new_this_month=new_customers,
                by_package=customer_by_package
            ),
            stations=StationStats(
                total=sum(s["count"] for s in station_stats),
                active=next((s["count"] for s in station_stats if s["_id"] == "ACTIVE"), 0),
                inactive=next((s["count"] for s in station_stats if s["_id"] != "ACTIVE"), 0),
                growth=calculate_growth(sum(s["count"] for s in station_stats), 0),
                total_bandwidth=sum(s["total_bandwidth"] for s in station_stats),
                average_uptime=calculate_uptime(station_stats),
                maintenance_needed=sum(s["maintenance_needed"] for s in station_stats),
                by_status=station_stats
            ),
            tickets=TicketStats(
                total=total_tickets,
                open=open_tickets,
                closed=closed_tickets,
                growth=calculate_growth(total_tickets, 0),
                average_resolution_time=calculate_avg_resolution_time(ticket_detail_stats),
                by_priority=[
                    TicketPriorityStats(
                        priority=str(t["_id"]["priority"]),  # Ensure priority is string
                        count=t["count"],
                        percentage=(t["count"] / total_tickets * 100) if total_tickets > 0 else 0.0,
                        avg_resolution_time=safe_float(t.get("avg_resolution_time"))  # Use safe conversion
                    )
                    for t in ticket_detail_stats 
                    if t["_id"].get("priority") is not None  # Safe check for priority existence
                ],
                by_category=[
                    TicketCategoryStats(
                        category=str(t["_id"]["category"]),  # Ensure category is string
                        count=t["count"],
                        percentage=(t["count"] / total_tickets * 100) if total_tickets > 0 else 0.0
                    )
                    for t in ticket_detail_stats 
                    if t["_id"].get("category") is not None  # Safe check for category existence
                ],
                satisfaction_rate=calculate_satisfaction_rate(ticket_detail_stats)
            ),
            inventory=InventoryStats(
                total=total_inventory,
                low_stock=low_stock,
                out_of_stock=out_of_stock,
                growth=calculate_growth(total_inventory, 0),
                total_value=calculate_inventory_value(inventory_stats),
                most_used=most_used_items,
                reorder_needed=reorder_needed_items,
                by_category=by_category_items
            ),
            revenue=RevenueStats(
                data=[
                    RevenueData(
                        date=f"{d['_id']['year']}-{d['_id']['month']}-{d['_id']['day']}",
                        amount=d['total'],
                        recurring=d['recurring'],
                        one_time=d['one_time'],
                        expenses=d['expenses']
                    ) for d in revenue_data
                ],
                growth=calculate_growth(sum(d['total'] for d in revenue_data), 0),
                total_revenue=sum(d['total'] for d in revenue_data),
                recurring_revenue=sum(d['recurring'] for d in revenue_data),
                average_revenue=calculate_average_revenue(revenue_data),
                projected_revenue=sum(d['total'] for d in revenue_data) * 1.1,  # Simple projection
                expenses=sum(d['expenses'] for d in revenue_data),
                profit_margin=(sum(d['total'] for d in revenue_data) - sum(d['expenses'] for d in revenue_data)) / sum(d['total'] for d in revenue_data) * 100 if sum(d['total'] for d in revenue_data) > 0 else 0
            ),
            bandwidth=BandwidthUsage(
                total=sum(b['total_usage'] for b in bandwidth_stats),
                download=sum(b['download'] for b in bandwidth_stats),
                upload=sum(b['upload'] for b in bandwidth_stats),
                peak_time=calculate_peak_time(bandwidth_stats),
                by_package=bandwidth_stats
            ),
            recent_activity=[
                ActivityItem(
                    id=str(activity["_id"]),
                    type=activity.get("type", "GENERAL"),
                    description=activity.get("description", ""),
                    timestamp=activity.get("timestamp", datetime.now(timezone.utc)),
                    user=activity.get("userId", ""),
                    category=activity.get("category", ""),
                    impact=activity.get("impact", "LOW"),
                    details=ActivityDetails(
                        details=convert_details_to_list(activity.get("details", {}))
                    ) if activity.get("details") else None
                ) for activity in recent_activities
            ]
        )






















