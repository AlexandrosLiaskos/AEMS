import { Injectable, BadRequestException } from '@nestjs/common';
import { EnvironmentService, EnvironmentConfig } from '../../../common/services/environment.service';
import { AppDataService } from '../../../common/services/app-data.service';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface SetupWizardStep
 * @purpose Setup wizard step definition
 */
export interface SetupWizardStep {
  id: string;
  title: string;
  description: string;
  fields: SetupField[];
  isComplete: boolean;
  isRequired: boolean;
}

/**
 * @interface SetupField
 * @purpose Setup field definition
 */
export interface SetupField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'number' | 'boolean' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  options?: Array<{ value: string; label: string }>;
  value?: any;
}

/**
 * @interface SetupProgress
 * @purpose Setup progress information
 */
export interface SetupProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  isComplete: boolean;
  canProceed: boolean;
  steps: SetupWizardStep[];
}

/**
 * @class SetupService
 * @purpose Handle initial application setup wizard
 */
@Injectable()
export class SetupService {
  constructor(
    private environmentService: EnvironmentService,
    private appDataService: AppDataService,
    private logger: LoggerService
  ) {}

  /**
   * @method getSetupProgress
   * @purpose Get current setup progress
   */
  async getSetupProgress(): Promise<SetupProgress> {
    const setupStatus = await this.environmentService.checkSetupStatus();
    const steps = this.getSetupSteps();

    // Load existing configuration if available
    let existingConfig: Partial<EnvironmentConfig> = {};
    if (setupStatus.hasValidConfig) {
      try {
        existingConfig = await this.environmentService.loadEnvironmentConfig();
      } catch (error) {
        this.logger.warn('Failed to load existing configuration', 'SetupService');
      }
    }

    // Update steps with existing values and completion status
    this.updateStepsWithExistingConfig(steps, existingConfig, setupStatus);

    const completedSteps = steps.filter(step => step.isComplete).length;
    const currentStep = steps.findIndex(step => !step.isComplete);

    return {
      currentStep: currentStep === -1 ? steps.length - 1 : currentStep,
      totalSteps: steps.length,
      completedSteps,
      isComplete: setupStatus.isComplete,
      canProceed: this.canProceedToNextStep(steps, currentStep),
      steps,
    };
  }

