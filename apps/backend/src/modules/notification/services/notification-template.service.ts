import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'push' | 'in-app';
  subject?: string;
  title?: string;
  body: string;
  html?: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

/**
 * Notification Template Service
 * Manages notification templates and variable substitution
 */
@Injectable()
export class NotificationTemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(private readonly logger: LoggerService) {
    this.initializeDefaultTemplates();
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): NotificationTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: 'email' | 'push' | 'in-app'): NotificationTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.type === type);
  }

  /**
   * Render template with variables
   */
  renderTemplate(templateId: string, variables: TemplateVariables): {
    subject?: string;
    title?: string;
    body: string;
    html?: string;
  } | null {
    const template = this.getTemplate(templateId);
    if (!template) {
      this.logger.warn(`Template not found: ${templateId}`, 'NotificationTemplateService');
      return null;
    }

    try {
      const rendered = {
        subject: template.subject ? this.substituteVariables(template.subject, variables) : undefined,
        title: template.title ? this.substituteVariables(template.title, variables) : undefined,
        body: this.substituteVariables(template.body, variables),
        html: template.html ? this.substituteVariables(template.html, variables) : undefined,
      };

      return rendered;
    } catch (error) {
      this.logger.error(
        `Failed to render template ${templateId}: ${error.message}`,
        'NotificationTemplateService',
        error
      );
      return null;
    }
  }

  /**
   * Create or update template
   */
  saveTemplate(template: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>): NotificationTemplate {
    const now = new Date();
    const existingTemplate = this.templates.get(template.id);

    const savedTemplate: NotificationTemplate = {
      ...template,
      createdAt: existingTemplate?.createdAt || now,
      updatedAt: now,
    };

    this.templates.set(template.id, savedTemplate);

    this.logger.log(
      `Template ${existingTemplate ? 'updated' : 'created'}: ${template.id}`,
      'NotificationTemplateService'
    );

    return savedTemplate;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    const deleted = this.templates.delete(templateId);
    
    if (deleted) {
      this.logger.log(`Template deleted: ${templateId}`, 'NotificationTemplateService');
    }

    return deleted;
  }

  /**
   * Substitute variables in text
   */
  private substituteVariables(text: string, variables: TemplateVariables): string {
    let result = text;

    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'email_processed',
        name: 'Email Processed',
        type: 'in-app',
        title: 'Email Processed',
        body: 'Your email "{{subject}}" has been classified as {{category}} with {{confidence}}% confidence.',
        variables: ['subject', 'category', 'confidence'],
        isActive: true,
      },
      {
        id: 'processing_error',
        name: 'Processing Error',
        type: 'in-app',
        title: 'Processing Error',
        body: 'Failed to process email "{{subject}}": {{error}}',
        variables: ['subject', 'error'],
        isActive: true,
      },
      {
        id: 'batch_complete',
        name: 'Batch Processing Complete',
        type: 'in-app',
        title: 'Batch Processing Complete',
        body: 'Processed {{totalProcessed}} emails: {{totalSuccessful}} successful, {{totalFailed}} failed.',
        variables: ['totalProcessed', 'totalSuccessful', 'totalFailed'],
        isActive: true,
      },
      {
        id: 'cost_warning',
        name: 'Cost Limit Warning',
        type: 'in-app',
        title: 'Cost Limit Warning',
        body: 'You have reached {{percentage}}% of your {{period}} cost limit ({{currentCost}}/{{limit}}).',
        variables: ['percentage', 'period', 'currentCost', 'limit'],
        isActive: true,
      },
      {
        id: 'daily_digest_email',
        name: 'Daily Digest Email',
        type: 'email',
        subject: 'Daily Email Processing Summary - AEMS',
        body: 'Daily Summary: {{totalProcessed}} emails processed, ${{totalCost}} cost',
        html: '<h2>Daily Email Processing Summary</h2><p><strong>Total Emails Processed:</strong> {{totalProcessed}}</p><p><strong>Total Cost:</strong> ${{totalCost}}</p><p>Visit your AEMS dashboard for detailed analytics.</p>',
        variables: ['totalProcessed', 'totalCost'],
        isActive: true,
      },
      {
        id: 'welcome_email',
        name: 'Welcome Email',
        type: 'email',
        subject: 'Welcome to AEMS',
        body: 'Welcome {{userName}}! Your AEMS account is ready.',
        html: `
          <h2>Welcome to AEMS</h2>
          <p>Hello {{userName}},</p>
          <p>Your Automated Email Management System account is now ready to use.</p>
          <p>Get started by connecting your Gmail account and setting up your preferences.</p>
        `,
        variables: ['userName'],
        isActive: true,
      },
    ];

    defaultTemplates.forEach(template => {
      this.saveTemplate(template);
    });

    this.logger.log(
      `Initialized ${defaultTemplates.length} default notification templates`,
      'NotificationTemplateService'
    );
  }
}