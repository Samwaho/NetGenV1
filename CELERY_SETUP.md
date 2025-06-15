# Celery Setup and Configuration

This document explains the Celery setup for the NetGen application, including task scheduling and background job processing.

## Overview

The application uses Celery for:
- **Background Tasks**: Processing SMS reminders asynchronously
- **Scheduled Tasks**: Daily payment reminder SMS to customers
- **Task Queue Management**: Redis as message broker and result backend

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Celery Beat   │    │  Celery Worker  │    │     Redis       │
│   (Scheduler)   │───▶│  (Task Runner)  │◄──▶│  (Message       │
│                 │    │                 │    │   Broker)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuration Files

### 1. `backend/app/config/celery_config.py`
- Centralized Celery configuration
- Broker and backend settings
- Task routing and serialization
- Beat schedule definitions

### 2. `backend/app/tasks/scheduler.py`
- Task definitions
- SMS reminder logic
- Async task execution

### 3. `docker-compose.yml`
- Service definitions for celery_worker and celery_beat
- Environment variables
- Volume mounts

## Security Improvements

### Non-Root User Execution
- **Issue**: Celery was running with superuser privileges (root)
- **Solution**: 
  - Created `appuser` in Dockerfile
  - Added `--uid=1000 --gid=1000` flags to Celery commands
  - Changed ownership of app directory to `appuser`

### Deprecation Warning Fix
- **Issue**: `broker_connection_retry` deprecation warning for Celery 6.0+
- **Solution**: Added `broker_connection_retry_on_startup=True` configuration

## Tasks

### Payment Reminder SMS
- **Task**: `send_payment_reminder_sms`
- **Schedule**: Daily (86400 seconds)
- **Function**: Sends SMS reminders to customers 5, 3, and 1 days before expiration
- **Template**: Uses organization-specific SMS templates

## Running Celery Services

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# Start only Celery services
docker-compose up -d celery_worker celery_beat

# View logs
docker-compose logs -f celery_worker celery_beat

# Restart Celery services
./restart_celery.sh
```

### Manual Commands (for development)
```bash
# Worker
celery -A app.tasks.scheduler worker --loglevel=info --uid=1000 --gid=1000

# Beat (scheduler)
celery -A app.tasks.scheduler beat --loglevel=info --uid=1000 --gid=1000

# Monitor tasks
celery -A app.tasks.scheduler flower
```

## Monitoring

### Logs
```bash
# View worker logs
docker-compose logs celery_worker

# View beat logs
docker-compose logs celery_beat

# Follow logs in real-time
docker-compose logs -f celery_worker celery_beat
```

### Redis Monitoring
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli monitor

# Check queue status
docker-compose exec redis redis-cli llen celery
```

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Ensure proper file ownership in Docker container
   - Check that `appuser` has access to required directories

2. **Connection Refused to Redis**
   - Verify Redis service is running
   - Check network connectivity between services
   - Validate Redis connection settings

3. **Tasks Not Executing**
   - Check worker logs for errors
   - Verify task registration
   - Ensure beat scheduler is running

4. **Memory Issues**
   - Monitor worker memory usage
   - Adjust `worker_prefetch_multiplier` setting
   - Consider worker auto-scaling

### Debug Commands
```bash
# Check Celery configuration
celery -A app.tasks.scheduler inspect conf

# List active tasks
celery -A app.tasks.scheduler inspect active

# List scheduled tasks
celery -A app.tasks.scheduler inspect scheduled

# Purge all tasks
celery -A app.tasks.scheduler purge
```

## Environment Variables

Required environment variables for Celery:
- `REDIS_HOST`: Redis server hostname (default: redis)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_DB`: Redis database number (default: 0)
- `REDIS_PASSWORD`: Redis password (optional)

## Best Practices

1. **Task Design**
   - Keep tasks idempotent
   - Handle exceptions gracefully
   - Use appropriate retry strategies

2. **Security**
   - Never run Celery as root in production
   - Use proper authentication for Redis
   - Validate task inputs

3. **Performance**
   - Monitor task execution times
   - Use appropriate serialization formats
   - Configure worker concurrency based on workload

4. **Monitoring**
   - Set up proper logging
   - Monitor queue lengths
   - Track task success/failure rates
