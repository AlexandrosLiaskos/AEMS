import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { EmailMessage } from './email-message.entity';

/**
 * @enum EmailCategory
 * @purpose Email category enumeration
 */
export enum EmailCategory {
  INVOICE = 'invoice',
  RECEIPT = 'receipt',
  CONTRACT = 'contract',
  QUOTE = 'quote',
  ORDER = 'order',
  CUSTOMER_INQUIRY = 'customer_inquiry',
  SUPPORT_TICKET = 'support_ticket',
  NEWSLETTER = 'newsletter',
  NOTIFICATION = 'notification',
  PERSONAL = 'personal',
  BUSINESS = 'business',
  SUPPORT = 'support',
  MARKETING = 'marketing',
  OTHER = 'other',
}

/**
 * @interface ClassificationFeatures
 * @purpose Features used for classification
 */
export interface ClassificationFeatures {
  subjectKeywords: string[];
  senderDomain: string;
  bodyKeywords: string[];
  attachmentTypes: string[];
  emailLength: number;
  hasLinks: boolean;
  hasAttachments: boolean;
  [key: string]: any;
}

/**
 * @interface ClassificationMetrics
 * @purpose Classification performance metrics
 */
export interface ClassificationMetrics {
  processingTime: number;
  tokensUsed: number;
  cost: number;
  modelVersion: string;
  features: ClassificationFeatures;
  apiCalls?: number;
  retryCount?: number;
  fallbackUsed?: boolean;
}

/**
 * @interface AlternativeCategory
 * @purpose Alternative classification category
 */
export interface AlternativeCategory {
  category: string;
  confidence: number;
  reasoning: string;
}

/**
 * @interface ValidationFeedback
 * @purpose Classification validation feedback
 */
export interface ValidationFeedback {
  isCorrect: boolean;
  correctCategory?: string;
  feedback?: string;
  validatedBy: string;
  validatedAt: Date;
}

/**
 * @class Classification
 * @purpose Email classification entity
 */
@Entity('classifications')
export class Classification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  emailId: string;

  @Column()
  category: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @Column({ type: 'text' })
  reasoning: string;

  @Column({ type: 'json', nullable: true })
  alternativeCategories?: AlternativeCategory[];

  @Column({ default: false })
  isManualOverride: boolean;

  @Column({ default: false })
  isValidated: boolean;

  @Column({ type: 'json', nullable: true })
  validationFeedback?: ValidationFeedback;

  @Column({ nullable: true })
  overrideReason?: string;

  @Column({ nullable: true })
  overriddenBy?: string;

  @Column({ nullable: true })
  overriddenAt?: Date;

  @Column({ nullable: true })
  validatedBy?: string;

  @Column({ nullable: true })
  validatedAt?: Date;

  @Column({ nullable: true })
  modelVersion?: string;

  @Column({ type: 'json', nullable: true })
  processingMetrics?: ClassificationMetrics;

  @Column({ type: 'json', nullable: true })
  metrics?: ClassificationMetrics;

  @Column({ type: 'json', nullable: true })
  features?: ClassificationFeatures;

  @OneToOne(() => EmailMessage, email => email.classification)
  @JoinColumn({ name: 'emailId' })
  email: EmailMessage;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * @method override
   * @purpose Override classification with manual input
   */
  override(category: string, reasoning: string, userId: string): void {
    this.category = category;
    this.reasoning = reasoning;
    this.isManualOverride = true;
    this.confidence = 1.0; // Manual overrides have full confidence
    this.updatedAt = new Date();
  }

  /**
   * @method getProcessingCost
   * @purpose Get processing cost for this classification
   */
  getProcessingCost(): number {
    return this.metrics?.cost || this.processingMetrics?.cost || 0;
  }

  /**
   * @method validate
   * @purpose Validate classification accuracy
   */
  validate(feedback: Omit<ValidationFeedback, 'validatedAt'>): void {
    this.validationFeedback = {
      ...feedback,
      validatedAt: new Date(),
    };
    this.isValidated = true;
    this.updatedAt = new Date();
  }
}