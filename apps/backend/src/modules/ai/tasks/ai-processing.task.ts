import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

// Services
import { AIService } from '../services/ai.service';
import { LoggerService } from '../../../common/services/logger.service';

// Entities
import { EmailMessage } from '../../../database/entities/email-message.entity';
import { Classification } from '../../../database/entities/classification.entity';
import { Extraction } from '../../../database/entities/extraction.entity';

// Enums
import { WorkflowState } from '../../../database/entities/email-message.entity';

/**
 * @class AIProcessingTask
 * @purpose Scheduled tasks for AI processing
 */
@Injectable()
export class AIProcessingTask {
  private isProcessing = false;

  constructor(
    @InjectRepository(EmailMessage)
    private emailRepository: Repository<EmailMessage>,
    @InjectRepository(Classification)
    private classificationRepository: Repository<Classification>,
    @InjectRepository(Extraction)
    private extractionRepository: Repository<Extraction>,
    private aiService: AIService,
    private configService: ConfigService,
    private logger: LoggerService
  ) {}

  /**
   * @method processUnclassifiedEmails
   * @purpose Process emails that haven't been classified yet
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processUnclassifiedEmails(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('AI processing already in progress, skipping', 'AIProcessingTask');
      return;
    }

    const isEnabled = this.configService.get<boolean>('ENABLE_AI_PROCESSING', true);
    if (!isEnabled) {
      return;
    }

    this.isProcessing = true;

    try {
      // Find emails without classifications
      const unclassifiedEmails = await this.emailRepository
        .createQueryBuilder('email')
        .leftJoin('email.classification', 'classification')
        .where('classification.id IS NULL')
        .andWhere('email.workflowState = :state', { state: WorkflowState.FETCHED })
        .orderBy('email.createdAt', 'ASC')
        .limit(10) // Process in small batches
        .getMany();

      if (unclassifiedEmails.length === 0) {
        this.logger.debug('No unclassified emails found', 'AIProcessingTask');
        return;
      }

      this.logger.log(
        `Processing ${unclassifiedEmails.length} unclassified emails`,
        'AIProcessingTask'
      );

      // Process each email
      for (const email of unclassifiedEmails) {
        try {
          await this.aiService.processEmail(email.id, email.userId, {
            skipExtraction: false,
            forceReprocess: false,
          });

          this.logger.debug(`Processed email ${email.id}`, 'AIProcessingTask');
        } catch (error) {
          this.logger.error(
            `Failed to process email ${email.id}: ${error.message}`,
            error.stack,
            'AIProcessingTask'
          );
        }

        // Small delay between processing
        await this.delay(1000);
      }

      this.logger.log(
        `Completed processing ${unclassifiedEmails.length} emails`,
        'AIProcessingTask'
      );

    } catch (error) {
      this.logger.error(
        'Error in processUnclassifiedEmails task',
        error.stack,
        'AIProcessingTask'
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * @method processIncompleteExtractions
   * @purpose Process extractions that are incomplete
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processIncompleteExtractions(): Promise<void> {
    const isEnabled = this.configService.get<boolean>('ENABLE_AI_PROCESSING', true);
    if (!isEnabled) {
      return;
    }

    try {
      // Find incomplete extractions
      const incompleteExtractions = await this.extractionRepository
        .createQueryBuilder('extraction')
        .innerJoin('extraction.email', 'email')
        .where('extraction.isComplete = :isComplete', { isComplete: false })
        .andWhere('extraction.processingAttempts < :maxAttempts', { maxAttempts: 3 })
        .orderBy('extraction.updatedAt', 'ASC')
        .limit(5) // Process fewer for extractions
        .getMany();

      if (incompleteExtractions.length === 0) {
        this.logger.debug('No incomplete extractions found', 'AIProcessingTask');
        return;
      }

      this.logger.log(
        `Reprocessing ${incompleteExtractions.length} incomplete extractions`,
        'AIProcessingTask'
      );

      for (const extraction of incompleteExtractions) {
        try {
          await this.aiService.processEmail(extraction.emailId, extraction.email.userId, {
            skipClassification: true,
            forceReprocess: true,
          });

          this.logger.debug(`Reprocessed extraction ${extraction.id}`, 'AIProcessingTask');
        } catch (error) {
          this.logger.error(
            `Failed to reprocess extraction ${extraction.id}: ${error.message}`,
            error.stack,
            'AIProcessingTask'
          );
        }

        await this.delay(2000); // Longer delay for extractions
      }

    } catch (error) {
      this.logger.error(
        'Error in processIncompleteExtractions task',
        error.stack,
        'AIProcessingTask'
      );
    }
  }

  /**
   * @method cleanupOldProcessingData
   * @purpose Clean up old processing data and logs
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldProcessingData(): Promise<void> {
    try {
      const retentionDays = this.configService.get<number>('AI_DATA_RETENTION_DAYS', 90);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old failed processing attempts
      const deletedClassifications = await this.classificationRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .andWhere('confidence < :minConfidence', { minConfidence: 0.3 })
        .andWhere('isValidated = :isValidated', { isValidated: false })
        .execute();

      const deletedExtractions = await this.extractionRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .andWhere('overallConfidence < :minConfidence', { minConfidence: 0.3 })
        .andWhere('isValidated = :isValidated', { isValidated: false })
        .execute();

      this.logger.log(
        `Cleaned up ${deletedClassifications.affected} old classifications and ${deletedExtractions.affected} old extractions`,
        'AIProcessingTask'
      );

    } catch (error) {
      this.logger.error(
        'Error in cleanupOldProcessingData task',
        error.stack,
        'AIProcessingTask'
      );
    }
  }

  /**
   * @method generateProcessingReport
   * @purpose Generate daily processing report
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateProcessingReport(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get processing statistics for yesterday
      const classificationStats = await this.classificationRepository
        .createQueryBuilder('classification')
        .select([
          'COUNT(*) as total',
          'AVG(confidence) as avgConfidence',
          'COUNT(CASE WHEN isValidated = true THEN 1 END) as validated',
          'COUNT(CASE WHEN isManualOverride = true THEN 1 END) as overridden',
        ])
        .where('createdAt >= :start', { start: yesterday })
        .andWhere('createdAt < :end', { end: today })
        .getRawOne();

      const extractionStats = await this.extractionRepository
        .createQueryBuilder('extraction')
        .select([
          'COUNT(*) as total',
          'AVG(overallConfidence) as avgConfidence',
          'COUNT(CASE WHEN isComplete = true THEN 1 END) as complete',
          'COUNT(CASE WHEN hasManualCorrections = true THEN 1 END) as corrected',
        ])
        .where('createdAt >= :start', { start: yesterday })
        .andWhere('createdAt < :end', { end: today })
        .getRawOne();

      const report = {
        date: yesterday.toISOString().split('T')[0],
        classifications: {
          total: parseInt(classificationStats.total) || 0,
          averageConfidence: parseFloat(classificationStats.avgConfidence) || 0,
          validated: parseInt(classificationStats.validated) || 0,
          overridden: parseInt(classificationStats.overridden) || 0,
        },
        extractions: {
          total: parseInt(extractionStats.total) || 0,
          averageConfidence: parseFloat(extractionStats.avgConfidence) || 0,
          complete: parseInt(extractionStats.complete) || 0,
          corrected: parseInt(extractionStats.corrected) || 0,
        },
      };

      this.logger.log(
        `Daily AI Processing Report: ${JSON.stringify(report)}`,
        'AIProcessingTask'
      );

    } catch (error) {
      this.logger.error(
        'Error in generateProcessingReport task',
        error.stack,
        'AIProcessingTask'
      );
    }
  }

  /**
   * @method retryFailedProcessing
   * @purpose Retry failed processing attempts
   */
  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedProcessing(): Promise<void> {
    const isEnabled = this.configService.get<boolean>('ENABLE_AI_PROCESSING', true);
    if (!isEnabled) {
      return;
    }

    try {
      // Find emails with failed processing (stuck in PROCESSING state)
      const stuckEmails = await this.emailRepository
        .createQueryBuilder('email')
        .where('email.workflowState = :state', { state: WorkflowState.PROCESSING })
        .andWhere('email.updatedAt < :cutoff', { 
          cutoff: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        })
        .limit(5)
        .getMany();

      if (stuckEmails.length === 0) {
        return;
      }

      this.logger.log(
        `Retrying ${stuckEmails.length} stuck processing jobs`,
        'AIProcessingTask'
      );

      for (const email of stuckEmails) {
        try {
          // Reset workflow state
          email.workflowState = WorkflowState.FETCHED;
          await this.emailRepository.save(email);

          // Retry processing
          await this.aiService.processEmail(email.id, email.userId, {
            forceReprocess: true,
          });

          this.logger.debug(`Retried processing for email ${email.id}`, 'AIProcessingTask');
        } catch (error) {
          this.logger.error(
            `Failed to retry processing for email ${email.id}: ${error.message}`,
            error.stack,
            'AIProcessingTask'
          );
        }

        await this.delay(1500);
      }

    } catch (error) {
      this.logger.error(
        'Error in retryFailedProcessing task',
        error.stack,
        'AIProcessingTask'
      );
    }
  }

  /**
   * @method delay
   * @purpose Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}