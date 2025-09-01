#!/bin/bash

# Installation script for Conflux MCP Server
# Supports both npm and bun package managers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Installing Conflux MCP Server Dependencies${NC}"

# Detect package manager
if command -v bun &> /dev/null; then
    echo -e "${BLUE}📦 Using Bun package manager${NC}"
    PACKAGE_MANAGER="bun"
elif command -v npm &> /dev/null; then
    echo -e "${BLUE}📦 Using npm package manager${NC}"
    PACKAGE_MANAGER="npm"
else
    echo -e "${RED}❌ No package manager found. Please install Bun or npm.${NC}"
    echo -e "${YELLOW}📦 Install Bun: https://bun.sh${NC}"
    echo -e "${YELLOW}📦 Install npm: https://nodejs.org${NC}"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}📥 Installing dependencies...${NC}"

if [ "$PACKAGE_MANAGER" = "bun" ]; then
    bun install
    echo -e "${GREEN}✅ Dependencies installed with Bun${NC}"
elif [ "$PACKAGE_MANAGER" = "npm" ]; then
    npm install
    echo -e "${GREEN}✅ Dependencies installed with npm${NC}"
fi

# Build the project
echo -e "${YELLOW}🔨 Building the project...${NC}"

if [ "$PACKAGE_MANAGER" = "bun" ]; then
    bun run build
    bun run build:http
    echo -e "${GREEN}✅ Project built with Bun${NC}"
elif [ "$PACKAGE_MANAGER" = "npm" ]; then
    npm run build
    npm run build:http
    echo -e "${GREEN}✅ Project built with npm${NC}"
fi

echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${YELLOW}   1. Start the server:${NC}"
if [ "$PACKAGE_MANAGER" = "bun" ]; then
    echo -e "${BLUE}      bun run start:http${NC}"
else
    echo -e "${BLUE}      npm run start:http${NC}"
fi
echo -e "${YELLOW}   2. Or use Docker:${NC}"
echo -e "${BLUE}      ./start.sh (Mac/Linux)${NC}"
echo -e "${BLUE}      .\\start.ps1 (Windows)${NC}" 