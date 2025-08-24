/**
 * @file Entity Index
 * @purpose Central export point for all database entities
 */

// Core entities
export { User, UserRole, UserStatus } from './user.entity';
export {
  EmailMessage,
  WorkflowState,
  Priority,
  EmailAddress,
  EmailHeaders,
  EmailMetadata
} from './email-message.entity';
export {
  Classification,
  EmailCategory,
  ClassificationFeatures,
  ClassificationMetrics
} from './classification.entity';
export {
  Extraction,
  ExtractedData,
  ExtractionMetrics
} from './extraction.entity';
export {
  Attachment,
  AttachmentStatus,
  AttachmentMetadata
} from './attachment.entity';

// Additional entities
export {
  WorkflowTransition,
  TransitionTrigger,
  TransitionMetadata
} from './workflow-transition.entity';
export {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationData
} from './notification.entity';
export {
  AuditLog,
  AuditAction,
  AuditSeverity,
  AuditContext,
  AuditChanges
} from './audit-log.entity';

// Import entities for the ENTITIES array
import { User } from './user.entity';
import { EmailMessage } from './email-message.entity';
import { Classification } from './classification.entity';
import { Extraction } from './extraction.entity';
import { Attachment } from './attachment.entity';
import { WorkflowTransition } from './workflow-transition.entity';
import { Notification } from './notification.entity';
import { AuditLog } from './audit-log.entity';

/**
 * @constant ENTITIES
 * @purpose Array of all entities for TypeORM configuration
 */
export const ENTITIES = [
  User,
  EmailMessage,
  Classification,
  Extraction,
  Attachment,
  WorkflowTransition,
  Notification,
  AuditLog,
];
