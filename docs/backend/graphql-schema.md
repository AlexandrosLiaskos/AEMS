# GraphQL Schema

## Core Types

### User Types
```graphql
type User {
  id: ID!
  email: String!
  name: String!
  picture: String
  isActive: Boolean!
  lastLogin: DateTime
  preferences: UserPreferences
  createdAt: DateTime!
  updatedAt: DateTime!
}

type UserPreferences {
  theme: String
  language: String
  timezone: String
  emailNotifications: Boolean
  desktopNotifications: Boolean
  autoSync: Boolean
  syncInterval: Int
}

input UserSettingsInput {
  theme: String
  language: String
  timezone: String
  emailNotifications: Boolean
  desktopNotifications: Boolean
  autoSync: Boolean
  syncInterval: Int
}

input UpdateProfileInput {
  name: String
  picture: String
}
```

### Email Types
```graphql
type Email {
  id: ID!
  gmailId: String!
  threadId: String!
  subject: String!
  from: EmailAddress!
  to: [EmailAddress!]!
  cc: [EmailAddress!]
  bcc: [EmailAddress!]
  bodyText: String
  bodyHtml: String
  snippet: String!
  attachments: [EmailAttachment!]!
  classification: Classification
  extraction: Extraction
  workflowState: WorkflowState!
  priority: Priority!
  tags: [String!]!
  notes: [String!]!
  isRead: Boolean!
  isStarred: Boolean!
  labels: [String!]!
  receivedAt: DateTime!
  fetchedAt: DateTime!
  processedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type EmailAddress {
  email: String!
  name: String
}

type EmailAttachment {
  id: ID!
  filename: String!
  mimeType: String!
  size: Int!
  contentId: String
  isInline: Boolean!
  downloadUrl: String
  processedAt: DateTime
}

type EmailConnection {
  edges: [EmailEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type EmailEdge {
  node: Email!
  cursor: String!
}

type EmailStats {
  totalCount: Int!
  unreadCount: Int!
  categoryBreakdown: [CategoryCount!]!
  priorityBreakdown: [PriorityCount!]!
  workflowBreakdown: [WorkflowCount!]!
  recentActivity: [ActivityCount!]!
}

type CategoryCount {
  category: EmailCategory!
  count: Int!
}

type PriorityCount {
  priority: Priority!
  count: Int!
}

type WorkflowCount {
  state: WorkflowState!
  count: Int!
}

type ActivityCount {
  date: Date!
  count: Int!
}
```

### Email Input Types
```graphql
input EmailFilter {
  categories: [EmailCategory!]
  priorities: [Priority!]
  workflowStates: [WorkflowState!]
  isRead: Boolean
  isStarred: Boolean
  hasAttachments: Boolean
  tags: [String!]
  dateRange: DateRangeInput
  fromEmail: String
  subject: String
}

input DateRangeInput {
  from: DateTime
  to: DateTime
}

input UpdateEmailInput {
  subject: String
  priority: Priority
  tags: [String!]
  notes: [String!]
  isStarred: Boolean
}

input BulkUpdateInput {
  priority: Priority
  workflowState: WorkflowState
  tags: [String!]
  addTags: [String!]
  removeTags: [String!]
}
```

### AI Processing Types
```graphql
type Classification {
  id: ID!
  category: EmailCategory!
  confidence: Float!
  reasoning: String
  modelVersion: String!
  processingTime: Int!
  isManualOverride: Boolean!
  overrideReason: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Extraction {
  id: ID!
  category: EmailCategory!
  extractedData: JSON!
  confidence: Float!
  schema: String!
  modelVersion: String!
  processingTime: Int!
  isValidated: Boolean!
  validationFeedback: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ClassificationStats {
  totalClassified: Int!
  averageConfidence: Float!
  categoryAccuracy: [CategoryAccuracy!]!
  modelPerformance: [ModelPerformance!]!
  processingTimes: ProcessingTimeStats!
}

type ExtractionStats {
  totalExtracted: Int!
  averageConfidence: Float!
  validationRate: Float!
  schemaBreakdown: [SchemaCount!]!
  processingTimes: ProcessingTimeStats!
}

type CategoryAccuracy {
  category: EmailCategory!
  accuracy: Float!
  sampleSize: Int!
}

type ModelPerformance {
  modelVersion: String!
  accuracy: Float!
  averageConfidence: Float!
  processingTime: Float!
}

type ProcessingTimeStats {
  average: Float!
  median: Float!
  p95: Float!
  p99: Float!
}

type SchemaCount {
  schema: String!
  count: Int!
}

type AIModel {
  id: ID!
  name: String!
  version: String!
  type: AIModelType!
  isActive: Boolean!
  configuration: JSON!
  metrics: ModelMetrics
}

type ModelMetrics {
  accuracy: Float
  precision: Float
  recall: Float
  f1Score: Float
  lastEvaluated: DateTime
}
```

