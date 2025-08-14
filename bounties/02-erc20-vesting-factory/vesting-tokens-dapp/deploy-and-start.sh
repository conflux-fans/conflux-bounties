#!/bin/bash

# Deploy and Start Script for Vesting Tokens DApp
# This script deploys the contract to Sepolia and starts the docker compose with the new address

set -e  # Exit on any error

echo "🚀 Starting deployment and startup process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "contracts/hardhat-project" ]; then
    print_error "This script must be run from the vesting-tokens-dapp root directory"
    exit 1
fi

# Navigate to hardhat project
print_status "Navigating to hardhat project directory..."
cd contracts/hardhat-project

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    print_status "Installing npm dependencies..."
    npm install
    print_success "Dependencies installed successfully"
else
    print_status "Dependencies already installed, skipping npm install"
fi

# Check if .env file exists for hardhat configuration
if [ ! -f ".env" ]; then
    print_warning "No .env file found in hardhat project. Please ensure you have configured:"
    print_warning "- PRIVATE_KEY"
    print_warning "- SEPOLIA_RPC_URL"
    print_warning "- ETHERSCAN_API_KEY (optional, for verification)"
    echo ""
    read -p "Do you want to continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled by user"
        exit 1
    fi
fi

# Deploy to Sepolia
print_status "Deploying TokenVestingFactory to Sepolia..."
print_warning "This may take a few minutes. Please wait..."

# Capture the deployment output
deployment_output=$(npm run deploy:sepolia 2>&1)
deployment_exit_code=$?

if [ $deployment_exit_code -ne 0 ]; then
    print_error "Deployment failed!"
    echo "$deployment_output"
    exit 1
fi

print_success "Contract deployed successfully!"

# Extract the factory address from the deployment output
# Look for the line containing "TokenVestingFactory deployed to:"
factory_address=$(echo "$deployment_output" | grep "TokenVestingFactory deployed to:" | sed 's/.*TokenVestingFactory deployed to: //')

if [ -z "$factory_address" ]; then
    print_error "Could not extract factory address from deployment output"
    echo "Deployment output:"
    echo "$deployment_output"
    exit 1
fi

print_success "Factory address extracted: $factory_address"

# Go back to root directory
cd ../..

# Create or update .env file with the new factory address
print_status "Updating environment configuration..."

# Check if .env file exists
if [ -f ".env" ]; then
    # Update existing .env file
    if grep -q "NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS" .env; then
        # Replace existing value
        sed -i.bak "s/NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS=.*/NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS=$factory_address/" .env
        rm .env.bak 2>/dev/null || true
        print_success "Updated existing .env file"
    else
        # Add new line
        echo "NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS=$factory_address" >> .env
        print_success "Added factory address to .env file"
    fi
else
    # Create new .env file
    cat > .env << EOF
# Environment configuration for Vesting Tokens DApp
# Generated automatically by deploy-and-start.sh

# Contract Addresses
NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS=$factory_address

# Add other required environment variables as needed:
# NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
# NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
# NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS=your_mainnet_factory_address
EOF
    print_success "Created new .env file with factory address"
fi

# Export the environment variable for current session
export NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS="$factory_address"

print_status "Starting services with make start..."

# Stop any existing processes if needed (optional)
print_status "Starting services..."
make start

# Wait a moment for services to start
sleep 5

# Check if services are running (optional check)
print_status "Checking if services are running..."
if pgrep -f "next" > /dev/null; then
    print_success "Next.js service is running"
else
    print_warning "Next.js service may not be running, check manually"
fi

print_success "🎉 Deployment and startup completed successfully!"
echo ""
echo "📋 Summary:"
echo "   Factory Address: $factory_address"
echo "   Environment: Updated .env file"
echo "   Docker Services: Started"
echo ""
echo "🌐 Your DApp should be available at: http://localhost:3000"
echo "📊 Database admin available at: http://localhost:5050"
echo ""
echo "📝 To view logs: check the terminal where make start is running"
echo "🛑 To stop services: Ctrl+C in the make start terminal or use make stop" 