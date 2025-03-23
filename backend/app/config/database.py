from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings

# Create MongoDB client
client = AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

# Export collections for easy access
users = db.users
organizations = db.organizations
services = db.services
subscriptions = db.subscriptions
activities = db.activities
isp_manager_packages = db.isp_manager_packages
isp_manager_stations = db.isp_manager_stations
isp_manager_customers = db.isp_manager_customers

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
