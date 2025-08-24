import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * @enum NotificationType
 * @purpose Types of notifications
 */
export enum NotificationType {
  EMAIL_PROCESSED = 'email_processed',
  EMAIL_NEEDS_REVIEW = 'email_needs_review',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  AI_COST_LIMIT = 'ai_cost_limit',
  CLASSIFICATION_ACCURACY = 'classification_accuracy',
  SYSTEM_UPDATE = 'system_update',
  SECURITY_ALERT = 'security_alert',
  BACKUP_COMPLETED = 'backup_completed',
  BACKUP_FAILED = 'backup_failed',
  QUOTA_WARNING = 'quota_warning',
  QUOTA_EXCEEDED = 'quota_exceeded',
  WELCOME = 'welcome',
  REMINDER = 'reminder',
  ANNOUNCEMENT = 'announcement',
}

/**
 * @enum NotificationPriority
 * @purpose Priority levels for notifications
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

/**
 * @enum NotificationStatus
 * @purpose Status of notification delivery
 */
export enum NotificationStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  READ = 'read',
  DISMISSED = 'dismissed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * @enum DeliveryChannel
 * @purpose Notification delivery channels
 */
export enum DeliveryChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  DESKTOP = 'desktop',
}

/**
 * @interface NotificationData
 * @purpose Structured notification data
 */
export interface NotificationData {
  // Core data
  title: string;
  message: string;
  
  // Action data
  actionUrl?: string;
  actionLabel?: string;
  actionData?: Record<string, any>;
  
  // Display data
  icon?: string;
  image?: string;
  color?: string;
  
  // Metadata
  category?: string;
  tags?: string[];
  relatedResourceId?: string;
  relatedResourceType?: string;
  
  // Timing
  expiresAt?: Date;
  scheduledFor?: Date;
  
  // Delivery preferences
  channels?: DeliveryChannel[];
  suppressDuplicates?: boolean;
  batchable?: boolean;
}

/**
 * @interface DeliveryAttempt
 * @purpose Delivery attempt tracking
 */
export interface DeliveryAttempt {
  channel: DeliveryChannel;
  attemptedAt: Date;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  deliveryId?: string;
  metadata?: Record<string, any>;
}

/**
 * @interface NotificationMetrics
 * @purpose Notification performance metrics
 */
export interface NotificationMetrics {
  createdAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  dismissedAt?: Date;
  actionTakenAt?: Date;
  deliveryTime?: number; // milliseconds
  timeToRead?: number; // milliseconds
  timeToAction?: number; // milliseconds
  deliveryAttempts: DeliveryAttempt[];
}

/**
 * @entity Notification
 * @purpose Notification entity for user alerts and updates
 */
