import asyncio
import logging
from datetime import datetime, timezone, timedelta
from app.config.database import isp_customers
from app.schemas.enums import IspManagerCustomerStatus
from app.config.utils import record_activity
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

async def check_expired_subscriptions():
    """Check for expired subscriptions and update customer status"""
    try:
        now = datetime.now(timezone.utc)
        
        # Find customers with expired subscriptions that are still active
        expired_customers = await isp_customers.find({
            "expirationDate": {"$lt": now},
            "status": IspManagerCustomerStatus.ACTIVE.value
        }).to_list(None)
        
        count = 0
        for customer in expired_customers:
            # Update customer status to inactive
            await isp_customers.update_one(
                {"_id": customer["_id"]},
                {
                    "$set": {
                        "status": IspManagerCustomerStatus.INACTIVE.value,
                        "updatedAt": now
                    }
                }
            )
            
            # Record activity
            await record_activity(
                None,  # System-generated activity
                customer["organizationId"],
                f"Customer {customer['username']} subscription expired and marked as inactive"
            )
            
            count += 1
            
        if count > 0:
            logger.info(f"Updated {count} expired customer subscriptions to inactive")
            
    except Exception as e:
        logger.error(f"Error checking expired subscriptions: {str(e)}")

async def send_expiration_reminders():
    """Send reminders to customers whose subscriptions are about to expire"""
    try:
        now = datetime.now(timezone.utc)
        reminder_threshold = now + timedelta(days=3)  # Remind if expiring within 3 days
        
        # Find customers with subscriptions expiring soon
        expiring_customers = await isp_customers.find({
            "expirationDate": {"$gt": now, "$lt": reminder_threshold},
            "status": IspManagerCustomerStatus.ACTIVE.value,
            "$or": [
                {"lastReminderSent": {"$exists": False}},
                {"lastReminderSent": {"$lt": now - timedelta(days=1)}}  # Don't send more than one reminder per day
            ]
        }).to_list(None)
        
        count = 0
        for customer in expiring_customers:
            # Send reminder (in a real implementation, this would send SMS or email)
            days_remaining = (customer["expirationDate"] - now).days
            
            # Record that reminder was sent
            await isp_customers.update_one(
                {"_id": customer["_id"]},
                {
                    "$set": {
                        "lastReminderSent": now,
                        "updatedAt": now
                    }
                }
            )
            
            # In production, you would integrate with SMS or email service here
            logger.info(f"Sending reminder to {customer['username']}: Subscription expires in {days_remaining} days")
            
            count += 1
            
        if count > 0:
            logger.info(f"Sent {count} subscription expiration reminders")
            
    except Exception as e:
        logger.error(f"Error sending expiration reminders: {str(e)}")

async def run_scheduled_tasks():
    """Run all scheduled tasks"""
    while True:
        await check_expired_subscriptions()
        await send_expiration_reminders()
        
        # Sleep for an hour before next check
        await asyncio.sleep(3600)  # 1 hour
        
def start_scheduler():
    """Start the scheduler in the background"""
    asyncio.create_task(run_scheduled_tasks()) 