### Workflow Types
```graphql
type WorkflowState {
  id: ID!
  name: String!
  displayName: String!
  description: String
  color: String!
  icon: String!
  isInitial: Boolean!
  isFinal: Boolean!
  requiresApproval: Boolean!
  allowedTransitions: [WorkflowState!]!
}

type StateTransition {
  id: ID!
  email: Email!
  fromState: String!
  toState: String!
  user: User!
  reason: String
  metadata: JSON
  isAutomated: Boolean!
  createdAt: DateTime!
}

type ApprovalRequest {
  id: ID!
  email: Email!
  requester: User!
  approver: User
  status: ApprovalStatus!
  decision: ApprovalDecision
  reason: String
  decidedAt: DateTime
  createdAt: DateTime!
}

type ApprovalConnection {
  edges: [ApprovalEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ApprovalEdge {
  node: ApprovalRequest!
  cursor: String!
}
```

### Notification Types
```graphql
type Notification {
  id: ID!
  type: NotificationType!
  title: String!
  message: String!
  data: JSON
  isRead: Boolean!
  priority: Priority!
  expiresAt: DateTime
  readAt: DateTime
  createdAt: DateTime!
}

type NotificationConnection {
  edges: [NotificationEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type NotificationEdge {
  node: Notification!
  cursor: String!
}
```

### Gmail Integration Types
```graphql
type SyncResult {
  success: Boolean!
  emailsProcessed: Int!
  emailsAdded: Int!
  emailsUpdated: Int!
  emailsSkipped: Int!
  errors: [SyncError!]!
  startedAt: DateTime!
  completedAt: DateTime!
  duration: Int!
}

type SyncError {
  emailId: String
  error: String!
  details: String
}

type SyncStatus {
  isRunning: Boolean!
  lastSync: DateTime
  nextSync: DateTime
  progress: SyncProgress
}

type SyncProgress {
  currentStep: String!
  totalSteps: Int!
  completedSteps: Int!
  estimatedTimeRemaining: Int
  emailsProcessed: Int!
  emailsTotal: Int
}
```

### Utility Types
```graphql
type BulkOperationResult {
  success: Boolean!
  totalRequested: Int!
  totalProcessed: Int!
  totalSucceeded: Int!
  totalFailed: Int!
  errors: [BulkOperationError!]!
}

type BulkOperationError {
  id: ID!
  error: String!
  details: String
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
}
```

## Enums

```graphql
enum EmailCategory {
  CUSTOMER_INQUIRY
  INVOICE
  OTHER
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum WorkflowState {
  FETCHED
  PROCESSING
  REVIEW
  APPROVED
  REJECTED
  ARCHIVED
}

enum NotificationType {
  EMAIL_RECEIVED
  PROCESSING_COMPLETE
  APPROVAL_REQUIRED
  SYNC_COMPLETE
  SYNC_ERROR
  SYSTEM_ALERT
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

enum ApprovalDecision {
  APPROVE
  REJECT
}

enum AIModelType {
  CLASSIFICATION
  EXTRACTION
  HYBRID
}
```

## Scalars

```graphql
scalar DateTime
scalar Date
scalar JSON
scalar Upload
```

## Root Types

### Query
```graphql
type Query {
  # User queries
  me: User
  userSettings: UserPreferences

  # Email queries
  emails(filter: EmailFilter, pagination: PaginationInput): EmailConnection!
  email(id: ID!): Email
  emailSearch(query: String!, filters: EmailFilter): [Email!]!
  emailStats(filter: EmailFilter): EmailStats!
  deletedEmails(pagination: PaginationInput): EmailConnection!

  # Workflow queries
  workflowStates: [WorkflowState!]!
  emailWorkflowHistory(emailId: ID!): [StateTransition!]!
  pendingApprovals(pagination: PaginationInput): ApprovalConnection!

  # Notification queries
  notifications(pagination: PaginationInput): NotificationConnection!
  unreadNotificationCount: Int!

  # AI queries
  classificationStats(filter: DateRangeInput): ClassificationStats!
  extractionStats(filter: DateRangeInput): ExtractionStats!
  aiModels: [AIModel!]!

  # Gmail queries
  syncStatus: SyncStatus!
}
```

