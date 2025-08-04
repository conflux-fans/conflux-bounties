#!/bin/bash

# Setup test database for integration tests
set -e

echo "Setting up test database for webhook relay system..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run integration tests."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker compose &> /dev/null; then
    echo "docker-compose is not installed. Please install docker-compose to run integration tests."
    exit 1
fi

# Start PostgreSQL container for testing
echo "Starting PostgreSQL container for testing..."
docker compose -f docker-compose.yml up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
timeout=60
counter=0

while ! docker exec webhook-relay-postgres pg_isready -U webhook_user -d webhook_relay > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo "Timeout waiting for PostgreSQL to be ready"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($counter/$timeout)"
    sleep 1
    counter=$((counter + 1))
done

echo "PostgreSQL is ready!"

# Create test database
echo "Creating test database..."
docker exec webhook-relay-postgres psql -U webhook_user -d webhook_relay -c "CREATE DATABASE webhook_relay_test;" || echo "Test database already exists"

# Set environment variables for tests
export TEST_DATABASE_URL="postgresql://webhook_user:webhook_pass@localhost:5432/webhook_relay_test"
export NODE_ENV=test

echo "Test database setup complete!"
echo "You can now run integration tests with: npm run test:integration"
echo ""
echo "To stop the test database:"
echo "docker-compose down"