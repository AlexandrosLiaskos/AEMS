# Backend Entities

## Core Entities

### User Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique user identifier |
| `googleId` | `string` | Unique, Not Null | Google OAuth user ID |
| `email` | `string` | Not Null | User email address |
| `name` | `string` | Not Null | User display name |
| `picture` | `string` | Nullable | Profile picture URL |
| `accessToken` | `string` | Nullable, Encrypted | Gmail OAuth access token |
| `refreshToken` | `string` | Nullable, Encrypted | Gmail OAuth refresh token |
| `tokenExpiry` | `Date` | Nullable | Token expiration date |
| `preferences` | `JSON` | Nullable | User preferences object |
| `isActive` | `boolean` | Default: true | User account status |
| `lastLogin` | `Date` | Nullable | Last login timestamp |
| `createdAt` | `Date` | Auto-generated | Account creation date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

### EmailMessage Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique email identifier |
| `gmailId` | `string` | Unique, Not Null | Gmail message ID |
| `threadId` | `string` | Not Null | Gmail thread ID |
| `userId` | `string` | Foreign Key, Not Null | Owner user ID |
| `subject` | `string` | Not Null | Email subject |
| `fromEmail` | `string` | Not Null | Sender email address |
| `fromName` | `string` | Nullable | Sender display name |
| `toEmails` | `JSON` | Not Null | Recipient email addresses |
| `ccEmails` | `JSON` | Nullable | CC email addresses |
| `bccEmails` | `JSON` | Nullable | BCC email addresses |
| `bodyText` | `text` | Nullable | Plain text body |
| `bodyHtml` | `text` | Nullable | HTML body |
| `snippet` | `string` | Not Null | Email snippet |
| `isRead` | `boolean` | Default: false | Read status |
| `isStarred` | `boolean` | Default: false | Starred status |
| `labels` | `JSON` | Nullable | Gmail labels |
| `workflowState` | `enum` | Default: 'FETCHED' | Current workflow state |
| `priority` | `enum` | Default: 'NORMAL' | Email priority |
| `tags` | `JSON` | Nullable | User-defined tags |
| `notes` | `text` | Nullable | User notes |
| `receivedAt` | `Date` | Not Null | Email received date |
| `fetchedAt` | `Date` | Not Null | Email fetched date |
| `processedAt` | `Date` | Nullable | AI processing date |
| `deletedAt` | `Date` | Nullable | Soft delete timestamp |
| `createdAt` | `Date` | Auto-generated | Record creation date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

### EmailAttachment Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique attachment identifier |
| `emailId` | `string` | Foreign Key, Not Null | Parent email ID |
| `gmailAttachmentId` | `string` | Not Null | Gmail attachment ID |
| `filename` | `string` | Not Null | Original filename |
| `mimeType` | `string` | Not Null | MIME type |
| `size` | `number` | Not Null | File size in bytes |
| `contentId` | `string` | Nullable | Content ID for inline attachments |
| `isInline` | `boolean` | Default: false | Inline attachment flag |
| `downloadUrl` | `string` | Nullable | Download URL |
| `localPath` | `string` | Nullable | Local file path |
| `processedAt` | `Date` | Nullable | Processing timestamp |
| `createdAt` | `Date` | Auto-generated | Record creation date |

## AI Processing Entities

### Classification Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique classification identifier |
| `emailId` | `string` | Foreign Key, Not Null | Classified email ID |
| `category` | `enum` | Not Null | Email category |
| `confidence` | `number` | Range: 0-1 | Classification confidence |
| `reasoning` | `text` | Nullable | AI reasoning explanation |
| `modelVersion` | `string` | Not Null | AI model version used |
| `processingTime` | `number` | Not Null | Processing time in milliseconds |
| `isManualOverride` | `boolean` | Default: false | Manual classification flag |
| `overrideReason` | `string` | Nullable | Override reason |
| `createdAt` | `Date` | Auto-generated | Classification date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

### Extraction Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique extraction identifier |
| `emailId` | `string` | Foreign Key, Not Null | Source email ID |
| `category` | `enum` | Not Null | Email category |
| `extractedData` | `JSON` | Not Null | Extracted structured data |
| `confidence` | `number` | Range: 0-1 | Extraction confidence |
| `schema` | `string` | Not Null | Data schema version |
| `modelVersion` | `string` | Not Null | AI model version used |
| `processingTime` | `number` | Not Null | Processing time in milliseconds |
| `isValidated` | `boolean` | Default: false | Human validation flag |
| `validationFeedback` | `JSON` | Nullable | Validation feedback |
| `createdAt` | `Date` | Auto-generated | Extraction date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

## Workflow Entities

