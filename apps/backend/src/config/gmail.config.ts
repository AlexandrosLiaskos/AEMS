import { registerAs } from '@nestjs/config';

export const gmailConfig = registerAs('gmail', () => ({
  // API settings
  api: {
    quotaLimit: parseInt(process.env.GMAIL_QUOTA_LIMIT, 10) || 1000000000, // 1 billion units per day
    requestsPerSecond: parseInt(process.env.GMAIL_REQUESTS_PER_SECOND, 10) || 10,
    timeout: parseInt(process.env.GMAIL_TIMEOUT, 10) || 30000, // 30 seconds
  },
  
  // Sync settings
  sync: {
    enabled: process.env.GMAIL_SYNC_ENABLED !== 'false',
    interval: parseInt(process.env.GMAIL_SYNC_INTERVAL, 10) || 300000, // 5 minutes
    maxResults: parseInt(process.env.GMAIL_SYNC_MAX_RESULTS, 10) || 100,
    includeSpamTrash: process.env.GMAIL_INCLUDE_SPAM_TRASH === 'true',
    syncAttachments: process.env.GMAIL_SYNC_ATTACHMENTS !== 'false',
    fullSyncOnStart: process.env.GMAIL_FULL_SYNC_ON_START === 'true',
  },
  
  // Filters
  filters: {
    defaultQuery: process.env.GMAIL_DEFAULT_QUERY || 'in:inbox',
    excludeLabels: process.env.GMAIL_EXCLUDE_LABELS ? process.env.GMAIL_EXCLUDE_LABELS.split(',') : ['SPAM', 'TRASH'],
    includeLabels: process.env.GMAIL_INCLUDE_LABELS ? process.env.GMAIL_INCLUDE_LABELS.split(',') : [],
    dateRange: {
      enabled: process.env.GMAIL_DATE_RANGE_ENABLED === 'true',
      days: parseInt(process.env.GMAIL_DATE_RANGE_DAYS, 10) || 30,
    },
  },
  
  // Attachments
  attachments: {
    enabled: process.env.GMAIL_ATTACHMENTS_ENABLED !== 'false',
    maxSize: parseInt(process.env.GMAIL_ATTACHMENT_MAX_SIZE, 10) || 25 * 1024 * 1024, // 25MB
    allowedTypes: process.env.GMAIL_ATTACHMENT_ALLOWED_TYPES ? 
      process.env.GMAIL_ATTACHMENT_ALLOWED_TYPES.split(',') : 
      ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'png', 'jpg', 'jpeg'],
    downloadPath: process.env.GMAIL_ATTACHMENT_DOWNLOAD_PATH || 'attachments',
    virusScan: process.env.GMAIL_ATTACHMENT_VIRUS_SCAN !== 'false',
  },
  
  // Retry settings
  retry: {
    maxAttempts: parseInt(process.env.GMAIL_RETRY_MAX_ATTEMPTS, 10) || 3,
    backoffMultiplier: parseFloat(process.env.GMAIL_RETRY_BACKOFF_MULTIPLIER) || 2,
    initialDelay: parseInt(process.env.GMAIL_RETRY_INITIAL_DELAY, 10) || 1000, // 1 second
    maxDelay: parseInt(process.env.GMAIL_RETRY_MAX_DELAY, 10) || 30000, // 30 seconds
  },
  
  // Webhook settings (for push notifications)
  webhook: {
    enabled: process.env.GMAIL_WEBHOOK_ENABLED === 'true',
    endpoint: process.env.GMAIL_WEBHOOK_ENDPOINT,
    secret: process.env.GMAIL_WEBHOOK_SECRET,
    topicName: process.env.GMAIL_WEBHOOK_TOPIC_NAME,
  },
  
  // Performance
  performance: {
    cacheEnabled: process.env.GMAIL_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.GMAIL_CACHE_TTL, 10) || 300, // 5 minutes
    batchSize: parseInt(process.env.GMAIL_BATCH_SIZE, 10) || 50,
    concurrency: parseInt(process.env.GMAIL_CONCURRENCY, 10) || 5,
  },
}));