import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EmailMessage, WorkflowState } from './email-message.entity';

/**
 * @enum TransitionTrigger
 * @purpose Workflow transition trigger enumeration
 */
export enum TransitionTrigger {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
  SCHEDULED = 'SCHEDULED',
  API = 'API',
  SYSTEM = 'SYSTEM',
}

/**
 * @interface TransitionMetadata
 * @purpose Additional transition metadata
 */
export interface TransitionMetadata {
  userAgent?: string;
  ipAddress?: string;
  apiKey?: string;
  batchId?: string;
  automationRule?: string;
  confidence?: number;
  processingTime?: number;
  [key: string]: any;
}

/**
 * @entity WorkflowTransition
 * @purpose Email workflow state transition history
 */
@Entity('workflow_transitions')
export class WorkflowTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: WorkflowState,
  })
  fromState: WorkflowState;

  @Column({
    type: 'enum',
    enum: WorkflowState,
  })
  toState: WorkflowState;

  @Column({
    type: 'enum',
    enum: TransitionTrigger,
  })
  trigger: TransitionTrigger;

  @Column({ nullable: true })
  triggeredBy: string; // User ID or system identifier

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'json', nullable: true })
  metadata: TransitionMetadata;

  @Column({ default: true })
  isSuccessful: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  duration: number; // Duration in milliseconds

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => EmailMessage, (email) => email.workflowTransitions)
  @JoinColumn({ name: 'emailId' })
  email: EmailMessage;

  @Column()
  emailId: string;

  /**
   * @method isValidTransition
   * @purpose Check if transition is valid
   */
  isValidTransition(): boolean {
    const validTransitions: Record<WorkflowState, WorkflowState[]> = {
      [WorkflowState.FETCHED]: [WorkflowState.PROCESSING, WorkflowState.ERROR],
      [WorkflowState.PROCESSING]: [WorkflowState.CLASSIFIED, WorkflowState.ERROR, WorkflowState.FETCHED],
      [WorkflowState.CLASSIFIED]: [WorkflowState.EXTRACTED, WorkflowState.REVIEW, WorkflowState.ERROR, WorkflowState.PROCESSING],
      [WorkflowState.EXTRACTED]: [WorkflowState.REVIEW, WorkflowState.APPROVED, WorkflowState.ERROR, WorkflowState.CLASSIFIED],
      [WorkflowState.REVIEW]: [WorkflowState.APPROVED, WorkflowState.ARCHIVED, WorkflowState.PROCESSING, WorkflowState.ERROR],
      [WorkflowState.APPROVED]: [WorkflowState.COMPLETED, WorkflowState.ARCHIVED, WorkflowState.PROCESSING],
      [WorkflowState.ARCHIVED]: [WorkflowState.PROCESSING], // Can reprocess archived emails
      [WorkflowState.COMPLETED]: [WorkflowState.PROCESSING, WorkflowState.ARCHIVED], // Can reprocess or archive
      [WorkflowState.ERROR]: [WorkflowState.FETCHED, WorkflowState.PROCESSING], // Can retry from error
    };

    return validTransitions[this.fromState]?.includes(this.toState) || false;
  }

  /**
   * @method getTransitionName
   * @purpose Get human-readable transition name
   */
  getTransitionName(): string {
    return `${this.fromState} → ${this.toState}`;
  }

  /**
   * @method isAutomated
   * @purpose Check if transition was automated
   */
  isAutomated(): boolean {
    return [
      TransitionTrigger.AUTOMATIC,
      TransitionTrigger.SCHEDULED,
      TransitionTrigger.SYSTEM,
    ].includes(this.trigger);
  }

  /**
   * @method isUserInitiated
   * @purpose Check if transition was user-initiated
   */
  isUserInitiated(): boolean {
    return this.trigger === TransitionTrigger.MANUAL;
  }

  /**
   * @method getDurationInSeconds
   * @purpose Get duration in seconds
   */
  getDurationInSeconds(): number {
    return Math.round(this.duration / 1000);
  }

  /**
   * @method toSummary
   * @purpose Convert to summary object
   */
  toSummary(): Partial<WorkflowTransition> {
    return {
      id: this.id,
      fromState: this.fromState,
      toState: this.toState,
      trigger: this.trigger,
      triggeredBy: this.triggeredBy,
      reason: this.reason,
      isSuccessful: this.isSuccessful,
      duration: this.duration,
      createdAt: this.createdAt,
    };
  }
}