from celery import Celery
from app.config.settings import settings

def create_celery_app() -> Celery:
    """Create and configure Celery application."""
    
    # Create Celery app
    celery_app = Celery(
        'scheduler',
        broker=f'redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}',
        backend=f'redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}'
    )
    
    # Configure Celery settings
    celery_app.conf.update(
        # Fix for Celery 6.0+ deprecation warning
        broker_connection_retry_on_startup=True,
        
        # Serialization settings
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        
        # Timezone settings
        timezone='UTC',
        enable_utc=True,
        
        # Task routing and execution settings
        task_routes={
            'app.tasks.scheduler.*': {'queue': 'scheduler'},
        },
        
        # Worker settings
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        
        # Result backend settings
        result_expires=3600,  # 1 hour
        
        # Beat schedule
        beat_schedule={
            'send-payment-reminder-sms': {
                'task': 'app.tasks.scheduler.send_payment_reminder_sms',
                'schedule': 86400,  # once a day (in seconds)
            },
        },
    )
    
    return celery_app

# Create the Celery app instance
celery_app = create_celery_app()
