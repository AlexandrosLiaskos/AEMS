# Backend Services

## Auth Module Services

### AuthService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `validateGoogleUser` | `googleProfile: GoogleProfile` | `Promise<User>` | Validate and create/update user from Google OAuth |
| `generateTokens` | `user: User` | `Promise<TokenPair>` | Generate JWT access and refresh tokens |
| `refreshTokens` | `refreshToken: string` | `Promise<TokenPair>` | Refresh expired access token |
| `revokeTokens` | `userId: string` | `Promise<void>` | Revoke all user tokens |
| `validateUser` | `userId: string` | `Promise<User>` | Validate user exists and is active |

### TokenService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `createAccessToken` | `payload: JwtPayload` | `string` | Create JWT access token |
| `createRefreshToken` | `payload: JwtPayload` | `string` | Create JWT refresh token |
| `verifyToken` | `token: string` | `JwtPayload` | Verify and decode JWT token |
| `isTokenExpired` | `token: string` | `boolean` | Check if token is expired |
| `storeRefreshToken` | `userId: string, token: string` | `Promise<void>` | Store refresh token |

## Email Module Services

### EmailService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `createEmail` | `emailData: CreateEmailDto` | `Promise<EmailMessage>` | Create new email record |
| `findEmailById` | `id: string` | `Promise<EmailMessage>` | Find email by ID |
| `findEmailsByUser` | `userId: string, filters: EmailFilters` | `Promise<EmailMessage[]>` | Find user's emails with filters |
| `updateEmail` | `id: string, updates: UpdateEmailDto` | `Promise<EmailMessage>` | Update email record |
| `deleteEmail` | `id: string` | `Promise<void>` | Soft delete email |
| `restoreEmail` | `id: string` | `Promise<EmailMessage>` | Restore deleted email |

### EmailQueryService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `searchEmails` | `query: SearchQuery` | `Promise<EmailSearchResult>` | Full-text search emails |
| `filterEmails` | `filters: EmailFilters` | `Promise<EmailMessage[]>` | Filter emails by criteria |
| `sortEmails` | `emails: EmailMessage[], sort: SortOptions` | `EmailMessage[]` | Sort email results |
| `paginateEmails` | `emails: EmailMessage[], pagination: PaginationOptions` | `PaginatedResult<EmailMessage>` | Paginate email results |

### EmailBulkService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `bulkUpdateWorkflow` | `emailIds: string[], state: WorkflowState` | `Promise<BulkOperationResult>` | Update workflow state for multiple emails |
| `bulkDelete` | `emailIds: string[]` | `Promise<BulkOperationResult>` | Bulk delete emails |
| `bulkRestore` | `emailIds: string[]` | `Promise<BulkOperationResult>` | Bulk restore emails |
| `bulkExport` | `emailIds: string[], format: ExportFormat` | `Promise<ExportResult>` | Bulk export emails |

## Gmail Module Services

### GmailService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `fetchEmails` | `userId: string, options: FetchOptions` | `Promise<GmailMessage[]>` | Fetch emails from Gmail API |
| `fetchEmailById` | `userId: string, messageId: string` | `Promise<GmailMessage>` | Fetch specific email |
| `fetchAttachment` | `userId: string, messageId: string, attachmentId: string` | `Promise<Buffer>` | Fetch email attachment |
| `markAsRead` | `userId: string, messageId: string` | `Promise<void>` | Mark email as read in Gmail |
| `archiveEmail` | `userId: string, messageId: string` | `Promise<void>` | Archive email in Gmail |

### GmailSyncService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `syncUserEmails` | `userId: string` | `Promise<SyncResult>` | Sync user's emails from Gmail |
| `incrementalSync` | `userId: string, lastSyncTime: Date` | `Promise<SyncResult>` | Incremental email sync |
| `fullSync` | `userId: string` | `Promise<SyncResult>` | Full email sync |
| `getSyncStatus` | `userId: string` | `Promise<SyncStatus>` | Get current sync status |
| `scheduleSyncJob` | `userId: string, schedule: CronExpression` | `Promise<void>` | Schedule automatic sync |

### GmailAuthService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `refreshGmailToken` | `userId: string` | `Promise<string>` | Refresh Gmail OAuth token |
| `validateGmailAccess` | `userId: string` | `Promise<boolean>` | Validate Gmail API access |
| `revokeGmailAccess` | `userId: string` | `Promise<void>` | Revoke Gmail API access |
| `getGmailProfile` | `userId: string` | `Promise<GmailProfile>` | Get Gmail user profile |

## AI Module Services

### AIClassificationService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `classifyEmail` | `email: EmailMessage` | `Promise<Classification>` | Classify single email |
| `classifyBatch` | `emails: EmailMessage[]` | `Promise<Classification[]>` | Classify multiple emails |
| `retrainModel` | `trainingData: ClassificationTrainingData` | `Promise<void>` | Retrain classification model |
| `getClassificationConfidence` | `email: EmailMessage` | `Promise<number>` | Get classification confidence score |

