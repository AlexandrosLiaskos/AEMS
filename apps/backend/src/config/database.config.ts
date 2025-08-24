import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { join } from 'path';

/**
 * @interface DatabaseConfig
 * @purpose Database configuration interface
 */
export interface DatabaseConfig {
  type: 'json' | 'sqlite';
  path: string;
  synchronize: boolean;
  logging: boolean;
  maxConnections: number;
  acquireTimeout: number;
  timeout: number;
  backupEnabled: boolean;
  backupInterval: number;
  backupRetention: number;
}

/**
 * @constant databaseConfigSchema
 * @purpose Joi validation schema for database configuration
 */
export const databaseConfigSchema = Joi.object({
  DATABASE_TYPE: Joi.string()
    .valid('json', 'sqlite')
    .default('json'),
  DATABASE_PATH: Joi.string().default('data'),
  DATABASE_SYNCHRONIZE: Joi.boolean().default(true),
  DATABASE_LOGGING: Joi.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: Joi.number().min(1).max(100).default(10),
  DATABASE_ACQUIRE_TIMEOUT: Joi.number().min(1000).default(60000),
  DATABASE_TIMEOUT: Joi.number().min(1000).default(30000),
  DATABASE_BACKUP_ENABLED: Joi.boolean().default(true),
  DATABASE_BACKUP_INTERVAL: Joi.number().min(60000).default(900000), // 15 minutes
  DATABASE_BACKUP_RETENTION: Joi.number().min(1).default(30), // 30 days
});

/**
 * @function databaseConfig
 * @purpose Database configuration factory
 * @returns {DatabaseConfig} Validated database configuration
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Determine data directory based on environment
  let dataPath: string;
  if (nodeEnv === 'development') {
    dataPath = join(process.cwd(), 'dev-data');
  } else if (nodeEnv === 'test') {
    dataPath = join(process.cwd(), 'test-data');
  } else {
    // Production - use OS-appropriate directories
    const os = require('os');
    const path = require('path');
    
    if (process.platform === 'win32') {
      dataPath = path.join(os.homedir(), 'AppData', 'Local', 'AEMS');
    } else if (process.platform === 'darwin') {
      dataPath = path.join(os.homedir(), 'Library', 'Application Support', 'AEMS');
    } else {
      dataPath = path.join(os.homedir(), '.local', 'share', 'AEMS');
    }
  }

  const config = {
    type: (process.env.DATABASE_TYPE as 'json' | 'sqlite') || 'json',
    path: process.env.DATABASE_PATH || dataPath,
    synchronize: process.env.DATABASE_SYNCHRONIZE !== 'false',
    logging: process.env.DATABASE_LOGGING === 'true',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10) || 10,
    acquireTimeout: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT, 10) || 60000,
    timeout: parseInt(process.env.DATABASE_TIMEOUT, 10) || 30000,
    backupEnabled: process.env.DATABASE_BACKUP_ENABLED !== 'false',
    backupInterval: parseInt(process.env.DATABASE_BACKUP_INTERVAL, 10) || 900000,
    backupRetention: parseInt(process.env.DATABASE_BACKUP_RETENTION, 10) || 30,
  };

  // Validate configuration
  const { error } = databaseConfigSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (error) {
    throw new Error(`Database configuration validation error: ${error.message}`);
  }

  return config;
});