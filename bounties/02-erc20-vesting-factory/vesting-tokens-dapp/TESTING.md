# Testing Guide

This document describes the testing setup and how to run tests for the Vesting Tokens DApp.

## Testing Setup

The project uses Jest as the test runner with React Testing Library for component testing. The testing environment is configured to work with Next.js and includes mocks for web3 functionality.

### Dependencies

The following testing dependencies are included:

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers for DOM testing
- **@testing-library/user-event**: User interaction simulation
- **jest-environment-jsdom**: DOM environment for Jest

### Configuration Files

- `jest.config.js`: Jest configuration with Next.js integration
- `jest.setup.js`: Global test setup and mocks
- `src/test-utils.tsx`: Custom test utilities and providers

## Running Tests

### Install Dependencies

First, install the testing dependencies:

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Structure

### Unit Tests

Unit tests are located alongside the source files with the following naming convention:
- `*.test.ts` for utility functions and hooks
- `*.test.tsx` for React components

### Test Categories

1. **Utility Functions** (`src/lib/utils.test.ts`)
   - Tests for helper functions like `cn()` for class name merging

2. **State Management** (`src/store/*.test.ts`)
   - Tests for Zustand stores
   - State updates and actions
   - Store persistence

3. **Custom Hooks** (`src/lib/hooks/*.test.ts`)
   - Tests for custom React hooks
   - Hook behavior and state changes
   - Error handling

4. **UI Components** (`src/components/ui/*.test.tsx`)
   - Component rendering
   - Props and variants
   - User interactions
   - Accessibility

## Mocking Strategy

### Web3 Mocks

The testing environment includes comprehensive mocks for web3 functionality:

- **Wagmi hooks**: `useAccount`, `useConnect`, `useWriteContract`, etc.
- **RainbowKit**: Wallet connection components
- **Next.js**: Router and navigation
- **NextAuth**: Authentication

### Example Mock Usage

```typescript
// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234...',
    isConnected: true,
  }),
  useWriteContract: () => ({
    writeContract: jest.fn(),
    isPending: false,
  }),
}))
```

## Writing Tests

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button Component', () => {
  it('should render with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('should handle click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react'
import { useDeploymentStore } from './deployment-store'

describe('useDeploymentStore', () => {
  it('should set token config', () => {
    const { result } = renderHook(() => useDeploymentStore())
    
    act(() => {
      result.current.setTokenConfig({
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18,
      })
    })
    
    expect(result.current.tokenConfig?.name).toBe('Test Token')
  })
})
```

### Store Testing

```typescript
import { renderHook, act } from '@testing-library/react'
import { useBatchDeploymentStore } from './batch-deployment-store'

describe('useBatchDeploymentStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useBatchDeploymentStore())
    act(() => {
      result.current.resetBatchDeployment()
    })
  })

  it('should add vesting schedule', () => {
    const { result } = renderHook(() => useBatchDeploymentStore())
    
    act(() => {
      result.current.addBatchVestingSchedule({
        id: 'team',
        tokenId: 'token1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true,
      })
    })
    
    expect(result.current.batchVestingSchedules).toHaveLength(1)
  })
})
```

## Best Practices

### Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Test both success and error scenarios
- Test edge cases and boundary conditions

### Component Testing

- Test user interactions, not implementation details
- Use semantic queries (getByRole, getByLabelText) over test IDs
- Test accessibility features
- Mock external dependencies

### State Testing

- Test state changes after actions
- Verify side effects (like removing related data)
- Test store persistence if applicable
- Reset state between tests

### Async Testing

- Use `act()` for state updates
- Handle async operations properly
- Test loading states and error handling

## Coverage Goals

The project aims for 70% test coverage across:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Troubleshooting

### Common Issues

1. **Import errors**: Ensure all dependencies are installed
2. **Mock failures**: Check that mocks are properly configured
3. **Async test failures**: Use `act()` and proper async handling
4. **Component rendering issues**: Verify that all required providers are mocked

### Debug Mode

Run tests with verbose output:

```bash
npm test -- --verbose
```

### Isolated Testing

Run a specific test file:

```bash
npm test -- button.test.tsx
```

## Continuous Integration

Tests are configured to run automatically in CI/CD pipelines. Ensure all tests pass before merging code changes. 