### AIExtractionService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `extractData` | `email: EmailMessage` | `Promise<Extraction>` | Extract structured data from email |
| `extractFromPDF` | `attachment: EmailAttachment` | `Promise<Extraction>` | Extract data from PDF attachment |
| `validateExtraction` | `extraction: Extraction` | `Promise<ValidationResult>` | Validate extracted data |
| `improveExtraction` | `extraction: Extraction, feedback: ExtractionFeedback` | `Promise<Extraction>` | Improve extraction with feedback |

### AIModelService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `loadModel` | `modelName: string` | `Promise<AIModel>` | Load AI model |
| `updateModel` | `modelName: string, config: ModelConfig` | `Promise<void>` | Update model configuration |
| `getModelMetrics` | `modelName: string` | `Promise<ModelMetrics>` | Get model performance metrics |
| `switchModel` | `fromModel: string, toModel: string` | `Promise<void>` | Switch between models |

## Workflow Module Services

### WorkflowService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `transitionState` | `emailId: string, newState: WorkflowState` | `Promise<EmailMessage>` | Transition email workflow state |
| `getAvailableTransitions` | `emailId: string` | `Promise<WorkflowState[]>` | Get valid state transitions |
| `validateTransition` | `emailId: string, newState: WorkflowState` | `Promise<boolean>` | Validate state transition |
| `getWorkflowHistory` | `emailId: string` | `Promise<StateTransition[]>` | Get email workflow history |

### StateTransitionService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `executeTransition` | `transition: StateTransition` | `Promise<void>` | Execute state transition |
| `rollbackTransition` | `transitionId: string` | `Promise<void>` | Rollback state transition |
| `logTransition` | `transition: StateTransition` | `Promise<void>` | Log state transition |
| `getTransitionRules` | `fromState: WorkflowState, toState: WorkflowState` | `Promise<TransitionRule[]>` | Get transition rules |

### ApprovalService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `requestApproval` | `emailId: string, approver: string` | `Promise<ApprovalRequest>` | Request email approval |
| `approveEmail` | `approvalId: string, decision: ApprovalDecision` | `Promise<void>` | Approve/reject email |
| `getPendingApprovals` | `userId: string` | `Promise<ApprovalRequest[]>` | Get pending approvals |
| `getApprovalHistory` | `emailId: string` | `Promise<ApprovalHistory[]>` | Get approval history |

## Notification Module Services

### NotificationService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `sendNotification` | `notification: CreateNotificationDto` | `Promise<void>` | Send notification to user |
| `broadcastNotification` | `notification: CreateNotificationDto` | `Promise<void>` | Broadcast to all users |
| `markAsRead` | `notificationId: string` | `Promise<void>` | Mark notification as read |
| `getUserNotifications` | `userId: string` | `Promise<Notification[]>` | Get user notifications |
| `deleteNotification` | `notificationId: string` | `Promise<void>` | Delete notification |

### SSEService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `addClient` | `userId: string, response: Response` | `void` | Add SSE client connection |
| `removeClient` | `userId: string` | `void` | Remove SSE client connection |
| `sendToUser` | `userId: string, data: any` | `void` | Send data to specific user |
| `sendToAll` | `data: any` | `void` | Send data to all connected clients |
| `getConnectedUsers` | | `string[]` | Get list of connected users |

### WebSocketService
| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `handleConnection` | `client: Socket` | `void` | Handle new WebSocket connection |
| `handleDisconnection` | `client: Socket` | `void` | Handle WebSocket disconnection |
| `sendToClient` | `clientId: string, event: string, data: any` | `void` | Send event to specific client |
| `broadcastToRoom` | `room: string, event: string, data: any` | `void` | Broadcast to room |
| `joinRoom` | `clientId: string, room: string` | `void` | Join client to room |

## Service Dependencies

### Cross-Module Service Dependencies
| Service | Depends On | Purpose |
|---------|------------|---------|
| `GmailSyncService` | `EmailService` | Store synced emails |
| `AIClassificationService` | `EmailService` | Get emails for classification |
| `WorkflowService` | `EmailService`, `NotificationService` | Update emails, send notifications |
| `ExportService` | `EmailService` | Get emails for export |
| `BackupService` | All data services | Backup data |

### Internal Module Dependencies
| Module | Service Dependencies |
|--------|---------------------|
| **Auth** | `TokenService` → `AuthService` |
| **Email** | `EmailQueryService` → `EmailService`, `EmailBulkService` → `EmailService` |
| **Gmail** | `GmailAuthService` → `GmailService`, `GmailSyncService` → `GmailService` |
| **AI** | `AIModelService` → `AIClassificationService`, `AIExtractionService` |
| **Workflow** | `StateTransitionService` → `WorkflowService`, `ApprovalService` → `WorkflowService` |
| **Notification** | `SSEService` → `NotificationService`, `WebSocketService` → `NotificationService` |