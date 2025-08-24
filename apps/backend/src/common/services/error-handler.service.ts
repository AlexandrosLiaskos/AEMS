import { Injectable } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { EventService } from './event.service';
import { 
  BaseCustomError,
  ExternalServiceError,
  DatabaseError,
  PipelineError,
  GmailApiError,
  OpenAIApiError,
} from '../errors/custom-errors';

/**
 * @interface ErrorContext
 * @purpose Context information for error handling
 */
export interface ErrorContext {
  userId?: string;
  operation?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

/**
 * @interface ErrorHandlingOptions
 * @purpose Options for error handling
 */
export interface ErrorHandlingOptions {
  shouldLog?: boolean;
  shouldNotify?: boolean;
  shouldRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: any;
}

/**
 * @interface RetryConfig
 * @purpose Configuration for retry logic
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * @class ErrorHandlerService
 * @purpose Centralized error handling service
 */
@Injectable()
export class ErrorHandlerService {
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'EXTERNAL_SERVICE_ERROR',
      'GMAIL_API_ERROR',
      'OPENAI_API_ERROR',
      'RATE_LIMIT_ERROR',
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
    ],
  };

  constructor(
    private logger: LoggerService,
    private eventService: EventService,
  ) {}

  /**
   * @method handleError
   * @purpose Handle error with context and options
   */
  async handleError(
    error: Error,
    context: ErrorContext = {},
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    const {
      shouldLog = true,
      shouldNotify = false,
    } = options;

    // Enhance error with context
    const enhancedError = this.enhanceError(error, context);

    // Log error if requested
    if (shouldLog) {
      await this.logError(enhancedError, context);
    }

    // Send notification if requested
    if (shouldNotify && context.userId) {
      await this.notifyUser(enhancedError, context);
    }

    // Emit error event
    this.eventService.emit('error.occurred', {
      type: 'error.occurred',
      payload: {
        error: {
          name: enhancedError.name,
          message: enhancedError.message,
          code: (enhancedError as any).code,
        },
        context,
      },
      userId: context.userId,
    });
  }

  /**
   * @method handleAsyncError
   * @purpose Handle async operation with error handling
   */
  async handleAsyncError<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    options: ErrorHandlingOptions = {}
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(error as Error, context, options);
      
      if (options.fallbackValue !== undefined) {
        return options.fallbackValue;
      }
      
      throw error;
    }
  }

  /**
   * @method withRetry
   * @purpose Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError, config.retryableErrors)) {
          throw lastError;
        }
        
        // Don't retry on last attempt
        if (attempt === config.maxAttempts) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        this.logger.warn(
          `Operation failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms`,
          'ErrorHandlerService',
          {
            error: lastError.message,
            context,
            attempt,
            delay,
          }
        );
        
        await this.delay(delay);
      }
    }
    
    // All retries exhausted
    await this.handleError(lastError!, context, { shouldLog: true, shouldNotify: true });
    throw lastError!;
  }

  /**
   * @method wrapExternalService
   * @purpose Wrap external service calls with error handling
   */
  async wrapExternalService<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await this.withRetry(operation, {
        ...context,
        operation: `${serviceName} API call`,
      });
    } catch (error) {
      // Convert to external service error
      const serviceError = new ExternalServiceError(
        serviceName,
        (error as Error).message,
        { originalError: error }
      );
      
      throw serviceError;
    }
  }

  /**
   * @method wrapGmailApi
   * @purpose Wrap Gmail API calls with specific error handling
   */
  async wrapGmailApi<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await this.wrapExternalService('Gmail', operation, context);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new GmailApiError(error.message, error.details);
      }
      throw error;
    }
  }

  /**
   * @method wrapOpenAIApi
   * @purpose Wrap OpenAI API calls with specific error handling
   */
  async wrapOpenAIApi<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await this.wrapExternalService('OpenAI', operation, context);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new OpenAIApiError(error.message, error.details);
      }
      throw error;
    }
  }

  /**
   * @method wrapDatabaseOperation
   * @purpose Wrap database operations with error handling
   */
  async wrapDatabaseOperation<T>(
    operation: string,
    dbOperation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await dbOperation();
    } catch (error) {
      const dbError = new DatabaseError(
        operation,
        (error as Error).message,
        { originalError: error }
      );
      
      await this.handleError(dbError, {
        ...context,
        operation: `Database ${operation}`,
      });
      
      throw dbError;
    }
  }

  /**
   * @method wrapPipelineOperation
   * @purpose Wrap pipeline operations with error handling
   */
  async wrapPipelineOperation<T>(
    stage: string,
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const pipelineError = new PipelineError(
        stage,
        (error as Error).message,
        { originalError: error }
      );
      
      await this.handleError(pipelineError, {
        ...context,
        operation: `Pipeline ${stage}`,
      });
      
      throw pipelineError;
    }
  }

  /**
   * @method enhanceError
   * @purpose Enhance error with additional context
   */
  private enhanceError(error: Error, context: ErrorContext): Error {
    if (error instanceof BaseCustomError) {
      return error;
    }

    // Add context to error
    (error as any).context = context;
    (error as any).timestamp = new Date().toISOString();
    (error as any).errorId = this.generateErrorId();

    return error;
  }

  /**
   * @method logError
   * @purpose Log error with appropriate level
   */
  private async logError(error: Error, context: ErrorContext): Promise<void> {
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      errorId: (error as any).errorId,
    };

    if (error instanceof BaseCustomError) {
      // Custom errors - log based on severity
      if (error.getStatus() >= 500) {
        this.logger.error(`${error.code}: ${error.message}`, 'ErrorHandlerService', JSON.stringify(errorInfo));
      } else {
        this.logger.warn(`${error.code}: ${error.message}`, 'ErrorHandlerService', errorInfo);
      }
    } else {
      // Unknown errors - always log as error
      this.logger.error(`Unhandled error: ${error.message}`, 'ErrorHandlerService', JSON.stringify(errorInfo));
    }
  }

  /**
   * @method notifyUser
   * @purpose Send error notification to user
   */
  private async notifyUser(error: Error, context: ErrorContext): Promise<void> {
    if (!context.userId) return;

    const userMessage = (error as any).userMessage || 'An unexpected error occurred';
    
    this.eventService.emit('user.notification', {
      type: 'user.notification',
      payload: {
        type: 'error',
        title: 'Error',
        message: userMessage,
        errorId: (error as any).errorId,
      },
      userId: context.userId,
    });
  }

  /**
   * @method isRetryableError
   * @purpose Check if error is retryable
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorCode = (error as any).code || error.name;
    return retryableErrors.includes(errorCode);
  }

  /**
   * @method delay
   * @purpose Create delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * @method generateErrorId
   * @purpose Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * @method getErrorStats
   * @purpose Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{
      timestamp: string;
      type: string;
      message: string;
      context?: ErrorContext;
    }>;
  } {
    // This would typically be implemented with a proper error tracking system
    // For now, return mock data
    return {
      totalErrors: 0,
      errorsByType: {},
      recentErrors: [],
    };
  }
}