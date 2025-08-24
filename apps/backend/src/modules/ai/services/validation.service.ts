import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface ValidationRule
 * @purpose Validation rule definition
 */
export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'custom';
  rule: string | RegExp | ((value: any) => boolean);
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * @interface ValidationResult
 * @purpose Result of validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  score: number; // 0-1
}

/**
 * @interface ValidationError
 * @purpose Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  value?: any;
  expectedFormat?: string;
}

/**
 * @interface SchemaValidation
 * @purpose Schema-based validation configuration
 */
export interface SchemaValidation {
  category: string;
  version: string;
  rules: ValidationRule[];
  customValidators?: Record<string, (value: any, context?: any) => boolean>;
}

/**
 * @class ValidationService
 * @purpose Validate extracted data and AI results
 */
@Injectable()
export class ValidationService {
  private readonly schemas: Map<string, SchemaValidation> = new Map();

  constructor(private logger: LoggerService) {
    this.initializeDefaultSchemas();
  }

  /**
   * @method validateExtractedData
   * @purpose Validate extracted data against schema
   */
  validateExtractedData(
    data: Record<string, any>,
    category: string,
    schema?: any
  ): ValidationResult {
    const validationSchema = this.schemas.get(category.toLowerCase());
    if (!validationSchema) {
      this.logger.warn(`No validation schema found for category: ${category}`, 'ValidationService');
      return {
        isValid: true,
        errors: [],
        warnings: [{
          field: 'schema',
          message: `No validation schema available for category: ${category}`,
          severity: 'warning',
        }],
        score: 0.5,
      };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate each rule
    for (const rule of validationSchema.rules) {
      const result = this.validateField(data, rule, validationSchema);
      if (result) {
        if (result.severity === 'error') {
          errors.push(result);
        } else {
          warnings.push(result);
        }
      }
    }

    // Calculate validation score
    const totalRules = validationSchema.rules.length;
    const errorCount = errors.length;
    const warningCount = warnings.length;
    
    const score = totalRules > 0 
      ? Math.max(0, (totalRules - errorCount - (warningCount * 0.5)) / totalRules)
      : 1;

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      score,
    };
  }

