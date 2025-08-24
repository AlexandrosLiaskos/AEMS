import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { LoggerService } from '../../../common/services/logger.service';
import { GoogleAuthService, GoogleTokens } from '../../auth/services/google-auth.service';
import { EmailMessage, WorkflowState } from '../../../database/entities/email-message.entity';
import { EventService } from '../../../common/services/event.service';
import { EmailMessageRepository } from '../../../database/repositories/email-message.repository';
import { EmailParserService } from './email-parser.service';

/**
 * @interface SyncOptions
 * @purpose Gmail synchronization options
 */
export interface SyncOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
  syncAttachments?: boolean;
  fullSync?: boolean;
}

/**
 * @interface SyncResult
 * @purpose Gmail synchronization result
 */
export interface SyncResult {
  success: boolean;
  emailsProcessed: number;
  emailsAdded: number;
  emailsUpdated: number;
  emailsSkipped: number;
  errors: Array<{
    messageId: string;
    error: string;
  }>;
  duration: number;
  nextPageToken?: string;
}

/**
 * @interface GmailMessage
 * @purpose Gmail message structure
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
 * @class GmailSyncService
 * @purpose Gmail synchronization service
 */
@Injectable()
export class GmailSyncService {
  private readonly maxBatchSize: number;
  private readonly syncInterval: number;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private googleAuthService: GoogleAuthService,
    private eventService: EventService,
    private emailMessageRepository: EmailMessageRepository,
    private emailParserService: EmailParserService,
  ) {
    this.maxBatchSize = this.configService.get<number>('GMAIL_BATCH_SIZE', 50);
    this.syncInterval = this.configService.get<number>('GMAIL_SYNC_INTERVAL', 5 * 60 * 1000); // 5 minutes
  }

  /**
   * @method syncEmails
   * @purpose Synchronize emails from Gmail
   */
  async syncEmails(
    userId: string,
    tokens: GoogleTokens,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      emailsProcessed: 0,
      emailsAdded: 0,
      emailsUpdated: 0,
      emailsSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.logger.info('Starting Gmail sync', 'GmailSyncService', {
        userId,
        options,
      });

      // Get authenticated Gmail client
      const gmail = await this.getGmailClient(tokens);

      // List messages
      const messages = await this.listMessages(gmail, options);

      if (!messages || messages.length === 0) {
        this.logger.info('No messages found to sync', 'GmailSyncService');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Process messages in batches
      const batches = this.createBatches(messages, this.maxBatchSize);

      for (const batch of batches) {
        const batchResult = await this.processBatch(gmail, batch, userId, options);

        result.emailsProcessed += batchResult.processed;
        result.emailsAdded += batchResult.added;
        result.emailsUpdated += batchResult.updated;
        result.emailsSkipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      this.logger.info('Gmail sync completed', 'GmailSyncService', {
        userId,
        result,
      });

      // Emit sync completed event
      this.eventService.emit('gmail.sync.completed', {
        type: 'gmail.sync.completed',
        payload: { userId, result },
        userId,
      });

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      this.logger.error(`Gmail sync failed: ${error.message}`, error.stack, 'GmailSyncService', {
        userId,
        error: error.message,
      });

      // Emit sync failed event
      this.eventService.emit('gmail.sync.failed', {
        type: 'gmail.sync.failed',
        payload: { userId, error: error.message },
        userId,
      });

      throw error;
    }
  }

  /**
   * @method getGmailClient
   * @purpose Get authenticated Gmail client
   */
  private async getGmailClient(tokens: GoogleTokens): Promise<gmail_v1.Gmail> {
    try {
      const auth = this.googleAuthService.getAuthenticatedClient(tokens);
      return google.gmail({ version: 'v1', auth });
    } catch (error) {
      this.logger.error(`Failed to create Gmail client: ${error.message}`, 'GmailSyncService');
      throw new Error('Failed to authenticate with Gmail');
    }
  }

  /**
   * @method listMessages
   * @purpose List messages from Gmail
   */
  private async listMessages(
    gmail: gmail_v1.Gmail,
    options: SyncOptions
  ): Promise<gmail_v1.Schema$Message[]> {
    try {
      const listParams: gmail_v1.Params$Resource$Users$Messages$List = {
        userId: 'me',
        maxResults: options.maxResults || 100,
        q: options.query,
        labelIds: options.labelIds,
        includeSpamTrash: options.includeSpamTrash || false,
      };

      const response = await gmail.users.messages.list(listParams);
      return response.data.messages || [];

    } catch (error) {
      this.logger.error(`Failed to list messages: ${error.message}`, 'GmailSyncService');
      throw error;
    }
  }

  /**
   * @method processBatch
   * @purpose Process a batch of messages
   */
  private async processBatch(
    gmail: gmail_v1.Gmail,
    messageIds: string[],
    userId: string,
    options: SyncOptions
  ): Promise<{
    processed: number;
    added: number;
    updated: number;
    skipped: number;
    errors: Array<{ messageId: string; error: string }>;
  }> {
    const batchResult = {
      processed: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const messageId of messageIds) {
      try {
        const message = await this.getMessage(gmail, messageId);

        if (!message) {
          batchResult.skipped++;
          continue;
        }

        const emailMessage = await this.convertToEmailMessage(message, userId);

        // Check if email already exists
        const existingEmail = await this.findExistingEmail(emailMessage.gmailId, userId);

        if (existingEmail) {
          // Update existing email if needed
          const updated = await this.updateEmailMessage(existingEmail, emailMessage);
          if (updated) {
            batchResult.updated++;
          } else {
            batchResult.skipped++;
          }
        } else {
          // Add new email
          await this.saveEmailMessage(emailMessage);
          batchResult.added++;
        }

        batchResult.processed++;

      } catch (error) {
        batchResult.errors.push({
          messageId,
          error: error.message,
        });
        this.logger.warn(`Failed to process message ${messageId}: ${error.message}`, 'GmailSyncService');
      }
    }

    return batchResult;
  }

  /**
   * @method getMessage
   * @purpose Get full message details from Gmail
   */
  private async getMessage(gmail: gmail_v1.Gmail, messageId: string): Promise<GmailMessage | null> {
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data as GmailMessage;

    } catch (error) {
      this.logger.warn(`Failed to get message ${messageId}: ${error.message}`, 'GmailSyncService');
      return null;
    }
  }

  /**
   * @method convertToEmailMessage
   * @purpose Convert Gmail message to EmailMessage entity
   */
  private async convertToEmailMessage(gmailMessage: GmailMessage, userId: string): Promise<EmailMessage> {
    const headers = gmailMessage.payload.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const emailMessage = new EmailMessage();
    emailMessage.gmailId = gmailMessage.id;
    emailMessage.threadId = gmailMessage.threadId;
    emailMessage.subject = getHeader('Subject') || '(No Subject)';
    emailMessage.from = this.emailParserService.parseEmailAddress(getHeader('From'));
    emailMessage.to = this.emailParserService.parseEmailAddressList(getHeader('To'));
    emailMessage.date = new Date(parseInt(gmailMessage.internalDate));
    emailMessage.userId = userId;
    emailMessage.workflowState = WorkflowState.FETCHED;

    // Extract body content
    const bodyData = this.extractBodyContent(gmailMessage.payload);
    emailMessage.body = bodyData.text || gmailMessage.snippet || '';
    emailMessage.htmlBody = bodyData.html;

    // Extract attachments
    emailMessage.attachments = this.extractAttachments(gmailMessage.payload);

    return emailMessage;
  }

  /**
   * @method extractBodyContent
   * @purpose Extract text and HTML content from message payload
   */
  private extractBodyContent(payload: gmail_v1.Schema$MessagePart): { text?: string; html?: string } {
    const result: { text?: string; html?: string } = {};

    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        result.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        result.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    extractFromPart(payload);
    return result;
  }

  /**
   * @method extractAttachments
   * @purpose Extract attachment information from message payload
   */
  private extractAttachments(payload: gmail_v1.Schema$MessagePart): Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> {
    const attachments: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }> = [];

    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    extractFromPart(payload);
    return attachments;
  }

  /**
   * @method createBatches
   * @purpose Create batches from message list
   */
  private createBatches(messages: gmail_v1.Schema$Message[], batchSize: number): string[][] {
    const batches: string[][] = [];
    const messageIds = messages.map(m => m.id).filter(Boolean) as string[];

    for (let i = 0; i < messageIds.length; i += batchSize) {
      batches.push(messageIds.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * @method findExistingEmail
   * @purpose Find existing email by Gmail ID
   */
  private async findExistingEmail(gmailId: string, userId: string): Promise<EmailMessage | null> {
    return this.emailMessageRepository.findByGmailId(gmailId);
  }

  /**
   * @method updateEmailMessage
   * @purpose Update existing email message
   */
  private async updateEmailMessage(existing: EmailMessage, updated: EmailMessage): Promise<boolean> {
    // Check if update is needed (compare relevant fields)
    if (existing.subject !== updated.subject ||
        existing.body !== updated.body ||
        existing.workflowState !== updated.workflowState) {

      await this.emailMessageRepository.update(existing.id, {
        subject: updated.subject,
        body: updated.body,
        htmlBody: updated.htmlBody,
        attachments: updated.attachments,
        workflowState: updated.workflowState,
      });

      return true;
    }

    return false;
  }

  /**
   * @method saveEmailMessage
   * @purpose Save new email message
   */
  private async saveEmailMessage(emailMessage: EmailMessage): Promise<void> {
    // Create a plain object with only the data properties needed for the repository
    // Cast to any to bypass the method requirements since this is a file-based repository
    const emailData: any = {
      gmailId: emailMessage.gmailId,
      threadId: emailMessage.threadId,
      subject: emailMessage.subject,
      from: emailMessage.from,
      to: emailMessage.to,
      cc: emailMessage.cc,
      bcc: emailMessage.bcc,
      body: emailMessage.body,
      bodyText: emailMessage.bodyText,
      bodyHtml: emailMessage.bodyHtml,
      htmlBody: emailMessage.htmlBody,
      snippet: emailMessage.snippet,
      date: emailMessage.date,
      receivedAt: emailMessage.receivedAt,
      fetchedAt: emailMessage.fetchedAt,
      processedAt: emailMessage.processedAt,
      reviewedAt: emailMessage.reviewedAt,
      reviewedBy: emailMessage.reviewedBy,
      reviewNotes: emailMessage.reviewNotes,
      isRead: emailMessage.isRead,
      isStarred: emailMessage.isStarred,
      isImportant: emailMessage.isImportant,
      priority: emailMessage.priority,
      tags: emailMessage.tags,
      labels: emailMessage.labels,
      metadata: emailMessage.metadata,
      headers: emailMessage.headers,
      customFields: emailMessage.customFields,
      attachments: emailMessage.attachments,
      workflowState: emailMessage.workflowState,
      processingAttempts: emailMessage.processingAttempts,
      lastProcessingError: emailMessage.lastProcessingError,
      userId: emailMessage.userId,
    };
    
    await this.emailMessageRepository.create(emailData);

    this.logger.debug('Email message saved', 'GmailSyncService', {
      gmailId: emailMessage.gmailId,
      subject: emailMessage.subject,
    });
  }

  /**
   * @method startAutoSync
   * @purpose Start automatic synchronization
   */
  startAutoSync(userId: string, tokens: GoogleTokens, options: SyncOptions = {}): void {
    if (this.syncTimer) {
      this.stopAutoSync();
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncEmails(userId, tokens, options);
      } catch (error) {
        this.logger.error(`Auto sync failed: ${error.message}`, 'GmailSyncService');
      }
    }, this.syncInterval);

    this.logger.info('Auto sync started', 'GmailSyncService', {
      userId,
      interval: this.syncInterval,
    });
  }

  /**
   * @method stopAutoSync
   * @purpose Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.logger.info('Auto sync stopped', 'GmailSyncService');
    }
  }

  /**
   * @method onModuleDestroy
   * @purpose Cleanup on module destruction
   */
  onModuleDestroy(): void {
    this.stopAutoSync();
  }
}
