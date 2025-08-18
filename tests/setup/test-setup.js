/**
 * Jest Test Setup for AEMS
 * Configures test environment and provides utilities for functional testing
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.OPENAI_API_KEY = 'test-key-mock';
process.env.OPENAI_MODEL = 'gpt-3.5-turbo';
process.env.OPENAI_MAX_TOKENS = '1000';
process.env.AI_DAILY_LIMIT = '100';
process.env.AI_EXTRACTION_DAILY_LIMIT = '50';
process.env.MAX_EMAILS_PER_SYNC = '10';
process.env.AI_BATCH_SIZE = '3';
process.env.AI_BATCH_DELAY = '500';
process.env.ENABLE_AUDIT_LOGGING = 'true';
process.env.ENABLE_CSRF_PROTECTION = 'false'; // Disable for testing
process.env.SESSION_SECRET = 'test-session-secret';

// Test data directories
const TEST_DATA_DIR = path.join(__dirname, '../test-data');
const BACKUP_DATA_DIR = path.join(__dirname, '../test-data-backup');

/**
 * Global test utilities
 */
global.testUtils = {
  // Generate test email data
  generateTestEmail: (overrides = {}) => {
    const id = uuidv4();
    return {
      id,
      gmailId: `gmail-${id}`,
      subject: overrides.subject || 'Test Email Subject',
      body: overrides.body || 'This is a test email body content.',
      fromAddress: overrides.fromAddress || 'test@example.com',
      toAddress: overrides.toAddress || 'user@company.com',
      date: overrides.date || new Date().toISOString(),
      category: overrides.category || 'other',
      status: overrides.status || 'FETCHED',
      userId: overrides.userId || 'test-user',
      attachments: overrides.attachments || [],
      isRead: overrides.isRead || false,
      isDeleted: overrides.isDeleted || false,
      createdAt: overrides.createdAt || new Date().toISOString(),
      updatedAt: overrides.updatedAt || new Date().toISOString(),
      ...overrides
    };
  },

  // Generate test customer inquiry email
  generateCustomerInquiryEmail: (overrides = {}) => {
    return global.testUtils.generateTestEmail({
      subject: 'Customer Support Request - Product Issue',
      body: 'Hello, I am having trouble with my recent order #12345. The product arrived damaged and I need assistance with a replacement. Please contact me at your earliest convenience.',
      category: 'customer_inquiry',
      ...overrides
    });
  },

  // Generate test invoice email
  generateInvoiceEmail: (overrides = {}) => {
    return global.testUtils.generateTestEmail({
      subject: 'Invoice #INV-2024-001 - Payment Due',
      body: 'Please find attached invoice #INV-2024-001 for services rendered. Amount due: €1,500.00. Payment terms: 30 days.',
      category: 'invoice',
      attachments: [{
        filename: 'invoice-INV-2024-001.pdf',
        mimeType: 'application/pdf',
        size: 125000,
        attachmentId: 'att-' + uuidv4()
      }],
      ...overrides
    });
  },

  // Generate test extracted data
  generateExtractedData: (category, overrides = {}) => {
    const baseData = {
      id: uuidv4(),
      emailId: overrides.emailId || uuidv4(),
      category,
      extractedAt: new Date().toISOString(),
      agent: 'ai-extractor-test'
    };

    if (category === 'customer_inquiry') {
      return {
        ...baseData,
        data: {
          customerName: 'John Doe',
          customerEmail: 'john.doe@example.com',
          inquiryType: 'product_issue',
          priority: 'medium',
          description: 'Product arrived damaged, needs replacement',
          orderNumber: '12345',
          ...overrides.data
        }
      };
    } else if (category === 'invoice') {
      return {
        ...baseData,
        data: {
          invoiceNumber: 'INV-2024-001',
          invoiceDate: '2024-01-15',
          customerName: 'ABC Company Ltd',
          amount: 1500.00,
          vatAmount: 360.00,
          totalAmount: 1860.00,
          currency: 'EUR',
          dueDate: '2024-02-14',
          ...overrides.data
        }
      };
    }

    return baseData;
  },

  // Generate test notification
  generateNotification: (overrides = {}) => {
    return {
      id: uuidv4(),
      type: overrides.type || 'info',
      title: overrides.title || 'Test Notification',
      message: overrides.message || 'This is a test notification message',
      timestamp: overrides.timestamp || new Date().toISOString(),
      isRead: overrides.isRead || false,
      userId: overrides.userId || 'test-user',
      ...overrides
    };
  },

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Clean test data directory
  cleanTestData: async () => {
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  },

  // Setup test data directory
  setupTestData: async () => {
    await global.testUtils.cleanTestData();
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    
    // Create subdirectories
    const subdirs = [
      'emails/fetched',
      'emails/review', 
      'emails/managed',
      'emails/deleted',
      'extracted-data',
      'attachments',
      'notifications'
    ];

    for (const subdir of subdirs) {
      await fs.mkdir(path.join(TEST_DATA_DIR, subdir), { recursive: true });
    }

    // Create empty JSON files
    const jsonFiles = [
      'emails/fetched/customer-inquiries.json',
      'emails/fetched/invoices.json',
      'emails/fetched/other.json',
      'emails/review/customer-inquiries.json',
      'emails/review/invoices.json',
      'emails/review/other.json',
      'emails/managed/customer-inquiries.json',
      'emails/managed/invoices.json',
      'emails/managed/other.json',
      'emails/deleted/all.json',
      'extracted-data/customer-inquiries.json',
      'extracted-data/invoices.json',
      'attachments/all.json',
      'notifications/all.json',
      'users.json',
      'settings.json'
    ];

    for (const file of jsonFiles) {
      await fs.writeFile(path.join(TEST_DATA_DIR, file), '[]');
    }

    // Write default settings
    const defaultSettings = {
      syncInterval: 5,
      autoSync: true,
      emailCategories: ['customer_inquiry', 'invoice'],
      language: 'both',
      notifications: true,
      lastSync: null
    };
    await fs.writeFile(
      path.join(TEST_DATA_DIR, 'settings.json'), 
      JSON.stringify(defaultSettings, null, 2)
    );
  },

  // Backup original data directory
  backupOriginalData: async () => {
    const originalDataDir = path.join(__dirname, '../../data');
    try {
      await fs.access(originalDataDir);
      await fs.rm(BACKUP_DATA_DIR, { recursive: true, force: true });
      await fs.cp(originalDataDir, BACKUP_DATA_DIR, { recursive: true });
    } catch (error) {
      // Original data might not exist, that's ok
    }
  },

  // Restore original data directory
  restoreOriginalData: async () => {
    const originalDataDir = path.join(__dirname, '../../data');
    try {
      await fs.rm(originalDataDir, { recursive: true, force: true });
      await fs.access(BACKUP_DATA_DIR);
      await fs.cp(BACKUP_DATA_DIR, originalDataDir, { recursive: true });
    } catch (error) {
      // Backup might not exist, create empty structure
      await global.testUtils.setupTestData();
      await fs.cp(TEST_DATA_DIR, originalDataDir, { recursive: true });
    }
  }
};

// Setup and teardown hooks
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
  await global.testUtils.backupOriginalData();
  await global.testUtils.setupTestData();
  
  // Override data directory for testing
  const originalDataDir = path.join(__dirname, '../../data');
  await fs.rm(originalDataDir, { recursive: true, force: true });
  await fs.cp(TEST_DATA_DIR, originalDataDir, { recursive: true });
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  await global.testUtils.restoreOriginalData();
  await global.testUtils.cleanTestData();
  await fs.rm(BACKUP_DATA_DIR, { recursive: true, force: true });
});

// Increase timeout for integration tests
jest.setTimeout(30000);