  /**
   * @method validateStep
   * @purpose Validate a setup step
   */
  async validateStep(stepId: string, data: Record<string, any>): Promise<{
    isValid: boolean;
    errors: Record<string, string>;
    warnings: Record<string, string>;
  }> {
    const steps = this.getSetupSteps();
    const step = steps.find(s => s.id === stepId);

    if (!step) {
      throw new BadRequestException(`Invalid step ID: ${stepId}`);
    }

    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Validate each field
    for (const field of step.fields) {
      const value = data[field.name];

      // Required field validation
      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} is required`;
        continue;
      }

      // Skip further validation if field is empty and not required
      if (!value) continue;

      // Type-specific validation
      const fieldErrors = this.validateField(field, value);
      if (fieldErrors.length > 0) {
        errors[field.name] = fieldErrors[0];
      }

      // Special validations for API keys
      if (stepId === 'api-keys') {
        const apiValidation = await this.validateApiCredentials(field.name, value);
        if (!apiValidation.valid && apiValidation.error) {
          if (field.required) {
            errors[field.name] = apiValidation.error;
          } else {
            warnings[field.name] = apiValidation.error;
          }
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
    };
  }

  /**
   * @method saveStepData
   * @purpose Save step data
   */
  async saveStepData(stepId: string, data: Record<string, any>): Promise<void> {
    // Validate step data first
    const validation = await this.validateStep(stepId, data);
    if (!validation.isValid) {
      throw new BadRequestException('Invalid step data', JSON.stringify(validation.errors));
    }

    // Load existing configuration
    let existingConfig: Partial<EnvironmentConfig> = {};
    try {
      const setupStatus = await this.environmentService.checkSetupStatus();
      if (setupStatus.hasValidConfig) {
        existingConfig = await this.environmentService.loadEnvironmentConfig();
      }
    } catch (error) {
      // Ignore errors when loading existing config
    }

    // Map step data to environment config
    const configUpdates = this.mapStepDataToConfig(stepId, data);

    // Merge with existing configuration
    const updatedConfig = { ...existingConfig, ...configUpdates };

    // Save configuration
    if (Object.keys(existingConfig).length === 0) {
      await this.environmentService.createInitialConfig(updatedConfig);
    } else {
      await this.environmentService.updateConfig(configUpdates);
    }

    this.logger.log(`Setup step '${stepId}' data saved`, 'SetupService');
  }

  /**
   * @method completeSetup
   * @purpose Complete the setup process
   */
  async completeSetup(): Promise<{ success: boolean; message: string; configPath: string }> {
    const setupStatus = await this.environmentService.checkSetupStatus();

    if (!setupStatus.isComplete) {
      throw new BadRequestException(
        'Setup is not complete. Missing required fields: ' + 
        setupStatus.missingRequiredFields.join(', ')
      );
    }

    // Perform final validation
    const config = await this.environmentService.loadEnvironmentConfig();
    const apiValidation = await this.environmentService.validateApiKeys(config);

    if (!apiValidation.openai.valid || !apiValidation.google.valid) {
      throw new BadRequestException('API credentials validation failed');
    }

    this.logger.log('Initial setup completed successfully', 'SetupService');

    return {
      success: true,
      message: 'Setup completed successfully! You can now start using AEMS.',
      configPath: setupStatus.configPath,
    };
  }

  /**
   * @method getSetupSteps
   * @purpose Get setup wizard steps
   */
  private getSetupSteps(): SetupWizardStep[] {
    return [
      {
        id: 'welcome',
        title: 'Welcome to AEMS',
        description: 'Welcome to the Automated Email Management System setup wizard. This will guide you through the initial configuration.',
        isRequired: true,
        isComplete: false,
        fields: [
          {
            name: 'acceptTerms',
            label: 'I accept the terms and conditions',
            type: 'boolean',
            required: true,
            description: 'By proceeding, you agree to the AEMS terms of service and privacy policy.',
          },
        ],
      },
      {
        id: 'api-keys',
        title: 'API Configuration',
        description: 'Configure your API keys for OpenAI and Google services. These are required for AI processing and Gmail integration.',
        isRequired: true,
        isComplete: false,
        fields: [
          {
            name: 'OPENAI_API_KEY',
            label: 'OpenAI API Key',
            type: 'password',
            required: true,
            placeholder: 'sk-...',
            description: 'Your OpenAI API key for AI-powered email classification and data extraction. Get one from https://platform.openai.com/api-keys',
            validation: {
              pattern: '^sk-[a-zA-Z0-9]{48,}$',
              minLength: 20,
            },
          },
          {
            name: 'GOOGLE_CLIENT_ID',
            label: 'Google Client ID',
            type: 'text',
            required: true,
            placeholder: 'your-client-id.apps.googleusercontent.com',
            description: 'Google OAuth Client ID for Gmail integration. Get one from Google Cloud Console.',
            validation: {
              pattern: '.*\\.apps\\.googleusercontent\\.com$',
            },
          },
          {
            name: 'GOOGLE_CLIENT_SECRET',
            label: 'Google Client Secret',
            type: 'password',
            required: true,
            placeholder: 'GOCSPX-...',
            description: 'Google OAuth Client Secret for Gmail integration.',
            validation: {
              minLength: 10,
            },
          },
        ],
      },
      {
        id: 'ai-settings',
        title: 'AI Processing Settings',
        description: 'Configure AI processing parameters for email classification and data extraction.',
        isRequired: false,
        isComplete: false,
        fields: [
          {
            name: 'OPENAI_MODEL',
            label: 'OpenAI Model',
            type: 'select',
            required: false,
            description: 'Choose the OpenAI model for AI processing. GPT-3.5-turbo is recommended for cost-effectiveness.',
            options: [
              { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Recommended)' },
              { value: 'gpt-4', label: 'GPT-4 (Higher accuracy, more expensive)' },
              { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Balanced)' },
            ],
            value: 'gpt-3.5-turbo',
          },
          {
            name: 'CLASSIFICATION_CONFIDENCE_THRESHOLD',
            label: 'Classification Confidence Threshold',
            type: 'number',
            required: false,
            description: 'Minimum confidence score for automatic email classification (0.0 - 1.0).',
            validation: {
              min: 0,
              max: 1,
            },
            value: 0.8,
          },
          {
            name: 'EXTRACTION_CONFIDENCE_THRESHOLD',
            label: 'Extraction Confidence Threshold',
            type: 'number',
            required: false,
            description: 'Minimum confidence score for automatic data extraction (0.0 - 1.0).',
            validation: {
              min: 0,
              max: 1,
            },
            value: 0.9,
          },
        ],
      },
      {
        id: 'application-settings',
        title: 'Application Settings',
        description: 'Configure general application settings and preferences.',
        isRequired: false,
        isComplete: false,
        fields: [
          {
            name: 'FRONTEND_URL',
            label: 'Frontend URL',
            type: 'url',
            required: false,
            placeholder: 'http://localhost:3000',
            description: 'URL where the frontend application will be accessible.',
            value: 'http://localhost:3000',
          },
          {
            name: 'LOG_LEVEL',
            label: 'Log Level',
            type: 'select',
            required: false,
            description: 'Application logging level.',
            options: [
              { value: 'error', label: 'Error' },
              { value: 'warn', label: 'Warning' },
              { value: 'info', label: 'Info (Recommended)' },
              { value: 'debug', label: 'Debug' },
            ],
            value: 'info',
          },
          {
            name: 'ENABLE_NOTIFICATIONS',
            label: 'Enable Notifications',
            type: 'boolean',
            required: false,
            description: 'Enable real-time notifications for email processing updates.',
            value: true,
          },
        ],
      },
      {
        id: 'review',
        title: 'Review & Complete',
        description: 'Review your configuration and complete the setup process.',
        isRequired: true,
        isComplete: false,
        fields: [
          {
            name: 'confirmSetup',
            label: 'I confirm that the configuration is correct',
            type: 'boolean',
            required: true,
            description: 'Please review all settings before completing the setup.',
          },
        ],
      },
    ];
  }

  /**
   * @method updateStepsWithExistingConfig
   * @purpose Update steps with existing configuration values
   */
  private updateStepsWithExistingConfig(
    steps: SetupWizardStep[],
    config: Partial<EnvironmentConfig>,
    setupStatus: any
  ): void {
    for (const step of steps) {
      for (const field of step.fields) {
        // Set existing values
        if (config[field.name as keyof EnvironmentConfig] !== undefined) {
          field.value = config[field.name as keyof EnvironmentConfig];
        }
      }

      // Mark step as complete based on required fields
      if (step.id === 'api-keys') {
        step.isComplete = setupStatus.missingRequiredFields.length === 0;
      } else if (step.isRequired) {
        step.isComplete = step.fields.every(field => 
          !field.required || (field.value !== undefined && field.value !== '')
        );
      } else {
        step.isComplete = true; // Optional steps are considered complete by default
      }
    }
  }

  /**
   * @method validateField
   * @purpose Validate individual field
   */
  private validateField(field: SetupField, value: any): string[] {
    const errors: string[] = [];

    if (!field.validation) return errors;

    const stringValue = value?.toString() || '';

    // Pattern validation
    if (field.validation.pattern && stringValue) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(stringValue)) {
        errors.push(`${field.label} format is invalid`);
      }
    }

    // Length validation
    if (field.validation.minLength && stringValue.length < field.validation.minLength) {
      errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
    }

    if (field.validation.maxLength && stringValue.length > field.validation.maxLength) {
      errors.push(`${field.label} must be no more than ${field.validation.maxLength} characters`);
    }

    // Number validation
    if (field.type === 'number') {
      const numValue = parseFloat(stringValue);
      if (isNaN(numValue)) {
        errors.push(`${field.label} must be a valid number`);
      } else {
        if (field.validation.min !== undefined && numValue < field.validation.min) {
          errors.push(`${field.label} must be at least ${field.validation.min}`);
        }
        if (field.validation.max !== undefined && numValue > field.validation.max) {
          errors.push(`${field.label} must be no more than ${field.validation.max}`);
        }
      }
    }

    // URL validation
    if (field.type === 'url' && stringValue) {
      try {
        new URL(stringValue);
      } catch {
        errors.push(`${field.label} must be a valid URL`);
      }
    }

    // Email validation
    if (field.type === 'email' && stringValue) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(stringValue)) {
        errors.push(`${field.label} must be a valid email address`);
      }
    }

    return errors;
  }

  /**
   * @method validateApiCredentials
   * @purpose Validate API credentials
   */
  private async validateApiCredentials(fieldName: string, value: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    switch (fieldName) {
      case 'OPENAI_API_KEY':
        if (!value.startsWith('sk-') || value.length < 20) {
          return { valid: false, error: 'Invalid OpenAI API key format' };
        }
        return { valid: true };

      case 'GOOGLE_CLIENT_ID':
        if (!value.includes('.googleusercontent.com')) {
          return { valid: false, error: 'Invalid Google Client ID format' };
        }
        return { valid: true };

      case 'GOOGLE_CLIENT_SECRET':
        if (value.length < 10) {
          return { valid: false, error: 'Google Client Secret appears to be too short' };
        }
        return { valid: true };

      default:
        return { valid: true };
    }
  }

  /**
   * @method mapStepDataToConfig
   * @purpose Map step data to environment configuration
   */
  private mapStepDataToConfig(stepId: string, data: Record<string, any>): Partial<EnvironmentConfig> {
    const config: Partial<EnvironmentConfig> = {};

    // Direct mapping for most fields
    const directMappingFields = [
      'OPENAI_API_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'OPENAI_MODEL',
      'CLASSIFICATION_CONFIDENCE_THRESHOLD',
      'EXTRACTION_CONFIDENCE_THRESHOLD',
      'FRONTEND_URL',
      'LOG_LEVEL',
      'ENABLE_NOTIFICATIONS',
    ];

    for (const field of directMappingFields) {
      if (data[field] !== undefined) {
        (config as any)[field] = data[field];
      }
    }

    return config;
  }

  /**
   * @method canProceedToNextStep
   * @purpose Check if can proceed to next step
   */
  private canProceedToNextStep(steps: SetupWizardStep[], currentStepIndex: number): boolean {
    if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
      return false;
    }

    const currentStep = steps[currentStepIndex];
    return currentStep.isComplete || !currentStep.isRequired;
  }
}