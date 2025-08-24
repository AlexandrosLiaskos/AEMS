import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import { EventService } from '../../../common/services/event.service';
import { EmailMessage, WorkflowState } from '../../../database/entities/email-message.entity';

/**
 * @interface WorkflowTransition
 * @purpose Workflow state transition definition
 */
export interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  condition?: (email: EmailMessage) => boolean;
  action?: (email: EmailMessage) => Promise<void>;
}

/**
 * @interface WorkflowRule
 * @purpose Workflow rule definition
 */
export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
    value: any;
  }>;
  actions: Array<{
    type: 'setState' | 'addTag' | 'removeTag' | 'setPriority' | 'notify';
    parameters: Record<string, any>;
  }>;
  priority: number;
}

/**
 * @class WorkflowService
 * @purpose Email workflow management service
 */
@Injectable()
export class WorkflowService {
  private readonly transitions: WorkflowTransition[] = [
    {
      from: WorkflowState.FETCHED,
      to: WorkflowState.PROCESSING,
    },
    {
      from: WorkflowState.PROCESSING,
      to: WorkflowState.CLASSIFIED,
      condition: (email) => !!email.classification,
    },
    {
      from: WorkflowState.CLASSIFIED,
      to: WorkflowState.EXTRACTED,
      condition: (email) => !!email.extraction,
    },
    {
      from: WorkflowState.EXTRACTED,
      to: WorkflowState.COMPLETED,
      condition: (email) => email.extraction?.isComplete === true,
    },
    {
      from: WorkflowState.PROCESSING,
      to: WorkflowState.ERROR,
    },
    {
      from: WorkflowState.CLASSIFIED,
      to: WorkflowState.ERROR,
    },
    {
      from: WorkflowState.EXTRACTED,
      to: WorkflowState.ERROR,
    },
  ];

  constructor(
    private logger: LoggerService,
    private eventService: EventService,
  ) {}

