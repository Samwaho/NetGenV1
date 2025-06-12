#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Fixing SSL certificate permissions for Docker...${NC}"

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Check if certificates exist
if [ ! -f "ssl/ispinnacle.co.ke.crt" ] || [ ! -f "ssl/ispinnacle.co.ke.key" ]; then
    echo -e "${RED}SSL certificates not found in ssl directory!${NC}"
    echo "Please run setup_ssl.sh first to obtain the certificates."
    exit 1
fi

# Set proper permissions for Docker
echo "Setting proper permissions..."
sudo chown -R 101:101 ssl/  # 101 is the nginx user ID in the official nginx image
sudo chmod 644 ssl/ispinnacle.co.ke.crt
sudo chmod 640 ssl/ispinnacle.co.ke.key

echo -e "${GREEN}Permissions have been fixed!${NC}"
echo "You can now restart your Docker containers with: docker-compose down && docker-compose up -d" 