#!/bin/bash

echo "🛑 Stopping Celery services..."
docker-compose stop celery_worker celery_beat

echo "🔨 Rebuilding backend image..."
docker-compose build backend

echo "🚀 Starting Celery services..."
docker-compose up -d celery_worker celery_beat

echo "⏳ Waiting for services to start..."
sleep 5

echo "📋 Checking service status..."
docker-compose ps celery_worker celery_beat

echo "📝 Showing logs for Celery services..."
echo "Press Ctrl+C to stop following logs"
docker-compose logs -f celery_worker celery_beat
