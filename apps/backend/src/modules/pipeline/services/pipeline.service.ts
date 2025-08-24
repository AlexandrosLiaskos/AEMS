import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/services/logger.service';
import { EventService } from '../../common/services/event.service';

// Services
import { GmailSyncService } from '../gmail/services/gmail-sync.service';
import { ClassificationService } from '../ai/services/classification.service';
import { ExtractionService } from '../ai/services/extraction.service';
import { WorkflowService } from '../workflow/services/workflow.service';
import { AuditService } from '../audit/services/audit.service';

// Repositories
import { EmailMessageRepository } from '../../database/repositories/email-message.repository';
import { UserRepository } from '../../database/repositories/user.repository';

// Entities
import { EmailMessage, WorkflowState } from '../../database/entities/email-message.entity';
import { User } from '../../database/entities/user.entity';

/**
 * @interface PipelineOptions
 * @purpose Options for pipeline execution
 */
export interface PipelineOptions {
  userId: string;
  batchSize?: number;
  skipSync?: boolean;
  skipClassification?: boolean;
  skipExtraction?: boolean;
  forceReprocess?: boolean;
  categories?: string[];
}

/**
 * @interface PipelineResult
 * @purpose Result of pipeline execution
 */
export interface PipelineResult {
  success: boolean;
  totalEmails: number;
  processed: number;
  classified: number;
  extracted: number;
  errors: number;
  duration: number;
  errorDetails: Array<{
    emailId: string;
    stage: string;
    error: string;
  }>;
}

/**
 * @interface PipelineStats
 * @purpose Pipeline execution statistics
 */
export interface PipelineStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastRun: Date | null;
  emailsProcessed: number;
  classificationsCreated: number;
  extractionsCreated: number;
}

/**
 * @class EmailProcessingPipelineService
 * @purpose Complete email processing pipeline service
 */
