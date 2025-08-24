import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { AppDataService } from './app-data.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * @interface EnvironmentConfig
 * @purpose Environment configuration structure
 */
export interface EnvironmentConfig {
  // Application
  NODE_ENV: string;
  PORT: number;
  FRONTEND_URL: string;

  // Database
  DATABASE_TYPE: string;
  DATABASE_PATH: string;
  BACKUP_ENABLED: boolean;
  BACKUP_RETENTION_DAYS: number;

  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  SESSION_SECRET: string;

  // Google OAuth
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI: string;

  // OpenAI
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  OPENAI_MAX_TOKENS: number;

  // AI Processing
  ENABLE_AI_PROCESSING: boolean;
  CLASSIFICATION_CONFIDENCE_THRESHOLD: number;
  EXTRACTION_CONFIDENCE_THRESHOLD: number;

  // Logging
  LOG_LEVEL: string;
  LOG_FILE: string;

  // Features
  ENABLE_NOTIFICATIONS: boolean;
  ENABLE_METRICS: boolean;

  // Performance
  MAX_CONCURRENT_EMAILS: number;
  CACHE_TTL: number;
  API_RATE_LIMIT: number;
}

/**
 * @interface SetupStatus
 * @purpose Setup completion status
 */
export interface SetupStatus {
  isComplete: boolean;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  hasValidConfig: boolean;
  configPath: string;
}

/**
 * @class EnvironmentService
 * @purpose Manage environment configuration and setup
 */
@Injectable()
export class EnvironmentService {
  private configCache: EnvironmentConfig | null = null;

  constructor(
    private configService: ConfigService,
    private appDataService: AppDataService,
    private logger: LoggerService
  ) {}

  /**
   * @method checkSetupStatus
   * @purpose Check if initial setup is complete
   */
  async checkSetupStatus(): Promise<SetupStatus> {
    const configPath = this.appDataService.getConfigFilePath('.env');
    const hasConfigFile = await this.fileExists(configPath);

    if (!hasConfigFile) {
      return {
        isComplete: false,
        missingRequiredFields: this.getRequiredFields(),
        missingOptionalFields: this.getOptionalFields(),
        hasValidConfig: false,
        configPath,
      };
    }

    const config = await this.loadEnvironmentConfig();
    const missingRequired = this.validateRequiredFields(config);
    const missingOptional = this.validateOptionalFields(config);

    return {
      isComplete: missingRequired.length === 0,
      missingRequiredFields: missingRequired,
      missingOptionalFields: missingOptional,
      hasValidConfig: true,
      configPath,
    };
  }

  /**
   * @method createInitialConfig
   * @purpose Create initial environment configuration
   */
  async createInitialConfig(userInputs: Partial<EnvironmentConfig>): Promise<void> {
    const configPath = this.appDataService.getConfigFilePath('.env');
    
    // Generate default configuration
    const config = this.generateDefaultConfig();
    
    // Override with user inputs
    Object.assign(config, userInputs);

    // Generate missing secrets
    if (!config.JWT_SECRET) {
      config.JWT_SECRET = this.generateSecret(64);
    }
    
    if (!config.SESSION_SECRET) {
      config.SESSION_SECRET = this.generateSecret(32);
    }

    // Set paths to use AppDataService
    config.DATABASE_PATH = this.appDataService.getDataPath();
    config.LOG_FILE = this.appDataService.getLogFilePath('aems.log');

    // Create .env file content
    const envContent = this.generateEnvFileContent(config);

    // Write configuration file
    await fs.writeFile(configPath, envContent, 'utf-8');

    this.logger.log(`Environment configuration created at: ${configPath}`, 'EnvironmentService');
    
    // Clear cache to force reload
    this.configCache = null;
  }

  /**
   * @method updateConfig
   * @purpose Update existing configuration
   */
  async updateConfig(updates: Partial<EnvironmentConfig>): Promise<void> {
    const configPath = this.appDataService.getConfigFilePath('.env');
    const currentConfig = await this.loadEnvironmentConfig();

    // Merge updates
    const updatedConfig = { ...currentConfig, ...updates };

    // Create .env file content
    const envContent = this.generateEnvFileContent(updatedConfig);

    // Write updated configuration
    await fs.writeFile(configPath, envContent, 'utf-8');

    this.logger.log('Environment configuration updated', 'EnvironmentService');
    
    // Clear cache
    this.configCache = null;
  }

