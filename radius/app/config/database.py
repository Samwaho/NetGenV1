from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# MongoDB Settings
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

# Create MongoDB client with SSL configuration
client = AsyncIOMotorClient(
    MONGODB_URL,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000
)
db = client[DATABASE_NAME]

# Export collections for easy access
isp_customers = db.isp_customers
isp_customers_accounting = db.isp_customers_accounting
isp_packages = db.isp_packages
hotspot_vouchers = db.hotspot_vouchers
hotspot_vouchers_accounting = db.hotspot_vouchers_accounting


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
