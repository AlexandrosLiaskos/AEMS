import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../services/logger.service';
import { AuditService } from '../../modules/audit/services/audit.service';

/**
 * @interface ErrorResponse
 * @purpose Standardized error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
  };
  statusCode: number;
}

/**
 * @class GlobalExceptionFilter
 * @purpose Global exception filter for handling all unhandled exceptions
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private loggerService: LoggerService,
    private auditService: AuditService,
  ) {}

  /**
   * @method catch
   * @purpose Handle exceptions and format error responses
   */
  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, errorResponse } = this.processException(exception, request);

    // Log the error
    await this.logError(exception, request, errorResponse);

    // Audit the error if it's a user request
    if (request.user) {
      await this.auditError(exception, request, errorResponse);
    }

    // Send error response
    response.status(status).json(errorResponse);
  }

  /**
   * @method processException
   * @purpose Process exception and create error response
   */
  private processException(exception: unknown, request: Request): {
    status: number;
    errorResponse: ErrorResponse;
  } {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.getErrorCodeFromStatus(status);
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;
        code = responseObj.code || this.getErrorCodeFromStatus(status);
        details = responseObj.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name || 'UNKNOWN_ERROR';
      
      // Handle specific error types
      if (exception.name === 'ValidationError') {
        status = HttpStatus.BAD_REQUEST;
        code = 'VALIDATION_ERROR';
      } else if (exception.name === 'UnauthorizedError') {
        status = HttpStatus.UNAUTHORIZED;
        code = 'UNAUTHORIZED';
      } else if (exception.name === 'ForbiddenError') {
        status = HttpStatus.FORBIDDEN;
        code = 'FORBIDDEN';
      } else if (exception.name === 'NotFoundError') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
      } else if (exception.name === 'ConflictError') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
      } else if (exception.name === 'RateLimitError') {
        status = HttpStatus.TOO_MANY_REQUESTS;
        code = 'RATE_LIMIT_EXCEEDED';
      }
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        requestId: request.headers['x-request-id'] as string,
      },
      statusCode: status,
    };

    return { status, errorResponse };
  }

  /**
   * @method getErrorCodeFromStatus
   * @purpose Get error code from HTTP status
   */
  private getErrorCodeFromStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return statusCodes[status] || 'UNKNOWN_ERROR';
  }

  /**
   * @method logError
   * @purpose Log error details
   */
  private async logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse
  ): Promise<void> {
    const { error, statusCode } = errorResponse;
    const userId = (request as any).user?.id;
    const userEmail = (request as any).user?.email;

    const logContext = {
      requestId: error.requestId,
      userId,
      userEmail,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      statusCode,
      errorCode: error.code,
    };

    if (statusCode >= 500) {
      // Server errors - log as error with full stack trace
      this.loggerService.error(
        `${error.code}: ${error.message}`,
        'GlobalExceptionFilter',
        JSON.stringify({
          ...logContext,
          stack: exception instanceof Error ? exception.stack : undefined,
          details: error.details,
        })
      );
    } else if (statusCode >= 400) {
      // Client errors - log as warning
      this.loggerService.warn(
        `${error.code}: ${error.message}`,
        'GlobalExceptionFilter',
        logContext
      );
    } else {
      // Other errors - log as info
      this.loggerService.info(
        `${error.code}: ${error.message}`,
        'GlobalExceptionFilter',
        logContext
      );
    }
  }

  /**
   * @method auditError
   * @purpose Audit error for security and compliance
   */
  private async auditError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse
  ): Promise<void> {
    try {
      const { error, statusCode } = errorResponse;
      const user = (request as any).user;

      // Only audit significant errors
      if (statusCode >= 400) {
        await this.auditService.logAction({
          userId: user.id,
          action: 'error.occurred',
          resource: `${request.method} ${request.url}`,
          resourceId: error.requestId || 'unknown',
          details: {
            errorCode: error.code,
            errorMessage: error.message,
            statusCode,
            requestId: error.requestId,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          },
        });
      }
    } catch (auditError) {
      // Don't let audit errors break the error handling
      this.logger.error('Failed to audit error', auditError);
    }
  }
}

/**
 * @class ValidationExceptionFilter
 * @purpose Specific filter for validation errors
 */
@Catch(HttpException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    if (status === HttpStatus.BAD_REQUEST) {
      const exceptionResponse = exception.getResponse() as any;
      
      if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
        // Handle class-validator errors
        const validationErrors = exceptionResponse.message.map((msg: string) => ({
          field: this.extractFieldFromMessage(msg),
          message: msg,
        }));

        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              validationErrors,
            },
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          },
          statusCode: status,
        };

        return response.status(status).json(errorResponse);
      }
    }

    // Fall back to default handling
    throw exception;
  }

  /**
   * @method extractFieldFromMessage
   * @purpose Extract field name from validation message
   */
  private extractFieldFromMessage(message: string): string {
    // Try to extract field name from common validation messages
    const fieldMatch = message.match(/^(\w+)\s/);
    return fieldMatch ? fieldMatch[1] : 'unknown';
  }
}