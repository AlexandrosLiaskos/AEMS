import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentService } from './environment.service';
import { AppDataService } from './app-data.service';
import { LoggerService } from './logger.service';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * @interface InitializationResult
 * @purpose Result of environment initialization
 */
export interface InitializationResult {
  success: boolean;
  isFirstRun: boolean;
  configCreated: boolean;
  secretsGenerated: string[];
  warnings: string[];
  errors: string[];
  setupRequired: boolean;
}

/**
 * @interface ValidationResult
 * @purpose Result of environment validation
 */
export interface ValidationResult {
  isValid: boolean;
  missingRequired: string[];
  missingOptional: string[];
  invalidValues: Array<{ field: string; reason: string }>;
  recommendations: string[];
}

/**
 * @class EnvironmentInitializerService
 * @purpose Initialize and validate environment configuration on startup
 */
@Injectable()
export class EnvironmentInitializerService implements OnModuleInit {
  private initializationComplete = false;

  constructor(
    private configService: ConfigService,
    private environmentService: EnvironmentService,
    private appDataService: AppDataService,
    private logger: LoggerService
  ) {}

  /**
   * @method onModuleInit
   * @purpose Initialize environment on module startup
   */
  async onModuleInit(): Promise<void> {
    try {
      const result = await this.initializeEnvironment();
      
      if (result.success) {
        this.logger.log('Environment initialization completed successfully', 'EnvironmentInitializer');
        
        if (result.isFirstRun) {
          this.logger.log('First run detected - setup wizard will be required', 'EnvironmentInitializer');
        }
        
        if (result.secretsGenerated.length > 0) {
          this.logger.log(`Generated secrets: ${result.secretsGenerated.join(', ')}`, 'EnvironmentInitializer');
        }
        
        if (result.warnings.length > 0) {
          result.warnings.forEach(warning => 
            this.logger.warn(warning, 'EnvironmentInitializer')
          );
        }
      } else {
        this.logger.error('Environment initialization failed', null, 'EnvironmentInitializer');
        result.errors.forEach(error => 
          this.logger.error(error, null, 'EnvironmentInitializer')
        );
      }
      
      this.initializationComplete = true;
    } catch (error) {
      this.logger.error(
        'Critical error during environment initialization',
        error.stack,
        'EnvironmentInitializer'
      );
      throw error;
    }
  }

  /**
   * @method initializeEnvironment
   * @purpose Initialize environment configuration
   */
  async initializeEnvironment(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      isFirstRun: false,
      configCreated: false,
      secretsGenerated: [],
      warnings: [],
      errors: [],
      setupRequired: false,
    };

