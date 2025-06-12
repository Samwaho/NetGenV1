#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Fixing SSL certificate permissions...${NC}"

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Check if certificates exist
if [ ! -f "ssl/ispinnacle.co.ke.crt" ] || [ ! -f "ssl/ispinnacle.co.ke.key" ]; then
    echo -e "${RED}SSL certificates not found in ssl directory!${NC}"
    echo "Please run setup_ssl.sh first to obtain the certificates."
    exit 1
fi

# Set proper permissions
echo "Setting proper permissions..."
sudo chown -R root:root ssl/
sudo chmod 644 ssl/ispinnacle.co.ke.crt
sudo chmod 600 ssl/ispinnacle.co.ke.key

# Ensure nginx can read the certificates
echo "Ensuring nginx can read the certificates..."
sudo chown -R root:root /etc/nginx/ssl/
sudo chmod 644 /etc/nginx/ssl/ispinnacle.co.ke.crt
sudo chmod 600 /etc/nginx/ssl/ispinnacle.co.ke.key

# Copy certificates to nginx ssl directory
echo "Copying certificates to nginx ssl directory..."
sudo mkdir -p /etc/nginx/ssl/
sudo cp ssl/ispinnacle.co.ke.crt /etc/nginx/ssl/
sudo cp ssl/ispinnacle.co.ke.key /etc/nginx/ssl/

echo -e "${GREEN}Permissions have been fixed!${NC}"
echo "You can now restart your Docker containers with: docker-compose down && docker-compose up -d" 