### WorkflowState Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique state identifier |
| `name` | `string` | Unique, Not Null | State name |
| `displayName` | `string` | Not Null | Human-readable name |
| `description` | `text` | Nullable | State description |
| `color` | `string` | Not Null | UI color code |
| `icon` | `string` | Not Null | UI icon name |
| `isInitial` | `boolean` | Default: false | Initial state flag |
| `isFinal` | `boolean` | Default: false | Final state flag |
| `requiresApproval` | `boolean` | Default: false | Approval requirement |
| `allowedTransitions` | `JSON` | Not Null | Allowed next states |
| `createdAt` | `Date` | Auto-generated | State creation date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

### StateTransition Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique transition identifier |
| `emailId` | `string` | Foreign Key, Not Null | Email being transitioned |
| `fromState` | `string` | Not Null | Previous state |
| `toState` | `string` | Not Null | New state |
| `userId` | `string` | Foreign Key, Not Null | User who triggered transition |
| `reason` | `string` | Nullable | Transition reason |
| `metadata` | `JSON` | Nullable | Additional transition data |
| `isAutomated` | `boolean` | Default: false | Automated transition flag |
| `createdAt` | `Date` | Auto-generated | Transition timestamp |

## Notification Entities

### Notification Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique notification identifier |
| `userId` | `string` | Foreign Key, Not Null | Target user ID |
| `type` | `enum` | Not Null | Notification type |
| `title` | `string` | Not Null | Notification title |
| `message` | `text` | Not Null | Notification message |
| `data` | `JSON` | Nullable | Additional notification data |
| `isRead` | `boolean` | Default: false | Read status |
| `priority` | `enum` | Default: 'NORMAL' | Notification priority |
| `expiresAt` | `Date` | Nullable | Expiration date |
| `readAt` | `Date` | Nullable | Read timestamp |
| `createdAt` | `Date` | Auto-generated | Notification creation date |

### NotificationTemplate Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique template identifier |
| `name` | `string` | Unique, Not Null | Template name |
| `type` | `enum` | Not Null | Notification type |
| `title` | `string` | Not Null | Template title |
| `message` | `text` | Not Null | Template message |
| `variables` | `JSON` | Nullable | Template variables |
| `isActive` | `boolean` | Default: true | Template status |
| `createdAt` | `Date` | Auto-generated | Template creation date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

## Audit Entities

### AuditLog Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique log identifier |
| `userId` | `string` | Foreign Key, Nullable | User who performed action |
| `action` | `string` | Not Null | Action performed |
| `resource` | `string` | Not Null | Resource affected |
| `resourceId` | `string` | Nullable | Resource identifier |
| `details` | `JSON` | Nullable | Action details |
| `ipAddress` | `string` | Nullable | User IP address |
| `userAgent` | `string` | Nullable | User agent string |
| `success` | `boolean` | Not Null | Action success status |
| `errorMessage` | `string` | Nullable | Error message if failed |
| `createdAt` | `Date` | Auto-generated | Action timestamp |

## System Entities

### Settings Entity
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `string` | Primary Key, UUID | Unique setting identifier |
| `key` | `string` | Unique, Not Null | Setting key |
| `value` | `JSON` | Not Null | Setting value |
| `type` | `enum` | Not Null | Value type |
| `description` | `text` | Nullable | Setting description |
| `isPublic` | `boolean` | Default: false | Public visibility flag |
| `isEditable` | `boolean` | Default: true | Edit permission flag |
| `createdAt` | `Date` | Auto-generated | Setting creation date |
| `updatedAt` | `Date` | Auto-updated | Last update date |

## Entity Relationships

### Primary Relationships
| Parent Entity | Child Entity | Relationship Type | Foreign Key |
|---------------|--------------|-------------------|-------------|
| `User` | `EmailMessage` | One-to-Many | `userId` |
| `EmailMessage` | `EmailAttachment` | One-to-Many | `emailId` |
| `EmailMessage` | `Classification` | One-to-One | `emailId` |
| `EmailMessage` | `Extraction` | One-to-One | `emailId` |
| `EmailMessage` | `StateTransition` | One-to-Many | `emailId` |
| `User` | `Notification` | One-to-Many | `userId` |
| `User` | `AuditLog` | One-to-Many | `userId` |

### Enum Definitions
| Enum | Values | Usage |
|------|--------|-------|
| `WorkflowState` | `FETCHED`, `PROCESSING`, `REVIEW`, `APPROVED`, `REJECTED`, `ARCHIVED` | Email workflow states |
| `EmailCategory` | `CUSTOMER_INQUIRY`, `INVOICE`, `OTHER` | AI classification categories |
| `Priority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` | Email and notification priority |
| `NotificationType` | `EMAIL_RECEIVED`, `PROCESSING_COMPLETE`, `APPROVAL_REQUIRED`, `SYSTEM_ALERT` | Notification types |
| `SettingType` | `STRING`, `NUMBER`, `BOOLEAN`, `JSON`, `ARRAY` | Setting value types |