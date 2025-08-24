import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * @class BaseCustomError
 * @purpose Base class for custom application errors
 */
export abstract class BaseCustomError extends HttpException {
  abstract code: string;
  abstract userMessage: string;
  
  constructor(
    message: string,
    status: HttpStatus,
    public readonly details?: any
  ) {
    super(message, status);
  }
}

/**
 * @class ValidationError
 * @purpose Validation error
 */
export class ValidationError extends BaseCustomError {
  code = 'VALIDATION_ERROR';
  userMessage = 'The provided data is invalid';

  constructor(message: string, details?: any) {
    super(message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * @class AuthenticationError
 * @purpose Authentication error
 */
export class AuthenticationError extends BaseCustomError {
  code = 'AUTHENTICATION_ERROR';
  userMessage = 'Authentication is required';

  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, HttpStatus.UNAUTHORIZED, details);
  }
}

/**
 * @class AuthorizationError
 * @purpose Authorization error
 */
export class AuthorizationError extends BaseCustomError {
  code = 'AUTHORIZATION_ERROR';
  userMessage = 'You do not have permission to perform this action';

  constructor(message: string = 'Access denied', details?: any) {
    super(message, HttpStatus.FORBIDDEN, details);
  }
}

/**
 * @class NotFoundError
 * @purpose Resource not found error
 */
export class NotFoundError extends BaseCustomError {
  code = 'NOT_FOUND_ERROR';
  userMessage = 'The requested resource was not found';

  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, HttpStatus.NOT_FOUND, { resource, identifier });
  }
}

/**
 * @class ConflictError
 * @purpose Resource conflict error
 */
export class ConflictError extends BaseCustomError {
  code = 'CONFLICT_ERROR';
  userMessage = 'The operation conflicts with the current state';

  constructor(message: string, details?: any) {
    super(message, HttpStatus.CONFLICT, details);
  }
}

/**
 * @class RateLimitError
 * @purpose Rate limit exceeded error
 */
export class RateLimitError extends BaseCustomError {
  code = 'RATE_LIMIT_ERROR';
  userMessage = 'Too many requests. Please try again later';

  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, details);
  }
}

/**
 * @class ExternalServiceError
 * @purpose External service error
 */
export class ExternalServiceError extends BaseCustomError {
  code = 'EXTERNAL_SERVICE_ERROR';
  userMessage = 'An external service is currently unavailable';

  constructor(service: string, message: string, details?: any) {
    super(`${service}: ${message}`, HttpStatus.BAD_GATEWAY, { service, ...details });
  }
}

/**
 * @class GmailApiError
 * @purpose Gmail API specific error
 */
export class GmailApiError extends ExternalServiceError {
  code = 'GMAIL_API_ERROR';
  userMessage = 'Gmail service is currently unavailable';

  constructor(message: string, details?: any) {
    super('Gmail API', message, details);
  }
}

/**
 * @class OpenAIApiError
 * @purpose OpenAI API specific error
 */
export class OpenAIApiError extends ExternalServiceError {
  code = 'OPENAI_API_ERROR';
  userMessage = 'AI service is currently unavailable';

  constructor(message: string, details?: any) {
    super('OpenAI API', message, details);
  }
}

/**
 * @class DatabaseError
 * @purpose Database operation error
 */
export class DatabaseError extends BaseCustomError {
  code = 'DATABASE_ERROR';
  userMessage = 'A database error occurred';

  constructor(operation: string, message: string, details?: any) {
    super(`Database ${operation}: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, { operation, ...details });
  }
}

/**
 * @class FileSystemError
 * @purpose File system operation error
 */
export class FileSystemError extends BaseCustomError {
  code = 'FILESYSTEM_ERROR';
  userMessage = 'A file system error occurred';

  constructor(operation: string, path: string, message: string) {
    super(`File system ${operation} failed for '${path}': ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, { 
      operation, 
      path 
    });
  }
}

/**
 * @class ConfigurationError
 * @purpose Configuration error
 */
export class ConfigurationError extends BaseCustomError {
  code = 'CONFIGURATION_ERROR';
  userMessage = 'The application is not properly configured';

  constructor(setting: string, message: string) {
    super(`Configuration error for '${setting}': ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, { setting });
  }
}

/**
 * @class BusinessLogicError
 * @purpose Business logic error
 */
export class BusinessLogicError extends BaseCustomError {
  code = 'BUSINESS_LOGIC_ERROR';
  userMessage = 'The operation cannot be completed due to business rules';

  constructor(message: string, details?: any) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/**
 * @class PipelineError
 * @purpose Pipeline execution error
 */
export class PipelineError extends BaseCustomError {
  code = 'PIPELINE_ERROR';
  userMessage = 'Email processing pipeline encountered an error';

  constructor(stage: string, message: string, details?: any) {
    super(`Pipeline error in ${stage}: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, { stage, ...details });
  }
}

/**
 * @class ClassificationError
 * @purpose Email classification error
 */
export class ClassificationError extends BaseCustomError {
  code = 'CLASSIFICATION_ERROR';
  userMessage = 'Email classification failed';

  constructor(message: string, details?: any) {
    super(`Classification error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}

/**
 * @class ExtractionError
 * @purpose Data extraction error
 */
export class ExtractionError extends BaseCustomError {
  code = 'EXTRACTION_ERROR';
  userMessage = 'Data extraction failed';

  constructor(message: string, details?: any) {
    super(`Extraction error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}

/**
 * @class WorkflowError
 * @purpose Workflow execution error
 */
export class WorkflowError extends BaseCustomError {
  code = 'WORKFLOW_ERROR';
  userMessage = 'Workflow execution failed';

  constructor(message: string, details?: any) {
    super(`Workflow error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}

/**
 * @class TokenExpiredError
 * @purpose Token expired error
 */
export class TokenExpiredError extends AuthenticationError {
  code = 'TOKEN_EXPIRED_ERROR';
  userMessage = 'Your session has expired. Please log in again';

  constructor(tokenType: string = 'access token') {
    super(`${tokenType} has expired`, { tokenType });
  }
}

/**
 * @class InvalidTokenError
 * @purpose Invalid token error
 */
export class InvalidTokenError extends AuthenticationError {
  code = 'INVALID_TOKEN_ERROR';
  userMessage = 'Invalid authentication token';

  constructor(tokenType: string = 'access token') {
    super(`Invalid ${tokenType}`, { tokenType });
  }
}

/**
 * @class QuotaExceededError
 * @purpose API quota exceeded error
 */
export class QuotaExceededError extends RateLimitError {
  code = 'QUOTA_EXCEEDED_ERROR';
  userMessage = 'API quota exceeded. Please try again later';

  constructor(service: string, quotaType: string, details?: any) {
    super(`${service} ${quotaType} quota exceeded`, { service, quotaType, ...details });
  }
}

/**
 * @class MaintenanceError
 * @purpose Service maintenance error
 */
export class MaintenanceError extends BaseCustomError {
  code = 'MAINTENANCE_ERROR';
  userMessage = 'The service is currently under maintenance';

  constructor(service: string, estimatedDuration?: string) {
    const message = estimatedDuration 
      ? `${service} is under maintenance (estimated duration: ${estimatedDuration})`
      : `${service} is under maintenance`;
    
    super(message, HttpStatus.SERVICE_UNAVAILABLE, { service, estimatedDuration });
  }
}