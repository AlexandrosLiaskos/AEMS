import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { google, gmail_v1 } from 'googleapis';

// Entities
import { User } from '../../../database/entities/user.entity';
import { EmailMessage, WorkflowState } from '../../../database/entities/email-message.entity';
import { AuditLog, AuditAction } from '../../../database/entities/audit-log.entity';

// Services
import { GmailAuthService } from './gmail-auth.service';
import { GmailQuotaService } from './gmail-quota.service';
import { EmailParserService } from './email-parser.service';
import { LoggerService } from '../../../common/services/logger.service';

// DTOs
import { GmailSyncOptionsDto, EmailFiltersDto } from '../dto/gmail.dto';

/**
 * @interface GmailMessage
 * @purpose Gmail API message interface
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: gmail_v1.Schema$MessagePart;
  sizeEstimate: number;
}

/**
 * @interface SyncResult
 * @purpose Email synchronization result
 */
export interface SyncResult {
  success: boolean;
  totalProcessed: number;
  totalAdded: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  errors: Array<{
    messageId: string;
    error: string;
    details?: any;
  }>;
  startedAt: Date;
  completedAt: Date;
  duration: number;
}

/**
 * @class GmailService
 * @purpose Core Gmail API integration service
 */
@Injectable()
export class GmailService {
  private readonly gmail: gmail_v1.Gmail;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EmailMessage)
    private emailRepository: Repository<EmailMessage>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: ConfigService,
    private gmailAuthService: GmailAuthService,
    private gmailQuotaService: GmailQuotaService,
    private emailParserService: EmailParserService,
    private logger: LoggerService,
    private eventEmitter: EventEmitter2
  ) {
    // Initialize Gmail API client
    this.gmail = google.gmail({ version: 'v1' });
  }

  /**
   * @method syncUserEmails
   * @purpose Synchronize emails for a specific user
   */
  async syncUserEmails(
    userId: string,
    options: GmailSyncOptionsDto = {}
  ): Promise<SyncResult> {
    const startedAt = new Date();
    const result: SyncResult = {
      success: false,
      totalProcessed: 0,
      totalAdded: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalFailed: 0,
      errors: [],
      startedAt,
      completedAt: null,
      duration: 0,
    };

    try {
      // Get user and validate Gmail access
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (!user.gmailAccessToken) {
        throw new UnauthorizedException('Gmail access not configured');
      }

      // Set up OAuth2 client
      const auth = await this.gmailAuthService.getAuthClient(user);

      // Check quota before starting
      await this.gmailQuotaService.checkQuota(userId, 'sync', 1);

      // Emit sync started event
      this.eventEmitter.emit('gmail.sync.started', {
        userId,
        options,
        startedAt,
      });

      // Get sync parameters
      const {
        maxResults = 100,
        fullSync = false,
        labelIds = ['INBOX'],
        query = '',
        includeSpamTrash = false,
      } = options;

      // Build Gmail query
      let gmailQuery = query;
      if (!includeSpamTrash) {
        gmailQuery += ' -in:spam -in:trash';
      }

      // Get last sync time for incremental sync
      let lastSyncTime: Date | null = null;
      if (!fullSync) {
        lastSyncTime = user.lastSyncAt;
        if (lastSyncTime) {
          const timestamp = Math.floor(lastSyncTime.getTime() / 1000);
          gmailQuery += ` after:${timestamp}`;
        }
      }

      this.logger.log(
        `Starting Gmail sync for user ${userId}: ${fullSync ? 'full' : 'incremental'} sync`,
        'GmailService',
        { userId, maxResults, gmailQuery, lastSyncTime }
      );

      // List messages
      const listResponse = await this.gmail.users.messages.list({
        auth,
        userId: 'me',
        q: gmailQuery,
        labelIds,
        maxResults,
        includeSpamTrash,
      });

      const messages = listResponse.data.messages || [];
      result.totalProcessed = messages.length;

      this.logger.log(
        `Found ${messages.length} messages to process`,
        'GmailService',
        { userId, messageCount: messages.length }
      );

      // Process messages in batches
      const batchSize = this.configService.get<number>('gmail.batchSize', 10);
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        // Process batch
        const batchResults = await this.processBatch(auth, userId, batch);

        // Update results
        result.totalAdded += batchResults.added;
        result.totalUpdated += batchResults.updated;
        result.totalSkipped += batchResults.skipped;
        result.totalFailed += batchResults.failed;
        result.errors.push(...batchResults.errors);

        // Update quota usage
        await this.gmailQuotaService.recordUsage(userId, 'batch_sync', batch.length);

        // Emit progress event
        this.eventEmitter.emit('gmail.sync.progress', {
          userId,
          processed: i + batch.length,
          total: messages.length,
          progress: Math.round(((i + batch.length) / messages.length) * 100),
        });

        // Small delay to respect rate limits
        if (i + batchSize < messages.length) {
          await this.delay(100);
        }
      }

      // Update user's last sync time
      user.lastSyncAt = new Date();
      user.totalEmailsProcessed += result.totalAdded;
      await this.userRepository.save(user);

      // Mark as successful
      result.success = result.totalFailed === 0 || result.totalAdded > 0;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startedAt.getTime();

      // Log sync completion
      await this.logSyncEvent(userId, result);

      // Emit sync completed event
      this.eventEmitter.emit('gmail.sync.completed', {
        userId,
        result,
      });

      this.logger.log(
        `Gmail sync completed for user ${userId}: ${result.totalAdded} added, ${result.totalUpdated} updated, ${result.totalFailed} failed`,
        'GmailService',
        { userId, result }
      );

      return result;
    } catch (error) {
      result.success = false;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startedAt.getTime();
      result.errors.push({
        messageId: 'sync_error',
        error: error.message,
        details: error.stack,
      });

      this.logger.error(
        `Gmail sync failed for user ${userId}`,
        error.stack,
        'GmailService',
        { userId, error: error.message }
      );

      // Log sync failure
      await this.logSyncEvent(userId, result);

      // Emit sync failed event
      this.eventEmitter.emit('gmail.sync.failed', {
        userId,
        error: error.message,
        result,
      });

      throw error;
    }
  }

  /**
   * @method getEmailById
   * @purpose Get specific email by Gmail ID
   */
  async getEmailById(userId: string, gmailId: string): Promise<GmailMessage> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.gmailAccessToken) {
        throw new UnauthorizedException('Gmail access not configured');
      }

      const auth = await this.gmailAuthService.getAuthClient(user);

      const response = await this.gmail.users.messages.get({
        auth,
        userId: 'me',
        id: gmailId,
        format: 'full',
      });

      await this.gmailQuotaService.recordUsage(userId, 'api_call', 1);

      return response.data as GmailMessage;
    } catch (error) {
      this.logger.error(
        `Failed to get email ${gmailId} for user ${userId}`,
        error.stack,
        'GmailService'
      );
      throw error;
    }
  }

  /**
   * @method searchEmails
   * @purpose Search emails using Gmail query syntax
   */
  async searchEmails(
    userId: string,
    query: string,
    maxResults = 50
  ): Promise<gmail_v1.Schema$Message[]> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.gmailAccessToken) {
        throw new UnauthorizedException('Gmail access not configured');
      }

      const auth = await this.gmailAuthService.getAuthClient(user);

      const response = await this.gmail.users.messages.list({
        auth,
        userId: 'me',
        q: query,
        maxResults,
      });

      await this.gmailQuotaService.recordUsage(userId, 'api_call', 1);

      return response.data.messages || [];
    } catch (error) {
      this.logger.error(
        `Failed to search emails for user ${userId}`,
        error.stack,
        'GmailService'
      );
      throw error;
    }
  }

  /**
   * @method getUserProfile
   * @purpose Get Gmail user profile information
   */
  async getUserProfile(userId: string): Promise<gmail_v1.Schema$Profile> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.gmailAccessToken) {
        throw new UnauthorizedException('Gmail access not configured');
      }

      const auth = await this.gmailAuthService.getAuthClient(user);

      const response = await this.gmail.users.getProfile({
        auth,
        userId: 'me',
      });

      await this.gmailQuotaService.recordUsage(userId, 'api_call', 1);

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get Gmail profile for user ${userId}`,
        error.stack,
        'GmailService'
      );
      throw error;
    }
  }

  /**
   * @method getLabels
   * @purpose Get Gmail labels for user
   */
  async getLabels(userId: string): Promise<gmail_v1.Schema$Label[]> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.gmailAccessToken) {
        throw new UnauthorizedException('Gmail access not configured');
      }

      const auth = await this.gmailAuthService.getAuthClient(user);

      const response = await this.gmail.users.labels.list({
        auth,
        userId: 'me',
      });

      await this.gmailQuotaService.recordUsage(userId, 'api_call', 1);

      return response.data.labels || [];
    } catch (error) {
      this.logger.error(
        `Failed to get Gmail labels for user ${userId}`,
        error.stack,
        'GmailService'
      );
      throw error;
    }
  }

  /**
   * @method processBatch
   * @purpose Process a batch of Gmail messages
   */
  private async processBatch(
    auth: any,
    userId: string,
    messages: gmail_v1.Schema$Message[]
  ): Promise<{
    added: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ messageId: string; error: string; details?: any }>;
  }> {
    const result = {
      added: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const message of messages) {
      try {
        // Check if email already exists
        const existingEmail = await this.emailRepository.findOne({
          where: { gmailId: message.id, userId },
        });

        if (existingEmail) {
          result.skipped++;
          continue;
        }

        // Get full message details
        const fullMessage = await this.gmail.users.messages.get({
          auth,
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        // Parse email
        const parsedEmail = await this.emailParserService.parseGmailMessage(
          fullMessage.data as GmailMessage,
          userId
        );

        // Save email
        const savedEmail = await this.emailRepository.save(parsedEmail);

        result.added++;

        // Emit email added event
        this.eventEmitter.emit('gmail.email.added', {
          userId,
          emailId: savedEmail.id,
          gmailId: message.id,
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          messageId: message.id,
          error: error.message,
          details: error.stack,
        });

        this.logger.error(
          `Failed to process message ${message.id}`,
          error.stack,
          'GmailService'
        );
      }
    }

    return result;
  }

  /**
   * @method logSyncEvent
   * @purpose Log sync event to audit log
   */
  private async logSyncEvent(userId: string, result: SyncResult): Promise<void> {
    try {
      const auditLogData = {
        action: result.success ? AuditAction.SYNC_COMPLETED : AuditAction.SYNC_FAILED,
        resourceType: 'gmail_sync',
        resourceId: userId,
        description: result.success
          ? `Gmail sync completed: ${result.totalAdded} emails added`
          : `Gmail sync failed: ${result.errors.length} errors`,
        context: {
          duration: result.duration,
          metadata: {
            totalProcessed: result.totalProcessed,
            totalAdded: result.totalAdded,
            totalFailed: result.totalFailed,
          },
        },
        userId,
        performedBy: 'system',
        isSuccessful: result.success,
        errorMessage: result.success ? null : result.errors[0]?.error,
      };

      await this.auditLogRepository.create(auditLogData);
    } catch (error) {
      this.logger.error('Failed to log sync event', error.stack, 'GmailService');
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
