import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

/**
 * @enum AuditAction
 * @purpose Audit action enumeration
 */
export enum AuditAction {
  // Authentication actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',

  // Email actions
  EMAIL_FETCHED = 'EMAIL_FETCHED',
  EMAIL_PROCESSED = 'EMAIL_PROCESSED',
  EMAIL_CLASSIFIED = 'EMAIL_CLASSIFIED',
  EMAIL_EXTRACTED = 'EMAIL_EXTRACTED',
  EMAIL_REVIEWED = 'EMAIL_REVIEWED',
  EMAIL_APPROVED = 'EMAIL_APPROVED',
  EMAIL_REJECTED = 'EMAIL_REJECTED',
  EMAIL_ARCHIVED = 'EMAIL_ARCHIVED',
  EMAIL_DELETED = 'EMAIL_DELETED',
  EMAIL_RESTORED = 'EMAIL_RESTORED',

  // Workflow actions
  WORKFLOW_TRANSITION = 'WORKFLOW_TRANSITION',
  CLASSIFICATION_OVERRIDE = 'CLASSIFICATION_OVERRIDE',
  EXTRACTION_CORRECTED = 'EXTRACTION_CORRECTED',

  // System actions
  SYNC_STARTED = 'SYNC_STARTED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  SYNC_FAILED = 'SYNC_FAILED',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',

  // Configuration actions
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_REACTIVATED = 'USER_REACTIVATED',

  // Data actions
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_IMPORTED = 'DATA_IMPORTED',
  DATA_PURGED = 'DATA_PURGED',

  // Security actions
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // Notification actions
  NOTIFICATION_CREATED = 'NOTIFICATION_CREATED',
  NOTIFICATION_READ = 'NOTIFICATION_READ',
  NOTIFICATION_DISMISSED = 'NOTIFICATION_DISMISSED',
  NOTIFICATION_ACTION_TAKEN = 'NOTIFICATION_ACTION_TAKEN',
  NOTIFICATION_DELETED = 'NOTIFICATION_DELETED',

  // API actions
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_CALL = 'API_CALL',
}

/**
 * @enum AuditSeverity
 * @purpose Audit log severity enumeration
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * @interface AuditContext
 * @purpose Audit context information
 */
export interface AuditContext {
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  correlationId?: string;
  requestId?: string;
  apiKey?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

/**
 * @interface AuditChanges
 * @purpose Audit changes information
 */
export interface AuditChanges {
  before?: Record<string, any>;
  after?: Record<string, any>;
  fields?: string[];
  diff?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

/**
 * @entity AuditLog
 * @purpose System audit log entity
 */
@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['severity', 'createdAt'])
@Index(['resourceType', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  @Index()
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.LOW,
  })
  severity: AuditSeverity;

  @Column({ nullable: true })
  resourceType: string; // e.g., 'email', 'user', 'classification'

  @Column({ nullable: true })
  @Index()
  resourceId: string; // ID of the affected resource

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  context: AuditContext;

  @Column({ type: 'json', nullable: true })
  changes: AuditChanges;

  @Column({ default: true })
  isSuccessful: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  stackTrace: string;

  @Column({ type: 'json', nullable: true })
  additionalData: Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({ nullable: true })
  performedBy: string; // Can be user ID, system, or API key

  /**
   * @method isSecurityEvent
   * @purpose Check if this is a security-related event
   */
  isSecurityEvent(): boolean {
    const securityActions = [
      AuditAction.LOGIN_FAILED,
      AuditAction.SECURITY_VIOLATION,
      AuditAction.RATE_LIMIT_EXCEEDED,
      AuditAction.UNAUTHORIZED_ACCESS,
      AuditAction.SUSPICIOUS_ACTIVITY,
    ];

    return securityActions.includes(this.action);
  }

  /**
   * @method isUserAction
   * @purpose Check if this was a user-initiated action
   */
  isUserAction(): boolean {
    return this.userId !== null && this.performedBy === this.userId;
  }

  /**
   * @method isSystemAction
   * @purpose Check if this was a system-initiated action
   */
  isSystemAction(): boolean {
    return this.performedBy === 'system';
  }

  /**
   * @method isApiAction
   * @purpose Check if this was an API-initiated action
   */
  isApiAction(): boolean {
    return this.context?.apiKey !== undefined;
  }

