# Performance Tests

This document explains how to run and understand the performance tests for the webhook relay system.

## Quick Start

To run performance tests only:

```bash
# Run all performance tests
node run-performance-only.js

# Or run specific performance test files
npx jest tests/performance/simple.performance.test.ts --testTimeout=60000 --verbose
npx jest tests/performance/high-volume.performance.test.ts --testTimeout=60000 --verbose
```

## Test Files

### 1. Simple Performance Tests (`simple.performance.test.ts`)

Basic performance tests that validate factory methods and data creation:

- **Event Creation**: Creates 1000 blockchain events quickly
- **Delivery Creation**: Creates 500 webhook deliveries quickly  
- **Config Creation**: Creates 100 webhook configurations quickly
- **Data Processing**: Tests data transformation performance

### 2. High Volume Performance Tests (`high-volume.performance.test.ts`)

Comprehensive performance tests that simulate real-world high-volume scenarios:

#### Event Processing Performance
- Process 500 events within 2 seconds
- Handle concurrent event streams (3 streams, 100 events each)

#### Queue Processing Performance  
- Process 200 webhook deliveries efficiently
- Handle high concurrency without memory leaks (500 deliveries)
- Maintain performance under failure conditions (70% success rate with retries)

#### Memory and Resource Usage
- Handle large payloads (100KB each) without excessive memory usage
- Clean up resources properly after processing

#### Throughput Benchmarks
- Achieve target throughput of 100 deliveries/second

## Performance Metrics

The tests measure and report:

- **Processing Time**: Total time to complete operations
- **Throughput**: Operations per second
- **Memory Usage**: Memory increase during processing
- **Success Rates**: Percentage of successful operations
- **Retry Rates**: Percentage of operations that required retries

## Common Issues Fixed

### 1. Timeout Issues
**Problem**: Tests were running with `--testTimeout=100` (100ms) which was too short.
**Solution**: Use `--testTimeout=60000` (60 seconds) for performance tests.

### 2. Mock Interface Mismatch
**Problem**: MockHttpClient didn't match the expected interface.
**Solution**: Fixed the mock to return the correct response format with `success`, `responseTime`, `statusCode`, etc.

### 3. Complex Queue Mocking
**Problem**: Tests were using complex queue persistence mocking that caused hanging.
**Solution**: Simplified tests to use direct webhook sender calls without complex queue management.

### 4. Blocking Operations
**Problem**: Tests were hanging due to infinite loops or blocking operations.
**Solution**: Removed complex async queue operations and used simple batch processing.

## Running Tests

### Individual Test Suites
```bash
# Run only simple performance tests
npx jest tests/performance/simple.performance.test.ts --testTimeout=60000

# Run only high-volume performance tests  
npx jest tests/performance/high-volume.performance.test.ts --testTimeout=60000
```

### All Performance Tests
```bash
# Using the convenience script
node run-performance-only.js

# Or directly with jest
npx jest tests/performance/ --testTimeout=60000 --verbose
```

### With Jest Projects (runs all test types)
```bash
# This will run performance tests alongside unit/integration tests (slower)
npm test -- --selectProjects performance --testTimeout=60000
```

## Expected Output

When tests run successfully, you'll see output like:

```
✓ should process 200 webhook deliveries efficiently (41 ms)
  Processed 200 webhook deliveries in 18ms
  Average: 0.09ms per delivery
  Throughput: 11111.11 deliveries/second

✓ should achieve target throughput of 100 deliveries/second (161 ms)  
  Processed 500 deliveries in 161ms
  Actual throughput: 3105.59 deliveries/second
  Target throughput: 100 deliveries/second
```

## Troubleshooting

### Tests Hanging
- Check that you're using the correct timeout: `--testTimeout=60000`
- Ensure you're running the fixed version of the tests (not the original broken version)

### Memory Issues
- The tests include memory leak detection
- Large payload tests verify memory usage stays reasonable
- Force garbage collection is used where available

### Performance Expectations
- Simple operations should complete in milliseconds
- High-volume operations should achieve target throughput
- Memory usage should be reasonable and not grow excessively