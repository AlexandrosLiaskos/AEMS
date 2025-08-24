import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { EmailMessage } from './email-message.entity';
import { EmailCategory } from './classification.entity';

// Re-export EmailCategory for convenience
export { EmailCategory };

/**
 * @interface ExtractedData
 * @purpose Extracted data structure
 */
export interface ExtractedData {
  [key: string]: any;
}

/**
 * @interface FieldCorrection
 * @purpose Field correction record
 */
export interface FieldCorrection {
  field: string;
  originalValue: any;
  correctedValue: any;
  correctedBy: string;
  correctedAt: Date;
  reason: string;
}

/**
 * @interface ExtractionMetrics
 * @purpose Extraction processing metrics
 */
export interface ExtractionMetrics {
  processingTime: number;
  modelVersion: string;
  tokensUsed: number;
  cost: number;
  apiCalls: number;
  retryCount: number;
  fallbackUsed: boolean;
  fieldsExtracted: number;
  fieldsConfident: number;
  averageFieldConfidence: number;
  fieldsValidated?: number;
  fieldsCorrected?: number;
}

/**
 * @class Extraction
 * @purpose Data extraction entity
 */
@Entity('extractions')
export class Extraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  emailId: string;

  @Column()
  category: string;

  @Column({ type: 'json' })
  extractedData: ExtractedData;

  @Column({ type: 'json', nullable: true })
  fieldConfidences?: Record<string, { confidence: number; reasoning: string }>;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  overallConfidence: number;

  @Column({ type: 'json', nullable: true })
  schema?: any;

  @Column({ nullable: true })
  modelVersion?: string;

  @Column({ type: 'json', nullable: true })
  metrics?: ExtractionMetrics;

  @Column({ default: false })
  isComplete: boolean;

  @Column({ type: 'json', nullable: true })
  missingFields?: string[];

  @Column({ type: 'json', nullable: true })
  extractionErrors?: Array<{ field: string; error: string; severity: string }>;

  @Column({ default: false })
  isValidated: boolean;

  @Column({ nullable: true })
  validatedBy?: string;

  @Column({ nullable: true })
  validatedAt?: Date;

  @Column({ default: false })
  hasManualCorrections: boolean;

  @Column({ type: 'json', nullable: true })
  corrections?: FieldCorrection[];

  @Column({ type: 'json', nullable: true })
  manualCorrections?: FieldCorrection[];

  @Column({ type: 'json', nullable: true })
  correctionHistory?: FieldCorrection[];

  @Column({ type: 'json', nullable: true })
  fieldsValidated?: string[];

  @Column({ type: 'json', nullable: true })
  fieldsCorrected?: string[];

  @Column({ default: 0 })
  processingAttempts: number;

  @Column({ nullable: true })
  lastProcessingError?: string;

  @OneToOne(() => EmailMessage, email => email.extraction)
  @JoinColumn({ name: 'emailId' })
  email: EmailMessage;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * @method correctField
   * @purpose Correct extracted field value
   */
  correctField(fieldName: string, correctedValue: any, userId: string, reason: string): void {
    if (!this.corrections) {
      this.corrections = [];
    }

    const correction: FieldCorrection = {
      field: fieldName,
      originalValue: this.extractedData[fieldName],
      correctedValue,
      correctedBy: userId,
      correctedAt: new Date(),
      reason,
    };

    this.corrections.push(correction);
    this.extractedData[fieldName] = correctedValue;
    this.hasManualCorrections = true;
    this.updatedAt = new Date();
  }

  /**
   * @method validate
   * @purpose Validate extraction accuracy
   */
  validate(feedback: any, userId: string): void {
    this.isValidated = true;
    this.updatedAt = new Date();
  }

  /**
   * @method markAsComplete
   * @purpose Mark extraction as complete
   */
  markAsComplete(): void {
    this.isComplete = true;
    this.updatedAt = new Date();
  }

  /**
   * @method getProcessingCost
   * @purpose Get processing cost for this extraction
   */
  getProcessingCost(): number {
    return this.metrics?.cost || 0;
  }

  /**
   * @method needsReview
   * @purpose Check if extraction needs human review
   */
  needsReview(confidenceThreshold: number): boolean {
    return (
      !this.isComplete ||
      this.overallConfidence < confidenceThreshold ||
      (this.missingFields && this.missingFields.length > 0) ||
      (this.extractionErrors && this.extractionErrors.some(e => e.severity === 'high'))
    );
  }
}