  /**
   * @method transitionState
   * @purpose Transition email to new workflow state
   */
  async transitionState(email: EmailMessage, targetState: WorkflowState): Promise<boolean> {
    try {
      const currentState = email.workflowState;

      // Find valid transition
      const transition = this.transitions.find(t =>
        t.from === currentState && t.to === targetState
      );

      if (!transition) {
        this.logger.warn(`Invalid workflow transition: ${currentState} -> ${targetState}`, 'WorkflowService', {
          emailId: email.id,
          currentState,
          targetState,
        });
        return false;
      }

      // Check transition condition
      if (transition.condition && !transition.condition(email)) {
        this.logger.warn(`Workflow transition condition not met: ${currentState} -> ${targetState}`, 'WorkflowService', {
          emailId: email.id,
          currentState,
          targetState,
        });
        return false;
      }

      // Update state
      email.workflowState = targetState;
      email.updatedAt = new Date();

      // Execute transition action
      if (transition.action) {
        await transition.action(email);
      }

      // Emit workflow event
      this.eventService.emit('workflow.state.changed', {
        type: 'workflow.state.changed',
        payload: {
          emailId: email.id,
          fromState: currentState,
          toState: targetState,
        },
        userId: email.userId,
      });

      this.logger.info(`Workflow state transitioned: ${currentState} -> ${targetState}`, 'WorkflowService', {
        emailId: email.id,
        currentState,
        targetState,
      });

      return true;

    } catch (error) {
      this.logger.error(`Failed to transition workflow state: ${error.message}`, error.stack, 'WorkflowService', {
        emailId: email.id,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * @method getValidTransitions
   * @purpose Get valid transitions for current state
   */
  getValidTransitions(currentState: WorkflowState): WorkflowState[] {
    return this.transitions
      .filter(t => t.from === currentState)
      .map(t => t.to);
  }

  /**
   * @method canTransition
   * @purpose Check if transition is valid
   */
  canTransition(email: EmailMessage, targetState: WorkflowState): boolean {
    const transition = this.transitions.find(t =>
      t.from === email.workflowState && t.to === targetState
    );

    if (!transition) {
      return false;
    }

    if (transition.condition) {
      return transition.condition(email);
    }

    return true;
  }

  /**
   * @method getWorkflowProgress
   * @purpose Get workflow progress for email
   */
  getWorkflowProgress(email: EmailMessage): {
    currentState: WorkflowState;
    progress: number;
    nextStates: WorkflowState[];
    isComplete: boolean;
    hasError: boolean;
  } {
    const stateOrder = [
      WorkflowState.FETCHED,
      WorkflowState.PROCESSING,
      WorkflowState.CLASSIFIED,
      WorkflowState.EXTRACTED,
      WorkflowState.COMPLETED,
    ];

    const currentIndex = stateOrder.indexOf(email.workflowState);
    const progress = email.workflowState === WorkflowState.ERROR ? 0 :
                    (currentIndex + 1) / stateOrder.length * 100;

    return {
      currentState: email.workflowState,
      progress,
      nextStates: this.getValidTransitions(email.workflowState),
      isComplete: email.workflowState === WorkflowState.COMPLETED,
      hasError: email.workflowState === WorkflowState.ERROR,
    };
  }

  /**
   * @method processWorkflowRules
   * @purpose Process workflow rules for email
   */
  async processWorkflowRules(email: EmailMessage, rules: WorkflowRule[]): Promise<void> {
    try {
      // Sort rules by priority
      const sortedRules = rules
        .filter(rule => rule.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        if (await this.evaluateRuleConditions(email, rule)) {
          await this.executeRuleActions(email, rule);

          this.logger.debug(`Workflow rule executed: ${rule.name}`, 'WorkflowService', {
            emailId: email.id,
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      }

    } catch (error) {
      this.logger.error(`Failed to process workflow rules: ${error.message}`, error.stack, 'WorkflowService', {
        emailId: email.id,
        error: error.message,
      });
    }
  }

  /**
   * @method evaluateRuleConditions
   * @purpose Evaluate rule conditions
   */
  private async evaluateRuleConditions(email: EmailMessage, rule: WorkflowRule): Promise<boolean> {
    try {
      for (const condition of rule.conditions) {
        const fieldValue = this.getFieldValue(email, condition.field);

        if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.warn(`Failed to evaluate rule conditions: ${error.message}`, 'WorkflowService', {
        ruleId: rule.id,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * @method executeRuleActions
   * @purpose Execute rule actions
   */
  private async executeRuleActions(email: EmailMessage, rule: WorkflowRule): Promise<void> {
    try {
      for (const action of rule.actions) {
        switch (action.type) {
          case 'setState':
            if (action.parameters.state) {
              await this.transitionState(email, action.parameters.state);
            }
            break;

          case 'addTag':
            if (action.parameters.tag) {
              email.tags = email.tags || [];
              if (!email.tags.includes(action.parameters.tag)) {
                email.tags.push(action.parameters.tag);
              }
            }
            break;

          case 'removeTag':
            if (action.parameters.tag && email.tags) {
              email.tags = email.tags.filter(tag => tag !== action.parameters.tag);
            }
            break;

          case 'setPriority':
            if (action.parameters.priority) {
              email.priority = action.parameters.priority;
            }
            break;

          case 'notify':
            // Emit notification event
            this.eventService.emit('workflow.notification', {
              type: 'workflow.notification',
              payload: {
                emailId: email.id,
                message: action.parameters.message,
                type: action.parameters.notificationType,
              },
              userId: email.userId,
            });
            break;
        }
      }

    } catch (error) {
      this.logger.error(`Failed to execute rule actions: ${error.message}`, error.stack, 'WorkflowService', {
        ruleId: rule.id,
        error: error.message,
      });
    }
  }

  /**
   * @method getFieldValue
   * @purpose Get field value from email
   */
  private getFieldValue(email: EmailMessage, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value: any = email;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * @method evaluateCondition
   * @purpose Evaluate single condition
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    const fieldStr = String(fieldValue).toLowerCase();
    const expectedStr = String(expectedValue).toLowerCase();

    switch (operator) {
      case 'equals':
        return fieldStr === expectedStr;

      case 'contains':
        return fieldStr.includes(expectedStr);

      case 'startsWith':
        return fieldStr.startsWith(expectedStr);

      case 'endsWith':
        return fieldStr.endsWith(expectedStr);

      case 'regex':
        try {
          const regex = new RegExp(expectedValue, 'i');
          return regex.test(fieldStr);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * @method getWorkflowStats
   * @purpose Get workflow statistics
   */
  async getWorkflowStats(userId: string): Promise<{
    totalEmails: number;
    stateBreakdown: Record<WorkflowState, number>;
    averageProcessingTime: number;
    completionRate: number;
    errorRate: number;
  }> {
    try {
      // This would typically query the database for statistics
      // For now, return mock data
      return {
        totalEmails: 0,
        stateBreakdown: {
          [WorkflowState.FETCHED]: 0,
          [WorkflowState.PROCESSING]: 0,
          [WorkflowState.CLASSIFIED]: 0,
          [WorkflowState.EXTRACTED]: 0,
          [WorkflowState.REVIEW]: 0,
          [WorkflowState.APPROVED]: 0,
          [WorkflowState.ARCHIVED]: 0,
          [WorkflowState.COMPLETED]: 0,
          [WorkflowState.ERROR]: 0,
        },
        averageProcessingTime: 0,
        completionRate: 0,
        errorRate: 0,
      };

    } catch (error) {
      this.logger.error(`Failed to get workflow stats: ${error.message}`, 'WorkflowService');
      throw error;
    }
  }
}
