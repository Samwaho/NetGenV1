FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps flag
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application in production mode
CMD ["npm", "start"]

