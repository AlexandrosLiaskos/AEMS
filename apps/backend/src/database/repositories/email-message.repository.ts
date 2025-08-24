import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { EmailMessage, WorkflowState, Priority } from '../entities/email-message.entity';
import { LoggerService } from '../../common/services/logger.service';
import { AppDataService } from '../../common/services/app-data.service';
import { FileService } from '../../common/services/file.service';

/**
 * @class EmailMessageRepository
 * @purpose Repository for EmailMessage entity operations
 */
@Injectable()
export class EmailMessageRepository extends BaseRepository<EmailMessage> {
  protected readonly fileName = 'email-messages.json';

  constructor(
    logger: LoggerService,
    appDataService: AppDataService,
    fileService: FileService,
  ) {
    super(logger, appDataService, fileService);
    this.initializeFilePath();
  }

  /**
   * @method findByUserId
   * @purpose Find emails by user ID
   */
  async findByUserId(userId: string, options?: {
    limit?: number;
    offset?: number;
    workflowState?: WorkflowState;
    isRead?: boolean;
    priority?: Priority;
  }): Promise<EmailMessage[]> {
    const where: any = { userId };

    if (options?.workflowState) {
      where.workflowState = options.workflowState;
    }
    if (options?.isRead !== undefined) {
      where.isRead = options.isRead;
    }
    if (options?.priority) {
      where.priority = options.priority;
    }

    return this.findAll({
      where,
      limit: options?.limit,
      offset: options?.offset,
      orderBy: { field: 'date', direction: 'DESC' },
    });
  }

  /**
   * @method findByGmailId
   * @purpose Find email by Gmail ID
   */
  async findByGmailId(gmailId: string): Promise<EmailMessage | null> {
    return this.findOne({ gmailId });
  }

  /**
   * @method findByThreadId
   * @purpose Find emails by thread ID
   */
  async findByThreadId(threadId: string): Promise<EmailMessage[]> {
    return this.findAll({
      where: { threadId },
      orderBy: { field: 'date', direction: 'ASC' },
    });
  }

  /**
   * @method findByWorkflowState
   * @purpose Find emails by workflow state
   */
  async findByWorkflowState(workflowState: WorkflowState, userId?: string): Promise<EmailMessage[]> {
    const where: any = { workflowState };
    if (userId) {
      where.userId = userId;
    }

    return this.findAll({
      where,
      orderBy: { field: 'updatedAt', direction: 'ASC' },
    });
  }

  /**
   * @method findUnreadEmails
   * @purpose Find unread emails for user
   */
  async findUnreadEmails(userId: string): Promise<EmailMessage[]> {
    return this.findAll({
      where: { userId, isRead: false },
      orderBy: { field: 'date', direction: 'DESC' },
    });
  }

  /**
   * @method findStarredEmails
   * @purpose Find starred emails for user
   */
  async findStarredEmails(userId: string): Promise<EmailMessage[]> {
    return this.findAll({
      where: { userId, isStarred: true },
      orderBy: { field: 'date', direction: 'DESC' },
    });
  }

  /**
   * @method findEmailsWithAttachments
   * @purpose Find emails that have attachments
   */
  async findEmailsWithAttachments(userId: string): Promise<EmailMessage[]> {
    const allEmails = await this.findByUserId(userId);
    return allEmails.filter(email => email.attachments && email.attachments.length > 0);
  }

  /**
   * @method findEmailsByDateRange
   * @purpose Find emails within date range
   */
  async findEmailsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EmailMessage[]> {
    const allEmails = await this.findByUserId(userId);
    return allEmails.filter(email =>
      email.date >= startDate && email.date <= endDate
    );
  }

  /**
   * @method findEmailsByTag
   * @purpose Find emails by tag
   */
  async findEmailsByTag(userId: string, tag: string): Promise<EmailMessage[]> {
    const allEmails = await this.findByUserId(userId);
    return allEmails.filter(email =>
      email.tags && email.tags.includes(tag)
    );
  }

