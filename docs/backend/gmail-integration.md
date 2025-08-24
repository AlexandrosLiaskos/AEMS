# Gmail Integration

## Gmail API Integration

### API Configuration
| Setting | Value | Purpose |
|---------|-------|---------|
| **API Version** | v1 | Stable Gmail API |
| **Scopes** | `gmail.readonly`, `profile`, `email` | Read emails + user info |
| **Quota Limits** | 1 billion quota units/day | Rate limiting |
| **Request Rate** | 250 quota units/user/second | Burst protection |
| **Batch Size** | 100 requests/batch | Efficient bulk operations |

### OAuth2 Scopes
| Scope | Purpose | Justification |
|-------|---------|---------------|
| `https://www.googleapis.com/auth/gmail.readonly` | Read Gmail messages | Core functionality |
| `https://www.googleapis.com/auth/userinfo.profile` | User profile info | User identification |
| `https://www.googleapis.com/auth/userinfo.email` | User email address | Account linking |

### API Endpoints Used
| Endpoint | Method | Purpose | Quota Cost | Rate Limit |
|----------|--------|---------|------------|------------|
| `/gmail/v1/users/me/messages` | GET | List messages | 5 units | 250/second |
| `/gmail/v1/users/me/messages/{id}` | GET | Get message | 5 units | 250/second |
| `/gmail/v1/users/me/messages/{id}/attachments/{id}` | GET | Get attachment | 5 units | 250/second |
| `/gmail/v1/users/me/profile` | GET | Get profile | 1 unit | 250/second |
| `/gmail/v1/users/me/history` | GET | Get history | 2 units | 250/second |

## Email Synchronization

### Sync Strategies
| Strategy | Use Case | Frequency | Data Volume | Performance |
|----------|----------|-----------|-------------|-------------|
| **Full Sync** | Initial setup, data recovery | Manual/weekly | All emails | Slow, comprehensive |
| **Incremental Sync** | Regular updates | Every 5-15 minutes | New/changed emails | Fast, efficient |
| **Real-time Sync** | Immediate updates | Push notifications | Individual emails | Instant, minimal |
| **Selective Sync** | Specific folders/labels | On-demand | Filtered emails | Variable |

### Full Synchronization Process
| Step | Action | API Calls | Error Handling | Progress Tracking |
|------|--------|-----------|----------------|-------------------|
| 1 | **Get User Profile** | `users/me/profile` | Retry with backoff | 5% |
| 2 | **List All Messages** | `messages?maxResults=500` | Handle pagination | 10-30% |
| 3 | **Batch Message Details** | `messages/batch` (100 per batch) | Retry failed items | 30-80% |
| 4 | **Download Attachments** | `attachments/{id}` | Skip on failure | 80-95% |
| 5 | **Store in Database** | Local operations | Transaction rollback | 95-100% |

### Incremental Synchronization Process
| Step | Action | API Calls | Optimization | Conflict Resolution |
|------|--------|-----------|--------------|-------------------|
| 1 | **Get History** | `history?startHistoryId={last}` | Use historyId cursor | Latest wins |
| 2 | **Filter Changes** | Local processing | Skip unchanged | Merge metadata |
| 3 | **Fetch New Messages** | `messages/{id}` | Batch requests | Update existing |
| 4 | **Update Database** | Local operations | Atomic updates | Log conflicts |

### Real-time Synchronization (Push Notifications)
| Component | Configuration | Purpose | Fallback |
|-----------|---------------|---------|----------|
| **Pub/Sub Topic** | `projects/{project}/topics/gmail` | Receive notifications | Polling |
| **Webhook Endpoint** | `POST /api/gmail/webhook` | Handle notifications | Manual sync |
| **Message Processing** | Async queue | Process updates | Batch processing |
| **Verification** | Google signature | Security | IP whitelist |

## Data Mapping & Transformation

### Gmail Message to Email Entity
| Gmail Field | Email Entity Field | Transformation | Validation |
|-------------|-------------------|----------------|------------|
| `id` | `gmailId` | Direct mapping | Required, unique |
| `threadId` | `threadId` | Direct mapping | Required |
| `payload.headers` | `subject`, `from`, `to`, `cc` | Header parsing | Email format validation |
| `payload.body.data` | `bodyText` | Base64 decode | UTF-8 validation |
| `payload.parts` | `bodyHtml`, `attachments` | MIME parsing | Content type validation |
| `snippet` | `snippet` | Direct mapping | Length limit |
| `labelIds` | `labels` | Array mapping | Label validation |
| `internalDate` | `receivedAt` | Timestamp conversion | Date validation |

