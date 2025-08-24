import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';
import { EventService } from '../../../common/services/event.service';

export interface WebhookPayload {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

/**
 * Gmail Webhook Service
 * Handles Gmail push notifications via Cloud Pub/Sub
 */
@Injectable()
export class GmailWebhookService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly eventService: EventService,
  ) {}

  /**
   * Process incoming Gmail webhook notification
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    try {
      // Decode the base64 message data
      const decodedData = Buffer.from(payload.message.data, 'base64').toString('utf-8');
      const notification: GmailNotification = JSON.parse(decodedData);

      this.logger.log(
        `Received Gmail webhook notification for ${notification.emailAddress}`,
        'GmailWebhookService'
      );

      // Emit event for Gmail sync service to handle
      this.eventService.emit('gmail.webhook.received', {
        type: 'gmail.webhook.received',
        payload: {
          emailAddress: notification.emailAddress,
          historyId: notification.historyId,
          messageId: payload.message.messageId,
          publishTime: payload.message.publishTime,
        },
      });

    } catch (error) {
      this.logger.error(
        `Failed to process Gmail webhook: ${error.message}`,
        'GmailWebhookService',
        error
      );
      throw error;
    }
  }

  /**
   * Verify webhook authenticity (if needed)
   */
  async verifyWebhook(headers: Record<string, string>, body: string): Promise<boolean> {
    // Implement webhook verification logic if required by Gmail
    // This might involve checking signatures or tokens
    return true;
  }

  /**
   * Set up Gmail push notifications for a user
   */
  async setupPushNotifications(userId: string, emailAddress: string): Promise<void> {
    try {
      // This would typically involve calling Gmail API to set up push notifications
      // For now, we'll just log the setup
      this.logger.log(
        `Setting up push notifications for user ${userId} (${emailAddress})`,
        'GmailWebhookService'
      );

      // Emit event that push notifications are set up
      this.eventService.emit('gmail.push.setup', {
        type: 'gmail.push.setup',
        payload: {
          userId,
          emailAddress,
        },
      });

    } catch (error) {
      this.logger.error(
        `Failed to setup push notifications for user ${userId}: ${error.message}`,
        'GmailWebhookService',
        error
      );
      throw error;
    }
  }

  /**
   * Stop Gmail push notifications for a user
   */
  async stopPushNotifications(userId: string, emailAddress: string): Promise<void> {
    try {
      this.logger.log(
        `Stopping push notifications for user ${userId} (${emailAddress})`,
        'GmailWebhookService'
      );

      // Emit event that push notifications are stopped
      this.eventService.emit('gmail.push.stopped', {
        type: 'gmail.push.stopped',
        payload: {
          userId,
          emailAddress,
        },
      });

    } catch (error) {
      this.logger.error(
        `Failed to stop push notifications for user ${userId}: ${error.message}`,
        'GmailWebhookService',
        error
      );
      throw error;
    }
  }
}