### Mutation
```graphql
type Mutation {
  # User mutations
  updateUserSettings(input: UserSettingsInput!): UserPreferences!
  updateProfile(input: UpdateProfileInput!): User!

  # Email mutations
  updateEmail(id: ID!, input: UpdateEmailInput!): Email!
  deleteEmail(id: ID!): Boolean!
  restoreEmail(id: ID!): Email!
  bulkUpdateEmails(ids: [ID!]!, input: BulkUpdateInput!): BulkOperationResult!
  bulkDeleteEmails(ids: [ID!]!): BulkOperationResult!
  addEmailNote(emailId: ID!, note: String!): Email!
  addEmailTags(emailId: ID!, tags: [String!]!): Email!

  # Workflow mutations
  transitionEmailState(emailId: ID!, newState: WorkflowState!, reason: String): Email!
  approveEmail(emailId: ID!, decision: ApprovalDecision!, reason: String): Email!
  bulkTransitionState(emailIds: [ID!]!, newState: WorkflowState!): BulkOperationResult!

  # Gmail mutations
  syncEmails(fullSync: Boolean = false): SyncResult!
  refreshGmailToken: Boolean!
  disconnectGmail: Boolean!

  # AI mutations
  classifyEmail(emailId: ID!): Classification!
  extractEmailData(emailId: ID!): Extraction!
  overrideClassification(emailId: ID!, category: EmailCategory!, reason: String!): Classification!
  validateExtraction(extractionId: ID!, isValid: Boolean!, feedback: String): Extraction!

  # Notification mutations
  markNotificationRead(id: ID!): Notification!
  markAllNotificationsRead: Boolean!
  deleteNotification(id: ID!): Boolean!
}
```

### Subscription
```graphql
type Subscription {
  # Email subscriptions
  emailUpdated(userId: ID): Email!
  emailCreated(userId: ID): Email!
  emailDeleted(userId: ID): ID!

  # Workflow subscriptions
  workflowStateChanged(userId: ID): StateTransition!
  approvalRequested(userId: ID): ApprovalRequest!

  # Notification subscriptions
  notificationReceived(userId: ID!): Notification!

  # Gmail subscriptions
  syncProgress(userId: ID!): SyncProgress!
}
```

## Schema Directives

```graphql
directive @auth on FIELD_DEFINITION
directive @rateLimit(max: Int!, window: Int!) on FIELD_DEFINITION
directive @cache(ttl: Int!) on FIELD_DEFINITION
directive @deprecated(reason: String) on FIELD_DEFINITION | ENUM_VALUE
```

## Usage Examples

### Query Examples
```graphql
# Get paginated emails with filters
query GetEmails($filter: EmailFilter, $pagination: PaginationInput) {
  emails(filter: $filter, pagination: $pagination) {
    edges {
      node {
        id
        subject
        from { email, name }
        workflowState
        priority
        classification { category, confidence }
        receivedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

# Search emails
query SearchEmails($query: String!, $filters: EmailFilter) {
  emailSearch(query: $query, filters: $filters) {
    id
    subject
    snippet
    from { email, name }
    receivedAt
  }
}
```

### Mutation Examples
```graphql
# Transition email workflow state
mutation TransitionState($emailId: ID!, $newState: WorkflowState!, $reason: String) {
  transitionEmailState(emailId: $emailId, newState: $newState, reason: $reason) {
    id
    workflowState
    updatedAt
  }
}

# Bulk update emails
mutation BulkUpdate($ids: [ID!]!, $input: BulkUpdateInput!) {
  bulkUpdateEmails(ids: $ids, input: $input) {
    success
    totalProcessed
    totalSucceeded
    errors { id, error }
  }
}
```

### Subscription Examples
```graphql
# Subscribe to email updates
subscription EmailUpdates($userId: ID) {
  emailUpdated(userId: $userId) {
    id
    subject
    workflowState
    updatedAt
  }
}

# Subscribe to sync progress
subscription SyncProgress($userId: ID!) {
  syncProgress(userId: $userId) {
    currentStep
    completedSteps
    totalSteps
    emailsProcessed
  }
}
```