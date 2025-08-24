import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Services
import { OpenAIService } from './openai.service';
import { LoggerService } from '../../../common/services/logger.service';
import { PromptService } from './prompt.service';
import { ValidationService } from '../../../common/services/validation.service';
import { CacheService } from './cache.service';

// Repositories
import { ExtractionRepository } from '../../../database/repositories/extraction.repository';
import { EmailMessageRepository } from '../../../database/repositories/email-message.repository';

// Entities
import { Extraction, ExtractedData, ExtractionMetrics } from '../../../database/entities/extraction.entity';
import { EmailMessage } from '../../../database/entities/email-message.entity';
import { Classification } from '../../../database/entities/classification.entity';

/**
 * @interface ExtractionOptions
 * @purpose Options for data extraction
 */
export interface ExtractionOptions {
  forceReprocess?: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
  includeMetrics?: boolean;
}

/**
 * @interface ExtractionResult
 * @purpose Result of extraction operation
 */
export interface ExtractionResult {
  success: boolean;
  extraction?: Extraction;
  error?: string;
  processingTime: number;
  cost: number;
  needsReview: boolean;
}

/**
 * @class ExtractionService
 * @purpose AI-powered data extraction service
 */
@Injectable()
export class ExtractionService {
  private readonly confidenceThreshold: number;
  private readonly maxRetries: number;

  constructor(
    private extractionRepository: ExtractionRepository,
    private emailRepository: EmailMessageRepository,
    private openaiService: OpenAIService,
    private promptService: PromptService,
    private validationService: ValidationService,
    private cacheService: CacheService,
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.confidenceThreshold = this.configService.get<number>('EXTRACTION_CONFIDENCE_THRESHOLD', 0.9);
    this.maxRetries = this.configService.get<number>('EXTRACTION_MAX_RETRIES', 3);
  }

  /**
   * @method extractFromEmail
   * @purpose Extract structured data from email
   */
  async extractFromEmail(
    emailId: string,
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Get email and classification
      const email = await this.emailRepository.findOne({
        where: { id: emailId, userId },
        relations: ['classification'],
      });

      if (!email) {
        throw new NotFoundException('Email not found');
      }

      if (!email.classification) {
        throw new BadRequestException('Email must be classified before extraction');
      }

      // Check if extraction already exists
      const existingExtraction = await this.extractionRepository.findOne({
        where: { emailId },
      });

      if (existingExtraction && !options.forceReprocess) {
        return {
          success: true,
          extraction: existingExtraction,
          processingTime: Date.now() - startTime,
          cost: 0,
          needsReview: existingExtraction.needsReview(this.confidenceThreshold),
        };
      }

      // Perform extraction
      const extractionResult = await this.performExtraction(
        email,
        email.classification,
        options
      );

      // Save extraction
      const extraction = existingExtraction || new Extraction();
      Object.assign(extraction, {
        emailId: email.id,
        category: email.classification.category,
        extractedData: extractionResult.data,
        fieldConfidences: extractionResult.fieldConfidences,
        overallConfidence: extractionResult.overallConfidence,
        schema: extractionResult.schema,
        modelVersion: extractionResult.modelVersion,
        metrics: extractionResult.metrics,
        isComplete: extractionResult.isComplete,
        missingFields: extractionResult.missingFields,
        extractionErrors: extractionResult.errors,
        processingAttempts: (extraction.processingAttempts || 0) + 1,
        lastProcessingError: null,
      });

      await this.extractionRepository.create(extraction);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Data extraction completed for email ${emailId} in ${processingTime}ms`,
        'ExtractionService'
      );

      return {
        success: true,
        extraction,
        processingTime,
        cost: extractionResult.metrics?.cost || 0,
        needsReview: extraction.needsReview(this.confidenceThreshold),
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Data extraction failed for email ${emailId}: ${error.message}`,
        error.stack,
        'ExtractionService'
      );

      // Update extraction with error
      const extraction = await this.extractionRepository.findOne({
        where: { emailId },
      });

      if (extraction) {
        extraction.processingAttempts = (extraction.processingAttempts || 0) + 1;
        extraction.lastProcessingError = error.message;
        await this.extractionRepository.create(extraction);
      }

