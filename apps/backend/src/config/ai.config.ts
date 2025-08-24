import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 2000,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
    timeout: parseInt(process.env.OPENAI_TIMEOUT, 10) || 30000,
  },
  
  // Classification
  classification: {
    confidenceThreshold: parseFloat(process.env.CLASSIFICATION_CONFIDENCE_THRESHOLD) || 0.7,
    maxRetries: parseInt(process.env.CLASSIFICATION_MAX_RETRIES, 10) || 3,
    cacheEnabled: process.env.CLASSIFICATION_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.CLASSIFICATION_CACHE_TTL, 10) || 3600, // 1 hour
  },
  
  // Extraction
  extraction: {
    confidenceThreshold: parseFloat(process.env.EXTRACTION_CONFIDENCE_THRESHOLD) || 0.8,
    maxRetries: parseInt(process.env.EXTRACTION_MAX_RETRIES, 10) || 3,
    cacheEnabled: process.env.EXTRACTION_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.EXTRACTION_CACHE_TTL, 10) || 3600, // 1 hour
    validateResults: process.env.EXTRACTION_VALIDATE_RESULTS !== 'false',
  },
  
  // Cost tracking
  costTracking: {
    enabled: process.env.COST_TRACKING_ENABLED !== 'false',
    budgetLimit: parseFloat(process.env.COST_BUDGET_LIMIT) || 100.0, // $100 default
    alertThreshold: parseFloat(process.env.COST_ALERT_THRESHOLD) || 0.8, // 80% of budget
    resetPeriod: process.env.COST_RESET_PERIOD || 'monthly', // monthly, weekly, daily
  },
  
  // Processing
  processing: {
    batchSize: parseInt(process.env.AI_BATCH_SIZE, 10) || 10,
    concurrency: parseInt(process.env.AI_CONCURRENCY, 10) || 3,
    queueEnabled: process.env.AI_QUEUE_ENABLED !== 'false',
    retryDelay: parseInt(process.env.AI_RETRY_DELAY, 10) || 5000, // 5 seconds
  },
  
  // Categories
  categories: {
    default: [
      'invoice',
      'receipt',
      'contract',
      'newsletter',
      'notification',
      'personal',
      'business',
      'support',
      'marketing',
      'other',
    ],
    custom: process.env.CUSTOM_CATEGORIES ? process.env.CUSTOM_CATEGORIES.split(',') : [],
  },
}));