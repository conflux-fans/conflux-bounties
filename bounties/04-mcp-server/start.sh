#!/bin/bash
set -e

echo "Setting up Conflux MCP Server..."

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker not found. Please install Docker Desktop."
    exit 1
fi

# Stop existing containers
docker-compose down 2>/dev/null || true

# Build and start
echo "Building and starting server..."
docker-compose up --build -d

# Wait and check
sleep 10
if curl -f http://localhost:3333/health >/dev/null 2>&1; then
    echo "SUCCESS: Server is running at http://localhost:3333"
else
    echo "ERROR: Server not responding. Check logs with: docker-compose logs"
    exit 1
fi 