### Header Parsing
```typescript
interface HeaderParser {
  parseFrom(headers: GmailHeader[]): EmailAddress;
  parseTo(headers: GmailHeader[]): EmailAddress[];
  parseCC(headers: GmailHeader[]): EmailAddress[];
  parseBCC(headers: GmailHeader[]): EmailAddress[];
  parseSubject(headers: GmailHeader[]): string;
  parseDate(headers: GmailHeader[]): Date;
  parseMessageId(headers: GmailHeader[]): string;
  parseReferences(headers: GmailHeader[]): string[];
}
```

### MIME Content Processing
| Content Type | Processing | Output | Error Handling |
|--------------|------------|--------|----------------|
| `text/plain` | Direct extraction | `bodyText` | Encoding fallback |
| `text/html` | HTML parsing + sanitization | `bodyHtml` | Strip dangerous tags |
| `multipart/alternative` | Prefer HTML, fallback text | Both fields | Use available part |
| `multipart/mixed` | Extract all parts | Text + attachments | Skip corrupted parts |
| `application/*` | Attachment processing | `attachments[]` | Log unsupported types |
| `image/*` | Attachment processing | `attachments[]` | Validate image format |

### Attachment Processing
| Step | Action | Validation | Storage |
|------|--------|------------|---------|
| 1 | **Extract Metadata** | Filename, size, MIME type | Required fields |
| 2 | **Download Content** | Gmail attachments API | Size limits |
| 3 | **Virus Scanning** | ClamAV integration | Quarantine infected |
| 4 | **File Storage** | Local filesystem | Unique naming |
| 5 | **Database Record** | Attachment entity | Foreign key integrity |

## Error Handling & Resilience

### Error Categories
| Error Type | HTTP Status | Retry Strategy | User Impact | Resolution |
|------------|-------------|----------------|-------------|------------|
| **Rate Limit** | 429 | Exponential backoff | Sync delay | Automatic |
| **Quota Exceeded** | 403 | Wait until reset | Sync pause | Automatic |
| **Invalid Token** | 401 | Refresh token | Re-authentication | User action |
| **Network Error** | 5xx | Linear backoff | Temporary failure | Automatic |
| **Invalid Request** | 400 | No retry | Log error | Manual fix |
| **Not Found** | 404 | Skip item | Missing email | Log warning |

### Retry Configuration
```typescript
interface RetryConfig {
  maxAttempts: number;           // 3
  baseDelay: number;             // 1000ms
  maxDelay: number;              // 30000ms
  backoffMultiplier: number;     // 2
  jitter: boolean;               // true
  retryableErrors: number[];     // [429, 500, 502, 503, 504]
}
```

### Circuit Breaker Pattern
| State | Condition | Behavior | Recovery |
|-------|-----------|----------|----------|
| **Closed** | Normal operation | Allow all requests | N/A |
| **Open** | Error rate > 50% | Block all requests | After timeout |
| **Half-Open** | Testing recovery | Allow limited requests | Based on success rate |

### Fallback Mechanisms
| Primary Method | Fallback | Trigger | Data Quality |
|----------------|----------|---------|--------------|
| **Real-time Push** | Polling sync | Push failure | Same |
| **Batch API** | Individual requests | Batch failure | Same |
| **Full Message** | Message snippet | API timeout | Reduced |
| **Attachment Download** | Placeholder | Download failure | Missing attachment |

## Performance Optimization

### Request Batching
| Operation | Batch Size | Frequency | Benefits |
|-----------|------------|-----------|----------|
| **Message List** | 500 per request | As needed | Reduced API calls |
| **Message Details** | 100 per batch | Every 30s | Efficient bulk fetch |
| **Attachment Download** | 10 concurrent | As needed | Parallel processing |
| **History Requests** | Single request | Every 5 minutes | Minimal overhead |

### Caching Strategy
| Cache Type | TTL | Size Limit | Eviction Policy |
|------------|-----|------------|-----------------|
| **Message Metadata** | 1 hour | 10,000 items | LRU |
| **User Profiles** | 24 hours | 1,000 items | LRU |
| **Label Information** | 6 hours | 500 items | LRU |
| **Attachment Metadata** | 12 hours | 5,000 items | LRU |

### Connection Pooling
```typescript
interface ConnectionConfig {
  maxConnections: number;        // 10
  connectionTimeout: number;     // 30000ms
  requestTimeout: number;        // 60000ms
  keepAlive: boolean;           // true
  keepAliveMsecs: number;       // 1000ms
}
```

