import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, LessThan, MoreThan, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { 
  Notification, 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus, 
  DeliveryChannel,
  NotificationData 
} from '../../../database/entities/notification.entity';
import { User } from '../../../database/entities/user.entity';
import { AuditLog, AuditAction } from '../../../database/entities/audit-log.entity';

// Services
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationPreferenceService, NotificationPreferences } from './notification-preference.service';
import { LoggerService } from '../../../common/services/logger.service';

// DTOs
import { CreateNotificationDto, NotificationFiltersDto } from '../dto/notification.dto';

/**
 * @interface NotificationStats
 * @purpose Notification statistics interface
 */
export interface NotificationStats {
  total: number;
  unread: number;
  highPriority: number;
  actionRequired: number;
  byType: Record<NotificationType, number>;
  byStatus: Record<NotificationStatus, number>;
  deliveryRate: number;
  readRate: number;
  actionRate: number;
}

/**
 * @interface BulkNotificationResult
 * @purpose Bulk notification operation result
 */
export interface BulkNotificationResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{
    notificationId: string;
    error: string;
  }>;
}

/**
 * @class NotificationService
 * @purpose Core notification management service
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private notificationDeliveryService: NotificationDeliveryService,
    private notificationTemplateService: NotificationTemplateService,
    private notificationPreferenceService: NotificationPreferenceService,
    private configService: ConfigService,
    private logger: LoggerService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * @method create
   * @purpose Create a new notification
   */
  async create(
    userId: string,
    notificationData: CreateNotificationDto
  ): Promise<Notification> {
    try {
      // Validate user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Get user preferences
      const preferences = await this.notificationPreferenceService.getPreferences(userId);

      // Check if user wants this type of notification
      if (!this.isTypeEnabled(preferences, notificationData.type)) {
        this.logger.debug(
          `Notification type ${notificationData.type} disabled for user ${userId}`,
          'NotificationService'
        );
        return null;
      }

      // Check for duplicate suppression
      if (notificationData.data?.suppressDuplicates) {
        const existingNotification = await this.findDuplicate(userId, notificationData);
        if (existingNotification) {
          this.logger.debug(
            `Suppressing duplicate notification for user ${userId}`,
            'NotificationService',
            { type: notificationData.type, relatedResourceId: notificationData.relatedResourceId }
          );
          return existingNotification;
        }
      }

      // Apply template if specified
      let processedData = notificationData;
      if (notificationData.templateId) {
        const templateResult = this.notificationTemplateService.renderTemplate(
          notificationData.templateId,
          notificationData as any
        );
        
        if (templateResult) {
          processedData = {
            ...notificationData,
            title: templateResult.title || notificationData.title,
            message: templateResult.body || notificationData.message,
          };
        }
      }

      // Determine delivery channels
      const channels = processedData.channels || this.getChannelsForType(preferences, notificationData.type);

      // Create notification
      const notification = this.notificationRepository.create({
        userId,
        type: processedData.type,
        priority: processedData.priority || NotificationPriority.NORMAL,
        title: processedData.title,
        message: processedData.message,
        data: processedData.data,
        actionUrl: processedData.actionUrl,
        actionLabel: processedData.actionLabel,
        actionData: processedData.actionData,
        channels: channels as DeliveryChannel[],
        expiresAt: processedData.expiresAt,
        scheduledFor: processedData.scheduledFor,
        relatedResourceId: processedData.relatedResourceId,
        relatedResourceType: processedData.relatedResourceType,
        metadata: processedData.metadata,
        metrics: {
          createdAt: new Date(),
          deliveryAttempts: [],
        },
      });

      const savedNotification = await this.notificationRepository.save(notification);

      // Log notification creation
      await this.logNotificationEvent(
        userId,
        savedNotification.id,
        AuditAction.NOTIFICATION_CREATED,
        'Notification created'
      );

      // Emit notification created event
      this.eventEmitter.emit('notification.created', {
        notification: savedNotification,
        userId,
      });

      // Schedule delivery if not scheduled for future
      if (!savedNotification.isScheduled()) {
        await this.scheduleDelivery(savedNotification);
      }

      this.logger.log(
        `Notification created for user ${userId}: ${savedNotification.type}`,
        'NotificationService',
        { notificationId: savedNotification.id, type: savedNotification.type }
      );

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to create notification for user ${userId}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method isTypeEnabled
   * @purpose Check if notification type is enabled for user
   */
  private isTypeEnabled(preferences: NotificationPreferences, type: NotificationType): boolean {
    // Map notification types to preference settings
    switch (type) {
      case 'EMAIL_PROCESSED' as any:
        return preferences.emailNotifications.emailProcessed || 
               preferences.pushNotifications.emailProcessed || 
               preferences.inAppNotifications.emailProcessed;
      case 'PROCESSING_ERROR' as any:
        return preferences.emailNotifications.processingErrors || 
               preferences.pushNotifications.processingErrors || 
               preferences.inAppNotifications.processingErrors;
      case 'BATCH_COMPLETE' as any:
        return preferences.pushNotifications.batchComplete || 
               preferences.inAppNotifications.batchComplete;
      case 'COST_WARNING' as any:
        return preferences.emailNotifications.costWarnings || 
               preferences.pushNotifications.costWarnings || 
               preferences.inAppNotifications.costWarnings;
      case 'SYSTEM_UPDATE' as any:
        return preferences.inAppNotifications.systemUpdates;
      default:
        return true; // Enable unknown types by default
    }
  }

  /**
   * @method getChannelsForType
   * @purpose Get delivery channels for notification type
   */
  private getChannelsForType(preferences: NotificationPreferences, type: NotificationType): string[] {
    const channels: string[] = [];
    
    // Add email channel if enabled
    if (preferences.emailNotifications.enabled) {
      switch (type) {
        case 'EMAIL_PROCESSED' as any:
          if (preferences.emailNotifications.emailProcessed) channels.push('email');
          break;
        case 'PROCESSING_ERROR' as any:
          if (preferences.emailNotifications.processingErrors) channels.push('email');
          break;
        case 'COST_WARNING' as any:
          if (preferences.emailNotifications.costWarnings) channels.push('email');
          break;
      }
    }
    
    // Add push channel if enabled
    if (preferences.pushNotifications.enabled) {
      switch (type) {
        case 'EMAIL_PROCESSED' as any:
          if (preferences.pushNotifications.emailProcessed) channels.push('push');
          break;
        case 'PROCESSING_ERROR' as any:
          if (preferences.pushNotifications.processingErrors) channels.push('push');
          break;
        case 'BATCH_COMPLETE' as any:
          if (preferences.pushNotifications.batchComplete) channels.push('push');
          break;
        case 'COST_WARNING' as any:
          if (preferences.pushNotifications.costWarnings) channels.push('push');
          break;
      }
    }
    
    // Add in-app channel if enabled
    if (preferences.inAppNotifications.enabled) {
      switch (type) {
        case 'EMAIL_PROCESSED' as any:
          if (preferences.inAppNotifications.emailProcessed) channels.push('in-app');
          break;
        case 'PROCESSING_ERROR' as any:
          if (preferences.inAppNotifications.processingErrors) channels.push('in-app');
          break;
        case 'BATCH_COMPLETE' as any:
          if (preferences.inAppNotifications.batchComplete) channels.push('in-app');
          break;
        case 'COST_WARNING' as any:
          if (preferences.inAppNotifications.costWarnings) channels.push('in-app');
          break;
        case 'SYSTEM_UPDATE' as any:
          if (preferences.inAppNotifications.systemUpdates) channels.push('in-app');
          break;
      }
    }
    
    return channels.length > 0 ? channels : ['in-app']; // Default to in-app if no channels
  }

  /**
   * @method createBulk
   * @purpose Create multiple notifications
   */
  async createBulk(
    userIds: string[],
    notificationData: CreateNotificationDto
  ): Promise<BulkNotificationResult> {
    const result: BulkNotificationResult = {
      success: true,
      totalProcessed: userIds.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const userId of userIds) {
      try {
        await this.create(userId, notificationData);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          notificationId: userId,
          error: error.message,
        });
      }
    }

    result.success = result.failed === 0;

    this.logger.log(
      `Bulk notification creation completed: ${result.successful}/${result.totalProcessed} successful`,
      'NotificationService',
      { result }
    );

    return result;
  }

  /**
   * @method findByUser
   * @purpose Get notifications for a user with filtering
   */
  async findByUser(
    userId: string,
    filters: NotificationFiltersDto = {},
    limit = 50,
    offset = 0
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const queryOptions: FindManyOptions<Notification> = {
        where: { userId },
        order: { createdAt: 'DESC' },
        take: Math.min(limit, 100),
        skip: offset,
      };

      // Apply filters
      const where: any = { userId };

      if (filters.types?.length) {
        where.type = In(filters.types);
      }

      if (filters.priorities?.length) {
        where.priority = In(filters.priorities);
      }

      if (filters.statuses?.length) {
        where.status = In(filters.statuses);
      }

      if (filters.unreadOnly) {
        where.status = In([NotificationStatus.PENDING, NotificationStatus.DELIVERED]);
      }

      if (filters.actionRequired) {
        where.actionUrl = MoreThan('');
        where.actionTaken = false;
      }

      if (filters.dateFrom) {
        where.createdAt = MoreThan(filters.dateFrom);
      }

      if (filters.dateTo) {
        where.createdAt = LessThan(filters.dateTo);
      }

      queryOptions.where = where;

      const [notifications, total] = await this.notificationRepository.findAndCount(queryOptions);

      return { notifications, total };
    } catch (error) {
      this.logger.error(
        `Failed to get notifications for user ${userId}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method getUnreadCount
   * @purpose Get count of unread notifications for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await this.findByUser(userId, { unreadOnly: true }, 1000, 0);
      return result.total;
    } catch (error) {
      this.logger.error(
        `Failed to get unread count for user ${userId}`,
        error.stack,
        'NotificationService'
      );
      return 0;
    }
  }

  /**
   * @method findById
   * @purpose Get notification by ID
   */
  async findById(id: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id, userId },
      });

      if (!notification) {
        throw new BadRequestException('Notification not found');
      }

      return notification;
    } catch (error) {
      this.logger.error(
        `Failed to get notification ${id}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method markAsRead
   * @purpose Mark notification as read
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.findById(id, userId);
      
      notification.markAsRead();
      const savedNotification = await this.notificationRepository.save(notification);

      // Log notification read
      await this.logNotificationEvent(
        userId,
        id,
        AuditAction.NOTIFICATION_READ,
        'Notification marked as read'
      );

      // Emit notification read event
      this.eventEmitter.emit('notification.read', {
        notification: savedNotification,
        userId,
      });

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to mark notification ${id} as read`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method markAllAsRead
   * @purpose Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.notificationRepository
        .createQueryBuilder()
        .update(Notification)
        .set({ 
          status: NotificationStatus.READ,
          readAt: new Date(),
        })
        .where('userId = :userId', { userId })
        .andWhere('status IN (:...statuses)', { 
          statuses: [NotificationStatus.PENDING, NotificationStatus.DELIVERED] 
        })
        .execute();

      const affectedCount = result.affected || 0;

      // Log bulk read
      await this.logNotificationEvent(
        userId,
        'bulk',
        AuditAction.NOTIFICATION_READ,
        `${affectedCount} notifications marked as read`
      );

      // Emit bulk read event
      this.eventEmitter.emit('notification.bulk.read', {
        userId,
        count: affectedCount,
      });

      this.logger.log(
        `Marked ${affectedCount} notifications as read for user ${userId}`,
        'NotificationService'
      );

      return affectedCount;
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read for user ${userId}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method dismiss
   * @purpose Dismiss notification
   */
  async dismiss(id: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.findById(id, userId);
      
      notification.markAsDismissed();
      const savedNotification = await this.notificationRepository.save(notification);

      // Log notification dismissal
      await this.logNotificationEvent(
        userId,
        id,
        AuditAction.NOTIFICATION_DISMISSED,
        'Notification dismissed'
      );

      // Emit notification dismissed event
      this.eventEmitter.emit('notification.dismissed', {
        notification: savedNotification,
        userId,
      });

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to dismiss notification ${id}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method takeAction
   * @purpose Mark action as taken on notification
   */
  async takeAction(
    id: string,
    userId: string,
    actionData?: Record<string, any>
  ): Promise<Notification> {
    try {
      const notification = await this.findById(id, userId);
      
      notification.markActionTaken(actionData);
      const savedNotification = await this.notificationRepository.save(notification);

      // Log action taken
      await this.logNotificationEvent(
        userId,
        id,
        AuditAction.NOTIFICATION_ACTION_TAKEN,
        'Action taken on notification'
      );

      // Emit action taken event
      this.eventEmitter.emit('notification.action.taken', {
        notification: savedNotification,
        userId,
        actionData,
      });

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to take action on notification ${id}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method delete
   * @purpose Delete notification
   */
  async delete(id: string, userId: string): Promise<void> {
    try {
      const notification = await this.findById(id, userId);
      
      await this.notificationRepository.remove(notification);

      // Log notification deletion
      await this.logNotificationEvent(
        userId,
        id,
        AuditAction.NOTIFICATION_DELETED,
        'Notification deleted'
      );

      // Emit notification deleted event
      this.eventEmitter.emit('notification.deleted', {
        notificationId: id,
        userId,
      });

      this.logger.log(
        `Notification ${id} deleted for user ${userId}`,
        'NotificationService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete notification ${id}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method getStats
   * @purpose Get notification statistics for user
   */
  async getStats(userId: string): Promise<NotificationStats> {
    try {
      const notifications = await this.notificationRepository.find({
        where: { userId },
      });

      const stats: NotificationStats = {
        total: notifications.length,
        unread: 0,
        highPriority: 0,
        actionRequired: 0,
        byType: {} as Record<NotificationType, number>,
        byStatus: {} as Record<NotificationStatus, number>,
        deliveryRate: 0,
        readRate: 0,
        actionRate: 0,
      };

      // Initialize counters
      Object.values(NotificationType).forEach(type => {
        stats.byType[type] = 0;
      });

      Object.values(NotificationStatus).forEach(status => {
        stats.byStatus[status] = 0;
      });

      // Calculate statistics
      let delivered = 0;
      let read = 0;
      let actionTaken = 0;

      notifications.forEach(notification => {
        // Count by type
        stats.byType[notification.type]++;

        // Count by status
        stats.byStatus[notification.status]++;

        // Count unread
        if ([NotificationStatus.PENDING, NotificationStatus.DELIVERED].includes(notification.status)) {
          stats.unread++;
        }

        // Count high priority
        if ([NotificationPriority.HIGH, NotificationPriority.URGENT, NotificationPriority.CRITICAL].includes(notification.priority)) {
          stats.highPriority++;
        }

        // Count action required
        if (notification.actionUrl && !notification.actionTaken) {
          stats.actionRequired++;
        }

        // Count for rates
        if (notification.status === NotificationStatus.DELIVERED || notification.status === NotificationStatus.READ) {
          delivered++;
        }

        if (notification.status === NotificationStatus.READ) {
          read++;
        }

        if (notification.actionTaken) {
          actionTaken++;
        }
      });

      // Calculate rates
      stats.deliveryRate = stats.total > 0 ? delivered / stats.total : 0;
      stats.readRate = delivered > 0 ? read / delivered : 0;
      stats.actionRate = stats.actionRequired > 0 ? actionTaken / (stats.actionRequired + actionTaken) : 0;

      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get notification stats for user ${userId}`,
        error.stack,
        'NotificationService'
      );
      throw error;
    }
  }

  /**
   * @method scheduleDelivery
   * @purpose Schedule notification for delivery
   */
  private async scheduleDelivery(notification: Notification): Promise<void> {
    try {
      // Transform notification to DeliveryOptions format
      const deliveryOptions = {
        userId: notification.userId,
        type: (notification.channels[0] as 'email' | 'push' | 'in-app') || 'in-app', // Use first channel or default to in-app
        category: notification.type,
        templateId: (notification.data as any)?.templateId,
        variables: notification.data,
        priority: (notification.priority === NotificationPriority.HIGH || notification.priority === NotificationPriority.URGENT || notification.priority === NotificationPriority.CRITICAL ? 'high' : 'normal') as 'low' | 'normal' | 'high',
        scheduleFor: notification.scheduledFor,
        respectQuietHours: true,
      };
      
      await this.notificationDeliveryService.deliver(deliveryOptions);
    } catch (error) {
      this.logger.error(
        `Failed to schedule delivery for notification ${notification.id}`,
        error.stack,
        'NotificationService'
      );
    }
  }

  /**
   * @method findDuplicate
   * @purpose Find duplicate notification
   */
  private async findDuplicate(
    userId: string,
    notificationData: CreateNotificationDto
  ): Promise<Notification | null> {
    const timeWindow = this.configService.get<number>('notification.duplicateWindowMinutes', 60);
    const windowStart = new Date(Date.now() - timeWindow * 60 * 1000);

    return await this.notificationRepository.findOne({
      where: {
        userId,
        type: notificationData.type,
        relatedResourceId: notificationData.relatedResourceId,
        createdAt: MoreThan(windowStart),
        status: In([NotificationStatus.PENDING, NotificationStatus.DELIVERED]),
      },
    });
  }

  /**
   * @method logNotificationEvent
   * @purpose Log notification event to audit log
   */
  private async logNotificationEvent(
    userId: string,
    notificationId: string,
    action: AuditAction,
    description: string
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        resourceType: 'notification',
        resourceId: notificationId,
        description,
        userId,
        performedBy: userId,
        isSuccessful: true,
      });

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to log notification event', error.stack, 'NotificationService');
    }
  }
}