  /**
   * @method getActionDisplayName
   * @purpose Get human-readable action name
   */
  getActionDisplayName(): string {
    const displayNames: Record<AuditAction, string> = {
      [AuditAction.LOGIN]: 'User Login',
      [AuditAction.LOGOUT]: 'User Logout',
      [AuditAction.LOGIN_FAILED]: 'Failed Login Attempt',
      [AuditAction.PASSWORD_CHANGED]: 'Password Changed',
      [AuditAction.TOKEN_REFRESHED]: 'Token Refreshed',
      [AuditAction.EMAIL_FETCHED]: 'Email Fetched',
      [AuditAction.EMAIL_PROCESSED]: 'Email Processed',
      [AuditAction.EMAIL_CLASSIFIED]: 'Email Classified',
      [AuditAction.EMAIL_EXTRACTED]: 'Data Extracted',
      [AuditAction.EMAIL_REVIEWED]: 'Email Reviewed',
      [AuditAction.EMAIL_APPROVED]: 'Email Approved',
      [AuditAction.EMAIL_REJECTED]: 'Email Rejected',
      [AuditAction.EMAIL_ARCHIVED]: 'Email Archived',
      [AuditAction.EMAIL_DELETED]: 'Email Deleted',
      [AuditAction.EMAIL_RESTORED]: 'Email Restored',
      [AuditAction.WORKFLOW_TRANSITION]: 'Workflow Transition',
      [AuditAction.CLASSIFICATION_OVERRIDE]: 'Classification Override',
      [AuditAction.EXTRACTION_CORRECTED]: 'Extraction Corrected',
      [AuditAction.SYNC_STARTED]: 'Sync Started',
      [AuditAction.SYNC_COMPLETED]: 'Sync Completed',
      [AuditAction.SYNC_FAILED]: 'Sync Failed',
      [AuditAction.BACKUP_CREATED]: 'Backup Created',
      [AuditAction.BACKUP_RESTORED]: 'Backup Restored',
      [AuditAction.SETTINGS_UPDATED]: 'Settings Updated',
      [AuditAction.USER_CREATED]: 'User Created',
      [AuditAction.USER_UPDATED]: 'User Updated',
      [AuditAction.USER_DEACTIVATED]: 'User Deactivated',
      [AuditAction.USER_REACTIVATED]: 'User Reactivated',
      [AuditAction.DATA_EXPORTED]: 'Data Exported',
      [AuditAction.DATA_IMPORTED]: 'Data Imported',
      [AuditAction.DATA_PURGED]: 'Data Purged',
      [AuditAction.SECURITY_VIOLATION]: 'Security Violation',
      [AuditAction.RATE_LIMIT_EXCEEDED]: 'Rate Limit Exceeded',
      [AuditAction.UNAUTHORIZED_ACCESS]: 'Unauthorized Access',
      [AuditAction.SUSPICIOUS_ACTIVITY]: 'Suspicious Activity',
      [AuditAction.NOTIFICATION_CREATED]: 'Notification Created',
      [AuditAction.NOTIFICATION_READ]: 'Notification Read',
      [AuditAction.NOTIFICATION_DISMISSED]: 'Notification Dismissed',
      [AuditAction.NOTIFICATION_ACTION_TAKEN]: 'Notification Action Taken',
      [AuditAction.NOTIFICATION_DELETED]: 'Notification Deleted',
      [AuditAction.API_KEY_CREATED]: 'API Key Created',
      [AuditAction.API_KEY_REVOKED]: 'API Key Revoked',
      [AuditAction.API_CALL]: 'API Call',
    };

    return displayNames[this.action] || this.action;
  }

  /**
   * @method getSeverityColor
   * @purpose Get color code for severity
   */
  getSeverityColor(): string {
    const colors: Record<AuditSeverity, string> = {
      [AuditSeverity.LOW]: '#10B981', // Green
      [AuditSeverity.MEDIUM]: '#F59E0B', // Yellow
      [AuditSeverity.HIGH]: '#EF4444', // Red
      [AuditSeverity.CRITICAL]: '#7C2D12', // Dark red
    };

    return colors[this.severity];
  }

