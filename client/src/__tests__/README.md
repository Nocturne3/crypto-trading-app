# Tests

This directory contains tests for the Trading App components and utilities.

## Test Structure

```
__tests__/
├── setup.js                          # Test setup and configuration
├── components/
│   └── Portfolio/
│       └── PortfolioTracking.test.jsx # Tests for PortfolioTracking component
└── utils/
    └── tradeHistory.test.js          # Tests for tradeHistory utilities
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Coverage

### PortfolioTracking Component
Tests cover:
- Component rendering
- Statistics display
- Trade history management
- Add/remove trade functionality
- Form validation
- Performance chart rendering
- Best/worst trade display

### tradeHistory Utilities
Tests cover:
- Loading and saving trade history
- Adding and removing trades
- Portfolio snapshot management
- Trade statistics calculation
- FIFO trade matching
- Win rate calculation

## Writing New Tests

When adding new tests:
1. Place component tests in `__tests__/components/[ComponentName]/`
2. Place utility tests in `__tests__/utils/`
3. Use descriptive test names
4. Mock external dependencies (APIs, localStorage, etc.)
5. Clean up after each test

## Dependencies

- **Vitest**: Test runner
- **@testing-library/react**: React testing utilities
- **@testing-library/jest-dom**: DOM matchers
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: DOM environment for tests