    try {
      // Step 1: Ensure data directories exist
      await this.appDataService.ensureDirectories();

      // Step 2: Check if configuration exists
      const setupStatus = await this.environmentService.checkSetupStatus();
      result.isFirstRun = !setupStatus.hasValidConfig;
      result.setupRequired = !setupStatus.isComplete;

      // Step 3: Handle first run or missing configuration
      if (result.isFirstRun) {
        await this.handleFirstRun(result);
      } else {
        await this.validateExistingConfiguration(result);
      }

      // Step 4: Migrate from portable mode if needed
      await this.handlePortableMigration(result);

      // Step 5: Generate missing secrets
      await this.generateMissingSecrets(result);

      // Step 6: Validate final configuration
      const validation = await this.validateConfiguration();
      if (!validation.isValid) {
        result.warnings.push(...validation.recommendations);
        if (validation.missingRequired.length > 0) {
          result.setupRequired = true;
        }
      }

      result.success = true;
      return result;

    } catch (error) {
      result.errors.push(`Initialization failed: ${error.message}`);
      return result;
    }
  }

  /**
   * @method handleFirstRun
   * @purpose Handle first run initialization
   */
  private async handleFirstRun(result: InitializationResult): Promise<void> {
    this.logger.log('First run detected - creating initial configuration', 'EnvironmentInitializer');

    // Create minimal configuration with generated secrets
    const initialConfig = {
      NODE_ENV: 'production',
      PORT: 3001,
      FRONTEND_URL: 'http://localhost:3000',
      DATABASE_TYPE: 'json',
      DATABASE_PATH: this.appDataService.getDataPath(),
      LOG_FILE: this.appDataService.getLogFilePath('aems.log'),
      JWT_SECRET: this.generateSecret(64),
      SESSION_SECRET: this.generateSecret(32),
      ENABLE_AI_PROCESSING: true,
      CLASSIFICATION_CONFIDENCE_THRESHOLD: 0.8,
      EXTRACTION_CONFIDENCE_THRESHOLD: 0.9,
      LOG_LEVEL: 'info',
      ENABLE_NOTIFICATIONS: true,
      ENABLE_METRICS: true,
      MAX_CONCURRENT_EMAILS: 5,
      CACHE_TTL: 300,
      API_RATE_LIMIT: 1000,
      BACKUP_ENABLED: true,
      BACKUP_RETENTION_DAYS: 30,
    };

    await this.environmentService.createInitialConfig(initialConfig);
    
    result.configCreated = true;
    result.secretsGenerated.push('JWT_SECRET', 'SESSION_SECRET');
    result.setupRequired = true; // API keys still needed
  }

  /**
   * @method validateExistingConfiguration
   * @purpose Validate existing configuration
   */
  private async validateExistingConfiguration(result: InitializationResult): Promise<void> {
    try {
      const config = await this.environmentService.loadEnvironmentConfig();
      
      // Check for missing or invalid values
      const validation = await this.validateConfiguration();
      
      if (validation.invalidValues.length > 0) {
        result.warnings.push('Configuration has invalid values that may need attention');
        validation.invalidValues.forEach(invalid => {
          result.warnings.push(`${invalid.field}: ${invalid.reason}`);
        });
      }

      // Update paths to use AppDataService if they're still using relative paths
      let needsUpdate = false;
      const updates: any = {};

      if (config.DATABASE_PATH === 'data' || config.DATABASE_PATH?.startsWith('./')) {
        updates.DATABASE_PATH = this.appDataService.getDataPath();
        needsUpdate = true;
      }

      if (config.LOG_FILE === 'logs/aems.log' || config.LOG_FILE?.startsWith('./')) {
        updates.LOG_FILE = this.appDataService.getLogFilePath('aems.log');
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.environmentService.updateConfig(updates);
        result.warnings.push('Updated configuration paths to use OS-specific directories');
      }

    } catch (error) {
      result.warnings.push(`Could not validate existing configuration: ${error.message}`);
    }
  }

  /**
   * @method handlePortableMigration
   * @purpose Handle migration from portable mode
   */
  private async handlePortableMigration(result: InitializationResult): Promise<void> {
    // Check if there's data in the current directory that should be migrated
    const portableDataPath = path.join(process.cwd(), 'data');
    
    try {
      await fs.access(portableDataPath);
      
      // Check if we're not already in portable mode
      if (!this.appDataService.isPortableMode()) {
        const osDataPath = this.appDataService.getDataPath();
        
        // Check if OS-specific directory is empty or doesn't exist
        let shouldMigrate = false;
        try {
          const osDataContents = await fs.readdir(osDataPath);
          shouldMigrate = osDataContents.length === 0;
        } catch (error) {
          shouldMigrate = true; // Directory doesn't exist
        }

        if (shouldMigrate) {
          this.logger.log('Migrating data from portable mode to OS-specific directory', 'EnvironmentInitializer');
          await this.appDataService.migrateFromPortableMode(portableDataPath);
          result.warnings.push('Migrated data from portable mode to OS-specific directory');
        }
      }
    } catch (error) {
      // No portable data to migrate, which is fine
    }
  }

  /**
   * @method generateMissingSecrets
   * @purpose Generate missing secrets in configuration
   */
  private async generateMissingSecrets(result: InitializationResult): Promise<void> {
    try {
      const config = await this.environmentService.loadEnvironmentConfig();
      const updates: any = {};
      let needsUpdate = false;

      // Check and generate JWT secret
      if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
        updates.JWT_SECRET = this.generateSecret(64);
        result.secretsGenerated.push('JWT_SECRET');
        needsUpdate = true;
      }

      // Check and generate session secret
      if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 16) {
        updates.SESSION_SECRET = this.generateSecret(32);
        result.secretsGenerated.push('SESSION_SECRET');
        needsUpdate = true;
      }

      // Generate Google redirect URI if missing
      if (!config.GOOGLE_REDIRECT_URI) {
        const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000';
        const backendPort = config.PORT || 3001;
        updates.GOOGLE_REDIRECT_URI = `http://localhost:${backendPort}/api/auth/google/callback`;
        result.secretsGenerated.push('GOOGLE_REDIRECT_URI');
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.environmentService.updateConfig(updates);
      }

    } catch (error) {
      result.warnings.push(`Could not generate missing secrets: ${error.message}`);
    }
  }

  /**
   * @method validateConfiguration
   * @purpose Validate current configuration
   */
  async validateConfiguration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      missingRequired: [],
      missingOptional: [],
      invalidValues: [],
      recommendations: [],
    };

    try {
      const config = await this.environmentService.loadEnvironmentConfig();

      // Required fields validation
      const requiredFields = [
        'JWT_SECRET',
        'SESSION_SECRET',
        'DATABASE_PATH',
        'PORT',
      ];

      for (const field of requiredFields) {
        if (!config[field as keyof typeof config]) {
          result.missingRequired.push(field);
          result.isValid = false;
        }
      }

      // API keys validation (required for full functionality)
      const apiFields = ['OPENAI_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
      for (const field of apiFields) {
        if (!config[field as keyof typeof config]) {
          result.missingOptional.push(field);
        }
      }

      // Value validation
      if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
        result.invalidValues.push({
          field: 'JWT_SECRET',
          reason: 'Should be at least 32 characters for security',
        });
      }

      if (config.SESSION_SECRET && config.SESSION_SECRET.length < 16) {
        result.invalidValues.push({
          field: 'SESSION_SECRET',
          reason: 'Should be at least 16 characters for security',
        });
      }

      if (config.PORT && (config.PORT < 1024 || config.PORT > 65535)) {
        result.invalidValues.push({
          field: 'PORT',
          reason: 'Should be between 1024 and 65535',
        });
      }

      if (config.OPENAI_API_KEY && !config.OPENAI_API_KEY.startsWith('sk-')) {
        result.invalidValues.push({
          field: 'OPENAI_API_KEY',
          reason: 'Should start with "sk-" for OpenAI API keys',
        });
      }

      // Generate recommendations
      if (result.missingOptional.length > 0) {
        result.recommendations.push(
          `API keys missing: ${result.missingOptional.join(', ')}. ` +
          'Run the setup wizard to configure these for full functionality.'
        );
      }

      if (result.invalidValues.length > 0) {
        result.recommendations.push(
          'Some configuration values may need attention. Check the setup wizard for validation.'
        );
      }

      if (config.NODE_ENV !== 'production' && process.env.NODE_ENV === 'production') {
        result.recommendations.push(
          'NODE_ENV in configuration does not match runtime environment'
        );
      }

    } catch (error) {
      result.isValid = false;
      result.recommendations.push(`Configuration validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * @method generateSecret
   * @purpose Generate cryptographically secure secret
   */
  private generateSecret(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * @method isInitializationComplete
   * @purpose Check if initialization is complete
   */
  isInitializationComplete(): boolean {
    return this.initializationComplete;
  }

  /**
   * @method getInitializationStatus
   * @purpose Get current initialization status
   */
  async getInitializationStatus(): Promise<{
    complete: boolean;
    setupRequired: boolean;
    dataPath: string;
    configPath: string;
  }> {
    const setupStatus = await this.environmentService.checkSetupStatus();
    
    return {
      complete: this.initializationComplete,
      setupRequired: !setupStatus.isComplete,
      dataPath: this.appDataService.getDataPath(),
      configPath: setupStatus.configPath,
    };
  }

  /**
   * @method regenerateSecrets
   * @purpose Regenerate all secrets (for security purposes)
   */
  async regenerateSecrets(): Promise<string[]> {
    const regenerated: string[] = [];

    try {
      const updates = {
        JWT_SECRET: this.generateSecret(64),
        SESSION_SECRET: this.generateSecret(32),
      };

      await this.environmentService.updateConfig(updates);
      regenerated.push('JWT_SECRET', 'SESSION_SECRET');

      this.logger.log('Security secrets regenerated', 'EnvironmentInitializer');

    } catch (error) {
      this.logger.error(
        'Failed to regenerate secrets',
        error.stack,
        'EnvironmentInitializer'
      );
      throw error;
    }

    return regenerated;
  }
}