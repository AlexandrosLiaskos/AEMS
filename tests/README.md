# AEMS Test Suite

Comprehensive test suite for the Agentic Email Management System (AEMS) with functional integration tests.

## Overview

This test suite provides complete coverage of the AEMS system with real functional tests that interact with the actual codebase. The tests are designed to be run directly against the system without extensive mocking, ensuring that the functionality works as expected in real scenarios.

## Test Structure

```
tests/
├── setup/
│   └── test-setup.js          # Global test configuration and utilities
├── unit/                      # Unit tests for individual modules
│   ├── ai.test.js            # AI service tests
│   ├── ai-extractor.test.js  # AI data extraction tests
│   ├── audit-logger.test.js  # Audit logging tests
│   ├── database.test.js      # Database operations tests
│   ├── env-validator.test.js # Environment validation tests
│   ├── gmail.test.js         # Gmail integration tests
│   ├── health-monitor.test.js # Health monitoring tests
│   ├── pdf-processor.test.js # PDF processing tests
│   └── retry-utils.test.js   # Retry logic tests
├── integration/
│   └── api.test.js           # API endpoint integration tests
├── run-tests.js              # Comprehensive test runner
└── README.md                 # This file
```

## Test Categories

### Unit Tests

**Database Tests (`database.test.js`)**
- Email CRUD operations
- Status transitions (FETCHED → REVIEW → MANAGED)
- Category-based storage
- Soft delete functionality
- Extracted data management
- Statistics and metrics
- Settings management
- Error handling

**AI Service Tests (`ai.test.js`)**
- Email categorization (customer_inquiry, invoice, other)
- Batch processing
- Usage statistics tracking
- Rate limiting
- Retry logic with exponential backoff
- Error handling and fallbacks

**AI Extractor Tests (`ai-extractor.test.js`)**
- Customer inquiry data extraction
- Invoice data extraction with PDF processing
- Greek and English text support
- Error handling for unsupported categories
- Usage statistics and limits
- OAuth2 integration for PDF access

**PDF Processor Tests (`pdf-processor.test.js`)**
- PDF content extraction
- Multiple attachment handling
- File size limits and filtering
- Text cleaning and processing
- Greek text support
- Error handling for invalid PDFs

**Gmail Service Tests (`gmail.test.js`)**
- OAuth2 authentication flow
- Email fetching with attachments
- Multipart email parsing
- Email synchronization with AI categorization
- Email management (mark as read)
- Connection status management
- Token refresh handling

**Health Monitor Tests (`health-monitor.test.js`)**
- Database health checks
- Memory usage monitoring
- Disk space monitoring
- Custom health check registration
- Metrics tracking and reporting
- Circuit breaker functionality
- History management

**Audit Logger Tests (`audit-logger.test.js`)**
- Security event logging
- Authentication and authorization logging
- Data access and modification tracking
- Performance metrics logging
- Log rotation and file management
- Error handling and recovery

**Retry Utils Tests (`retry-utils.test.js`)**
- Exponential backoff retry logic
- Circuit breaker pattern
- Parallel retry operations
- Custom retry conditions
- Timeout handling
- Error classification

**Environment Validator Tests (`env-validator.test.js`)**
- Required variable validation
- URL format validation
- Numeric range validation
- Boolean value validation
- Enum value validation
- Security validation (session secrets)
- Production environment warnings

### Integration Tests

**API Integration Tests (`api.test.js`)**
- Static file serving
- Security headers and rate limiting
- Gmail authentication endpoints
- Email management endpoints
- Email synchronization endpoints
- Data extraction endpoints
- Statistics and health check endpoints
- Input validation and sanitization

## Test Features

### Functional Testing
- **Real Database Operations**: Tests use the actual JSON database with real file operations
- **Actual AI Integration**: Tests interact with mocked AI services but use real processing logic
- **Complete Email Lifecycle**: Tests cover the full email processing pipeline
- **Error Scenarios**: Comprehensive error handling and edge case testing

### Test Data Management
- **Automatic Setup/Teardown**: Test environment is automatically configured and cleaned up
- **Data Isolation**: Each test runs with isolated test data
- **Realistic Test Data**: Generated test data mimics real email scenarios
- **Greek Language Support**: Tests include Greek text processing scenarios

### Test Utilities
- **Email Generators**: Utilities to generate realistic test emails
- **Data Generators**: Functions to create test extracted data
- **Cleanup Helpers**: Automatic cleanup of test artifacts
- **Wait Utilities**: Helpers for async operation testing

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure test environment is set up
npm run test:setup  # If available
```

### Run All Tests
```bash
# Run complete test suite with coverage
npm test

# Run with custom test runner
node tests/run-tests.js
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage report
npm run test:coverage
```

### Run Individual Test Files
```bash
# Specific module tests
npx jest tests/unit/database.test.js
npx jest tests/unit/ai.test.js

# With watch mode for development
npx jest tests/unit/database.test.js --watch
```

### Debug Tests
```bash
# Run with verbose output
npx jest --verbose

# Run specific test with debugging
npx jest tests/unit/database.test.js --verbose --no-cache
```

## Test Configuration

### Environment Variables
Tests use a separate test environment configuration:
- `NODE_ENV=test`
- Mock API keys for external services
- Isolated data directories
- Disabled CSRF protection for testing
- Higher rate limits for test scenarios

### Jest Configuration
```javascript
{
  "testEnvironment": "node",
  "setupFilesAfterEnv": ["<rootDir>/tests/setup/test-setup.js"],
  "testMatch": ["**/tests/**/*.test.js"],
  "testTimeout": 30000,
  "collectCoverageFrom": [
    "lib/**/*.js",
    "server.js",
    "!lib/**/*.test.js"
  ]
}
```

## Coverage Goals

- **Lines**: > 80%
- **Functions**: > 85%
- **Branches**: > 75%
- **Statements**: > 80%

## Test Data

### Email Test Data
- Customer inquiry emails (English and Greek)
- Invoice emails with PDF attachments
- Various email formats (plain text, HTML, multipart)
- Edge cases (empty emails, malformed data)

### Extracted Data Test Data
- Customer inquiry data structures
- Invoice data with Greek and English content
- Missing field scenarios
- Invalid data formats

## Continuous Integration

Tests are designed to run in CI environments:
- No external API dependencies during testing
- Isolated test data management
- Comprehensive error reporting
- Performance metrics tracking

## Troubleshooting

### Common Issues

**Test Data Conflicts**
```bash
# Clean test data manually
rm -rf tests/test-data
rm -rf tests/test-data-backup
```

**Database Lock Issues**
```bash
# Ensure no other processes are using the database
pkill -f "node.*server.js"
```

**Memory Issues with Large Test Suites**
```bash
# Run tests with increased memory
node --max-old-space-size=4096 tests/run-tests.js
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=aems:* npm test

# Run single test with full output
npx jest tests/unit/database.test.js --verbose --no-cache --runInBand
```

## Contributing

When adding new tests:
1. Follow the existing test structure and naming conventions
2. Use the provided test utilities for data generation
3. Ensure proper cleanup in `afterEach` hooks
4. Add both success and error scenarios
5. Include Greek language test cases where applicable
6. Update this documentation for new test categories

## Test Metrics

The test suite tracks:
- Test execution time
- Coverage percentages
- Success/failure rates
- Memory usage during tests
- Database operation performance

Results are displayed in a comprehensive summary after test execution.
