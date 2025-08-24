# Error Handling & Logging

## Error Classification System

### Error Categories
| Category | Severity | User Impact | Recovery Strategy | Examples |
|----------|----------|-------------|-------------------|----------|
| **Validation Errors** | Low | User feedback required | User correction | Invalid email format, missing required fields |
| **Business Logic Errors** | Medium | Operation blocked | Alternative flow | Invalid workflow transition, insufficient permissions |
| **Integration Errors** | High | Service degradation | Retry with fallback | Gmail API failure, OpenAI timeout |
| **System Errors** | Critical | Service unavailable | Immediate intervention | Database corruption, out of memory |
| **Security Errors** | Critical | Potential breach | Alert and block | Authentication failure, suspicious activity |

### Error Hierarchy
```typescript
abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly severity: ErrorSeverity;
  abstract readonly category: ErrorCategory;
  readonly timestamp: Date;
  readonly context: Record<string, any>;
  readonly correlationId: string;
  
  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.timestamp = new Date();
    this.context = context || {};
    this.correlationId = generateCorrelationId();
  }
}

// Validation Errors
class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly severity = ErrorSeverity.LOW;
  readonly category = ErrorCategory.VALIDATION;
}

class EmailFormatError extends ValidationError {
  readonly code = 'INVALID_EMAIL_FORMAT';
}

class RequiredFieldError extends ValidationError {
  readonly code = 'REQUIRED_FIELD_MISSING';
}

// Business Logic Errors
class BusinessLogicError extends BaseError {
  readonly code = 'BUSINESS_LOGIC_ERROR';
  readonly severity = ErrorSeverity.MEDIUM;
  readonly category = ErrorCategory.BUSINESS_LOGIC;
}

class InvalidWorkflowTransitionError extends BusinessLogicError {
  readonly code = 'INVALID_WORKFLOW_TRANSITION';
}

class InsufficientPermissionsError extends BusinessLogicError {
  readonly code = 'INSUFFICIENT_PERMISSIONS';
}

// Integration Errors
class IntegrationError extends BaseError {
  readonly code = 'INTEGRATION_ERROR';
  readonly severity = ErrorSeverity.HIGH;
  readonly category = ErrorCategory.INTEGRATION;
}

class GmailApiError extends IntegrationError {
  readonly code = 'GMAIL_API_ERROR';
}

class OpenAiTimeoutError extends IntegrationError {
  readonly code = 'OPENAI_TIMEOUT';
}

// System Errors
class SystemError extends BaseError {
  readonly code = 'SYSTEM_ERROR';
  readonly severity = ErrorSeverity.CRITICAL;
  readonly category = ErrorCategory.SYSTEM;
}

class DatabaseCorruptionError extends SystemError {
  readonly code = 'DATABASE_CORRUPTION';
}

class OutOfMemoryError extends SystemError {
  readonly code = 'OUT_OF_MEMORY';
}
```

## Error Response Formats

### REST API Error Response
```typescript
interface RestErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    correlationId: string;
    path: string;
    method: string;
  };
  statusCode: number;
}

// Example responses
{
  "error": {
    "code": "INVALID_EMAIL_FORMAT",
    "message": "The provided email address is not valid",
    "details": {
      "field": "email",
      "value": "invalid-email",
      "expectedFormat": "user@domain.com"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "correlationId": "req_123456789",
    "path": "/api/emails",
    "method": "POST"
  },
  "statusCode": 400
}
```

### GraphQL Error Response
```typescript
interface GraphQLErrorResponse {
  errors: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: Array<string | number>;
    extensions: {
      code: string;
      severity: ErrorSeverity;
      category: ErrorCategory;
      timestamp: string;
      correlationId: string;
      details?: Record<string, any>;
    };
  }>;
  data: null | Record<string, any>;
}

// Example response
{
  "errors": [
    {
      "message": "Email not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["email"],
      "extensions": {
        "code": "EMAIL_NOT_FOUND",
        "severity": "MEDIUM",
        "category": "BUSINESS_LOGIC",
        "timestamp": "2024-01-15T10:30:00Z",
        "correlationId": "gql_123456789",
        "details": {
          "emailId": "email_123",
          "userId": "user_456"
        }
      }
    }
  ],
  "data": null
}
```

## Retry Strategies

