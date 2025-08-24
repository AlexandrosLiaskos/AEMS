import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface PromptTemplate
 * @purpose Template for AI prompts
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'classification' | 'extraction' | 'general';
  version: string;
}

/**
 * @interface PromptContext
 * @purpose Context for prompt generation
 */
export interface PromptContext {
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string;
  emailTo?: string;
  category?: string;
  previousClassifications?: any[];
  userPreferences?: any;
  [key: string]: any;
}

/**
 * @class PromptService
 * @purpose Service for managing AI prompts and templates
 */
@Injectable()
export class PromptService {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.initializeDefaultTemplates();
  }

  /**
   * @method getClassificationPrompt
   * @purpose Get prompt for email classification
   */
  getClassificationPrompt(context: PromptContext): string {
    const template = this.templates.get('email-classification');
    if (!template) {
      throw new Error('Classification prompt template not found');
    }

    return this.renderTemplate(template, context);
  }

  /**
   * @method getExtractionPrompt
   * @purpose Get prompt for data extraction
   */
  getExtractionPrompt(category: string, context: PromptContext): string {
    const templateId = `extraction-${category}`;
    const template = this.templates.get(templateId) || this.templates.get('extraction-generic');
    
    if (!template) {
      throw new Error(`Extraction prompt template not found for category: ${category}`);
    }

    return this.renderTemplate(template, { ...context, category });
  }

  /**
   * @method renderTemplate
   * @purpose Render template with context variables
   */
  private renderTemplate(template: PromptTemplate, context: PromptContext): string {
    let rendered = template.template;

    // Replace variables in template
    for (const variable of template.variables) {
      const value = context[variable] || '';
      const placeholder = `{{${variable}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }

  /**
   * @method initializeDefaultTemplates
   * @purpose Initialize default prompt templates
   */
  private initializeDefaultTemplates(): void {
    // Email Classification Template
    this.templates.set('email-classification', {
      id: 'email-classification',
      name: 'Email Classification',
      description: 'Classify emails into categories',
      template: `Classify the following email into one of these categories: invoice, receipt, contract, newsletter, notification, personal, business, support, marketing, other.

Email Details:
Subject: {{emailSubject}}
From: {{emailFrom}}
Body: {{emailBody}}

Respond with a JSON object containing:
- category: the classification category
- confidence: confidence score (0-1)
- reasoning: brief explanation for the classification

Response:`,
      variables: ['emailSubject', 'emailFrom', 'emailBody'],
      category: 'classification',
      version: '1.0',
    });

    // Generic Extraction Template
    this.templates.set('extraction-generic', {
      id: 'extraction-generic',
      name: 'Generic Data Extraction',
      description: 'Extract structured data from emails',
      template: `Extract structured data from the following {{category}} email:

Email Details:
Subject: {{emailSubject}}
From: {{emailFrom}}
Body: {{emailBody}}

Extract relevant information and respond with a JSON object containing the extracted data.
Include confidence scores for each field.

Response:`,
      variables: ['category', 'emailSubject', 'emailFrom', 'emailBody'],
      category: 'extraction',
      version: '1.0',
    });

    // Invoice Extraction Template
    this.templates.set('extraction-invoice', {
      id: 'extraction-invoice',
      name: 'Invoice Data Extraction',
      description: 'Extract data from invoice emails',
      template: `Extract invoice data from the following email:

Email Details:
Subject: {{emailSubject}}
From: {{emailFrom}}
Body: {{emailBody}}

Extract the following information:
- invoiceNumber: Invoice number
- amount: Total amount (number)
- currency: Currency code
- dueDate: Due date (ISO format)
- vendor: Vendor/company name
- description: Invoice description
- items: Array of line items (if available)

Respond with a JSON object containing the extracted data and confidence scores.

Response:`,
      variables: ['emailSubject', 'emailFrom', 'emailBody'],
      category: 'extraction',
      version: '1.0',
    });

    this.logger.log(`Initialized ${this.templates.size} prompt templates`, 'PromptService');
  }

  /**
   * @method addTemplate
   * @purpose Add custom prompt template
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    this.logger.log(`Added prompt template: ${template.id}`, 'PromptService');
  }

  /**
   * @method getTemplate
   * @purpose Get prompt template by ID
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * @method listTemplates
   * @purpose List all available templates
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
}