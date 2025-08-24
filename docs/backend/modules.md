# Backend Modules

## Core Modules

### Auth Module
| Aspect | Details |
|--------|---------|
| **Purpose** | User authentication and authorization |
| **Responsibilities** | Google OAuth2, JWT tokens, session management |
| **Entities** | User, Session, Token |
| **Services** | AuthService, TokenService, SessionService |
| **Controllers** | AuthController |
| **Guards** | JwtAuthGuard, GoogleOAuthGuard |

### Email Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Email message management and CRUD operations |
| **Responsibilities** | Email storage, retrieval, filtering, bulk operations |
| **Entities** | EmailMessage, EmailAttachment, EmailThread |
| **Services** | EmailService, EmailQueryService, EmailBulkService |
| **Controllers** | EmailController |
| **Repositories** | EmailRepository, AttachmentRepository |

### Gmail Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Gmail API integration and synchronization |
| **Responsibilities** | Fetch emails, sync with Gmail, handle OAuth tokens |
| **Services** | GmailService, GmailSyncService, GmailAuthService |
| **Controllers** | GmailController |
| **Schedulers** | GmailSyncScheduler |
| **Adapters** | GmailApiAdapter |

### AI Module
| Aspect | Details |
|--------|---------|
| **Purpose** | AI-powered email classification and data extraction |
| **Responsibilities** | Email categorization, data extraction, AI model management |
| **Services** | AIClassificationService, AIExtractionService, AIModelService |
| **Controllers** | AIController |
| **Entities** | Classification, Extraction, AIModel |
| **Providers** | OpenAIProvider, LangChainProvider |

### Workflow Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Email workflow state management |
| **Responsibilities** | State transitions, workflow rules, approval processes |
| **Services** | WorkflowService, StateTransitionService, ApprovalService |
| **Controllers** | WorkflowController |
| **Entities** | WorkflowState, StateTransition, ApprovalRule |
| **Guards** | WorkflowPermissionGuard |

### Notification Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Real-time notifications and alerts |
| **Responsibilities** | SSE, WebSocket connections, notification delivery |
| **Services** | NotificationService, SSEService, WebSocketService |
| **Controllers** | NotificationController |
| **Gateways** | NotificationGateway |
| **Entities** | Notification, NotificationTemplate |

## Support Modules

### Audit Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Activity logging and audit trails |
| **Responsibilities** | Log user actions, system events, security events |
| **Services** | AuditService, AuditLogService |
| **Entities** | AuditLog, AuditEvent |
| **Interceptors** | AuditInterceptor |

### Health Module
| Aspect | Details |
|--------|---------|
| **Purpose** | System health monitoring and metrics |
| **Responsibilities** | Health checks, performance metrics, system status |
| **Services** | HealthService, MetricsService |
| **Controllers** | HealthController |
| **Indicators** | DatabaseHealthIndicator, APIHealthIndicator |

### Backup Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Data backup and recovery |
| **Responsibilities** | Scheduled backups, data integrity, restore operations |
| **Services** | BackupService, RestoreService, IntegrityService |
| **Controllers** | BackupController |
| **Schedulers** | BackupScheduler |

### Export Module
| Aspect | Details |
|--------|---------|
| **Purpose** | Data export functionality |
| **Responsibilities** | XLSX export, CSV export, data formatting |
| **Services** | ExportService, XLSXService, CSVService |
| **Controllers** | ExportController |
| **Formatters** | EmailExportFormatter, DataExportFormatter |

## Module Dependencies

### Dependency Graph
| Module | Depends On | Reason |
|--------|------------|--------|
| **Email** | Auth | User context for email access |
| **Gmail** | Auth, Email | Authentication for Gmail API, email storage |
| **AI** | Email | Email data for processing |
| **Workflow** | Email, Auth | Email state management, user permissions |
| **Notification** | Auth, Email, Workflow | User notifications for email events |
| **Audit** | Auth | User context for audit logs |
| **Export** | Email, Auth | Email data export with user permissions |
| **Backup** | All data modules | Data backup across all modules |

### Module Interactions
| From Module | To Module | Interaction Type | Purpose |
|-------------|-----------|------------------|---------|
| Gmail → Email | Service call | Store fetched emails |
| Email → AI | Event emission | Trigger AI processing |
| AI → Workflow | Service call | Update workflow state |
| Workflow → Notification | Event emission | Notify state changes |
| All → Audit | Interceptor | Log activities |
| Email → Export | Service call | Export email data |

## Module Configuration

### Module Registration Order
1. **Core Infrastructure**: Health, Audit, Config
2. **Authentication**: Auth
3. **Data Layer**: Email, Gmail
4. **Processing**: AI, Workflow
5. **Communication**: Notification
6. **Utilities**: Export, Backup

### Shared Dependencies
| Dependency | Used By | Purpose |
|------------|---------|---------|
| **TypeORM** | Email, Auth, AI, Workflow | Database operations |
| **ConfigService** | All modules | Configuration access |
| **EventEmitter** | Gmail, AI, Workflow, Notification | Inter-module communication |
| **Logger** | All modules | Structured logging |
| **Cache** | Gmail, AI, Email | Performance optimization |