  /**
   * @method validateClassification
   * @purpose Validate classification result
   */
  validateClassification(
    category: string,
    confidence: number,
    reasoning: string,
    availableCategories: string[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if category is valid
    if (!availableCategories.includes(category)) {
      errors.push({
        field: 'category',
        message: `Invalid category: ${category}. Must be one of: ${availableCategories.join(', ')}`,
        severity: 'error',
        value: category,
      });
    }

    // Check confidence range
    if (confidence < 0 || confidence > 1) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be between 0 and 1',
        severity: 'error',
        value: confidence,
      });
    }

    // Check confidence thresholds
    if (confidence < 0.5) {
      warnings.push({
        field: 'confidence',
        message: 'Low confidence score may require human review',
        severity: 'warning',
        value: confidence,
      });
    }

    // Check reasoning quality
    if (!reasoning || reasoning.length < 10) {
      warnings.push({
        field: 'reasoning',
        message: 'Reasoning should be more detailed for better transparency',
        severity: 'warning',
        value: reasoning,
      });
    }

    const isValid = errors.length === 0;
    const score = isValid ? Math.max(0.5, confidence) : 0;

    return {
      isValid,
      errors,
      warnings,
      score,
    };
  }

  /**
   * @method validateEmailFormat
   * @purpose Validate email format
   */
  validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * @method validateDateFormat
   * @purpose Validate date format
   */
  validateDateFormat(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString !== '';
  }

  /**
   * @method validateCurrency
   * @purpose Validate currency code
   */
  validateCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'];
    return validCurrencies.includes(currency.toUpperCase());
  }

  /**
   * @method validateAmount
   * @purpose Validate monetary amount
   */
  validateAmount(amount: any): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0;
  }

  /**
   * @method addValidationSchema
   * @purpose Add custom validation schema
   */
  addValidationSchema(schema: SchemaValidation): void {
    this.schemas.set(schema.category.toLowerCase(), schema);
    this.logger.log(`Added validation schema for category: ${schema.category}`, 'ValidationService');
  }

  /**
   * @method getValidationSchema
   * @purpose Get validation schema for category
   */
  getValidationSchema(category: string): SchemaValidation | undefined {
    return this.schemas.get(category.toLowerCase());
  }

  /**
   * @method validateField
   * @purpose Validate individual field
   */
  private validateField(
    data: Record<string, any>,
    rule: ValidationRule,
    schema: SchemaValidation
  ): ValidationError | null {
    const value = data[rule.field];

    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
            value,
          };
        }
        break;

      case 'format':
        if (value !== undefined && value !== null && value !== '') {
          let isValid = false;
          
          if (rule.rule instanceof RegExp) {
            isValid = rule.rule.test(String(value));
          } else if (typeof rule.rule === 'string') {
            // Predefined format validators
            switch (rule.rule) {
              case 'email':
                isValid = this.validateEmailFormat(String(value));
                break;
              case 'date':
                isValid = this.validateDateFormat(String(value));
                break;
              case 'currency':
                isValid = this.validateCurrency(String(value));
                break;
              case 'amount':
                isValid = this.validateAmount(value);
                break;
              default:
                isValid = true;
            }
          }

          if (!isValid) {
            return {
              field: rule.field,
              message: rule.message,
              severity: rule.severity,
              value,
              expectedFormat: String(rule.rule),
            };
          }
        }
        break;

      case 'range':
        if (value !== undefined && value !== null) {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            const [min, max] = String(rule.rule).split('-').map(parseFloat);
            if (num < min || num > max) {
              return {
                field: rule.field,
                message: rule.message,
                severity: rule.severity,
                value,
                expectedFormat: `${min}-${max}`,
              };
            }
          }
        }
        break;

      case 'custom':
        if (typeof rule.rule === 'function') {
          if (!rule.rule(value)) {
            return {
              field: rule.field,
              message: rule.message,
              severity: rule.severity,
              value,
            };
          }
        } else if (schema.customValidators && typeof rule.rule === 'string') {
          const validator = schema.customValidators[rule.rule];
          if (validator && !validator(value, data)) {
            return {
              field: rule.field,
              message: rule.message,
              severity: rule.severity,
              value,
            };
          }
        }
        break;
    }

    return null;
  }

  /**
   * @method initializeDefaultSchemas
   * @purpose Initialize default validation schemas
   */
  private initializeDefaultSchemas(): void {
    // Invoice validation schema
    this.schemas.set('invoice', {
      category: 'invoice',
      version: '1.0',
      rules: [
        {
          field: 'invoiceNumber',
          type: 'required',
          rule: '',
          message: 'Invoice number is required',
          severity: 'error',
        },
        {
          field: 'invoiceDate',
          type: 'format',
          rule: 'date',
          message: 'Invoice date must be a valid date',
          severity: 'error',
        },
        {
          field: 'totalAmount',
          type: 'required',
          rule: '',
          message: 'Total amount is required',
          severity: 'error',
        },
        {
          field: 'totalAmount',
          type: 'format',
          rule: 'amount',
          message: 'Total amount must be a valid positive number',
          severity: 'error',
        },
        {
          field: 'currency',
          type: 'format',
          rule: 'currency',
          message: 'Currency must be a valid currency code',
          severity: 'warning',
        },
        {
          field: 'vendorName',
          type: 'required',
          rule: '',
          message: 'Vendor name is required',
          severity: 'error',
        },
        {
          field: 'vendorEmail',
          type: 'format',
          rule: 'email',
          message: 'Vendor email must be a valid email address',
          severity: 'warning',
        },
      ],
    });

    // Receipt validation schema
    this.schemas.set('receipt', {
      category: 'receipt',
      version: '1.0',
      rules: [
        {
          field: 'receiptDate',
          type: 'format',
          rule: 'date',
          message: 'Receipt date must be a valid date',
          severity: 'error',
        },
        {
          field: 'totalAmount',
          type: 'required',
          rule: '',
          message: 'Total amount is required',
          severity: 'error',
        },
        {
          field: 'totalAmount',
          type: 'format',
          rule: 'amount',
          message: 'Total amount must be a valid positive number',
          severity: 'error',
        },
        {
          field: 'merchantName',
          type: 'required',
          rule: '',
          message: 'Merchant name is required',
          severity: 'error',
        },
      ],
    });

    this.logger.log('Initialized default validation schemas', 'ValidationService');
  }
}