# Test Documentation

This document provides information about running tests for the webhook relay system.

## Test Structure

The test suite is organized into several categories:

- **Unit Tests** (`src/**/__tests__/**/*.ts`): Test individual components in isolation
- **Integration Tests** (`tests/integration/**/*.ts`): Test component interactions and external services
- **End-to-End Tests** (`tests/e2e/**/*.ts`): Test complete workflows
- **Performance Tests** (`tests/performance/**/*.ts`): Test system performance under load

## Running Tests

### Prerequisites

Before running integration tests, you need to set up the required services:

1. **Database Setup**: PostgreSQL is required for database integration tests
2. **Network Access**: Some tests require internet access to test webhook delivery

### Quick Start

```bash
# Run all tests (unit + integration + e2e)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only e2e tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Run with coverage
npm run test:coverage
```

### Database Setup for Integration Tests

#### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL container
./scripts/setup-test-db.sh

# Run integration tests
npm run test:integration

# Stop database when done
docker-compose down
```

#### Option 2: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create test database
createdb webhook_relay_test

# Set environment variable
export TEST_DATABASE_URL="postgresql://username:password@localhost:5432/webhook_relay_test"

# Run tests
npm run test:integration
```

#### Option 3: Skip Database Tests

If no database is available, the integration tests will automatically skip database-dependent tests and show warnings.

## Test Configuration

### Environment Variables

- `TEST_DATABASE_URL`: PostgreSQL connection string for integration tests
- `TEST_REDIS_URL`: Redis connection string for integration tests
- `NODE_ENV`: Set to 'test' during test execution
- `LOG_LEVEL`: Set to 'error' to reduce log noise during tests

### Test Timeouts

- Unit tests: 5 seconds (default)
- Integration tests: 30 seconds
- Performance tests: 2 minutes

## Integration Test Details

### Database Integration Tests

Tests database operations including:
- Connection pooling and management
- Queue persistence and retrieval
- Transaction handling
- Migration system
- Performance under load

**Requirements**: PostgreSQL database

**Behavior**: If database is not available, tests are automatically skipped with warnings.

### Webhook Delivery Integration Tests

Tests webhook delivery functionality including:
- HTTP POST delivery to external endpoints
- Retry logic and error handling
- Different payload formats (Zapier, Make.com, n8n, generic)
- Authentication and headers
- Timeout handling
- Rate limiting

**Requirements**: Internet access to httpbin.org

**Behavior**: If external services are unreachable, tests are automatically skipped with warnings.

## Troubleshooting

### Database Connection Issues

If you see errors like "getaddrinfo EAI_AGAIN postgres":

1. Ensure PostgreSQL is running
2. Check connection string in `TEST_DATABASE_URL`
3. Try running `./scripts/setup-test-db.sh`
4. Verify Docker is installed and running

### Network Connectivity Issues

If webhook tests fail with ENOTFOUND or ECONNREFUSED:

1. Check internet connectivity
2. Verify httpbin.org is accessible
3. Tests will automatically skip if external services are unreachable

### Test Flakiness

Some integration tests may be flaky due to:
- Network latency
- External service availability
- Database connection timing

The tests include retry logic and graceful degradation to minimize flakiness.

## Test Data Factories

The test suite uses factory patterns for creating test data:

- `EventFactory`: Creates blockchain events
- `WebhookFactory`: Creates webhook configurations
- `DeliveryFactory`: Creates webhook deliveries
- `ConfigFactory`: Creates system configurations
- `ContractFactory`: Creates contract configurations

## Coverage Requirements

- Minimum 80% coverage for all components
- Target 97%+ overall coverage
- Coverage reports available in `coverage/` directory

## Continuous Integration

For CI environments:

```bash
# Start services
docker-compose up -d postgres redis

# Wait for services to be ready
./scripts/setup-test-db.sh

# Run all tests
npm run test:all

# Generate coverage report
npm run test:coverage
```

## Performance Testing

Performance tests are designed to:
- Test high-volume event processing
- Measure webhook delivery performance
- Test database performance under load
- Identify memory leaks and resource usage

Run performance tests separately as they take longer:

```bash
npm run test:performance
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Tests clean up after themselves (database records, connections)
3. **Mocking**: External dependencies are mocked when appropriate
4. **Error Handling**: Tests handle network and service failures gracefully
5. **Documentation**: Complex test scenarios are well-documented

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Add appropriate error handling and cleanup
3. Update this documentation if adding new test categories
4. Ensure tests work in both local and CI environments
5. Add factory methods for complex test data