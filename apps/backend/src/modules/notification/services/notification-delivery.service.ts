import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import { EmailNotificationService } from './email-notification.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationTemplateService } from './notification-template.service';

export interface DeliveryOptions {
  userId: string;
  type: 'email' | 'push' | 'in-app';
  category: string;
  templateId?: string;
  variables?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  scheduleFor?: Date;
  respectQuietHours?: boolean;
}

export interface DeliveryResult {
  success: boolean;
  deliveryId: string;
  deliveredAt?: Date;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Notification Delivery Service
 * Orchestrates notification delivery across different channels
 */
@Injectable()
export class NotificationDeliveryService {
  constructor(
    private readonly emailService: EmailNotificationService,
    private readonly pushService: PushNotificationService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly templateService: NotificationTemplateService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Deliver notification to user
   */
  async deliver(options: DeliveryOptions): Promise<DeliveryResult> {
    const deliveryId = this.generateDeliveryId();

    try {
      // Check if notification is enabled for this user and category
      const isEnabled = await this.preferenceService.isNotificationEnabled(
        options.userId,
        options.type,
        options.category
      );

      if (!isEnabled) {
        return {
          success: true,
          deliveryId,
          skipped: true,
          skipReason: 'Notification disabled by user preferences',
        };
      }

      // Check quiet hours if requested
      if (options.respectQuietHours !== false) {
        const isQuietHours = await this.preferenceService.isInQuietHours(options.userId);
        if (isQuietHours && options.priority !== 'high') {
          return {
            success: true,
            deliveryId,
            skipped: true,
            skipReason: 'User is in quiet hours',
          };
        }
      }

      // Check rate limits
      const hasExceededLimit = await this.preferenceService.hasExceededRateLimit(options.userId);
      if (hasExceededLimit && options.priority !== 'high') {
        return {
          success: true,
          deliveryId,
          skipped: true,
          skipReason: 'Rate limit exceeded',
        };
      }

      // Schedule for later if requested
      if (options.scheduleFor && options.scheduleFor > new Date()) {
        // In a real implementation, this would queue the notification
        this.logger.log(
          `Notification scheduled for ${options.scheduleFor.toISOString()}`,
          'NotificationDeliveryService'
        );
        
        return {
          success: true,
          deliveryId,
          skipped: true,
          skipReason: 'Scheduled for later delivery',
        };
      }

      // Deliver the notification
      await this.deliverNow(options);

      return {
        success: true,
        deliveryId,
        deliveredAt: new Date(),
      };

    } catch (error) {
      this.logger.error(
        `Failed to deliver notification ${deliveryId}: ${error.message}`,
        'NotificationDeliveryService',
        error
      );

      return {
        success: false,
        deliveryId,
        error: error.message,
      };
    }
  }

  /**
   * Deliver notification immediately
   */
  private async deliverNow(options: DeliveryOptions): Promise<void> {
    switch (options.type) {
      case 'email':
        await this.deliverEmail(options);
        break;
      
      case 'push':
        await this.deliverPush(options);
        break;
      
      case 'in-app':
        await this.deliverInApp(options);
        break;
      
      default:
        throw new Error(`Unsupported notification type: ${options.type}`);
    }
  }

  /**
   * Deliver email notification
   */
  private async deliverEmail(options: DeliveryOptions): Promise<void> {
    // Get user email (this would typically come from user repository)
    const userEmail = `user-${options.userId}@example.com`;

    if (options.templateId && options.variables) {
      // Use template
      const rendered = this.templateService.renderTemplate(options.templateId, options.variables);
      if (!rendered) {
        throw new Error(`Failed to render template: ${options.templateId}`);
      }

      await this.emailService.sendEmail({
        to: userEmail,
        subject: rendered.subject || 'AEMS Notification',
        body: rendered.body,
        html: rendered.html,
        priority: options.priority,
      });
    } else {
      // Direct delivery (fallback)
      await this.emailService.sendEmail({
        to: userEmail,
        subject: 'AEMS Notification',
        body: `Notification for category: ${options.category}`,
        priority: options.priority,
      });
    }
  }

  /**
   * Deliver push notification
   */
  private async deliverPush(options: DeliveryOptions): Promise<void> {
    if (options.templateId && options.variables) {
      // Use template
      const rendered = this.templateService.renderTemplate(options.templateId, options.variables);
      if (!rendered) {
        throw new Error(`Failed to render template: ${options.templateId}`);
      }

      await this.pushService.sendPushNotification({
        userId: options.userId,
        title: rendered.title || 'AEMS Notification',
        body: rendered.body,
        data: options.variables,
      });
    } else {
      // Direct delivery (fallback)
      await this.pushService.sendPushNotification({
        userId: options.userId,
        title: 'AEMS Notification',
        body: `Notification for category: ${options.category}`,
        data: { category: options.category },
      });
    }
  }

  /**
   * Deliver in-app notification
   */
  private async deliverInApp(options: DeliveryOptions): Promise<void> {
    // In-app notifications would typically be stored in database
    // and delivered via WebSocket or similar real-time mechanism
    
    let title = 'AEMS Notification';
    let body = `Notification for category: ${options.category}`;

    if (options.templateId && options.variables) {
      const rendered = this.templateService.renderTemplate(options.templateId, options.variables);
      if (rendered) {
        title = rendered.title || title;
        body = rendered.body;
      }
    }

    this.logger.log(
      `In-app notification delivered to user ${options.userId}: ${title}`,
      'NotificationDeliveryService'
    );

    // This would typically save to database and emit via WebSocket
    // For now, we'll just log it
  }

  /**
   * Generate unique delivery ID
   */
  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}