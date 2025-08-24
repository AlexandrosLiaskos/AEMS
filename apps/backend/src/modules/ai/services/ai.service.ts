import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { User } from '../../../database/entities/user.entity';
import { EmailMessage, WorkflowState } from '../../../database/entities/email-message.entity';
import { Classification, EmailCategory } from '../../../database/entities/classification.entity';
import { Extraction } from '../../../database/entities/extraction.entity';
import { AuditLog, AuditAction } from '../../../database/entities/audit-log.entity';

// Services
import { ClassificationService } from './classification.service';
import { ExtractionService } from './extraction.service';
import { CostTrackingService } from './cost-tracking.service';
import { LoggerService } from '../../../common/services/logger.service';

// DTOs
import { ProcessEmailDto, BatchProcessDto, AIProcessingResultDto } from '../dto/ai.dto';

/**
 * @interface ProcessingResult
 * @purpose AI processing result interface
 */
export interface ProcessingResult {
  success: boolean;
  emailId: string;
  classification?: Classification;
  extraction?: Extraction;
  processingTime: number;
  cost: number;
  error?: string;
  needsReview: boolean;
}

/**
 * @interface BatchProcessingResult
 * @purpose Batch processing result interface
 */
export interface BatchProcessingResult {
  success: boolean;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalCost: number;
  totalTime: number;
  results: ProcessingResult[];
  errors: Array<{
    emailId: string;
    error: string;
  }>;
}

/**
 * @class AIService
 * @purpose Main AI processing orchestration service
 */
