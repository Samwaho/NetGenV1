#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SSL Certificate Setup for ispinnacle.co.ke${NC}"

# Create necessary directories
echo "Creating SSL directories..."
mkdir -p ssl
mkdir -p nginx/ssl

# Install required packages
echo "Installing required packages..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx if it's running
echo "Stopping nginx..."
sudo systemctl stop nginx

# Obtain SSL certificate
echo "Obtaining SSL certificate..."
sudo certbot certonly --standalone \
    -d ispinnacle.co.ke \
    -d www.ispinnacle.co.ke \
    --agree-tos \
    --email admin@ispinnacle.co.ke \
    --non-interactive

# Check if certificate was obtained successfully
if [ $? -eq 0 ]; then
    echo -e "${GREEN}SSL certificate obtained successfully!${NC}"
    
    # Copy certificates to project directory
    echo "Copying certificates to project directory..."
    sudo cp /etc/letsencrypt/live/ispinnacle.co.ke/fullchain.pem ssl/ispinnacle.co.ke.crt
    sudo cp /etc/letsencrypt/live/ispinnacle.co.ke/privkey.pem ssl/ispinnacle.co.ke.key
    
    # Set proper permissions
    sudo chown -R $USER:$USER ssl/
    chmod 600 ssl/ispinnacle.co.ke.key
    chmod 644 ssl/ispinnacle.co.ke.crt
    
    echo -e "${GREEN}SSL certificates have been set up successfully!${NC}"
    echo "Certificates are located in the 'ssl' directory"
    
    # Create auto-renewal script
    echo "Creating auto-renewal script..."
    cat > renew_ssl.sh << 'EOF'
#!/bin/bash
certbot renew --quiet
cp /etc/letsencrypt/live/ispinnacle.co.ke/fullchain.pem ssl/ispinnacle.co.ke.crt
cp /etc/letsencrypt/live/ispinnacle.co.ke/privkey.pem ssl/ispinnacle.co.ke.key
chmod 600 ssl/ispinnacle.co.ke.key
chmod 644 ssl/ispinnacle.co.ke.crt
docker-compose restart nginx
EOF
    
    chmod +x renew_ssl.sh
    
    # Add cron job for auto-renewal
    echo "Setting up auto-renewal cron job..."
    (crontab -l 2>/dev/null; echo "0 0 1 * * $(pwd)/renew_ssl.sh") | crontab -
    
    echo -e "${GREEN}Auto-renewal has been set up!${NC}"
    echo "The certificates will be automatically renewed when they're close to expiration."
    
else
    echo -e "${RED}Failed to obtain SSL certificate. Please check the error messages above.${NC}"
    exit 1
fi

echo -e "${GREEN}SSL setup completed!${NC}"
echo "You can now start your Docker containers with: docker-compose up -d" 