# Makefile for Vesting Tokens DApp Docker Operations

.PHONY: help dev prod build clean logs test migrate db-admin

# Default target
help:
	@echo "Vesting Tokens DApp - Docker Commands"
	@echo "====================================="
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build and start development environment"
	@echo "  make dev-logs     - View development logs"
	@echo "  make dev-stop     - Stop development environment"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build and start production environment"
	@echo "  make prod-logs    - View production logs"
	@echo "  make prod-stop    - Stop production environment"
	@echo ""
	@echo "Database:"
	@echo "  make migrate      - Run database migrations"
	@echo "  make db-admin     - Start pgAdmin (database admin tool)"
	@echo "  make db-reset     - Reset database (WARNING: deletes all data)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run tests in Docker"
	@echo "  make test-cov     - Run tests with coverage"
	@echo ""
	@echo "Utilities:"
	@echo "  make build        - Build Docker images"
	@echo "  make clean        - Clean up Docker resources"
	@echo "  make logs         - View all logs"
	@echo "  make shell        - Access app container shell"

# Development environment
dev:
	docker compose -f docker-compose.dev.yml up -d

dev-build:
	docker compose -f docker-compose.dev.yml up -d --build

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f app

dev-stop:
	docker compose -f docker-compose.dev.yml down

# Production environment
prod:
	docker compose --profile production up -d

prod-build:
	docker compose --profile production up -d --build

prod-logs:
	docker compose logs -f app-prod

prod-stop:
	docker compose --profile production down

# Database operations
migrate:
	docker compose -f docker-compose.dev.yml run --rm migrate

db-admin:
	docker compose -f docker-compose.dev.yml up -d pgadmin
	@echo "pgAdmin started at http://localhost:5050"
	@echo "Email: admin@vestingdapp.com"
	@echo "Password: admin123"

db-reset:
	@echo "WARNING: This will delete all database data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose -f docker-compose.dev.yml down -v; \
		docker compose -f docker-compose.dev.yml up -d postgres; \
		echo "Database reset complete"; \
	else \
		echo "Database reset cancelled"; \
	fi

# Testing
test:
	docker compose -f docker-compose.dev.yml run --rm test

test-cov:
	docker compose -f docker-compose.dev.yml run --rm test npm run test:coverage

# Build images
build:
	docker build -t vesting-dapp:latest .
	docker build -f Dockerfile.dev -t vesting-dapp:dev .

# Clean up
clean:
	docker compose -f docker-compose.dev.yml down -v
	docker compose down -v
	docker system prune -f
	docker volume prune -f

# View logs
logs:
	docker compose -f docker-compose.dev.yml logs

# Access container shell
shell:
	docker exec -it vesting-dapp-dev sh

# Status check
status:
	@echo "Development Environment:"
	docker compose -f docker-compose.dev.yml ps
	@echo ""
	@echo "Production Environment:"
	docker compose --profile production ps
	@echo ""
	@echo "Docker Images:"
	docker images | grep vesting-dapp

# Quick start (development)
start: dev
	@echo "Development environment started!"
	@echo "App: http://localhost:3000"
	@echo "pgAdmin: http://localhost:5050"
	@echo "Database: localhost:5432"
	@echo ""
	@echo "Use 'make dev-logs' to view logs"
	@echo "Use 'make dev-stop' to stop services"

# Quick stop
stop: dev-stop
	@echo "All development services stopped"

# Install dependencies (if running locally)
install:
	npm install

# Run tests locally (if not using Docker)
test-local:
	npm test

# Run tests with coverage locally
test-cov-local:
	npm run test:coverage

# Database operations locally
db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

db-studio:
	npm run db:studio

# Development server locally
dev-local:
	npm run dev

# Build locally
build-local:
	npm run build

# Start production server locally
start-local:
	npm start 