  /**
   * @method getAge
   * @purpose Get audit log age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt.getTime();
  }

  /**
   * @method getAgeInHours
   * @purpose Get audit log age in hours
   */
  getAgeInHours(): number {
    return Math.floor(this.getAge() / (1000 * 60 * 60));
  }

  /**
   * @method getAgeInDays
   * @purpose Get audit log age in days
   */
  getAgeInDays(): number {
    return Math.floor(this.getAge() / (1000 * 60 * 60 * 24));
  }

  /**
   * @method hasChanges
   * @purpose Check if audit log has change information
   */
  hasChanges(): boolean {
    return !!(this.changes && (this.changes.before || this.changes.after || this.changes.diff));
  }

  /**
   * @method getChangedFields
   * @purpose Get list of changed fields
   */
  getChangedFields(): string[] {
    if (this.changes?.fields) {
      return this.changes.fields;
    }

    if (this.changes?.diff) {
      return this.changes.diff.map(change => change.field);
    }

    if (this.changes?.before && this.changes?.after) {
      const beforeKeys = Object.keys(this.changes.before);
      const afterKeys = Object.keys(this.changes.after);
      const allKeys = [...new Set([...beforeKeys, ...afterKeys])];
      
      return allKeys.filter(key => 
        this.changes.before[key] !== this.changes.after[key]
      );
    }

    return [];
  }

  /**
   * @method toSummary
   * @purpose Convert to summary object
   */
  toSummary(): Partial<AuditLog> {
    return {
      id: this.id,
      action: this.action,
      severity: this.severity,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      description: this.description,
      isSuccessful: this.isSuccessful,
      userId: this.userId,
      performedBy: this.performedBy,
      createdAt: this.createdAt,
    };
  }

  /**
   * @method createUserLoginLog
   * @purpose Factory method for user login audit log
   */
  static createUserLoginLog(
    userId: string,
    ipAddress: string,
    userAgent: string,
    isSuccessful: boolean,
    errorMessage?: string
  ): Partial<AuditLog> {
    return {
      action: isSuccessful ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED,
      severity: isSuccessful ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      resourceType: 'user',
      resourceId: userId,
      description: isSuccessful ? 'User logged in successfully' : 'Failed login attempt',
      context: {
        ipAddress,
        userAgent,
      },
      userId: isSuccessful ? userId : null,
      performedBy: userId,
      isSuccessful,
      errorMessage,
    };
  }

  /**
   * @method createEmailProcessedLog
   * @purpose Factory method for email processed audit log
   */
  static createEmailProcessedLog(
    userId: string,
    emailId: string,
    emailSubject: string,
    processingTime: number
  ): Partial<AuditLog> {
    return {
      action: AuditAction.EMAIL_PROCESSED,
      severity: AuditSeverity.LOW,
      resourceType: 'email',
      resourceId: emailId,
      description: `Email processed: ${emailSubject}`,
      context: {
        duration: processingTime,
      },
      userId,
      performedBy: 'system',
      isSuccessful: true,
    };
  }

  /**
   * @method createWorkflowTransitionLog
   * @purpose Factory method for workflow transition audit log
   */
  static createWorkflowTransitionLog(
    userId: string,
    emailId: string,
    fromState: string,
    toState: string,
    reason?: string
  ): Partial<AuditLog> {
    return {
      action: AuditAction.WORKFLOW_TRANSITION,
      severity: AuditSeverity.LOW,
      resourceType: 'email',
      resourceId: emailId,
      description: `Email workflow transitioned from ${fromState} to ${toState}`,
      changes: {
        before: { workflowState: fromState },
        after: { workflowState: toState },
        fields: ['workflowState'],
      },
      additionalData: { reason },
      userId,
      performedBy: userId,
      isSuccessful: true,
    };
  }

  /**
   * @method createSecurityViolationLog
   * @purpose Factory method for security violation audit log
   */
  static createSecurityViolationLog(
    description: string,
    ipAddress: string,
    userAgent: string,
    userId?: string,
    additionalData?: Record<string, any>
  ): Partial<AuditLog> {
    return {
      action: AuditAction.SECURITY_VIOLATION,
      severity: AuditSeverity.HIGH,
      description,
      context: {
        ipAddress,
        userAgent,
      },
      userId,
      performedBy: userId || 'unknown',
      isSuccessful: false,
      additionalData,
    };
  }
}