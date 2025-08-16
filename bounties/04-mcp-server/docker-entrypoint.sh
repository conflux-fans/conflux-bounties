#!/bin/sh
set -e

echo "Starting Conflux MCP Server..."

# Check for built files and start
if [ -f "/app/build/http-server.js" ]; then
    echo "Starting HTTP server..."
    exec node build/http-server.js
elif [ -f "/app/build/index.js" ]; then
    echo "Starting STDIO server..."
    exec node build/index.js
else
    echo "ERROR: No built files found"
    ls -la /app/build/ || echo "build directory does not exist"
    exit 1
fi 