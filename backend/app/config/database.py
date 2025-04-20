from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
import certifi

# Create MongoDB client with SSL configuration
client = AsyncIOMotorClient(
    settings.MONGODB_URL,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000
)
db = client[settings.DATABASE_NAME]

# Export collections for easy access
users = db.users
organizations = db.organizations
plans = db.plans
subscriptions = db.subscriptions
activities = db.activities
isp_packages = db.isp_packages
isp_stations = db.isp_stations
isp_customers = db.isp_customers
isp_customers_accounting = db.isp_customers_accounting
isp_customer_payments = db.isp_customer_payments
isp_inventories = db.isp_inventories
isp_tickets = db.isp_tickets
isp_mpesa_transactions = db.isp_mpesa_transactions


async def connect_to_database():
    """Test database connection"""
    try:
        await client.admin.command('ping')
        print("Connected to MongoDB.")
    except Exception as e:
        print(f"Could not connect to MongoDB: {e}")
        raise

async def close_database_connection():
    """Close database connection"""
    client.close()
    print("MongoDB connection closed.")
