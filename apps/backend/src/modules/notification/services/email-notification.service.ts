import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';

export interface EmailNotificationOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  priority?: 'low' | 'normal' | 'high';
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Email Notification Service
 * Handles sending email notifications
 */
@Injectable()
export class EmailNotificationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Send email notification
   */
  async sendEmail(options: EmailNotificationOptions): Promise<void> {
    try {
      // In a real implementation, this would use a service like SendGrid, AWS SES, etc.
      // For now, we'll just log the email
      this.logger.log(
        `Email notification sent to ${options.to}: ${options.subject}`,
        'EmailNotificationService'
      );

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      this.logger.error(
        `Failed to send email notification to ${options.to}: ${error.message}`,
        'EmailNotificationService',
        error
      );
      throw error;
    }
  }

  /**
   * Send notification email for new email processing
   */
  async sendEmailProcessedNotification(
    userEmail: string,
    emailSubject: string,
    category: string,
    confidence: number
  ): Promise<void> {
    const options: EmailNotificationOptions = {
      to: userEmail,
      subject: 'Email Processed - AEMS',
      body: `Your email "${emailSubject}" has been processed and classified as "${category}" with ${Math.round(confidence * 100)}% confidence.`,
      html: `
        <h2>Email Processed</h2>
        <p>Your email "<strong>${emailSubject}</strong>" has been processed.</p>
        <ul>
          <li><strong>Category:</strong> ${category}</li>
          <li><strong>Confidence:</strong> ${Math.round(confidence * 100)}%</li>
        </ul>
        <p>You can review this email in your AEMS dashboard.</p>
      `,
    };

    await this.sendEmail(options);
  }

  /**
   * Send notification email for processing errors
   */
  async sendProcessingErrorNotification(
    userEmail: string,
    emailSubject: string,
    error: string
  ): Promise<void> {
    const options: EmailNotificationOptions = {
      to: userEmail,
      subject: 'Email Processing Error - AEMS',
      body: `There was an error processing your email "${emailSubject}": ${error}`,
      html: `
        <h2>Email Processing Error</h2>
        <p>There was an error processing your email "<strong>${emailSubject}</strong>".</p>
        <p><strong>Error:</strong> ${error}</p>
        <p>Please check your AEMS dashboard for more details.</p>
      `,
      priority: 'high',
    };

    await this.sendEmail(options);
  }

  /**
   * Send daily digest email
   */
  async sendDailyDigest(
    userEmail: string,
    stats: {
      totalProcessed: number;
      totalCost: number;
      categoryBreakdown: Record<string, number>;
    }
  ): Promise<void> {
    const categoryList = Object.entries(stats.categoryBreakdown)
      .map(([category, count]) => `<li>${category}: ${count}</li>`)
      .join('');

    const options: EmailNotificationOptions = {
      to: userEmail,
      subject: 'Daily Email Processing Summary - AEMS',
      body: `Daily Summary: ${stats.totalProcessed} emails processed, $${stats.totalCost.toFixed(4)} cost`,
      html: `
        <h2>Daily Email Processing Summary</h2>
        <p><strong>Total Emails Processed:</strong> ${stats.totalProcessed}</p>
        <p><strong>Total Cost:</strong> $${stats.totalCost.toFixed(4)}</p>
        <h3>Category Breakdown:</h3>
        <ul>${categoryList}</ul>
        <p>Visit your AEMS dashboard for detailed analytics.</p>
      `,
    };

    await this.sendEmail(options);
  }
}