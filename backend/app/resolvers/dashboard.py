import strawberry
from typing import List, Optional
from app.schemas.isp_customer import ISPCustomer
from app.schemas.isp_ticket import ISPTicket
from app.schemas.isp_inventory import ISPInventory
from app.schemas.isp_package import ISPPackage
from app.schemas.isp_transactions import ISPTransaction, TransactionType, TransactionStatus
from app.config.database import isp_customers, isp_tickets, isp_inventories, isp_packages, isp_mpesa_transactions
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

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