@Injectable()
export class AIService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EmailMessage)
    private emailRepository: Repository<EmailMessage>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private classificationService: ClassificationService,
    private extractionService: ExtractionService,
    private costTrackingService: CostTrackingService,
    private configService: ConfigService,
    private logger: LoggerService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * @method processEmail
   * @purpose Process a single email with AI classification and extraction
   */
  async processEmail(
    emailId: string,
    userId: string,
    options: ProcessEmailDto = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let totalCost = 0;

    try {
      // Get email
      const email = await this.emailRepository.findOne({
        where: { id: emailId, userId },
        relations: ['classification', 'extraction'],
      });

      if (!email) {
        throw new BadRequestException('Email not found');
      }

      // Check if email is processable
      if (!email.isProcessable()) {
        throw new BadRequestException('Email is not in a processable state');
      }

      // Check cost limits
      await this.costTrackingService.checkCostLimits(userId);

      // Update email state
      email.transitionTo(WorkflowState.PROCESSING, 'AI processing started', userId);
      await this.emailRepository.save(email);

      // Emit processing started event
      this.eventEmitter.emit('ai.processing.started', {
        emailId,
        userId,
        startTime: new Date(startTime),
      });

      const result: ProcessingResult = {
        success: false,
        emailId,
        processingTime: 0,
        cost: 0,
        needsReview: false,
      };

      // Step 1: Classification
      if (options.skipClassification !== true && !email.classification) {
        try {
          this.logger.log(
            `Starting classification for email ${emailId}`,
            'AIService',
            { emailId, userId }
          );

          const classification = await this.classificationService.classifyEmail(email);
          result.classification = classification;
          totalCost += classification.getProcessingCost();

          this.logger.log(
            `Classification completed for email ${emailId}: ${classification.category} (${classification.confidence})`,
            'AIService',
            { 
              emailId, 
              userId, 
              category: classification.category, 
              confidence: classification.confidence 
            }
          );
        } catch (error) {
          this.logger.error(
            `Classification failed for email ${emailId}`,
            error.stack,
            'AIService'
          );
          
          // Don't fail the entire process if classification fails
          result.error = `Classification failed: ${error.message}`;
        }
      }

      // Step 2: Data Extraction (only if classification succeeded or exists)
      const classification = result.classification || email.classification;
      if (
        options.skipExtraction !== true && 
        !email.extraction && 
        classification &&
        this.shouldExtractData(classification.category as EmailCategory)
      ) {
        try {
          this.logger.log(
            `Starting extraction for email ${emailId}`,
            'AIService',
            { emailId, userId, category: classification.category }
          );

          const extraction = await this.extractionService.extractData(email, classification);
          result.extraction = extraction;
          totalCost += extraction.getProcessingCost();

          this.logger.log(
            `Extraction completed for email ${emailId}: ${extraction.overallConfidence} confidence`,
            'AIService',
            { 
              emailId, 
              userId, 
              confidence: extraction.overallConfidence,
              fieldsExtracted: Object.keys(extraction.extractedData).length
            }
          );
        } catch (error) {
          this.logger.error(
            `Extraction failed for email ${emailId}`,
            error.stack,
            'AIService'
          );
          
          // Don't fail the entire process if extraction fails
          if (!result.error) {
            result.error = `Extraction failed: ${error.message}`;
          } else {
            result.error += `; Extraction failed: ${error.message}`;
          }
        }
      }

      // Calculate final metrics
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;
      result.cost = totalCost;

      // Determine if review is needed
      result.needsReview = this.determineReviewNeeded(result.classification, result.extraction);

      // Update email state based on results
      if (result.classification || result.extraction) {
        if (result.needsReview) {
          email.transitionTo(WorkflowState.REVIEW, 'AI processing completed - review needed', userId);
        } else {
          email.transitionTo(WorkflowState.APPROVED, 'AI processing completed - auto-approved', userId);
        }
        
        email.processedAt = new Date();
        email.resetProcessingAttempts();
        result.success = true;
      } else {
        email.transitionTo(WorkflowState.FETCHED, 'AI processing failed', userId);
        email.incrementProcessingAttempts(result.error);
      }

      await this.emailRepository.save(email);

      // Update user cost tracking
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        user.addAiCost(totalCost);
        await this.userRepository.save(user);
      }

      // Record cost usage
      await this.costTrackingService.recordUsage(userId, totalCost, processingTime);

      // Log processing event
      await this.logProcessingEvent(emailId, userId, result);

      // Emit processing completed event
      this.eventEmitter.emit('ai.processing.completed', {
        emailId,
        userId,
        result,
        processingTime,
        cost: totalCost,
      });

      this.logger.log(
        `AI processing completed for email ${emailId}: ${result.success ? 'success' : 'failed'}`,
        'AIService',
        { emailId, userId, result }
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Update email with error
      try {
        const email = await this.emailRepository.findOne({ where: { id: emailId, userId } });
        if (email) {
          email.transitionTo(WorkflowState.FETCHED, 'AI processing failed', userId);
          email.incrementProcessingAttempts(error.message);
          await this.emailRepository.save(email);
        }
      } catch (updateError) {
        this.logger.error('Failed to update email after processing error', updateError.stack, 'AIService');
      }

      // Emit processing failed event
      this.eventEmitter.emit('ai.processing.failed', {
        emailId,
        userId,
        error: error.message,
        processingTime,
      });

      this.logger.error(
        `AI processing failed for email ${emailId}`,
        error.stack,
        'AIService',
        { emailId, userId }
      );

      throw error;
    }
  }

  /**
   * @method processBatch
   * @purpose Process multiple emails in batch
   */
  async processBatch(
    emailIds: string[],
    userId: string,
    options: BatchProcessDto = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const results: ProcessingResult[] = [];
    const errors: Array<{ emailId: string; error: string }> = [];
    let totalCost = 0;

    try {
      this.logger.log(
        `Starting batch AI processing for ${emailIds.length} emails`,
        'AIService',
        { userId, emailCount: emailIds.length }
      );

      // Check cost limits before starting
      await this.costTrackingService.checkCostLimits(userId);

      // Process emails with concurrency control
      const concurrency = options.concurrency || this.configService.get<number>('ai.batchSize', 5);
      const batches = this.chunkArray(emailIds, concurrency);

      for (const batch of batches) {
        const batchPromises = batch.map(async (emailId) => {
          try {
            const result = await this.processEmail(emailId, userId, {
              skipClassification: options.skipClassification,
              skipExtraction: options.skipExtraction,
            });
            
            results.push(result);
            totalCost += result.cost;

            // Emit progress event
            this.eventEmitter.emit('ai.batch.progress', {
              userId,
              processed: results.length,
              total: emailIds.length,
              progress: Math.round((results.length / emailIds.length) * 100),
            });

            return result;
          } catch (error) {
            errors.push({
              emailId,
              error: error.message,
            });

            this.logger.error(
              `Batch processing failed for email ${emailId}`,
              error.stack,
              'AIService'
            );

            return null;
          }
        });

        // Wait for batch to complete
        await Promise.all(batchPromises);

        // Small delay between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(1000);
        }
      }

      const totalTime = Date.now() - startTime;
      const batchResult: BatchProcessingResult = {
        success: errors.length === 0,
        totalProcessed: emailIds.length,
        totalSuccessful: results.filter(r => r.success).length,
        totalFailed: errors.length,
        totalCost,
        totalTime,
        results,
        errors,
      };

      // Emit batch completed event
      this.eventEmitter.emit('ai.batch.completed', {
        userId,
        result: batchResult,
      });

      this.logger.log(
        `Batch AI processing completed: ${batchResult.totalSuccessful}/${batchResult.totalProcessed} successful`,
        'AIService',
        { userId, result: batchResult }
      );

      return batchResult;
    } catch (error) {
      this.logger.error(
        'Batch AI processing failed',
        error.stack,
        'AIService',
        { userId, emailIds }
      );

      throw error;
    }
  }

  /**
   * @method reprocessEmail
   * @purpose Reprocess an email (override existing results)
   */
  async reprocessEmail(
    emailId: string,
    userId: string,
    options: { forceClassification?: boolean; forceExtraction?: boolean } = {}
  ): Promise<ProcessingResult> {
    try {
      const email = await this.emailRepository.findOne({
        where: { id: emailId, userId },
        relations: ['classification', 'extraction'],
      });

      if (!email) {
        throw new BadRequestException('Email not found');
      }

      // Clear existing results if forced
      if (options.forceClassification && email.classification) {
        await this.classificationService.deleteClassification(email.classification.id);
      }

      if (options.forceExtraction && email.extraction) {
        await this.extractionService.deleteExtraction(email.extraction.id);
      }

      // Reset email state
      email.transitionTo(WorkflowState.FETCHED, 'Reprocessing requested', userId);
      email.resetProcessingAttempts();
      await this.emailRepository.save(email);

      // Process again
      return await this.processEmail(emailId, userId, {
        skipClassification: !options.forceClassification && !!email.classification,
        skipExtraction: !options.forceExtraction && !!email.extraction,
      });
    } catch (error) {
      this.logger.error(
        `Failed to reprocess email ${emailId}`,
        error.stack,
        'AIService'
      );
      throw error;
    }
  }

  /**
   * @method getProcessingStats
   * @purpose Get AI processing statistics for user
   */
  async getProcessingStats(userId: string): Promise<{
    totalProcessed: number;
    totalCost: number;
    averageProcessingTime: number;
    successRate: number;
    categoryBreakdown: Record<EmailCategory, number>;
    dailyCost: number;
    monthlyCost: number;
  }> {
    try {
      // Get user
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Get processing statistics
      const stats = await this.costTrackingService.getUsageStats(userId);
      
      // Get category breakdown
      const categoryBreakdown = await this.classificationService.getCategoryBreakdown(userId);

      return {
        totalProcessed: user.totalEmailsProcessed,
        totalCost: Number(user.totalAiCost),
        averageProcessingTime: stats.averageProcessingTime,
        successRate: stats.successRate,
        categoryBreakdown,
        dailyCost: stats.dailyCost,
        monthlyCost: stats.monthlyCost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get processing stats for user ${userId}`,
        error.stack,
        'AIService'
      );
      throw error;
    }
  }

  /**
   * @method shouldExtractData
   * @purpose Determine if data extraction should be performed for category
   */
  private shouldExtractData(category: EmailCategory): boolean {
    const extractableCategories = [
      EmailCategory.INVOICE,
      EmailCategory.RECEIPT,
      EmailCategory.QUOTE,
      EmailCategory.ORDER,
      EmailCategory.CUSTOMER_INQUIRY,
      EmailCategory.SUPPORT_TICKET,
    ];

    return extractableCategories.includes(category);
  }

  /**
   * @method determineReviewNeeded
   * @purpose Determine if human review is needed
   */
  private determineReviewNeeded(
    classification?: Classification,
    extraction?: Extraction
  ): boolean {
    const confidenceThreshold = this.configService.get<number>('ai.classificationConfidenceThreshold', 0.7);

    // Review needed if classification confidence is low
    if (classification && classification.confidence < confidenceThreshold) {
      return true;
    }

    // Review needed if extraction confidence is low
    if (extraction && extraction.needsReview(0.8)) {
      return true;
    }

    // Review needed for certain categories
    if (classification && classification.category === EmailCategory.OTHER) {
      return true;
    }

    return false;
  }

  /**
   * @method logProcessingEvent
   * @purpose Log AI processing event to audit log
   */
  private async logProcessingEvent(
    emailId: string,
    userId: string,
    result: ProcessingResult
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        action: AuditAction.EMAIL_PROCESSED,
        resourceType: 'email',
        resourceId: emailId,
        description: `AI processing ${result.success ? 'completed' : 'failed'}`,
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'AI Service',
          metadata: {
            processingTime: result.processingTime,
            cost: result.cost,
            needsReview: result.needsReview,
            hasClassification: !!result.classification,
            hasExtraction: !!result.extraction,
          },
        },
        userId,
        performedBy: 'system',
        isSuccessful: result.success,
        errorMessage: result.error,
      });

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to log processing event', error.stack, 'AIService');
    }
  }

  /**
   * @method chunkArray
   * @purpose Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * @method overrideClassification
   * @purpose Override classification with manual input
   */
  async overrideClassification(
    classificationId: string,
    userId: string,
    override: { category: string; reason: string }
  ): Promise<void> {
    await this.classificationService.overrideClassification(
      classificationId,
      override.category as EmailCategory,
      override.reason,
      userId
    );
  }

  /**
   * @method validateClassification
   * @purpose Validate classification accuracy
   */
  async validateClassification(
    classificationId: string,
    userId: string,
    validation: { isCorrect: boolean; correctCategory?: string; feedback?: string }
  ): Promise<void> {
    await this.classificationService.validateClassification(
      classificationId,
      validation.isCorrect,
      userId,
      validation.feedback,
      validation.correctCategory as EmailCategory
    );
  }

  /**
   * @method correctExtraction
   * @purpose Correct extraction field value
   */
  async correctExtraction(
    extractionId: string,
    userId: string,
    correction: { fieldName: string; correctedValue: string; reason: string }
  ): Promise<void> {
    await this.extractionService.correctField(
      extractionId,
      correction.fieldName,
      correction.correctedValue,
      userId,
      correction.reason
    );
  }

  /**
   * @method getProcessingStatus
   * @purpose Get current processing status
   */
  async getProcessingStatus(userId: string): Promise<{
    isProcessing: boolean;
    currentBatch?: {
      totalEmails: number;
      processedEmails: number;
      progress: number;
    };
    queuedEmails: number;
    lastProcessedAt?: Date;
  }> {
    // This would typically check for active processing jobs
    // For now, return a simple status
    return {
      isProcessing: false,
      queuedEmails: 0,
      lastProcessedAt: new Date(),
    };
  }

  /**
   * @method delay
   * @purpose Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}