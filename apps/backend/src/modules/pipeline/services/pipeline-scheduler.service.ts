import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/services/logger.service';
import { EmailProcessingPipelineService, PipelineOptions } from './pipeline.service';
import { UserRepository } from '../../database/repositories/user.repository';

/**
 * @interface ScheduleConfig
 * @purpose Configuration for pipeline scheduling
 */
export interface ScheduleConfig {
  enabled: boolean;
  interval: number; // milliseconds
  batchSize: number;
  skipExtraction: boolean;
  onlyActiveUsers: boolean;
}

/**
 * @class PipelineSchedulerService
 * @purpose Service for scheduling automatic pipeline execution
 */
@Injectable()
export class PipelineSchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: ScheduleConfig;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private pipelineService: EmailProcessingPipelineService,
    private userRepository: UserRepository,
  ) {
    this.config = {
      enabled: this.configService.get('pipeline.scheduler.enabled', false),
      interval: this.configService.get('pipeline.scheduler.interval', 5 * 60 * 1000), // 5 minutes
      batchSize: this.configService.get('pipeline.scheduler.batchSize', 5),
      skipExtraction: this.configService.get('pipeline.scheduler.skipExtraction', true),
      onlyActiveUsers: this.configService.get('pipeline.scheduler.onlyActiveUsers', true),
    };
  }

  /**
   * @method onModuleInit
   * @purpose Initialize the scheduler when module loads
   */
  async onModuleInit(): Promise<void> {
    if (this.config.enabled) {
      this.startScheduler();
    } else {
      this.logger.log('Pipeline scheduler is disabled', 'PipelineScheduler');
    }
  }

  /**
   * @method onModuleDestroy
   * @purpose Clean up when module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    this.stopScheduler();
  }

  /**
   * @method startScheduler
   * @purpose Start the automatic pipeline scheduler
   */
  startScheduler(): void {
    if (this.intervalId) {
      this.logger.warn('Scheduler is already running', 'PipelineScheduler');
      return;
    }

    this.logger.log(`Starting pipeline scheduler (interval: ${this.config.interval}ms)`, 'PipelineScheduler');

    this.intervalId = setInterval(async () => {
      await this.runScheduledPipeline();
    }, this.config.interval);
  }

  /**
   * @method stopScheduler
   * @purpose Stop the automatic pipeline scheduler
   */
  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Pipeline scheduler stopped', 'PipelineScheduler');
    }
  }

  /**
   * @method runScheduledPipeline
   * @purpose Run the pipeline for all eligible users
   */
  private async runScheduledPipeline(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Scheduled pipeline already running, skipping', 'PipelineScheduler');
      return;
    }

    this.isRunning = true;

    try {
      this.logger.debug('Running scheduled pipeline', 'PipelineScheduler');

      // Get eligible users
      const users = this.config.onlyActiveUsers 
        ? await this.userRepository.findActiveUsers()
        : await this.userRepository.findAll();

      const eligibleUsers = users.filter(user => 
        user.googleTokens && user.googleTokens.accessToken
      );

      if (eligibleUsers.length === 0) {
        this.logger.debug('No eligible users for scheduled pipeline', 'PipelineScheduler');
        return;
      }

      this.logger.log(`Running scheduled pipeline for ${eligibleUsers.length} users`, 'PipelineScheduler');

      // Run pipeline for each user (sequentially to avoid overwhelming the system)
      for (const user of eligibleUsers) {
        try {
          await this.runPipelineForUser(user.id);
        } catch (error) {
          this.logger.error(
            `Scheduled pipeline failed for user ${user.id}: ${error.message}`, 
            'PipelineScheduler'
          );
          // Continue with other users
        }
      }

      this.logger.log('Scheduled pipeline completed for all users', 'PipelineScheduler');

    } catch (error) {
      this.logger.error(`Scheduled pipeline failed: ${error.message}`, 'PipelineScheduler', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * @method runPipelineForUser
   * @purpose Run pipeline for a specific user
   */
  private async runPipelineForUser(userId: string): Promise<void> {
    // Check if user already has a pipeline running
    const status = this.pipelineService.getPipelineStatus();
    if (status.isRunning) {
      this.logger.debug(`Pipeline already running, skipping user ${userId}`, 'PipelineScheduler');
      return;
    }

    const options: PipelineOptions = {
      userId,
      batchSize: this.config.batchSize,
      skipSync: false,
      skipClassification: false,
      skipExtraction: this.config.skipExtraction,
      forceReprocess: false,
    };

    try {
      const result = await this.pipelineService.runPipeline(options);
      
      if (result.processed > 0) {
        this.logger.log(
          `Scheduled pipeline for user ${userId}: processed ${result.processed} emails`, 
          'PipelineScheduler'
        );
      } else {
        this.logger.debug(`No emails to process for user ${userId}`, 'PipelineScheduler');
      }

    } catch (error) {
      this.logger.error(
        `Pipeline failed for user ${userId}: ${error.message}`, 
        'PipelineScheduler'
      );
      throw error;
    }
  }

  /**
   * @method updateConfig
   * @purpose Update scheduler configuration
   */
  updateConfig(newConfig: Partial<ScheduleConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };

    // Restart scheduler if interval changed or enabled status changed
    if (wasEnabled && this.config.enabled) {
      this.stopScheduler();
      this.startScheduler();
    } else if (!wasEnabled && this.config.enabled) {
      this.startScheduler();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopScheduler();
    }

    this.logger.log('Pipeline scheduler configuration updated', 'PipelineScheduler', this.config);
  }

  /**
   * @method getConfig
   * @purpose Get current scheduler configuration
   */
  getConfig(): ScheduleConfig {
    return { ...this.config };
  }

  /**
   * @method getStatus
   * @purpose Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    nextRun: Date | null;
    config: ScheduleConfig;
  } {
    const nextRun = this.intervalId 
      ? new Date(Date.now() + this.config.interval)
      : null;

    return {
      enabled: this.config.enabled,
      running: this.intervalId !== null,
      nextRun,
      config: this.config,
    };
  }

  /**
   * @method runNow
   * @purpose Manually trigger scheduled pipeline
   */
  async runNow(): Promise<void> {
    this.logger.log('Manually triggering scheduled pipeline', 'PipelineScheduler');
    await this.runScheduledPipeline();
  }
}