### Retry Configuration by Error Type
| Error Type | Max Attempts | Base Delay | Max Delay | Backoff Strategy | Jitter |
|------------|--------------|------------|-----------|------------------|--------|
| **Network Timeout** | 3 | 1s | 30s | Exponential | Yes |
| **Rate Limit** | 5 | 2s | 60s | Exponential | Yes |
| **Temporary Service Unavailable** | 3 | 5s | 45s | Linear | No |
| **Database Lock** | 5 | 100ms | 2s | Exponential | Yes |
| **File System Error** | 2 | 500ms | 5s | Linear | No |

### Retry Implementation
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: 'linear' | 'exponential';
  jitter: boolean;
  retryableErrors: string[];
}

class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: Record<string, any> = {}
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryable(error, config.retryableErrors)) {
          throw error;
        }
        
        if (attempt === config.maxAttempts) {
          throw new MaxRetriesExceededError(lastError, attempt, context);
        }
        
        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
        
        this.logRetryAttempt(error, attempt, delay, context);
      }
    }
    
    throw lastError;
  }
  
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;
    
    if (config.backoffStrategy === 'exponential') {
      delay = config.baseDelay * Math.pow(2, attempt - 1);
    } else {
      delay = config.baseDelay * attempt;
    }
    
    delay = Math.min(delay, config.maxDelay);
    
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return delay;
  }
}
```

### Circuit Breaker Pattern
```typescript
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000,
    private readonly monitoringPeriod: number = 300000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new CircuitBreakerOpenError();
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.recoveryTimeout);
    }
  }
}
```

## Logging System

### Log Levels & Usage
| Level | Usage | Examples | Retention |
|-------|-------|----------|-----------|
| **ERROR** | System errors, exceptions | Unhandled exceptions, service failures | 1 year |
| **WARN** | Recoverable issues | Rate limits hit, fallback used | 6 months |
| **INFO** | Important events | User login, email processed | 3 months |
| **DEBUG** | Detailed execution | Function entry/exit, variable values | 1 month |
| **TRACE** | Very detailed execution | Loop iterations, condition checks | 1 week |

### Structured Logging Format
```typescript
interface LogEntry {
  timestamp: string;           // ISO 8601 format
  level: LogLevel;
  message: string;
  correlationId: string;       // Request/operation tracking
  userId?: string;             // User context
  service: string;             // Service name
  module: string;              // Module/class name
  function: string;            // Function name
  context: Record<string, any>; // Additional context
  error?: {
    name: string;
    message: string;
    stack: string;
    code?: string;
  };
  performance?: {
    duration: number;          // Milliseconds
    memoryUsage: number;       // Bytes
  };
  metadata: {
    environment: string;       // dev/staging/production
    version: string;           // Application version
    hostname: string;          // Server hostname
    pid: number;              // Process ID
  };
}
```

### Logging Configuration
```typescript
interface LoggingConfig {
  level: LogLevel;
  format: 'json' | 'text';
  outputs: Array<{
    type: 'console' | 'file' | 'elasticsearch' | 'cloudwatch';
    config: Record<string, any>;
  }>;
  sampling: {
    enabled: boolean;
    rate: number;              // 0.0 to 1.0
    excludeLevels: LogLevel[];
  };
  sensitive: {
    fields: string[];          // Fields to redact
    replacement: string;       // Replacement value
  };
}
```

### Context Propagation
```typescript
class LogContext {
  private static context = new AsyncLocalStorage<Map<string, any>>();
  
  static run<T>(context: Record<string, any>, fn: () => T): T {
    const contextMap = new Map(Object.entries(context));
    return this.context.run(contextMap, fn);
  }
  
  static get(key: string): any {
    return this.context.getStore()?.get(key);
  }
  
  static set(key: string, value: any): void {
    const store = this.context.getStore();
    if (store) {
      store.set(key, value);
    }
  }
  
  static getCorrelationId(): string {
    return this.get('correlationId') || generateCorrelationId();
  }
}
```

## Error Monitoring & Alerting

### Error Metrics
| Metric | Purpose | Calculation | Alert Threshold |
|--------|---------|-------------|-----------------|
| **Error Rate** | Service health | Errors / Total requests | > 5% |
| **Error Count** | Volume monitoring | Count of errors | > 100/hour |
| **Mean Time to Recovery** | Reliability | Time from error to fix | > 1 hour |
| **Error Distribution** | Pattern analysis | Errors by type/service | Anomaly detection |

### Alerting Rules
```typescript
interface AlertRule {
  name: string;
  condition: string;           // Query condition
  threshold: number;
  timeWindow: string;          // '5m', '1h', etc.
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  channels: string[];          // email, slack, pagerduty
  suppressionTime: string;     // Minimum time between alerts
}

