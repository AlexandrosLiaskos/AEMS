# Backend Controllers & GraphQL Resolvers

## REST Controllers

### AuthController
| Endpoint | Method | Parameters | Response | Purpose |
|----------|--------|------------|----------|---------|
| `/auth/google` | GET | - | Redirect to Google OAuth | Initiate Google OAuth flow |
| `/auth/google/callback` | GET | `code: string` | `{ user, tokens }` | Handle OAuth callback |
| `/auth/refresh` | POST | `{ refreshToken: string }` | `{ accessToken, refreshToken }` | Refresh access token |
| `/auth/logout` | POST | - | `{ success: boolean }` | Logout user |
| `/auth/profile` | GET | - | `User` | Get current user profile |

### EmailController
| Endpoint | Method | Parameters | Response | Purpose |
|----------|--------|------------|----------|---------|
| `/emails/upload` | POST | `file: File` | `{ attachmentId: string }` | Upload email attachment |
| `/emails/export` | GET | `format: string, ids: string[]` | `File` | Export emails to file |
| `/emails/bulk` | POST | `{ action: string, emailIds: string[] }` | `BulkOperationResult` | Bulk operations |

### GmailController
| Endpoint | Method | Parameters | Response | Purpose |
|----------|--------|------------|----------|---------|
| `/gmail/sync` | POST | - | `SyncResult` | Trigger manual sync |
| `/gmail/sync/status` | GET | - | `SyncStatus` | Get sync status |
| `/gmail/webhook` | POST | `GooglePubSubMessage` | `{ success: boolean }` | Gmail push notifications |

### HealthController
| Endpoint | Method | Parameters | Response | Purpose |
|----------|--------|------------|----------|---------|
| `/health` | GET | - | `HealthStatus` | Basic health check |
| `/health/detailed` | GET | - | `DetailedHealthStatus` | Detailed system health |
| `/metrics` | GET | - | `SystemMetrics` | System performance metrics |

### NotificationController
| Endpoint | Method | Parameters | Response | Purpose |
|----------|--------|------------|----------|---------|
| `/notifications/sse` | GET | - | `EventStream` | Server-sent events stream |
| `/notifications/test` | POST | `{ message: string }` | `{ success: boolean }` | Test notification |

## GraphQL Resolvers

### Query Resolvers

#### UserResolver
| Query | Parameters | Return Type | Purpose |
|-------|------------|-------------|---------|
| `me` | - | `User` | Get current authenticated user |
| `userSettings` | - | `UserSettings` | Get user preferences and settings |

#### EmailResolver
| Query | Parameters | Return Type | Purpose |
|-------|------------|-------------|---------|
| `emails` | `filter: EmailFilter, pagination: PaginationInput` | `EmailConnection` | Get paginated emails with filters |
| `email` | `id: ID!` | `Email` | Get single email by ID |
| `emailSearch` | `query: String!, filters: EmailFilter` | `[Email!]!` | Search emails by text query |
| `emailStats` | `filter: EmailFilter` | `EmailStats` | Get email statistics |
| `deletedEmails` | `pagination: PaginationInput` | `EmailConnection` | Get soft-deleted emails |

#### WorkflowResolver
| Query | Parameters | Return Type | Purpose |
|-------|------------|-------------|---------|
| `workflowStates` | - | `[WorkflowState!]!` | Get all workflow states |
| `emailWorkflowHistory` | `emailId: ID!` | `[StateTransition!]!` | Get email workflow history |
| `pendingApprovals` | `pagination: PaginationInput` | `ApprovalConnection` | Get pending approvals |

#### NotificationResolver
| Query | Parameters | Return Type | Purpose |
|-------|------------|-------------|---------|
| `notifications` | `pagination: PaginationInput` | `NotificationConnection` | Get user notifications |
| `unreadNotificationCount` | - | `Int!` | Get unread notification count |

#### AIResolver
| Query | Parameters | Return Type | Purpose |
|-------|------------|-------------|---------|
| `classificationStats` | `filter: DateRangeFilter` | `ClassificationStats` | Get AI classification statistics |
| `extractionStats` | `filter: DateRangeFilter` | `ExtractionStats` | Get AI extraction statistics |
| `aiModels` | - | `[AIModel!]!` | Get available AI models |

### Mutation Resolvers

#### EmailResolver
| Mutation | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `updateEmail` | `id: ID!, input: UpdateEmailInput!` | `Email!` | Update email details |
| `deleteEmail` | `id: ID!` | `Boolean!` | Soft delete email |
| `restoreEmail` | `id: ID!` | `Email!` | Restore deleted email |
| `bulkUpdateEmails` | `ids: [ID!]!, input: BulkUpdateInput!` | `BulkOperationResult!` | Bulk update emails |
| `bulkDeleteEmails` | `ids: [ID!]!` | `BulkOperationResult!` | Bulk delete emails |
| `addEmailNote` | `emailId: ID!, note: String!` | `Email!` | Add note to email |
| `addEmailTags` | `emailId: ID!, tags: [String!]!` | `Email!` | Add tags to email |

#### WorkflowResolver
| Mutation | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `transitionEmailState` | `emailId: ID!, newState: WorkflowState!, reason: String` | `Email!` | Transition email workflow state |
| `approveEmail` | `emailId: ID!, decision: ApprovalDecision!, reason: String` | `Email!` | Approve or reject email |
| `bulkTransitionState` | `emailIds: [ID!]!, newState: WorkflowState!` | `BulkOperationResult!` | Bulk state transition |

#### GmailResolver
| Mutation | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `syncEmails` | `fullSync: Boolean` | `SyncResult!` | Trigger email synchronization |
| `refreshGmailToken` | - | `Boolean!` | Refresh Gmail OAuth token |
| `disconnectGmail` | - | `Boolean!` | Disconnect Gmail integration |