@Injectable()
export class EmailProcessingPipelineService {
  private isRunning = false;
  private currentRun: string | null = null;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private eventService: EventService,
    private gmailSyncService: GmailSyncService,
    private classificationService: ClassificationService,
    private extractionService: ExtractionService,
    private workflowService: WorkflowService,
    private auditService: AuditService,
    private emailRepository: EmailMessageRepository,
    private userRepository: UserRepository,
  ) {}

  /**
   * @method runPipeline
   * @purpose Run the complete email processing pipeline
   */
  async runPipeline(options: PipelineOptions): Promise<PipelineResult> {
    if (this.isRunning) {
      throw new Error('Pipeline is already running');
    }

    const runId = this.generateRunId();
    this.currentRun = runId;
    this.isRunning = true;

    const startTime = Date.now();
    const result: PipelineResult = {
      success: false,
      totalEmails: 0,
      processed: 0,
      classified: 0,
      extracted: 0,
      errors: 0,
      duration: 0,
      errorDetails: [],
    };

    try {
      this.logger.log(`Starting email processing pipeline (${runId})`, 'EmailProcessingPipeline', {
        userId: options.userId,
        options,
      });

      // Emit pipeline start event
      this.eventService.emit('pipeline.started', {
        type: 'pipeline.started',
        payload: { runId, userId: options.userId, options },
        userId: options.userId,
      });

      // Audit log
      await this.auditService.logAction({
        userId: options.userId,
        action: 'pipeline.started',
        resource: 'email-processing',
        resourceId: runId,
        details: { runId, options },
      });

      // Step 1: Gmail Sync (if not skipped)
      if (!options.skipSync) {
        await this.runGmailSync(options, result);
      }

      // Step 2: Get emails to process
      const emailsToProcess = await this.getEmailsToProcess(options);
      result.totalEmails = emailsToProcess.length;

      this.logger.log(`Found ${emailsToProcess.length} emails to process`, 'EmailProcessingPipeline');

      // Step 3: Process emails in batches
      const batchSize = options.batchSize || 10;
      const batches = this.createBatches(emailsToProcess, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} emails)`, 'EmailProcessingPipeline');

        await this.processBatch(batch, options, result);

        // Emit progress event
        this.eventService.emit('pipeline.progress', {
          type: 'pipeline.progress',
          payload: {
            runId,
            progress: ((i + 1) / batches.length) * 100,
            batchesCompleted: i + 1,
            totalBatches: batches.length,
            result: { ...result },
          },
          userId: options.userId,
        });
      }

      result.success = result.errors === 0 || (result.processed > 0 && result.errors < result.totalEmails * 0.5);
      result.duration = Date.now() - startTime;

      this.logger.log(`Pipeline completed (${runId})`, 'EmailProcessingPipeline', {
        result,
        duration: `${result.duration}ms`,
      });

      // Emit pipeline completion event
      this.eventService.emit('pipeline.completed', {
        type: 'pipeline.completed',
        payload: { runId, result },
        userId: options.userId,
      });

      // Audit log
      await this.auditService.logAction({
        userId: options.userId,
        action: 'pipeline.completed',
        resource: 'email-processing',
        resourceId: runId,
        details: { runId, result },
      });

      return result;

    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errorDetails.push({
        emailId: 'pipeline',
        stage: 'general',
        error: error.message,
      });

      this.logger.error(`Pipeline failed (${runId}): ${error.message}`, 'EmailProcessingPipeline', error.stack);

      // Emit pipeline error event
      this.eventService.emit('pipeline.error', {
        type: 'pipeline.error',
        payload: { runId, error: error.message, result },
        userId: options.userId,
      });

      // Audit log
      await this.auditService.logAction({
        userId: options.userId,
        action: 'pipeline.failed',
        resource: 'email-processing',
        resourceId: runId,
        details: { runId, error: error.message, result },
      });

      throw error;

    } finally {
      this.isRunning = false;
      this.currentRun = null;
    }
  }

  /**
   * @method runGmailSync
   * @purpose Run Gmail synchronization
   */
  private async runGmailSync(options: PipelineOptions, result: PipelineResult): Promise<void> {
    try {
      this.logger.log('Starting Gmail sync', 'EmailProcessingPipeline');

      const user = await this.userRepository.findById(options.userId);
      if (!user || !user.googleTokens) {
        throw new Error('User not found or not connected to Gmail');
      }

      const syncResult = await this.gmailSyncService.syncEmails(
        options.userId,
        user.googleTokens,
        {
          maxResults: options.batchSize,
          fullSync: options.forceReprocess,
        }
      );

      this.logger.log(`Gmail sync completed: ${syncResult.emailsAdded} new emails`, 'EmailProcessingPipeline');

    } catch (error) {
      this.logger.error(`Gmail sync failed: ${error.message}`, 'EmailProcessingPipeline');
      result.errorDetails.push({
        emailId: 'sync',
        stage: 'gmail-sync',
        error: error.message,
      });
      // Don't throw - continue with existing emails
    }
  }

  /**
   * @method getEmailsToProcess
   * @purpose Get emails that need processing
   */
  private async getEmailsToProcess(options: PipelineOptions): Promise<EmailMessage[]> {
    if (options.forceReprocess) {
      // Get all emails for reprocessing
      return this.emailRepository.findByUserId(options.userId, {
        limit: options.batchSize || 100,
      });
    } else {
      // Get emails that need processing (FETCHED state)
      return this.emailRepository.findByWorkflowState(WorkflowState.FETCHED, options.userId);
    }
  }

  /**
   * @method createBatches
   * @purpose Create batches of emails for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * @method processBatch
   * @purpose Process a batch of emails
   */
  private async processBatch(
    emails: EmailMessage[],
    options: PipelineOptions,
    result: PipelineResult
  ): Promise<void> {
    const promises = emails.map(email => this.processEmail(email, options, result));
    await Promise.allSettled(promises);
  }

  /**
   * @method processEmail
   * @purpose Process a single email through the pipeline
   */
  private async processEmail(
    email: EmailMessage,
    options: PipelineOptions,
    result: PipelineResult
  ): Promise<void> {
    try {
      this.logger.debug(`Processing email: ${email.id}`, 'EmailProcessingPipeline');

      // Update workflow state to PROCESSING
      await this.workflowService.transitionState(email, WorkflowState.PROCESSING);

      // Step 1: Classification (if not skipped)
      if (!options.skipClassification) {
        await this.classifyEmail(email, options, result);
      }

      // Step 2: Extraction (if not skipped)
      if (!options.skipExtraction && email.classification) {
        await this.extractEmailData(email, options, result);
      }

      // Step 3: Complete workflow
      await this.completeEmailProcessing(email, result);

      result.processed++;

    } catch (error) {
      result.errors++;
      result.errorDetails.push({
        emailId: email.id,
        stage: 'processing',
        error: error.message,
      });

      // Update workflow state to ERROR
      await this.workflowService.transitionState(email, WorkflowState.ERROR);

      this.logger.error(`Failed to process email ${email.id}: ${error.message}`, 'EmailProcessingPipeline');
    }
  }

  /**
   * @method classifyEmail
   * @purpose Classify email using AI
   */
  private async classifyEmail(
    email: EmailMessage,
    options: PipelineOptions,
    result: PipelineResult
  ): Promise<void> {
    try {
      const classification = await this.classificationService.classifyEmail(email);

      if (classification) {
        result.classified++;
        await this.workflowService.transitionState(email, WorkflowState.CLASSIFIED);

        this.logger.debug(`Email classified: ${email.id} -> ${classification.category}`, 'EmailProcessingPipeline');
      }

    } catch (error) {
      this.logger.error(`Classification failed for email ${email.id}: ${error.message}`, 'EmailProcessingPipeline');
      throw error;
    }
  }

  /**
   * @method extractEmailData
   * @purpose Extract data from email using AI
   */
  private async extractEmailData(
    email: EmailMessage,
    options: PipelineOptions,
    result: PipelineResult
  ): Promise<void> {
    try {
      const extraction = await this.extractionService.extractEmailData(
        email,
        email.classification!.category
      );

      if (extraction) {
        result.extracted++;
        await this.workflowService.transitionState(email, WorkflowState.EXTRACTED);

        this.logger.debug(`Data extracted from email: ${email.id}`, 'EmailProcessingPipeline');
      }

    } catch (error) {
      this.logger.error(`Extraction failed for email ${email.id}: ${error.message}`, 'EmailProcessingPipeline');
      throw error;
    }
  }

  /**
   * @method completeEmailProcessing
   * @purpose Complete email processing workflow
   */
  private async completeEmailProcessing(email: EmailMessage, result: PipelineResult): Promise<void> {
    try {
      // Check if email processing is complete
      const isComplete = email.classification &&
                        email.extraction &&
                        email.extraction.isComplete;

      if (isComplete) {
        await this.workflowService.transitionState(email, WorkflowState.COMPLETED);
        this.logger.debug(`Email processing completed: ${email.id}`, 'EmailProcessingPipeline');
      }

    } catch (error) {
      this.logger.error(`Failed to complete email processing ${email.id}: ${error.message}`, 'EmailProcessingPipeline');
      throw error;
    }
  }

  /**
   * @method getPipelineStatus
   * @purpose Get current pipeline status
   */
  getPipelineStatus(): {
    isRunning: boolean;
    currentRun: string | null;
  } {
    return {
      isRunning: this.isRunning,
      currentRun: this.currentRun,
    };
  }

  /**
   * @method stopPipeline
   * @purpose Stop the current pipeline execution
   */
  async stopPipeline(): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    this.logger.log('Stopping pipeline execution', 'EmailProcessingPipeline');

    // Note: This is a simple implementation
    // In a production system, you'd want more sophisticated cancellation
    this.isRunning = false;
    this.currentRun = null;

    return true;
  }

  /**
   * @method generateRunId
   * @purpose Generate unique run ID
   */
  private generateRunId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * @method getPipelineStats
   * @purpose Get pipeline execution statistics
   */
  async getPipelineStats(userId: string): Promise<PipelineStats> {
    // This would typically query audit logs or a dedicated stats table
    // For now, return mock data
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageDuration: 0,
      lastRun: null,
      emailsProcessed: 0,
      classificationsCreated: 0,
      extractionsCreated: 0,
    };
  }
}
