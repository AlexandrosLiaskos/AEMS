import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Classification } from './classification.entity';
import { Extraction } from './extraction.entity';
import { WorkflowTransition } from './workflow-transition.entity';

/**
 * @interface EmailAddress
 * @purpose Email address structure
 */
export interface EmailAddress {
  name?: string;
  email: string;
}

/**
 * @interface EmailHeaders
 * @purpose Email headers structure
 */
export interface EmailHeaders {
  messageId?: string;
  references?: string[];
  inReplyTo?: string;
  [key: string]: any;
}

/**
 * @interface EmailMetadata
 * @purpose Email metadata structure
 */
export interface EmailMetadata {
  size?: number;
  headers?: EmailHeaders;
  labels?: string[];
  threadLength?: number;
  [key: string]: any;
}

/**
 * @enum WorkflowState
 * @purpose Email processing workflow states
 */
export enum WorkflowState {
  FETCHED = 'FETCHED',
  PROCESSING = 'PROCESSING',
  CLASSIFIED = 'CLASSIFIED',
  EXTRACTED = 'EXTRACTED',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

/**
 * @enum Priority
 * @purpose Email priority levels
 */
export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * @class EmailMessage
 * @purpose Email message entity
 */
@Entity('email_messages')
export class EmailMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gmailId: string;

  @Column()
  threadId: string;

  @Column()
  subject: string;

  @Column({ type: 'json' })
  from: EmailAddress;

  @Column({ type: 'json', nullable: true })
  to?: EmailAddress[];

  @Column({ type: 'json', nullable: true })
  cc?: EmailAddress[];

  @Column({ type: 'json', nullable: true })
  bcc?: EmailAddress[];

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  bodyText?: string;

  @Column({ type: 'text', nullable: true })
  bodyHtml?: string;

  @Column({ type: 'text', nullable: true })
  htmlBody?: string;

  @Column({ nullable: true })
  snippet?: string;

  @Column({ type: 'datetime' })
  date: Date;

  @Column({ nullable: true })
  receivedAt?: Date;

  @Column({ nullable: true })
  fetchedAt?: Date;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes?: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isStarred: boolean;

  @Column({ default: false })
  isImportant: boolean;

  @Column({
    type: 'enum',
    enum: Priority,
    default: Priority.NORMAL,
  })
  priority: Priority;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ type: 'json', nullable: true })
  labels?: string[];

  @Column({ type: 'json', nullable: true })
  metadata?: EmailMetadata;

  @Column({ type: 'json', nullable: true })
  headers?: EmailHeaders;

  @Column({ type: 'json', nullable: true })
  customFields?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;

  @Column({
    type: 'enum',
    enum: WorkflowState,
    default: WorkflowState.FETCHED,
  })
  workflowState: WorkflowState;

  @Column({ default: 0 })
  processingAttempts: number;

  @Column({ type: 'text', nullable: true })
  lastProcessingError?: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, user => user.emails)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => Classification, classification => classification.email)
  classification?: Classification;

  @OneToOne(() => Extraction, extraction => extraction.email)
  extraction?: Extraction;

  @OneToMany(() => WorkflowTransition, transition => transition.email)
  workflowTransitions?: WorkflowTransition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * @method getFromEmail
   * @purpose Get from email address as string
   */
  getFromEmail(): string {
    return typeof this.from === 'string' ? this.from : this.from.email;
  }

  /**
   * @method getFromName
   * @purpose Get from name
   */
  getFromName(): string {
    return typeof this.from === 'string' ? this.from : (this.from.name || this.from.email);
  }

  /**
   * @method getToEmails
   * @purpose Get to email addresses as string array
   */
  getToEmails(): string[] {
    if (!this.to) return [];
    return Array.isArray(this.to) ? this.to.map(addr => typeof addr === 'string' ? addr : addr.email) : [];
  }

  /**
   * @method markAsRead
   * @purpose Mark email as read
   */
  markAsRead(): void {
    this.isRead = true;
  }

  /**
   * @method markAsUnread
   * @purpose Mark email as unread
   */
  markAsUnread(): void {
    this.isRead = false;
  }

  /**
   * @method toggleStar
   * @purpose Toggle star status
   */
  toggleStar(): void {
    this.isStarred = !this.isStarred;
  }

  /**
   * @method setPriority
   * @purpose Set email priority
   */
  setPriority(priority: Priority): void {
    this.priority = priority;
  }

  /**
   * @method addTag
   * @purpose Add tag to email
   */
  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * @method removeTag
   * @purpose Remove tag from email
   */
  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
    }
  }

  /**
   * @method transitionTo
   * @purpose Transition to new workflow state
   */
  transitionTo(newState: WorkflowState, reason?: string, userId?: string): void {
    this.workflowState = newState;

    // Update timestamps based on state
    switch (newState) {
      case WorkflowState.PROCESSING:
        this.processedAt = new Date();
        break;
      case WorkflowState.COMPLETED:
        this.processedAt = new Date();
        break;
      case WorkflowState.REVIEW:
        this.reviewedAt = new Date();
        if (userId) {
          this.reviewedBy = userId;
        }
        break;
    }

    // Store reason in review notes if provided
    if (reason) {
      this.reviewNotes = reason;
    }
  }

  /**
   * @method isProcessable
   * @purpose Check if email can be processed
   */
  isProcessable(): boolean {
    return this.workflowState === WorkflowState.FETCHED ||
           this.workflowState === WorkflowState.ERROR;
  }

  /**
   * @method incrementProcessingAttempts
   * @purpose Increment processing attempts counter
   */
  incrementProcessingAttempts(error?: string): void {
    this.processingAttempts += 1;
    if (error) {
      this.lastProcessingError = error;
    }
  }

  /**
   * @method resetProcessingAttempts
   * @purpose Reset processing attempts counter
   */
  resetProcessingAttempts(): void {
    this.processingAttempts = 0;
    this.lastProcessingError = undefined;
  }

  /**
   * @method getMaxProcessingAttempts
   * @purpose Get maximum allowed processing attempts
   */
  getMaxProcessingAttempts(): number {
    return 3; // Allow up to 3 processing attempts
  }

  /**
   * @method hasExceededMaxAttempts
   * @purpose Check if processing attempts have been exceeded
   */
  hasExceededMaxAttempts(): boolean {
    return this.processingAttempts >= this.getMaxProcessingAttempts();
  }
}
