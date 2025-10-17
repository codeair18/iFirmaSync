# iFirmaSync Tests

This directory contains tests for the iFirmaSync application.

## Setup

1. Copy the test environment file:
   ```bash
   cp .env.test.example .env.test
   ```

2. Update `.env.test` with appropriate test values if needed.

## Running Tests

### Run all tests
```bash
bin/npm test
```

### Run tests in watch mode
```bash
bin/npm run test
```

### Run tests with UI
```bash
bin/npm run test:ui
```

### Run tests once (CI mode)
```bash
bin/npm run test:run
```

### Generate coverage report
```bash
bin/npm run test:coverage
```

## Test Structure

- `watch-drive-folder.test.ts` - Integration tests that spawn actual processes
- `watch-drive-folder.unit.test.ts` - Unit tests with mocked dependencies
- `setup.ts` - Test setup and global configuration
- `__mocks__/` - Mock implementations for testing

## Test Types

### Unit Tests
Unit tests mock all external dependencies and test individual functions in isolation.

### Integration Tests
Integration tests spawn actual Node.js processes to test the application behavior end-to-end.

## Writing Tests

Tests use Vitest with the following configuration:
- TypeScript support
- ES modules
- Node environment
- Global test API (describe, it, expect)

Example:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

## Mocking

Use Vitest's `vi.mock()` for mocking modules:

```typescript
vi.mock('../some-module', () => ({
  default: vi.fn()
}));
```

## Coverage

Coverage reports are generated in the `coverage/` directory:
- `coverage/index.html` - HTML coverage report
- `coverage/coverage-final.json` - JSON coverage data

## Troubleshooting

### Tests timeout
Increase timeout in test file:
```typescript
it('should do something', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Module import errors
Ensure `vitest.config.ts` is properly configured and TypeScript compilation succeeds:
```bash
bin/npm run build
```

### Environment variables not loading
Check that `.env.test` exists and is properly formatted.