@Entity('notifications')
@Index(['userId', 'status'])
@Index(['userId', 'type'])
@Index(['userId', 'priority'])
@Index(['userId', 'createdAt'])
@Index(['status', 'scheduledFor'])
@Index(['expiresAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    comment: 'Type of notification',
  })
  @Index()
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
    comment: 'Priority level of notification',
  })
  @Index()
  priority: NotificationPriority;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
    comment: 'Current status of notification',
  })
  @Index()
  status: NotificationStatus;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'Notification title',
  })
  title: string;

  @Column({
    type: 'text',
    comment: 'Notification message content',
  })
  message: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Structured notification data',
  })
  data: NotificationData;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Notification performance metrics',
  })
  metrics: NotificationMetrics;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'URL for notification action',
  })
  actionUrl: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Label for notification action',
  })
  actionLabel: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional action data',
  })
  actionData: Record<string, any>;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Whether action has been taken',
  })
  actionTaken: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When action was taken',
  })
  actionTakenAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When notification was read',
  })
  readAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When notification was dismissed',
  })
  dismissedAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When notification expires',
  })
  @Index()
  expiresAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When notification should be delivered',
  })
  @Index()
  scheduledFor: Date;

  @Column({
    type: 'json',
    default: () => "'[]'",
    comment: 'Delivery channels for this notification',
  })
  channels: DeliveryChannel[];

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of delivery attempts',
  })
  deliveryAttempts: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When notification was last delivered',
  })
  lastDeliveredAt: Date;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Last delivery error message',
  })
  lastDeliveryError: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Related resource ID',
  })
  relatedResourceId: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Related resource type',
  })
  relatedResourceType: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional metadata',
  })
  metadata: Record<string, any>;

  // Relations
  @Column({
    type: 'uuid',
    comment: 'User ID who should receive this notification',
  })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Timestamps
  @CreateDateColumn({
    comment: 'When notification was created',
  })
  createdAt: Date;

  @UpdateDateColumn({
    comment: 'When notification was last updated',
  })
  updatedAt: Date;

  // Methods

  /**
   * @method markAsRead
   * @purpose Mark notification as read
   */
  markAsRead(): void {
    if (this.status === NotificationStatus.DELIVERED) {
      this.status = NotificationStatus.READ;
      this.readAt = new Date();
      
      if (this.metrics) {
        this.metrics.readAt = this.readAt;
        if (this.metrics.deliveredAt) {
          this.metrics.timeToRead = this.readAt.getTime() - this.metrics.deliveredAt.getTime();
        }
      }
    }
  }

  /**
   * @method markAsDismissed
   * @purpose Mark notification as dismissed
   */
  markAsDismissed(): void {
    this.status = NotificationStatus.DISMISSED;
    this.dismissedAt = new Date();
    
    if (this.metrics) {
      this.metrics.dismissedAt = this.dismissedAt;
    }
  }

  /**
   * @method markActionTaken
   * @purpose Mark that action was taken on notification
   */
  markActionTaken(actionData?: Record<string, any>): void {
    this.actionTaken = true;
    this.actionTakenAt = new Date();
    
    if (actionData) {
      this.actionData = { ...this.actionData, ...actionData };
    }
    
    if (this.metrics) {
      this.metrics.actionTakenAt = this.actionTakenAt;
      if (this.metrics.deliveredAt) {
        this.metrics.timeToAction = this.actionTakenAt.getTime() - this.metrics.deliveredAt.getTime();
      }
    }
  }

  /**
   * @method markAsDelivered
   * @purpose Mark notification as delivered
   */
  markAsDelivered(channel: DeliveryChannel, deliveryId?: string): void {
    this.status = NotificationStatus.DELIVERED;
    this.lastDeliveredAt = new Date();
    this.lastDeliveryError = null;
    
    if (!this.metrics) {
      this.metrics = {
        createdAt: this.createdAt,
        deliveryAttempts: [],
      };
    }
    
    this.metrics.deliveredAt = this.lastDeliveredAt;
    this.metrics.deliveryTime = this.lastDeliveredAt.getTime() - this.createdAt.getTime();
    
    // Record delivery attempt
    this.metrics.deliveryAttempts.push({
      channel,
      attemptedAt: this.lastDeliveredAt,
      status: 'success',
      deliveryId,
    });
  }

  /**
   * @method markDeliveryFailed
   * @purpose Mark delivery attempt as failed
   */
  markDeliveryFailed(channel: DeliveryChannel, error: string): void {
    this.deliveryAttempts++;
    this.lastDeliveryError = error;
    
    if (!this.metrics) {
      this.metrics = {
        createdAt: this.createdAt,
        deliveryAttempts: [],
      };
    }
    
    // Record failed delivery attempt
    this.metrics.deliveryAttempts.push({
      channel,
      attemptedAt: new Date(),
      status: 'failed',
      error,
    });
    
    // Mark as failed if too many attempts
    if (this.deliveryAttempts >= 3) {
      this.status = NotificationStatus.FAILED;
    }
  }

  /**
   * @method isExpired
   * @purpose Check if notification is expired
   */
  isExpired(): boolean {
    return this.expiresAt && this.expiresAt < new Date();
  }

  /**
   * @method isScheduled
   * @purpose Check if notification is scheduled for future delivery
   */
  isScheduled(): boolean {
    return this.scheduledFor && this.scheduledFor > new Date();
  }

  /**
   * @method isReadyForDelivery
   * @purpose Check if notification is ready for delivery
   */
  isReadyForDelivery(): boolean {
    return (
      this.status === NotificationStatus.PENDING &&
      !this.isExpired() &&
      !this.isScheduled()
    );
  }

  /**
   * @method canRetryDelivery
   * @purpose Check if delivery can be retried
   */
  canRetryDelivery(): boolean {
    return (
      this.status === NotificationStatus.FAILED &&
      this.deliveryAttempts < 3 &&
      !this.isExpired()
    );
  }

  /**
   * @method getPriorityScore
   * @purpose Get numeric priority score for sorting
   */
  getPriorityScore(): number {
    const scores = {
      [NotificationPriority.LOW]: 1,
      [NotificationPriority.NORMAL]: 2,
      [NotificationPriority.HIGH]: 3,
      [NotificationPriority.URGENT]: 4,
      [NotificationPriority.CRITICAL]: 5,
    };
    
    return scores[this.priority] || 2;
  }

  /**
   * @method shouldSuppressDuplicate
   * @purpose Check if duplicate notifications should be suppressed
   */
  shouldSuppressDuplicate(): boolean {
    return this.data?.suppressDuplicates === true;
  }

  /**
   * @method isBatchable
   * @purpose Check if notification can be batched
   */
  isBatchable(): boolean {
    return this.data?.batchable === true;
  }

  /**
   * @method getDisplayData
   * @purpose Get data for display purposes
   */
  getDisplayData(): {
    title: string;
    message: string;
    icon?: string;
    color?: string;
    actionUrl?: string;
    actionLabel?: string;
  } {
    return {
      title: this.title,
      message: this.message,
      icon: this.data?.icon,
      color: this.data?.color,
      actionUrl: this.actionUrl,
      actionLabel: this.actionLabel,
    };
  }
}