### Rate Limiting Implementation
| Level | Limit | Window | Implementation |
|-------|-------|--------|----------------|
| **Global** | 1000 requests | 1 minute | Token bucket |
| **Per User** | 100 requests | 1 minute | Sliding window |
| **Per Operation** | 50 requests | 1 minute | Fixed window |
| **Burst Protection** | 10 requests | 1 second | Token bucket |

## Monitoring & Observability

### Sync Metrics
| Metric | Purpose | Alert Threshold | Dashboard |
|--------|---------|-----------------|-----------|
| **Sync Success Rate** | Reliability | < 95% | Primary |
| **Sync Duration** | Performance | > 5 minutes | Primary |
| **API Error Rate** | Health | > 5% | Primary |
| **Quota Usage** | Cost control | > 80% | Secondary |
| **Message Processing Rate** | Throughput | < 100/minute | Secondary |
| **Attachment Download Rate** | Performance | < 50% success | Secondary |

### Error Tracking
```typescript
interface SyncError {
  id: string;
  userId: string;
  operation: string;             // 'FULL_SYNC', 'INCREMENTAL_SYNC'
  errorType: string;             // 'RATE_LIMIT', 'QUOTA_EXCEEDED'
  errorMessage: string;
  stackTrace?: string;
  context: {
    messageId?: string;
    batchId?: string;
    retryCount: number;
  };
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}
```

### Performance Monitoring
| Component | Metrics | Alerts | Actions |
|-----------|---------|--------|---------|
| **API Latency** | p50, p95, p99 response times | p95 > 2s | Scale resources |
| **Queue Depth** | Pending sync jobs | > 100 jobs | Add workers |
| **Memory Usage** | Heap size, GC frequency | > 80% heap | Optimize memory |
| **CPU Usage** | Process CPU percentage | > 80% CPU | Scale horizontally |

## Security Considerations

### Token Security
| Aspect | Implementation | Purpose |
|--------|----------------|---------|
| **Token Encryption** | AES-256 encryption | Protect stored tokens |
| **Token Rotation** | Automatic refresh | Minimize exposure window |
| **Scope Limitation** | Minimal required scopes | Principle of least privilege |
| **Token Revocation** | On user logout/deletion | Prevent unauthorized access |

### Data Privacy
| Measure | Implementation | Compliance |
|---------|----------------|------------|
| **Data Minimization** | Only fetch required fields | GDPR Article 5 |
| **Retention Limits** | Configurable retention period | GDPR Article 17 |
| **User Consent** | Explicit OAuth consent | GDPR Article 6 |
| **Data Portability** | Export functionality | GDPR Article 20 |
| **Right to Deletion** | Account deletion process | GDPR Article 17 |

### Audit Logging
| Event | Log Level | Data Logged | Retention |
|-------|-----------|-------------|-----------|
| **Sync Started** | INFO | User ID, sync type, timestamp | 90 days |
| **Sync Completed** | INFO | User ID, messages processed, duration | 90 days |
| **API Error** | WARN | User ID, error type, message ID | 1 year |
| **Token Refresh** | INFO | User ID, timestamp | 30 days |
| **Quota Warning** | WARN | Usage percentage, timestamp | 1 year |

## Webhook Integration

### Push Notification Setup
```typescript
interface PushNotificationConfig {
  topicName: string;             // 'projects/aems/topics/gmail'
  subscriptionName: string;      // 'gmail-notifications'
  endpoint: string;              // 'https://api.aems.com/webhooks/gmail'
  ackDeadline: number;           // 60 seconds
  messageRetention: number;      // 7 days
}
```

### Webhook Processing
| Step | Action | Validation | Error Handling |
|------|--------|------------|----------------|
| 1 | **Verify Signature** | Google signature validation | Reject invalid |
| 2 | **Parse Message** | JSON parsing | Log malformed |
| 3 | **Extract History ID** | Get historyId from payload | Use last known |
| 4 | **Queue Sync Job** | Add to processing queue | Retry on failure |
| 5 | **Acknowledge** | Send ACK to Pub/Sub | Prevent redelivery |

### Webhook Security
| Security Measure | Implementation | Purpose |
|------------------|----------------|---------|
| **Signature Verification** | HMAC-SHA256 validation | Authenticate Google |
| **IP Whitelisting** | Google IP ranges | Network security |
| **Rate Limiting** | 1000 requests/minute | Prevent abuse |
| **Idempotency** | Message deduplication | Prevent duplicates |