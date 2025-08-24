import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';

export interface PushNotificationOptions {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Push Notification Service
 * Handles sending push notifications to web browsers and mobile devices
 */
@Injectable()
export class PushNotificationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Send push notification
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<void> {
    try {
      // In a real implementation, this would use a service like Firebase Cloud Messaging
      // For now, we'll just log the notification
      this.logger.log(
        `Push notification sent to user ${options.userId}: ${options.title}`,
        'PushNotificationService'
      );

      // Simulate push notification sending delay
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      this.logger.error(
        `Failed to send push notification to user ${options.userId}: ${error.message}`,
        'PushNotificationService',
        error
      );
      throw error;
    }
  }

  /**
   * Send notification for new email processing
   */
  async sendEmailProcessedNotification(
    userId: string,
    emailSubject: string,
    category: string
  ): Promise<void> {
    const options: PushNotificationOptions = {
      userId,
      title: 'Email Processed',
      body: `"${emailSubject}" classified as ${category}`,
      icon: '/icons/email-processed.png',
      data: {
        type: 'email_processed',
        category,
        subject: emailSubject,
      },
      actions: [
        {
          action: 'view',
          title: 'View Email',
          icon: '/icons/view.png',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        },
      ],
    };

    await this.sendPushNotification(options);
  }

  /**
   * Send notification for processing errors
   */
  async sendProcessingErrorNotification(
    userId: string,
    emailSubject: string,
    error: string
  ): Promise<void> {
    const options: PushNotificationOptions = {
      userId,
      title: 'Email Processing Error',
      body: `Error processing "${emailSubject}"`,
      icon: '/icons/error.png',
      data: {
        type: 'processing_error',
        error,
        subject: emailSubject,
      },
      actions: [
        {
          action: 'retry',
          title: 'Retry',
          icon: '/icons/retry.png',
        },
        {
          action: 'view',
          title: 'View Details',
        },
      ],
    };

    await this.sendPushNotification(options);
  }

  /**
   * Send notification for batch processing completion
   */
  async sendBatchProcessingNotification(
    userId: string,
    totalProcessed: number,
    totalSuccessful: number,
    totalFailed: number
  ): Promise<void> {
    const options: PushNotificationOptions = {
      userId,
      title: 'Batch Processing Complete',
      body: `${totalSuccessful}/${totalProcessed} emails processed successfully`,
      icon: '/icons/batch-complete.png',
      data: {
        type: 'batch_complete',
        totalProcessed,
        totalSuccessful,
        totalFailed,
      },
      actions: [
        {
          action: 'view_results',
          title: 'View Results',
        },
      ],
    };

    await this.sendPushNotification(options);
  }

  /**
   * Send notification for cost limit warnings
   */
  async sendCostLimitWarning(
    userId: string,
    currentCost: number,
    limit: number,
    period: 'daily' | 'monthly'
  ): Promise<void> {
    const percentage = Math.round((currentCost / limit) * 100);
    
    const options: PushNotificationOptions = {
      userId,
      title: 'Cost Limit Warning',
      body: `${percentage}% of ${period} cost limit reached ($${currentCost.toFixed(2)}/$${limit.toFixed(2)})`,
      icon: '/icons/warning.png',
      data: {
        type: 'cost_warning',
        currentCost,
        limit,
        period,
        percentage,
      },
      actions: [
        {
          action: 'view_usage',
          title: 'View Usage',
        },
        {
          action: 'adjust_limits',
          title: 'Adjust Limits',
        },
      ],
    };

    await this.sendPushNotification(options);
  }
}