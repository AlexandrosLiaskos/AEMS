import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';

/**
 * @interface LogContext
 * @purpose Context information for structured logging
 */
export interface LogContext {
  userId?: string;
  correlationId?: string;
  module?: string;
  function?: string;
  metadata?: Record<string, any>;
  scopes?: string[];
  email?: string;
  [key: string]: any;
}

/**
 * @class LoggerService
 * @purpose Enhanced logging service with structured logging and multiple transports
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;
  private _context: string = 'AEMS';

  get context(): string {
    return this._context;
  }

  constructor(private configService: ConfigService) {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // Create Winston logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            context: context || this.context,
            message,
            ...meta,
          };

          if (nodeEnv === 'development') {
            // Pretty print for development
            return `${timestamp} [${level.toUpperCase()}] ${context || this.context}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`;
          }

          return JSON.stringify(logEntry);
        })
      ),
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          handleRejections: true,
        }),
      ],
    });

    // Add file transport for production
    if (nodeEnv === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );

      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );
    }
  }

  /**
   * @method log
   * @purpose Log info level message
   */
  log(message: string, context?: string, logContext?: LogContext) {
    this.logger.info(message, { context, ...logContext });
  }

  /**
   * @method info
   * @purpose Log info level message
   */
  info(message: string, context?: string, logContext?: LogContext) {
    this.logger.info(message, { context, ...logContext });
  }

  /**
   * @method error
   * @purpose Log error level message
   */
  error(message: string, trace?: string, context?: string, logContext?: LogContext) {
    this.logger.error(message, { context, trace, ...logContext });
  }

  /**
   * @method warn
   * @purpose Log warning level message
   */
  warn(message: string, context?: string, logContext?: LogContext) {
    this.logger.warn(message, { context, ...logContext });
  }

  /**
   * @method debug
   * @purpose Log debug level message
   */
  debug(message: string, context?: string, logContext?: LogContext) {
    this.logger.debug(message, { context, ...logContext });
  }

  /**
   * @method verbose
   * @purpose Log verbose level message
   */
  verbose(message: string, context?: string, logContext?: LogContext) {
    this.logger.verbose(message, { context, ...logContext });
  }

  /**
   * @method logWithContext
   * @purpose Log message with structured context
   */
  logWithContext(
    level: 'info' | 'error' | 'warn' | 'debug' | 'verbose',
    message: string,
    context: LogContext
  ) {
    this.logger.log(level, message, context);
  }

  /**
   * @method logApiCall
   * @purpose Log API call with timing and metadata
   */
  logApiCall(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ) {
    this.logger.info('API Call', {
      type: 'api_call',
      method,
      url,
      statusCode,
      duration,
      ...context,
    });
  }

  /**
   * @method logDatabaseQuery
   * @purpose Log database query with timing
   */
  logDatabaseQuery(
    query: string,
    duration: number,
    rowCount?: number,
    context?: LogContext
  ) {
    this.logger.debug('Database Query', {
      type: 'database_query',
      query: query.substring(0, 200), // Truncate long queries
      duration,
      rowCount,
      ...context,
    });
  }

  /**
   * @method logEmailProcessing
   * @purpose Log email processing events
   */
  logEmailProcessing(
    emailId: string,
    action: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    error?: string,
    context?: LogContext
  ) {
    const level = status === 'failed' ? 'error' : 'info';
    this.logger.log(level, `Email Processing: ${action}`, {
      type: 'email_processing',
      emailId,
      action,
      status,
      duration,
      error,
      ...context,
    });
  }

  /**
   * @method logAIProcessing
   * @purpose Log AI processing events with cost tracking
   */
  logAIProcessing(
    operation: string,
    model: string,
    tokens: number,
    cost: number,
    duration: number,
    status: 'success' | 'error',
    context?: LogContext
  ) {
    const level = status === 'error' ? 'error' : 'info';
    this.logger.log(level, `AI Processing: ${operation}`, {
      type: 'ai_processing',
      operation,
      model,
      tokens,
      cost,
      duration,
      status,
      ...context,
    });
  }

  /**
   * @method logSecurityEvent
   * @purpose Log security-related events
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context?: LogContext
  ) {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.logger.log(level, `Security Event: ${event}`, {
      type: 'security_event',
      event,
      severity,
      details,
      ...context,
    });
  }

  /**
   * @method createChildLogger
   * @purpose Create a child logger with specific context
   */
  createChildLogger(context: string): LoggerService {
    const childLogger = new LoggerService(this.configService);
    childLogger._context = context;
    return childLogger;
  }
}