  /**
   * @method searchEmails
   * @purpose Search emails by subject or body content
   */
  async searchEmails(userId: string, query: string): Promise<EmailMessage[]> {
    const allEmails = await this.findByUserId(userId);
    const lowerQuery = query.toLowerCase();

    return allEmails.filter(email =>
      email.subject.toLowerCase().includes(lowerQuery) ||
      email.body.toLowerCase().includes(lowerQuery) ||
      (typeof email.from === 'string' ? email.from : email.from.email).toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * @method markAsRead
   * @purpose Mark email as read
   */
  async markAsRead(emailId: string): Promise<EmailMessage | null> {
    return this.update(emailId, { isRead: true });
  }

  /**
   * @method markAsUnread
   * @purpose Mark email as unread
   */
  async markAsUnread(emailId: string): Promise<EmailMessage | null> {
    return this.update(emailId, { isRead: false });
  }

  /**
   * @method toggleStar
   * @purpose Toggle email star status
   */
  async toggleStar(emailId: string): Promise<EmailMessage | null> {
    const email = await this.findById(emailId);
    if (!email) return null;

    return this.update(emailId, { isStarred: !email.isStarred });
  }

  /**
   * @method addTag
   * @purpose Add tag to email
   */
  async addTag(emailId: string, tag: string): Promise<EmailMessage | null> {
    const email = await this.findById(emailId);
    if (!email) return null;

    const tags = email.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      return this.update(emailId, { tags });
    }

    return email;
  }

  /**
   * @method removeTag
   * @purpose Remove tag from email
   */
  async removeTag(emailId: string, tag: string): Promise<EmailMessage | null> {
    const email = await this.findById(emailId);
    if (!email) return null;

    const tags = email.tags || [];
    const updatedTags = tags.filter(t => t !== tag);

    return this.update(emailId, { tags: updatedTags });
  }

  /**
   * @method updateWorkflowState
   * @purpose Update email workflow state
   */
  async updateWorkflowState(emailId: string, workflowState: WorkflowState): Promise<EmailMessage | null> {
    return this.update(emailId, { workflowState });
  }

  /**
   * @method getEmailStats
   * @purpose Get email statistics for user
   */
  async getEmailStats(userId: string): Promise<{
    total: number;
    unread: number;
    starred: number;
    withAttachments: number;
    byWorkflowState: Record<WorkflowState, number>;
    byPriority: Record<Priority, number>;
    todayCount: number;
    thisWeekCount: number;
    thisMonthCount: number;
  }> {
    const allEmails = await this.findByUserId(userId);

    const unread = allEmails.filter(e => !e.isRead).length;
    const starred = allEmails.filter(e => e.isStarred).length;
    const withAttachments = allEmails.filter(e => e.attachments && e.attachments.length > 0).length;

    // Count by workflow state
    const byWorkflowState: Record<WorkflowState, number> = {
      [WorkflowState.FETCHED]: 0,
      [WorkflowState.PROCESSING]: 0,
      [WorkflowState.CLASSIFIED]: 0,
      [WorkflowState.EXTRACTED]: 0,
      [WorkflowState.REVIEW]: 0,
      [WorkflowState.APPROVED]: 0,
      [WorkflowState.ARCHIVED]: 0,
      [WorkflowState.COMPLETED]: 0,
      [WorkflowState.ERROR]: 0,
    };
    allEmails.forEach(email => {
      byWorkflowState[email.workflowState]++;
    });

    // Count by priority
    const byPriority: Record<Priority, number> = {
      [Priority.LOW]: 0,
      [Priority.NORMAL]: 0,
      [Priority.HIGH]: 0,
      [Priority.URGENT]: 0,
    };
    allEmails.forEach(email => {
      byPriority[email.priority]++;
    });

    // Date-based counts
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayCount = allEmails.filter(e => e.date >= today).length;
    const thisWeekCount = allEmails.filter(e => e.date >= thisWeek).length;
    const thisMonthCount = allEmails.filter(e => e.date >= thisMonth).length;

    return {
      total: allEmails.length,
      unread,
      starred,
      withAttachments,
      byWorkflowState,
      byPriority,
      todayCount,
      thisWeekCount,
      thisMonthCount,
    };
  }

  /**
   * @method getProcessingQueue
   * @purpose Get emails that need processing
   */
  async getProcessingQueue(limit: number = 10): Promise<EmailMessage[]> {
    return this.findAll({
      where: { workflowState: WorkflowState.FETCHED },
      orderBy: { field: 'createdAt', direction: 'ASC' },
      limit,
    });
  }

  /**
   * @method getErroredEmails
   * @purpose Get emails that failed processing
   */
  async getErroredEmails(userId?: string): Promise<EmailMessage[]> {
    const where: any = { workflowState: WorkflowState.ERROR };
    if (userId) {
      where.userId = userId;
    }

    return this.findAll({
      where,
      orderBy: { field: 'updatedAt', direction: 'DESC' },
    });
  }
}
