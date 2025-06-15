#!/bin/bash

echo "Stopping Celery services..."
docker-compose stop celery_worker celery_beat

echo "Rebuilding backend image..."
docker-compose build backend

echo "Starting Celery services..."
docker-compose up -d celery_worker celery_beat

echo "Showing logs for Celery services..."
docker-compose logs -f celery_worker celery_beat
