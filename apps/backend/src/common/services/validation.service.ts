import { Injectable, BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import * as Joi from 'joi';

/**
 * @interface ValidationResult
 * @purpose Result of validation operation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

/**
 * @class ValidationService
 * @purpose Centralized validation service for DTOs, configurations, and data
 */
@Injectable()
export class ValidationService {
  /**
   * @method validateDto
   * @purpose Validate DTO using class-validator decorators
   */
  async validateDto<T extends object>(
    dtoClass: new () => T,
    data: any,
    options?: {
      skipMissingProperties?: boolean;
      whitelist?: boolean;
      forbidNonWhitelisted?: boolean;
    }
  ): Promise<ValidationResult> {
    try {
      const dto = plainToClass(dtoClass, data);
      const errors = await validate(dto, {
        skipMissingProperties: options?.skipMissingProperties || false,
        whitelist: options?.whitelist || true,
        forbidNonWhitelisted: options?.forbidNonWhitelisted || true,
      });

      if (errors.length > 0) {
        return {
          isValid: false,
          errors: this.formatValidationErrors(errors),
        };
      }

      return {
        isValid: true,
        errors: [],
        data: dto,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
      };
    }
  }

  /**
   * @method validateWithJoi
   * @purpose Validate data using Joi schema
   */
  validateWithJoi<T>(schema: Joi.Schema, data: any): ValidationResult {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      return {
        isValid: false,
        errors: error.details.map((detail) => detail.message),
      };
    }

    return {
      isValid: true,
      errors: [],
      data: value,
    };
  }

  /**
   * @method validateEmail
   * @purpose Validate email address format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * @method validateUrl
   * @purpose Validate URL format
   */
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @method validateUuid
   * @purpose Validate UUID format
   */
  validateUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * @method validatePhoneNumber
   * @purpose Validate phone number format (international)
   */
  validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * @method validatePassword
   * @purpose Validate password strength
   */
  validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * @method validateFileType
   * @purpose Validate file type against allowed types
   */
  validateFileType(filename: string, allowedTypes: string[]): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  /**
   * @method validateFileSize
   * @purpose Validate file size against maximum allowed size
   */
  validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  /**
   * @method validateDateRange
   * @purpose Validate date range (start date before end date)
   */
  validateDateRange(startDate: Date, endDate: Date): boolean {
    return startDate < endDate;
  }

  /**
   * @method validatePagination
   * @purpose Validate pagination parameters
   */
  validatePagination(page: number, limit: number, maxLimit = 100): ValidationResult {
    const errors: string[] = [];

    if (page < 1) {
      errors.push('Page must be greater than 0');
    }

    if (limit < 1) {
      errors.push('Limit must be greater than 0');
    }

    if (limit > maxLimit) {
      errors.push(`Limit cannot exceed ${maxLimit}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * @method validateSortField
   * @purpose Validate sort field against allowed fields
   */
  validateSortField(field: string, allowedFields: string[]): boolean {
    return allowedFields.includes(field);
  }

  /**
   * @method validateEnvironmentConfig
   * @purpose Validate environment configuration
   */
  validateEnvironmentConfig(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    const requiredFields = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'SESSION_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'OPENAI_API_KEY',
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push(`${field} is required`);
      }
    }

    // Validate secret lengths
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    if (config.JWT_REFRESH_SECRET && config.JWT_REFRESH_SECRET.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be at least 32 characters long');
    }

    if (config.SESSION_SECRET && config.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters long');
    }

    // Validate URLs
    if (config.FRONTEND_URL && !this.validateUrl(config.FRONTEND_URL)) {
      errors.push('FRONTEND_URL must be a valid URL');
    }

    if (config.GOOGLE_CALLBACK_URL && !this.validateUrl(config.GOOGLE_CALLBACK_URL)) {
      errors.push('GOOGLE_CALLBACK_URL must be a valid URL');
    }

    // Validate numeric values
    const numericFields = [
      'PORT',
      'DATABASE_MAX_CONNECTIONS',
      'GMAIL_REQUESTS_PER_SECOND',
      'OPENAI_MAX_TOKENS',
    ];

    for (const field of numericFields) {
      if (config[field] && isNaN(Number(config[field]))) {
        errors.push(`${field} must be a valid number`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * @method throwValidationException
   * @purpose Throw BadRequestException with validation errors
   */
  throwValidationException(errors: string[]): never {
    throw new BadRequestException({
      message: 'Validation failed',
      errors,
      statusCode: 400,
    });
  }

  /**
   * @method formatValidationErrors
   * @purpose Format class-validator errors into readable messages
   */
  private formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }

      if (error.children && error.children.length > 0) {
        messages.push(...this.formatValidationErrors(error.children));
      }
    }

    return messages;
  }
}