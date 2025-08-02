# Comprehensive Test Suite

This directory contains a comprehensive test suite for the Webhook Relay System, designed to ensure reliability, performance, and correctness across all components.

## Test Structure

```
tests/
├── factories/           # Test data factories for reproducible testing
│   ├── EventFactory.ts     # Blockchain event test data
│   ├── WebhookFactory.ts   # Webhook configuration test data
│   ├── ConfigFactory.ts    # System configuration test data
│   ├── DeliveryFactory.ts  # Webhook delivery test data
│   └── ContractFactory.ts  # Smart contract test data
├── e2e/                # End-to-end tests
│   └── conflux-testnet.test.ts
├── integration/        # Integration tests
│   ├── database.integration.test.ts
│   └── webhook-delivery.integration.test.ts
├── performance/        # Performance and load tests
│   └── high-volume.performance.test.ts
├── setup.ts           # Global test setup and configuration
└── README.md          # This file
```

## Test Types

### 1. Unit Tests
Located in `src/**/__tests__/` directories alongside source code.

**Purpose**: Test individual components in isolation
**Coverage**: All core classes and functions
**Execution Time**: Fast (< 10 seconds total)

```bash
npm run test:unit
```

### 2. Integration Tests
Located in `tests/integration/`

**Purpose**: Test component interactions and external dependencies
**Coverage**: Database operations, HTTP clients, queue processing
**Requirements**: PostgreSQL and Redis services

```bash
npm run test:integration
```

**Setup Requirements**:
```bash
# Start PostgreSQL
docker run -d --name postgres-test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_USER=test \
  -e POSTGRES_DB=webhook_relay_test \
  -p 5432:5432 postgres:13

# Start Redis
docker run -d --name redis-test \
  -p 6379:6379 redis:6-alpine
```

### 3. End-to-End Tests
Located in `tests/e2e/`

**Purpose**: Test complete workflows with real blockchain interaction
**Coverage**: Full system integration with Conflux testnet
**Requirements**: Network access to Conflux testnet

```bash
# Enable E2E tests
export CONFLUX_TESTNET_TESTS=true
npm run test:e2e
```

### 4. Performance Tests
Located in `tests/performance/`

**Purpose**: Validate system performance under load
**Coverage**: High-volume event processing, concurrent webhook delivery
**Metrics**: Throughput, latency, memory usage

```bash
npm run test:performance
```

## Test Data Factories

The test suite uses factory patterns to generate consistent, reproducible test data:

### EventFactory
```typescript
// Create single event
const event = EventFactory.createBlockchainEvent();

// Create specific event types
const transfer = EventFactory.createTransferEvent(from, to, value);
const approval = EventFactory.createApprovalEvent(owner, spender, value);

// Create batch events for load testing
const events = EventFactory.createBatchEvents(1000);
```

### WebhookFactory
```typescript
// Create webhook configurations
const webhook = WebhookFactory.createWebhookConfig();
const zapierWebhook = WebhookFactory.createZapierWebhook();
const makeWebhook = WebhookFactory.createMakeWebhook();

// Create batch webhooks
const webhooks = WebhookFactory.createBatchWebhooks(10);
```

### DeliveryFactory
```typescript
// Create webhook deliveries
const delivery = DeliveryFactory.createWebhookDelivery();
const pendingDelivery = DeliveryFactory.createPendingDelivery();
const failedDelivery = DeliveryFactory.createFailedDelivery();

// Create high-volume test data
const deliveries = DeliveryFactory.createHighVolumeDeliveries(1000);
```

## Running Tests

### Quick Start
```bash
# Run all tests (excluding E2E)
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:performance
```

### Comprehensive Test Suite
```bash
# Run the comprehensive test script
./scripts/run-comprehensive-tests.sh

# Run all tests including E2E
./scripts/run-comprehensive-tests.sh --all

# Run only specific test types
./scripts/run-comprehensive-tests.sh --unit-only
./scripts/run-comprehensive-tests.sh --performance-only
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `test` |
| `TEST_DATABASE_URL` | Test database connection | `postgresql://test:test@localhost:5432/webhook_relay_test` |
| `TEST_REDIS_URL` | Test Redis connection | `redis://localhost:6379/1` |
| `CONFLUX_TESTNET_TESTS` | Enable E2E tests | `false` |
| `LOG_LEVEL` | Test logging level | `error` |

## Coverage Requirements

The test suite maintains minimum coverage thresholds:

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI/CD

## Performance Benchmarks

### Target Metrics

| Metric | Target | Test |
|--------|--------|------|
| Event Processing | 1000 events/5s | `high-volume.performance.test.ts` |
| Webhook Delivery | 100 deliveries/s | `high-volume.performance.test.ts` |
| Memory Usage | < 200MB baseline | All performance tests |
| Response Time | < 100ms average | Integration tests |

### Load Testing Scenarios

1. **High Volume Events**: Process 1000+ blockchain events
2. **Concurrent Webhooks**: Deliver 100+ webhooks simultaneously  
3. **Large Payloads**: Handle 100KB+ webhook payloads
4. **Failure Recovery**: Maintain performance with 30% failure rate
5. **Memory Stability**: No memory leaks over extended runs

## Continuous Integration

### GitHub Actions
```yaml
- name: Run Unit Tests
  run: npm run test:unit

- name: Run Integration Tests
  run: npm run test:integration
  services:
    postgres:
      image: postgres:13
      env:
        POSTGRES_PASSWORD: test
    redis:
      image: redis:6-alpine

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v1
```

### Local Development
```bash
# Watch mode for development
npm run test:watch

# Run tests before commit
npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Start test database
   docker run -d --name postgres-test -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:13
   ```

2. **Redis Connection Errors**
   ```bash
   # Check Redis is running
   redis-cli ping
   
   # Start test Redis
   docker run -d --name redis-test -p 6379:6379 redis:6-alpine
   ```

3. **E2E Test Failures**
   ```bash
   # Enable E2E tests
   export CONFLUX_TESTNET_TESTS=true
   
   # Check network connectivity
   curl -s https://evmtestnet.confluxrpc.com
   ```

4. **Performance Test Timeouts**
   ```bash
   # Increase Jest timeout
   export JEST_TIMEOUT=120000
   
   # Run with more memory
   node --max-old-space-size=4096 node_modules/.bin/jest
   ```

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Run specific test file
npm test -- tests/integration/database.integration.test.ts

# Run with verbose output
npm test -- --verbose
```

## Contributing

When adding new features:

1. **Write unit tests** for all new functions/classes
2. **Add integration tests** for external dependencies
3. **Update factories** if new data types are introduced
4. **Add performance tests** for high-throughput features
5. **Maintain coverage** above 80% threshold

### Test Naming Conventions

- Unit tests: `ComponentName.test.ts`
- Integration tests: `feature-name.integration.test.ts`
- E2E tests: `workflow-name.e2e.test.ts`
- Performance tests: `scenario-name.performance.test.ts`

### Mock Guidelines

- Use factories for test data generation
- Mock external services (HTTP, blockchain)
- Avoid mocking internal components in integration tests
- Use real services for E2E tests when possible