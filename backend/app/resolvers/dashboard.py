import strawberry
from typing import List, Optional
from app.schemas.isp_customer import ISPCustomer
from app.schemas.isp_ticket import ISPTicket
from app.schemas.isp_inventory import ISPInventory
from app.schemas.isp_package import ISPPackage
from app.schemas.isp_transactions import ISPTransaction, TransactionType, TransactionStatus
from app.config.database import isp_customers, isp_tickets, isp_inventories, isp_packages, isp_mpesa_transactions
from app.config.redis import redis
from bson.objectid import ObjectId
import json
from datetime import datetime, timezone
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
        for field in ["createdAt", "updatedAt", "expiresAt"]:
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
                            package=ISPPackage(
                                id=c["package"]["id"],
                                name=c["package"]["name"],
                                description=c["package"].get("description", ""),
                                price=c["package"].get("price", 0.0),
                                organization=None,  # Will be populated if needed
                                downloadSpeed=c["package"].get("downloadSpeed", 0.0),
                                uploadSpeed=c["package"].get("uploadSpeed", 0.0),
                                createdAt=c["package"].get("createdAt", datetime.now(timezone.utc)),
                                updatedAt=c["package"].get("updatedAt", datetime.now(timezone.utc))
                            ) if c.get("package") else None,
                            initialAmount=c.get("initialAmount", 0.0),
                            isNew=c.get("isNew", False),
                            reminderDaysSent=c.get("reminderDaysSent", [])
                        )
                        for c in data["customers"]
                    ],
                    tickets=[
                        ISPTicket(
                            id=t["id"],
                            title=t["title"],
                            description=t.get("description", ""),
                            status=t["status"],
                            priority=t["priority"],
                            category=t["category"],
                            organization=None,  # Will be populated if needed
                            createdAt=t["createdAt"] if t["createdAt"] else None,
                            updatedAt=t["updatedAt"] if t["updatedAt"] else None
                        )
                        for t in data["tickets"]
                    ],
                    inventories=[
                        ISPInventory(
                            id=i["id"],
                            name=i["name"],
                            category=i["category"],
                            organization=None,  # Will be populated if needed
                            model=i.get("model"),
                            manufacturer=i.get("manufacturer"),
                            serialNumber=i.get("serialNumber"),
                            macAddress=i.get("macAddress"),
                            ipAddress=i.get("ipAddress"),
                            quantity=i.get("quantity", 0),
                            quantityThreshold=i.get("quantityThreshold"),
                            unitPrice=i.get("unitPrice", 0.0),
                            status=i["status"],
                            location=i.get("location"),
                            assignedTo=i.get("assignedTo"),
                            warrantyExpirationDate=i.get("warrantyExpirationDate"),
                            purchaseDate=i.get("purchaseDate"),
                            specifications=i.get("specifications"),
                            notes=i.get("notes"),
                            createdAt=i["createdAt"] if i["createdAt"] else None,
                            updatedAt=i["updatedAt"] if i["updatedAt"] else None
                        )
                        for i in data["inventories"]
                    ],
                    packages=[
                        ISPPackage(
                            id=p["id"],
                            name=p["name"],
                            description=p.get("description", ""),
                            price=p.get("price", 0.0),
                            organization=None,  # Will be populated if needed
                            downloadSpeed=p.get("downloadSpeed", 0.0),
                            uploadSpeed=p.get("uploadSpeed", 0.0),
                            burstDownload=p.get("burstDownload", 0.0),
                            burstUpload=p.get("burstUpload", 0.0),
                            thresholdDownload=p.get("thresholdDownload", 0.0),
                            thresholdUpload=p.get("thresholdUpload", 0.0),
                            burstTime=p.get("burstTime", 0),
                            serviceType=p.get("serviceType"),
                            addressPool=p.get("addressPool"),
                            sessionTimeout=p.get("sessionTimeout"),
                            idleTimeout=p.get("idleTimeout"),
                            priority=p.get("priority"),
                            vlanId=p.get("vlanId"),
                            showInHotspot=p.get("showInHotspot", False),
                            duration=p.get("duration"),
                            durationUnit=p.get("durationUnit"),
                            dataLimit=p.get("dataLimit"),
                            dataLimitUnit=p.get("dataLimitUnit"),
                            createdAt=p["createdAt"] if p["createdAt"] else None,
                            updatedAt=p["updatedAt"] if p["updatedAt"] else None
                        )
                        for p in data["packages"]
                    ],
                    transactions=[
                        ISPTransaction(
                            id=tr["id"],
                            organizationId=tr["organizationId"],
                            transactionType=tr.get("transactionType", TransactionType.CUSTOMER_PAYMENT.value),
                            callbackType=tr.get("callbackType", ""),
                            status=tr.get("status", TransactionStatus.COMPLETED.value),
                            amount=tr.get("amount", 0.0),
                            phoneNumber=tr.get("phoneNumber", ""),
                            createdAt=tr["createdAt"] if tr["createdAt"] else None,
                            updatedAt=tr["updatedAt"] if tr["updatedAt"] else None,
                            transactionId=tr.get("transactionId", tr["id"]),  # Use id as fallback
                            paymentMethod=tr.get("paymentMethod", "mpesa"),
                            # Customer payment specific fields
                            firstName=tr.get("firstName", ""),
                            middleName=tr.get("middleName"),
                            lastName=tr.get("lastName", ""),
                            billRefNumber=tr.get("billRefNumber"),
                            businessShortCode=tr.get("businessShortCode"),
                            orgAccountBalance=tr.get("orgAccountBalance"),
                            transTime=tr.get("transTime"),
                            # Hotspot voucher specific fields
                            voucherCode=tr.get("voucherCode"),
                            packageId=tr.get("packageId"),
                            packageName=tr.get("packageName"),
                            duration=tr.get("duration"),
                            dataLimit=tr.get("dataLimit"),
                            expiresAt=tr.get("expiresAt")
                        )
                        for tr in data["transactions"]
                    ],
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
                "organizationId": tr.organizationId,
                "transactionType": tr.transactionType,
                "callbackType": tr.callbackType,
                "status": tr.status,
                "amount": tr.amount,
                "phoneNumber": tr.phoneNumber,
                "createdAt": tr.createdAt.isoformat() if hasattr(tr, 'createdAt') and tr.createdAt else None,
                "updatedAt": tr.updatedAt.isoformat() if hasattr(tr, 'updatedAt') and tr.updatedAt else None,
                "transactionId": getattr(tr, 'transactionId', tr.id),  # Use id as fallback
                "paymentMethod": getattr(tr, 'paymentMethod', 'mpesa'),
                # Customer payment specific fields
                "firstName": getattr(tr, 'firstName', ''),
                "middleName": getattr(tr, 'middleName'),
                "lastName": getattr(tr, 'lastName', ''),
                "billRefNumber": getattr(tr, 'billRefNumber'),
                "businessShortCode": getattr(tr, 'businessShortCode'),
                "orgAccountBalance": getattr(tr, 'orgAccountBalance'),
                "transTime": getattr(tr, 'transTime'),
                # Hotspot voucher specific fields
                "voucherCode": getattr(tr, 'voucherCode'),
                "packageId": getattr(tr, 'packageId'),
                "packageName": getattr(tr, 'packageName'),
                "duration": getattr(tr, 'duration'),
                "dataLimit": getattr(tr, 'dataLimit'),
                "expiresAt": tr.expiresAt.isoformat() if hasattr(tr, 'expiresAt') and tr.expiresAt else None
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