#### AIResolver
| Mutation | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `classifyEmail` | `emailId: ID!` | `Classification!` | Manually trigger email classification |
| `extractEmailData` | `emailId: ID!` | `Extraction!` | Manually trigger data extraction |
| `overrideClassification` | `emailId: ID!, category: EmailCategory!, reason: String!` | `Classification!` | Override AI classification |
| `validateExtraction` | `extractionId: ID!, isValid: Boolean!, feedback: String` | `Extraction!` | Validate extraction result |

#### NotificationResolver
| Mutation | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `markNotificationRead` | `id: ID!` | `Notification!` | Mark notification as read |
| `markAllNotificationsRead` | - | `Boolean!` | Mark all notifications as read |
| `deleteNotification` | `id: ID!` | `Boolean!` | Delete notification |

#### UserResolver
| Mutation | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `updateUserSettings` | `input: UserSettingsInput!` | `UserSettings!` | Update user preferences |
| `updateProfile` | `input: UpdateProfileInput!` | `User!` | Update user profile |

### Subscription Resolvers

#### EmailResolver
| Subscription | Parameters | Return Type | Purpose |
|--------------|------------|-------------|---------|
| `emailUpdated` | `userId: ID` | `Email!` | Subscribe to email updates |
| `emailCreated` | `userId: ID` | `Email!` | Subscribe to new emails |
| `emailDeleted` | `userId: ID` | `ID!` | Subscribe to email deletions |

#### WorkflowResolver
| Subscription | Parameters | Return Type | Purpose |
|--------------|------------|-------------|---------|
| `workflowStateChanged` | `userId: ID` | `StateTransition!` | Subscribe to workflow changes |
| `approvalRequested` | `userId: ID` | `ApprovalRequest!` | Subscribe to approval requests |

#### NotificationResolver
| Subscription | Parameters | Return Type | Purpose |
|--------------|------------|-------------|---------|
| `notificationReceived` | `userId: ID!` | `Notification!` | Subscribe to new notifications |

#### GmailResolver
| Subscription | Parameters | Return Type | Purpose |
|--------------|------------|-------------|---------|
| `syncProgress` | `userId: ID!` | `SyncProgress!` | Subscribe to sync progress updates |

## Controller Middleware & Guards

### Authentication Guards
| Guard | Purpose | Applied To |
|-------|---------|------------|
| `JwtAuthGuard` | Validate JWT token | All protected endpoints |
| `GoogleOAuthGuard` | Handle Google OAuth | OAuth endpoints |
| `OptionalAuthGuard` | Optional authentication | Public endpoints with user context |

### Authorization Guards
| Guard | Purpose | Applied To |
|-------|---------|------------|
| `EmailOwnershipGuard` | Verify email ownership | Email-specific operations |
| `WorkflowPermissionGuard` | Check workflow permissions | State transition operations |
| `AdminGuard` | Admin-only access | Administrative endpoints |

### Validation Pipes
| Pipe | Purpose | Applied To |
|------|---------|------------|
| `ValidationPipe` | DTO validation | All input DTOs |
| `ParseUUIDPipe` | UUID validation | ID parameters |
| `ParseEnumPipe` | Enum validation | Enum parameters |

### Interceptors
| Interceptor | Purpose | Applied To |
|-------------|---------|------------|
| `LoggingInterceptor` | Request/response logging | All endpoints |
| `TransformInterceptor` | Response transformation | All endpoints |
| `CacheInterceptor` | Response caching | Cacheable endpoints |
| `AuditInterceptor` | Audit logging | Sensitive operations |

## Error Handling

### Custom Exceptions
| Exception | HTTP Status | GraphQL Error | Purpose |
|-----------|-------------|---------------|---------|
| `EmailNotFoundException` | 404 | `NOT_FOUND` | Email not found |
| `UnauthorizedEmailAccessException` | 403 | `FORBIDDEN` | Email access denied |
| `InvalidWorkflowTransitionException` | 400 | `BAD_USER_INPUT` | Invalid state transition |
| `GmailSyncException` | 500 | `INTERNAL_ERROR` | Gmail sync failure |
| `AIProcessingException` | 500 | `INTERNAL_ERROR` | AI processing failure |
| `TokenExpiredException` | 401 | `UNAUTHENTICATED` | Expired authentication token |

### Error Response Format
```typescript
// REST Error Response
{
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
  message: string;
  details?: any;
}

// GraphQL Error Response
{
  message: string;
  locations: [{ line: number; column: number }];
  path: string[];
  extensions: {
    code: string;
    timestamp: string;
    details?: any;
  };
}
```

## Rate Limiting

### Rate Limit Configuration
| Endpoint Pattern | Limit | Window | Purpose |
|------------------|-------|--------|---------|
| `/auth/*` | 5 requests | 15 minutes | Prevent brute force |
| `/gmail/sync` | 10 requests | 1 hour | Prevent sync abuse |
| `/emails/export` | 3 requests | 5 minutes | Prevent resource exhaustion |
| `GraphQL` | 100 requests | 1 minute | General API protection |
| `Subscriptions` | 10 connections | Per user | Connection limits |

## Response Caching

### Cache Configuration
| Endpoint/Resolver | TTL | Cache Key | Invalidation |
|-------------------|-----|-----------|--------------|
| `workflowStates` | 1 hour | `workflow:states` | On state changes |
| `emailStats` | 5 minutes | `email:stats:{userId}:{filter}` | On email changes |
| `userSettings` | 30 minutes | `user:settings:{userId}` | On settings update |
| `aiModels` | 1 hour | `ai:models` | On model changes |