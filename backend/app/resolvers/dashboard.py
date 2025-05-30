import strawberry
from typing import List, Optional
from app.schemas.isp_customer import ISPCustomer
from app.schemas.isp_ticket import ISPTicket
from app.schemas.isp_inventory import ISPInventory
from app.schemas.isp_package import ISPPackage
from app.schemas.isp_transactions import ISPTransaction
from app.config.database import isp_customers, isp_tickets, isp_inventories, isp_packages, isp_mpesa_transactions
from app.config.redis import redis
from bson.objectid import ObjectId
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes

def serialize(obj):
    import json
    return json.dumps(obj, default=str)

def deserialize(s):
    import json
    return json.loads(s)

def parse_dashboard_datetimes(data):
    # Parse datetimes for customers, tickets, inventories, packages, transactions
    def parse_dt(val):
        from datetime import datetime
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val)
            except Exception:
                return val
        return val
    for c in data.get("customers", []):
        for field in ["expirationDate", "createdAt", "updatedAt"]:
            if field in c:
                c[field] = parse_dt(c[field])
    for t in data.get("tickets", []):
        for field in ["createdAt", "updatedAt"]:
            if field in t:
                t[field] = parse_dt(t[field])
    for i in data.get("inventories", []):
        for field in ["createdAt", "updatedAt"]:
            if field in i:
                i[field] = parse_dt(i[field])
    for p in data.get("packages", []):
        for field in ["createdAt", "updatedAt"]:
            if field in p:
                p[field] = parse_dt(p[field])
    for tr in data.get("transactions", []):
        for field in ["createdAt", "updatedAt"]:
            if field in tr:
                tr[field] = parse_dt(tr[field])
    return data

@strawberry.type
class DashboardStats:
    customers: List[ISPCustomer]
    tickets: List[ISPTicket]
    inventories: List[ISPInventory]
    packages: List[ISPPackage]
    transactions: List[ISPTransaction]
    total_customers: int
    total_tickets: int
    total_inventory_items: int
    total_packages: int
    total_transactions: int