const alertRules: AlertRule[] = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > threshold',
    threshold: 0.05,
    timeWindow: '5m',
    severity: 'HIGH',
    channels: ['email', 'slack'],
    suppressionTime: '15m'
  },
  {
    name: 'Critical System Error',
    condition: 'severity = "CRITICAL"',
    threshold: 1,
    timeWindow: '1m',
    severity: 'CRITICAL',
    channels: ['email', 'slack', 'pagerduty'],
    suppressionTime: '5m'
  }
];
```

### Error Aggregation
| Aggregation Type | Purpose | Time Window | Retention |
|------------------|---------|-------------|-----------|
| **By Error Code** | Pattern identification | 1 hour | 30 days |
| **By Service** | Service health | 15 minutes | 7 days |
| **By User** | User impact | 1 hour | 14 days |
| **By Time** | Trend analysis | 5 minutes | 90 days |

## Health Checks & Diagnostics

### Health Check Endpoints
| Endpoint | Purpose | Response Time | Dependencies |
|----------|---------|---------------|--------------|
| `/health` | Basic liveness | < 100ms | None |
| `/health/ready` | Readiness check | < 500ms | Database, external APIs |
| `/health/detailed` | Comprehensive status | < 2s | All dependencies |
| `/metrics` | Prometheus metrics | < 200ms | Metrics collection |

### Health Check Implementation
```typescript
interface HealthCheck {
  name: string;
  check: () => Promise<HealthStatus>;
  timeout: number;
  critical: boolean;
}

interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  details?: Record<string, any>;
  responseTime: number;
  timestamp: Date;
}

class HealthService {
  private checks: HealthCheck[] = [
    {
      name: 'database',
      check: () => this.checkDatabase(),
      timeout: 5000,
      critical: true
    },
    {
      name: 'gmail-api',
      check: () => this.checkGmailApi(),
      timeout: 10000,
      critical: false
    },
    {
      name: 'openai-api',
      check: () => this.checkOpenAiApi(),
      timeout: 15000,
      critical: false
    }
  ];
  
  async getHealthStatus(): Promise<OverallHealthStatus> {
    const results = await Promise.allSettled(
      this.checks.map(check => this.runCheck(check))
    );
    
    return this.aggregateResults(results);
  }
}
```

### Diagnostic Information
```typescript
interface DiagnosticInfo {
  application: {
    name: string;
    version: string;
    buildTime: string;
    commitHash: string;
  };
  system: {
    hostname: string;
    platform: string;
    nodeVersion: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  };
  dependencies: {
    [serviceName: string]: {
      status: 'UP' | 'DOWN' | 'DEGRADED';
      version?: string;
      responseTime: number;
      lastCheck: Date;
    };
  };
  metrics: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}
```

## Error Recovery Strategies

### Graceful Degradation
| Service | Degradation Strategy | Fallback Behavior | User Impact |
|---------|---------------------|-------------------|-------------|
| **AI Classification** | Use rule-based classifier | Lower accuracy | Reduced automation |
| **Gmail Sync** | Manual sync only | No real-time updates | Delayed data |
| **Notifications** | Store for later delivery | Delayed notifications | Reduced real-time experience |
| **Search** | Basic text search | Slower, less accurate | Reduced search quality |

### Automatic Recovery
```typescript
interface RecoveryStrategy {
  errorType: string;
  strategy: 'RETRY' | 'FALLBACK' | 'CIRCUIT_BREAKER' | 'GRACEFUL_DEGRADATION';
  config: Record<string, any>;
  healthCheck: () => Promise<boolean>;
  recovery: () => Promise<void>;
}

class RecoveryManager {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  
  async handleError(error: BaseError): Promise<void> {
    const strategy = this.strategies.get(error.code);
    
    if (!strategy) {
      throw error; // No recovery strategy available
    }
    
    switch (strategy.strategy) {
      case 'RETRY':
        await this.executeRetry(error, strategy);
        break;
      case 'FALLBACK':
        await this.executeFallback(error, strategy);
        break;
      case 'CIRCUIT_BREAKER':
        await this.executeCircuitBreaker(error, strategy);
        break;
      case 'GRACEFUL_DEGRADATION':
        await this.executeGracefulDegradation(error, strategy);
        break;
    }
  }
}
```