  /**
   * @method loadEnvironmentConfig
   * @purpose Load environment configuration from file
   */
  async loadEnvironmentConfig(): Promise<EnvironmentConfig> {
    if (this.configCache) {
      return this.configCache;
    }

    const configPath = this.appDataService.getConfigFilePath('.env');
    
    if (!await this.fileExists(configPath)) {
      throw new Error('Environment configuration file not found');
    }

    const envContent = await fs.readFile(configPath, 'utf-8');
    const config = this.parseEnvContent(envContent);

    this.configCache = config;
    return config;
  }

  /**
   * @method validateApiKeys
   * @purpose Validate API keys and credentials
   */
  async validateApiKeys(config: Partial<EnvironmentConfig>): Promise<{
    openai: { valid: boolean; error?: string };
    google: { valid: boolean; error?: string };
  }> {
    const results = {
      openai: { valid: false, error: undefined as string | undefined },
      google: { valid: false, error: undefined as string | undefined },
    };

    // Validate OpenAI API key
    if (config.OPENAI_API_KEY) {
      try {
        // Basic format validation
        if (config.OPENAI_API_KEY.startsWith('sk-') && config.OPENAI_API_KEY.length > 20) {
          results.openai.valid = true;
        } else {
          results.openai.error = 'Invalid OpenAI API key format';
        }
      } catch (error) {
        results.openai.error = error.message;
      }
    } else {
      results.openai.error = 'OpenAI API key is required';
    }

    // Validate Google OAuth credentials
    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
      try {
        // Basic format validation
        if (config.GOOGLE_CLIENT_ID.includes('.googleusercontent.com') && 
            config.GOOGLE_CLIENT_SECRET.length > 10) {
          results.google.valid = true;
        } else {
          results.google.error = 'Invalid Google OAuth credentials format';
        }
      } catch (error) {
        results.google.error = error.message;
      }
    } else {
      results.google.error = 'Google OAuth credentials are required';
    }