@strawberry.type
class DashboardResolver:
    @strawberry.field
    async def dashboard_stats(self, info, organization_id: str) -> DashboardStats:
        cache_key = f"dashboard_stats:{organization_id}"
        cached = await redis.get(cache_key)
        if cached:
            try:
                data = deserialize(cached)
                data = parse_dashboard_datetimes(data)
                # Create partial objects with only the fields needed for display
                return DashboardStats(
                    customers=[
                        ISPCustomer(
                            id=c["id"],
                            firstName=c["firstName"],
                            lastName=c["lastName"],
                            email=c["email"],
                            phone=c["phone"],
                            username=c["username"],
                            status=c["status"],
                            online=c["online"],
                            expirationDate=c["expirationDate"] if c["expirationDate"] else None,
                            createdAt=c["createdAt"] if c["createdAt"] else None,
                            updatedAt=c["updatedAt"] if c["updatedAt"] else None,
                            # Add default values for required fields
                            password="",  # Empty password for display purposes
                            organization=None,  # Will be populated if needed
                            station=None,  # Will be populated if needed
                            package=ISPPackage(**c["package"]) if c["package"] else None,
                            initialAmount=c.get("initialAmount", 0.0),
                            isNew=c.get("isNew", False),
                            reminderDaysSent=c.get("reminderDaysSent", [])
                        )
                        for c in data["customers"]
                    ],
                    tickets=[ISPTicket(**t) for t in data["tickets"]],
                    inventories=[ISPInventory(**i) for i in data["inventories"]],
                    packages=[ISPPackage(**p) for p in data["packages"]],
                    transactions=[ISPTransaction(**tr) for tr in data["transactions"]],
                    total_customers=data["total_customers"],
                    total_tickets=data["total_tickets"],
                    total_inventory_items=data["total_inventory_items"],
                    total_packages=data["total_packages"],
                    total_transactions=data["total_transactions"]
                )
            except (TypeError, KeyError, ValueError) as e:
                # If there's any error reconstructing from cache, log it and continue to fetch fresh data
                logger.error(f"Error reconstructing from cache: {str(e)}")
                # Continue to fetch fresh data

        # Fetch recent customers (limit 20)
        customers_cursor = isp_customers.find({"organizationId": ObjectId(organization_id)}).sort("createdAt", -1).limit(20)
        customers = [await ISPCustomer.from_db(doc) async for doc in customers_cursor]
        total_customers = await isp_customers.count_documents({"organizationId": ObjectId(organization_id)})

        # Fetch recent tickets (limit 20)
        tickets_cursor = isp_tickets.find({"organizationId": ObjectId(organization_id)}).sort("createdAt", -1).limit(20)
        tickets = [await ISPTicket.from_db(doc) async for doc in tickets_cursor]
        total_tickets = await isp_tickets.count_documents({"organizationId": ObjectId(organization_id)})

        # Fetch recent inventory items (limit 20)
        inventories_cursor = isp_inventories.find({"organizationId": ObjectId(organization_id)}).sort("createdAt", -1).limit(20)
        inventories = [await ISPInventory.from_db(doc) async for doc in inventories_cursor]
        total_inventory_items = await isp_inventories.count_documents({"organizationId": ObjectId(organization_id)})

        # Fetch all packages (limit 20)
        packages_cursor = isp_packages.find({"organizationId": ObjectId(organization_id)}).sort("createdAt", -1).limit(20)
        packages = [await ISPPackage.from_db(doc) async for doc in packages_cursor]
        total_packages = await isp_packages.count_documents({"organizationId": ObjectId(organization_id)})

        # Fetch recent transactions (limit 20)
        transactions_cursor = isp_mpesa_transactions.find({"organizationId": ObjectId(organization_id)}).sort("createdAt", -1).limit(20)
        transactions = [await ISPTransaction.from_db(doc) async for doc in transactions_cursor]
        total_transactions = await isp_mpesa_transactions.count_documents({"organizationId": ObjectId(organization_id)})

        # Create serializable dictionaries instead of using __dict__
        serializable_data = {
            "customers": [c.to_dict() if hasattr(c, 'to_dict') else {
                "id": c.id,
                "firstName": c.firstName,
                "lastName": c.lastName,
                "email": c.email,
                "phone": c.phone,
                "username": c.username,
                "status": c.status,
                "online": c.online,
                "expirationDate": c.expirationDate.isoformat() if hasattr(c, 'expirationDate') and c.expirationDate else None,
                "package": {"id": c.package.id, "name": c.package.name} if c.package else None,
                "createdAt": c.createdAt.isoformat() if hasattr(c, 'createdAt') and c.createdAt else None,
                "updatedAt": c.updatedAt.isoformat() if hasattr(c, 'updatedAt') and c.updatedAt else None,
                "initialAmount": getattr(c, 'initialAmount', 0.0),
                "isNew": getattr(c, 'isNew', False),
                "reminderDaysSent": getattr(c, 'reminderDaysSent', [])
            } for c in customers],
            "tickets": [t.to_dict() if hasattr(t, 'to_dict') else {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "category": t.category,
                "createdAt": t.createdAt.isoformat() if hasattr(t, 'createdAt') and t.createdAt else None,
                "updatedAt": t.updatedAt.isoformat() if hasattr(t, 'updatedAt') and t.updatedAt else None
            } for t in tickets],
            "inventories": [i.to_dict() if hasattr(i, 'to_dict') else {
                "id": i.id,
                "name": i.name,
                "category": i.category,
                "status": i.status,
                "quantity": i.quantity,
                "quantityThreshold": i.quantityThreshold,
                "unitPrice": i.unitPrice,
                "createdAt": i.createdAt.isoformat() if hasattr(i, 'createdAt') and i.createdAt else None,
                "updatedAt": i.updatedAt.isoformat() if hasattr(i, 'updatedAt') and i.updatedAt else None
            } for i in inventories],
            "packages": [p.to_dict() if hasattr(p, 'to_dict') else {
                "id": p.id,
                "name": p.name,
                "price": p.price,
                "createdAt": p.createdAt.isoformat() if hasattr(p, 'createdAt') and p.createdAt else None,
                "updatedAt": p.updatedAt.isoformat() if hasattr(p, 'updatedAt') and p.updatedAt else None
            } for p in packages],
            "transactions": [tr.to_dict() if hasattr(tr, 'to_dict') else {
                "id": tr.id,
                "transactionId": tr.transactionId,
                "transactionType": tr.transactionType,
                "amount": tr.amount,
                "createdAt": tr.createdAt.isoformat() if hasattr(tr, 'createdAt') and tr.createdAt else None,
                "updatedAt": tr.updatedAt.isoformat() if hasattr(tr, 'updatedAt') and tr.updatedAt else None
            } for tr in transactions],
            "total_customers": total_customers,
            "total_tickets": total_tickets,
            "total_inventory_items": total_inventory_items,
            "total_packages": total_packages,
            "total_transactions": total_transactions
        }
        
        try:
            await redis.set(cache_key, serialize(serializable_data), ex=CACHE_TTL)
        except Exception as e:
            logger.error(f"Error caching dashboard data: {str(e)}")
            # Continue even if caching fails

        # Return the DashboardStats object
        return DashboardStats(
            customers=customers,
            tickets=tickets,
            inventories=inventories,
            packages=packages,
            transactions=transactions,
            total_customers=total_customers,
            total_tickets=total_tickets,
            total_inventory_items=total_inventory_items,
            total_packages=total_packages,
            total_transactions=total_transactions
        ) 