      return {
        success: false,
        error: error.message,
        processingTime,
        cost: 0,
        needsReview: true,
      };
    }
  }

  /**
   * @method correctField
   * @purpose Manually correct extracted field value
   */
  async correctField(
    extractionId: string,
    fieldName: string,
    correctedValue: any,
    userId: string,
    reason: string
  ): Promise<Extraction> {
    const extraction = await this.extractionRepository.findOne({
      where: { id: extractionId },
      relations: ['email'],
    });

    if (!extraction) {
      throw new NotFoundException('Extraction not found');
    }

    if (extraction.email.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Apply correction
    extraction.correctField(fieldName, correctedValue, userId, reason);

    // Recalculate completeness
    this.updateCompleteness(extraction);

    await this.extractionRepository.update(extraction.id, extraction);

    this.logger.log(
      `Field ${fieldName} corrected in extraction ${extractionId} by user ${userId}`,
      'ExtractionService'
    );

    return extraction;
  }

  /**
   * @method validateExtraction
   * @purpose Validate extraction accuracy
   */
  async validateExtraction(
    extractionId: string,
    isCorrect: boolean,
    userId: string,
    feedback?: string
  ): Promise<Extraction> {
    const extraction = await this.extractionRepository.findOne({
      where: { id: extractionId },
      relations: ['email'],
    });

    if (!extraction) {
      throw new NotFoundException('Extraction not found');
    }

    if (extraction.email.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Create validation feedback
    const validationFeedback = {
      correctFields: [],
      incorrectFields: [],
      missingFields: extraction.missingFields || [],
      additionalFields: [],
      overallAccuracy: isCorrect ? 1.0 : 0.0,
      comments: feedback,
    };

    // If correct, mark all fields as correct
    if (isCorrect) {
      validationFeedback.correctFields = Object.keys(extraction.extractedData);
    } else {
      validationFeedback.incorrectFields = Object.keys(extraction.extractedData);
    }

    extraction.validate(validationFeedback, userId);

    await this.extractionRepository.update(extraction.id, extraction);

    this.logger.log(
      `Extraction ${extractionId} validated as ${isCorrect ? 'correct' : 'incorrect'} by user ${userId}`,
      'ExtractionService'
    );

    return extraction;
  }

  /**
   * @method performExtraction
   * @purpose Perform AI-powered data extraction
   */
  private async performExtraction(
    email: EmailMessage,
    classification: Classification,
    options: ExtractionOptions
  ): Promise<{
    data: ExtractedData;
    fieldConfidences: any;
    overallConfidence: number;
    schema: any;
    modelVersion: string;
    metrics: ExtractionMetrics;
    isComplete: boolean;
    missingFields: string[];
    errors: any[];
  }> {
    const category = classification.category;
    const schema = this.getExtractionSchema(category);

    // Prepare extraction prompt
    const prompt = this.buildExtractionPrompt(email, category, schema);

    // Call OpenAI API
    const startTime = Date.now();
    const response = await this.openaiService.complete({
      prompt,
      maxTokens: this.configService.get<number>('OPENAI_MAX_TOKENS', 1000),
      temperature: 0.1,
    });

    const processingTime = Date.now() - startTime;

    // Parse and validate response
    const extractionResult = this.parseExtractionResponse(response, schema);

    // Calculate metrics
    const metrics: ExtractionMetrics = {
      processingTime,
      modelVersion: response.model || 'gpt-3.5-turbo',
      tokensUsed: response.tokensUsed || 0,
      cost: this.calculateCost(response.tokensUsed || 0),
      apiCalls: 1,
      retryCount: 0,
      fallbackUsed: false,
      fieldsExtracted: Object.keys(extractionResult.data).length,
      fieldsConfident: Object.values(extractionResult.fieldConfidences)
        .filter((conf: any) => conf.confidence >= this.confidenceThreshold).length,
      averageFieldConfidence: this.calculateAverageConfidence(extractionResult.fieldConfidences),
    };

    return {
      ...extractionResult,
      schema: this.getExtractionSchema(classification.category),
      modelVersion: metrics.modelVersion,
      metrics,
    };
  }

  /**
   * @method getExtractionSchema
   * @purpose Get extraction schema for category
   */
  private getExtractionSchema(category: string): any {
    const schemas = {
      INVOICE: {
        version: '1.0',
        fields: [
          { name: 'invoiceNumber', type: 'string', required: true, description: 'Invoice number' },
          { name: 'invoiceDate', type: 'date', required: true, description: 'Invoice date' },
          { name: 'dueDate', type: 'date', required: false, description: 'Payment due date' },
          { name: 'totalAmount', type: 'number', required: true, description: 'Total amount' },
          { name: 'currency', type: 'string', required: true, description: 'Currency code' },
          { name: 'vendorName', type: 'string', required: true, description: 'Vendor name' },
          { name: 'vendorAddress', type: 'string', required: false, description: 'Vendor address' },
          { name: 'taxAmount', type: 'number', required: false, description: 'Tax amount' },
        ],
      },
      RECEIPT: {
        version: '1.0',
        fields: [
          { name: 'receiptNumber', type: 'string', required: false, description: 'Receipt number' },
          { name: 'receiptDate', type: 'date', required: true, description: 'Receipt date' },
          { name: 'totalAmount', type: 'number', required: true, description: 'Total amount' },
          { name: 'currency', type: 'string', required: true, description: 'Currency code' },
          { name: 'merchantName', type: 'string', required: true, description: 'Merchant name' },
          { name: 'paymentMethod', type: 'string', required: false, description: 'Payment method' },
        ],
      },
      // Add more schemas as needed
    };

    return schemas[category] || schemas.INVOICE;
  }

  /**
   * @method buildExtractionPrompt
   * @purpose Build extraction prompt for AI
   */
  private buildExtractionPrompt(email: EmailMessage, category: string, schema: any): string {
    const fields = schema.fields.map(f => `- ${f.name} (${f.type}${f.required ? ', required' : ''}): ${f.description}`).join('\n');

    return `Extract structured data from this ${category.toLowerCase()} email.

Email Subject: ${email.subject}
Email From: ${email.from}
Email Date: ${email.date}
Email Body:
${email.body}

Extract the following fields:
${fields}

Return a JSON object with the extracted data and confidence scores for each field.
Format:
{
  "data": {
    "fieldName": "extractedValue",
    ...
  },
  "fieldConfidences": {
    "fieldName": {
      "confidence": 0.95,
      "reasoning": "Clear indication in email body"
    },
    ...
  },
  "overallConfidence": 0.90
}

Only extract fields that are clearly present in the email. Use null for missing required fields.`;
  }

  /**
   * @method parseExtractionResponse
   * @purpose Parse AI extraction response
   */
  private parseExtractionResponse(response: any, schema: any): {
    data: ExtractedData;
    fieldConfidences: any;
    overallConfidence: number;
    isComplete: boolean;
    missingFields: string[];
    errors: any[];
  } {
    try {
      const parsed = JSON.parse(response.content);
      const data = parsed.data || {};
      const fieldConfidences = parsed.fieldConfidences || {};
      const overallConfidence = parsed.overallConfidence || 0;

      // Check completeness
      const requiredFields = schema.fields.filter(f => f.required).map(f => f.name);
      const missingFields = requiredFields.filter(field => !data[field] || data[field] === null);
      const isComplete = missingFields.length === 0;

      return {
        data,
        fieldConfidences,
        overallConfidence,
        isComplete,
        missingFields,
        errors: [],
      };
    } catch (error) {
      this.logger.error('Failed to parse extraction response', error.stack, 'ExtractionService');

      return {
        data: {},
        fieldConfidences: {},
        overallConfidence: 0,
        isComplete: false,
        missingFields: schema.fields.filter(f => f.required).map(f => f.name),
        errors: [{ field: 'parsing', error: error.message, severity: 'high' }],
      };
    }
  }

  /**
   * @method updateCompleteness
   * @purpose Update extraction completeness status
   */
  private updateCompleteness(extraction: Extraction): void {
    const schema = extraction.schema;
    if (!schema) return;

    const requiredFields = schema.fields.filter(f => f.required).map(f => f.name);
    const missingFields = requiredFields.filter(field =>
      !extraction.extractedData[field] || extraction.extractedData[field] === null
    );

    extraction.missingFields = missingFields;
    extraction.isComplete = missingFields.length === 0;
  }

  /**
   * @method calculateCost
   * @purpose Calculate API cost based on token usage
   */
  private calculateCost(tokens: number): number {
    // GPT-3.5-turbo pricing: $0.002 per 1K tokens
    return (tokens / 1000) * 0.002;
  }

  /**
   * @method extractData
   * @purpose Extract data from email (alias for extractFromEmail)
   */
  async extractData(email: EmailMessage, classification: Classification): Promise<Extraction> {
    const result = await this.extractFromEmail(email.id, email.userId);
    if (!result.success || !result.extraction) {
      throw new Error(result.error || 'Extraction failed');
    }
    return result.extraction;
  }

  /**
   * @method extractEmailData
   * @purpose Extract email data (alias for extractFromEmail)
   */
  async extractEmailData(email: EmailMessage, category: string): Promise<Extraction> {
    const result = await this.extractFromEmail(email.id, email.userId);
    if (!result.success || !result.extraction) {
      throw new Error(result.error || 'Extraction failed');
    }
    return result.extraction;
  }

  /**
   * @method deleteExtraction
   * @purpose Delete an extraction
   */
  async deleteExtraction(extractionId: string): Promise<void> {
    const extraction = await this.extractionRepository.findOne({
      where: { id: extractionId },
    });

    if (!extraction) {
      throw new NotFoundException('Extraction not found');
    }

    await this.extractionRepository.delete(extractionId);

    this.logger.log(
      `Extraction ${extractionId} deleted`,
      'ExtractionService'
    );
  }

  /**
   * @method calculateAverageConfidence
   * @purpose Calculate average confidence across all fields
   */
  private calculateAverageConfidence(fieldConfidences: any): number {
    const confidences = Object.values(fieldConfidences).map((conf: any) => conf.confidence);
    return confidences.length > 0 ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0;
  }
}
