from redis.asyncio import Redis
from app.config.settings import settings

redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"

redis = Redis.from_url(
    redis_url,
    encoding="utf-8",
    decode_responses=True,
    password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
) 
