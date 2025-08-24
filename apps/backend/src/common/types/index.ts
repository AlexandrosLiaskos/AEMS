/**
 * @file Common Types and Interfaces
 * @purpose Centralized type definitions for the AEMS application
 */

/**
 * @enum EmailCategory
 * @purpose Email classification categories
 */
export enum EmailCategory {
  CUSTOMER_INQUIRY = 'CUSTOMER_INQUIRY',
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  SHIPPING = 'SHIPPING',
  SUPPORT = 'SUPPORT',
  MARKETING = 'MARKETING',
  NEWSLETTER = 'NEWSLETTER',
  NOTIFICATION = 'NOTIFICATION',
  PERSONAL = 'PERSONAL',
  SPAM = 'SPAM',
  OTHER = 'OTHER',
}

/**
 * @enum NotificationChannel
 * @purpose Notification delivery channels
 */
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEBHOOK = 'WEBHOOK',
  SLACK = 'SLACK',
  DISCORD = 'DISCORD',
}

/**
 * @interface EmailAddress
 * @purpose Email address structure
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * @interface ProcessingMetrics
 * @purpose Processing performance metrics
 */
export interface ProcessingMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  tokensUsed: number;
  cost: number;
  apiCalls: number;
  retryCount: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * @interface ValidationResult
 * @purpose Data validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  fieldValidation?: Record<string, {
    isValid: boolean;
    error?: string;
    warning?: string;
  }>;
}

/**
 * @interface AIResponse
 * @purpose Generic AI service response
 */
export interface AIResponse<T = any> {
  data: T;
  confidence: number;
  reasoning?: string;
  alternatives?: Array<{
    data: T;
    confidence: number;
    reasoning: string;
  }>;
  metadata?: {
    model: string;
    version: string;
    tokensUsed: number;
    cost: number;
    processingTime: number;
  };
}

/**
 * @interface PaginationOptions
 * @purpose Pagination parameters
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * @interface PaginatedResult
 * @purpose Paginated query result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * @interface FilterOptions
 * @purpose Generic filter options
 */
export interface FilterOptions {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  categories?: string[];
  tags?: string[];
  status?: string[];
  userId?: string;
}

/**
 * @interface ExportOptions
 * @purpose Data export configuration
 */
export interface ExportOptions {
  format: 'JSON' | 'CSV' | 'XLSX' | 'PDF';
  fields?: string[];
  filters?: FilterOptions;
  includeAttachments?: boolean;
  compression?: boolean;
}

/**
 * @interface BackupOptions
 * @purpose Backup configuration
 */
export interface BackupOptions {
  includeAttachments: boolean;
  compression: boolean;
  encryption: boolean;
  destination: string;
  retentionDays: number;
}

/**
 * @interface SystemHealth
 * @purpose System health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastCheck: Date;
    error?: string;
  }>;
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    uptime: number;
  };
}

/**
 * @interface AuditLogEntry
 * @purpose Audit log entry structure
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * @interface ConfigurationSchema
 * @purpose Application configuration schema
 */
export interface ConfigurationSchema {
  // API Keys
  OPENAI_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  
  // Security
  JWT_SECRET: string;
  SESSION_SECRET: string;
  
  // Database
  DATABASE_PATH: string;
  
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // Features
  ENABLE_CACHING: boolean;
  ENABLE_AUDIT_LOG: boolean;
  ENABLE_NOTIFICATIONS: boolean;
  
  // AI Configuration
  DEFAULT_AI_MODEL: string;
  CLASSIFICATION_CONFIDENCE_THRESHOLD: number;
  EXTRACTION_CONFIDENCE_THRESHOLD: number;
  MAX_TOKENS_PER_REQUEST: number;
  
  // Gmail API
  GMAIL_SCOPES: string[];
  GMAIL_REDIRECT_URI: string;
  
  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE: string;
  
  // Performance
  MAX_CONCURRENT_EMAILS: number;
  CACHE_TTL: number;
  API_RATE_LIMIT: number;
}