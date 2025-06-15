import logging
import asyncio
from datetime import datetime, timezone, timedelta
from app.config.database import isp_customers
from app.schemas.enums import IspManagerCustomerStatus
from app.services.sms.template import SmsTemplateService
from app.services.sms.utils import send_sms_for_organization
from app.schemas.sms_template import TemplateCategory
from app.config.celery_config import celery_app

logger = logging.getLogger(__name__)

@celery_app.task
def send_payment_reminder_sms():
    """Send payment reminder SMS to customers whose expiry is in 5, 3, or 1 days."""
    async def main():
        now = datetime.now(timezone.utc)
        for days in [5, 3, 1]:
            target_date = now + timedelta(days=days)
            customers = await isp_customers.find({
                "expirationDate": {
                    "$gte": datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc),
                    "$lt": datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc)
                },
                "status": IspManagerCustomerStatus.ACTIVE.value
            }).to_list(None)
            logger.info(f"[SMS Scheduler] Days to expire: {days} | Customers found: {len(customers)}")
            for customer in customers:
                sms_vars = {
                    "firstName": customer.get("firstName", ""),
                    "lastName": customer.get("lastName", ""),
                    "daysToExpire": days,
                    "expirationDate": customer["expirationDate"].strftime("%Y-%m-%d")
                }
                try:
                    template_result = await SmsTemplateService.list_templates(
                        organization_id=str(customer["organizationId"]),
                        category=TemplateCategory.PAYMENT_REMINDER,
                        is_active=True
                    )
                    template_doc = None
                    if template_result.get("success") and template_result.get("templates"):
                        template_doc = template_result["templates"][0]
                    if template_doc:
                        message = SmsTemplateService.render_template(template_doc["content"], sms_vars)
                        logger.info(f"[SMS Scheduler] Sending SMS to {customer['phone']} for org {customer['organizationId']} with message: {message}")
                        await send_sms_for_organization(
                            organization_id=str(customer["organizationId"]),
                            to=customer["phone"],
                            message=message
                        )
                    else:
                        logger.warning(f"[SMS Scheduler] No active payment reminder template found for org {customer['organizationId']}")
                except Exception as e:
                    logger.error(f"[SMS Scheduler] Failed to process customer {customer.get('phone', 'N/A')}: {e}")
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        asyncio.ensure_future(main())
    else:
        loop.run_until_complete(main())

# To schedule these tasks periodically, use Celery Beat.
# Example celery beat schedule (add to your celery config):
# CELERY_BEAT_SCHEDULE = {
#     'check-expired-subscriptions': {
#         'task': 'app.tasks.scheduler.check_expired_subscriptions',
#         'schedule': 3600,  # every hour
#     },
#     'send-expiration-reminders': {
#         'task': 'app.tasks.scheduler.send_expiration_reminders',
#         'schedule': 3600,  # every hour
#     },
# }

# Remove asyncio and start_scheduler logic. Run celery worker and beat instead.
# celery -A app.tasks.scheduler worker --loglevel=info
# celery -A app.tasks.scheduler beat --loglevel=info 