    return results;
  }

  /**
   * @method generateDefaultConfig
   * @purpose Generate default configuration
   */
  private generateDefaultConfig(): EnvironmentConfig {
    const dataPath = this.appDataService.getDataPath();
    const logPath = this.appDataService.getLogFilePath('aems.log');

    return {
      // Application
      NODE_ENV: 'production',
      PORT: 3001,
      FRONTEND_URL: 'http://localhost:3000',

      // Database
      DATABASE_TYPE: 'json',
      DATABASE_PATH: dataPath,
      BACKUP_ENABLED: true,
      BACKUP_RETENTION_DAYS: 30,

      // Authentication
      JWT_SECRET: '', // Will be generated
      JWT_EXPIRES_IN: '7d',
      SESSION_SECRET: '', // Will be generated

      // Google OAuth
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/auth/google/callback',

      // OpenAI
      OPENAI_MODEL: 'gpt-3.5-turbo',
      OPENAI_MAX_TOKENS: 1000,

      // AI Processing
      ENABLE_AI_PROCESSING: true,
      CLASSIFICATION_CONFIDENCE_THRESHOLD: 0.8,
      EXTRACTION_CONFIDENCE_THRESHOLD: 0.9,

      // Logging
      LOG_LEVEL: 'info',
      LOG_FILE: logPath,

      // Features
      ENABLE_NOTIFICATIONS: true,
      ENABLE_METRICS: true,

      // Performance
      MAX_CONCURRENT_EMAILS: 5,
      CACHE_TTL: 300,
      API_RATE_LIMIT: 1000,
    };
  }

  /**
   * @method generateEnvFileContent
   * @purpose Generate .env file content
   */
  private generateEnvFileContent(config: EnvironmentConfig): string {
    const lines = [
      '# AEMS Environment Configuration',
      '# Generated automatically - modify with care',
      '',
      '# =============================================================================',
      '# APPLICATION SETTINGS',
      '# =============================================================================',
      `NODE_ENV=${config.NODE_ENV}`,
      `PORT=${config.PORT}`,
      `FRONTEND_URL=${config.FRONTEND_URL}`,
      '',
      '# =============================================================================',
      '# DATABASE CONFIGURATION',
      '# =============================================================================',
      `DATABASE_TYPE=${config.DATABASE_TYPE}`,
      `DATABASE_PATH=${config.DATABASE_PATH}`,
      `BACKUP_ENABLED=${config.BACKUP_ENABLED}`,
      `BACKUP_RETENTION_DAYS=${config.BACKUP_RETENTION_DAYS}`,
      '',
      '# =============================================================================',
      '# AUTHENTICATION & SECURITY',
      '# =============================================================================',
      `JWT_SECRET=${config.JWT_SECRET}`,
      `JWT_EXPIRES_IN=${config.JWT_EXPIRES_IN}`,
      `SESSION_SECRET=${config.SESSION_SECRET}`,
      '',
      '# =============================================================================',
      '# GOOGLE OAUTH & GMAIL API',
      '# =============================================================================',
      `GOOGLE_CLIENT_ID=${config.GOOGLE_CLIENT_ID || ''}`,
      `GOOGLE_CLIENT_SECRET=${config.GOOGLE_CLIENT_SECRET || ''}`,
      `GOOGLE_REDIRECT_URI=${config.GOOGLE_REDIRECT_URI}`,
      '',
      '# =============================================================================',
      '# OPENAI API CONFIGURATION',
      '# =============================================================================',
      `OPENAI_API_KEY=${config.OPENAI_API_KEY || ''}`,
      `OPENAI_MODEL=${config.OPENAI_MODEL}`,
      `OPENAI_MAX_TOKENS=${config.OPENAI_MAX_TOKENS}`,
      '',
      '# =============================================================================',
      '# AI PROCESSING SETTINGS',
      '# =============================================================================',
      `ENABLE_AI_PROCESSING=${config.ENABLE_AI_PROCESSING}`,
      `CLASSIFICATION_CONFIDENCE_THRESHOLD=${config.CLASSIFICATION_CONFIDENCE_THRESHOLD}`,
      `EXTRACTION_CONFIDENCE_THRESHOLD=${config.EXTRACTION_CONFIDENCE_THRESHOLD}`,
      '',
      '# =============================================================================',
      '# LOGGING CONFIGURATION',
      '# =============================================================================',
      `LOG_LEVEL=${config.LOG_LEVEL}`,
      `LOG_FILE=${config.LOG_FILE}`,
      '',
      '# =============================================================================',
      '# FEATURE FLAGS',
      '# =============================================================================',
      `ENABLE_NOTIFICATIONS=${config.ENABLE_NOTIFICATIONS}`,
      `ENABLE_METRICS=${config.ENABLE_METRICS}`,
      '',
      '# =============================================================================',
      '# PERFORMANCE SETTINGS',
      '# =============================================================================',
      `MAX_CONCURRENT_EMAILS=${config.MAX_CONCURRENT_EMAILS}`,
      `CACHE_TTL=${config.CACHE_TTL}`,
      `API_RATE_LIMIT=${config.API_RATE_LIMIT}`,
    ];

    return lines.join('\n') + '\n';
  }

  /**
   * @method parseEnvContent
   * @purpose Parse .env file content
   */
  private parseEnvContent(content: string): EnvironmentConfig {
    const config = this.generateDefaultConfig();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');

        if (key && value !== undefined) {
          // Type conversion
          if (value === 'true') {
            (config as any)[key] = true;
          } else if (value === 'false') {
            (config as any)[key] = false;
          } else if (!isNaN(Number(value))) {
            (config as any)[key] = Number(value);
          } else {
            (config as any)[key] = value;
          }
        }
      }
    }

    return config;
  }

  /**
   * @method getRequiredFields
   * @purpose Get list of required configuration fields
   */
  private getRequiredFields(): string[] {
    return [
      'OPENAI_API_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
    ];
  }

  /**
   * @method getOptionalFields
   * @purpose Get list of optional configuration fields
   */
  private getOptionalFields(): string[] {
    return [
      'FRONTEND_URL',
      'LOG_LEVEL',
      'OPENAI_MODEL',
      'CLASSIFICATION_CONFIDENCE_THRESHOLD',
      'EXTRACTION_CONFIDENCE_THRESHOLD',
    ];
  }

  /**
   * @method validateRequiredFields
   * @purpose Validate required configuration fields
   */
  private validateRequiredFields(config: EnvironmentConfig): string[] {
    const missing: string[] = [];
    const required = this.getRequiredFields();

    for (const field of required) {
      if (!config[field as keyof EnvironmentConfig]) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * @method validateOptionalFields
   * @purpose Validate optional configuration fields
   */
  private validateOptionalFields(config: EnvironmentConfig): string[] {
    const missing: string[] = [];
    const optional = this.getOptionalFields();

    for (const field of optional) {
      if (!config[field as keyof EnvironmentConfig]) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * @method generateSecret
   * @purpose Generate cryptographic secret
   */
  private generateSecret(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * @method fileExists
   * @purpose Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}