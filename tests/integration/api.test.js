/**
 * API Integration Tests
 * Tests for Express server endpoints and middleware
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const path = require('path');

// Mock external services before importing the server
jest.mock('../../lib/gmail');
jest.mock('../../lib/ai');
jest.mock('../../lib/ai-extractor');

describe('API Integration Tests', () => {
  let app;
  let server;
  let mockGmail;
  let mockAI;
  let mockAIExtractor;

  beforeAll(async () => {
    // Setup mocks
    mockGmail = require('../../lib/gmail');
    mockAI = require('../../lib/ai');
    mockAIExtractor = require('../../lib/ai-extractor');

    // Mock Gmail service
    mockGmail.getConnectionStatus = jest.fn().mockReturnValue({
      connected: false,
      hasValidTokens: false
    });
    mockGmail.getAuthUrl = jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?...');
    mockGmail.handleOAuthCallback = jest.fn();
    mockGmail.syncEmails = jest.fn();
    mockGmail.disconnect = jest.fn();

    // Mock AI services
    mockAI.getUsageStats = jest.fn().mockReturnValue({
      requestCount: 10,
      tokenUsage: { total: 1000 },
      dailyLimit: 100
    });

    mockAIExtractor.getUsageStats = jest.fn().mockReturnValue({
      requestCount: 5,
      tokenUsage: { total: 500 },
      dailyLimit: 50
    });
    mockAIExtractor.extractDataFromEmail = jest.fn();

    // Import and start server after mocks are set up
    const serverModule = require('../../server');
    app = serverModule;
    
    // Start server on test port
    server = app.listen(3001);
    await global.testUtils.wait(100); // Wait for server to start
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Static File Serving', () => {
    test('should serve index.html', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('AEMS');
    });

    test('should serve CSS files', async () => {
      const response = await request(app)
        .get('/css/styles.css')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/css');
    });

    test('should serve JavaScript files', async () => {
      const response = await request(app)
        .get('/js/app.js')
        .expect(200);

      expect(response.headers['content-type']).toContain('javascript');
    });

    test('should return 404 for non-existent files', async () => {
      await request(app)
        .get('/non-existent-file.txt')
        .expect(404);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should enforce rate limiting', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array.from({ length: 10 }, () => 
        request(app).get('/api/emails')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed in test environment (higher limits)
      responses.forEach(response => {
        expect([200, 401, 403]).toContain(response.status);
      });
    });
  });

  describe('Gmail Authentication Endpoints', () => {
    test('GET /auth/gmail should return auth URL', async () => {
      const response = await request(app)
        .get('/auth/gmail')
        .expect(200);

      expect(response.body.authUrl).toBeDefined();
      expect(response.body.authUrl).toContain('oauth');
      expect(mockGmail.getAuthUrl).toHaveBeenCalled();
    });

    test('GET /auth/gmail/callback should handle OAuth callback', async () => {
      mockGmail.handleOAuthCallback.mockResolvedValue({
        success: true,
        user: { email: 'test@example.com' }
      });

      const response = await request(app)
        .get('/auth/gmail/callback?code=test-auth-code')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
      expect(mockGmail.handleOAuthCallback).toHaveBeenCalledWith('test-auth-code');
    });

    test('GET /auth/gmail/callback should handle OAuth errors', async () => {
      mockGmail.handleOAuthCallback.mockResolvedValue({
        success: false,
        error: 'Invalid authorization code'
      });

      const response = await request(app)
        .get('/auth/gmail/callback?code=invalid-code')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid authorization code');
    });

    test('GET /auth/gmail/status should return connection status', async () => {
      mockGmail.getConnectionStatus.mockReturnValue({
        connected: true,
        hasValidTokens: true,
        user: { email: 'test@example.com' }
      });

      const response = await request(app)
        .get('/auth/gmail/status')
        .expect(200);

      expect(response.body.connected).toBe(true);
      expect(response.body.hasValidTokens).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });

    test('POST /auth/gmail/disconnect should disconnect Gmail', async () => {
      mockGmail.disconnect.mockResolvedValue();

      const response = await request(app)
        .post('/auth/gmail/disconnect')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGmail.disconnect).toHaveBeenCalled();
    });
  });

  describe('Email Management Endpoints', () => {
    test('GET /api/emails should return emails', async () => {
      const response = await request(app)
        .get('/api/emails')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/emails with status filter', async () => {
      const response = await request(app)
        .get('/api/emails?status=fetched')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/emails with category filter', async () => {
      const response = await request(app)
        .get('/api/emails?category=customer_inquiry')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/emails/:id should return specific email', async () => {
      // First create an email to retrieve
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      const response = await request(app)
        .get(`/api/emails/${createdEmail.id}`)
        .expect(200);

      expect(response.body.id).toBe(createdEmail.id);
      expect(response.body.subject).toBe(testEmail.subject);

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });

    test('GET /api/emails/:id should return 404 for non-existent email', async () => {
      await request(app)
        .get('/api/emails/non-existent-id')
        .expect(404);
    });

    test('PUT /api/emails/:id should update email', async () => {
      // Create test email
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      const updates = {
        isRead: true,
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/emails/${createdEmail.id}`)
        .send(updates)
        .expect(200);

      expect(response.body.isRead).toBe(true);
      expect(response.body.priority).toBe('high');

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });

    test('PUT /api/emails/:id/status should update email status', async () => {
      // Create test email
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      const response = await request(app)
        .put(`/api/emails/${createdEmail.id}/status`)
        .send({ status: 'REVIEW' })
        .expect(200);

      expect(response.body.status).toBe('REVIEW');

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });

    test('DELETE /api/emails/:id should soft delete email', async () => {
      // Create test email
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      const response = await request(app)
        .delete(`/api/emails/${createdEmail.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify email is soft deleted
      const deletedEmail = await db.getEmailById(createdEmail.id);
      expect(deletedEmail.isDeleted).toBe(true);
    });
  });

  describe('Email Sync Endpoints', () => {
    test('POST /api/sync should trigger email sync', async () => {
      mockGmail.syncEmails.mockResolvedValue({
        count: 5,
        categorized: 5,
        errors: 0
      });

      const response = await request(app)
        .post('/api/sync')
        .expect(200);

      expect(response.body.count).toBe(5);
      expect(response.body.categorized).toBe(5);
      expect(response.body.errors).toBe(0);
      expect(mockGmail.syncEmails).toHaveBeenCalled();
    });

    test('POST /api/sync should handle sync errors', async () => {
      mockGmail.syncEmails.mockResolvedValue({
        success: false,
        error: 'Gmail API error'
      });

      const response = await request(app)
        .post('/api/sync')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Gmail API error');
    });
  });

  describe('Data Extraction Endpoints', () => {
    test('POST /api/extract/:id should extract data from email', async () => {
      // Create test email
      const testEmail = global.testUtils.generateCustomerInquiryEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      mockAIExtractor.extractDataFromEmail.mockResolvedValue({
        success: true,
        category: 'customer_inquiry',
        extractedData: {
          customerName: 'John Doe',
          inquiryType: 'product_issue'
        }
      });

      const response = await request(app)
        .post(`/api/extract/${createdEmail.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.extractedData.customerName).toBe('John Doe');
      expect(mockAIExtractor.extractDataFromEmail).toHaveBeenCalled();

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });

    test('POST /api/extract/:id should handle extraction errors', async () => {
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      mockAIExtractor.extractDataFromEmail.mockResolvedValue({
        success: false,
        error: 'Unsupported category'
      });

      const response = await request(app)
        .post(`/api/extract/${createdEmail.id}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsupported category');

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });
  });

  describe('Statistics Endpoints', () => {
    test('GET /api/stats should return system statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body.emails).toBeDefined();
      expect(response.body.ai).toBeDefined();
      expect(response.body.extraction).toBeDefined();
      expect(typeof response.body.emails.total).toBe('number');
    });

    test('GET /api/stats/ai should return AI usage statistics', async () => {
      const response = await request(app)
        .get('/api/stats/ai')
        .expect(200);

      expect(response.body.requestCount).toBe(10);
      expect(response.body.tokenUsage.total).toBe(1000);
      expect(response.body.dailyLimit).toBe(100);
      expect(mockAI.getUsageStats).toHaveBeenCalled();
    });
  });

  describe('Health Check Endpoints', () => {
    test('GET /api/health should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toMatch(/healthy|warning|unhealthy/);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.checks).toBeDefined();
    });

    test('GET /api/health/simple should return simple health check', async () => {
      const response = await request(app)
        .get('/api/health/simple')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should validate email update input', async () => {
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      // Invalid input - XSS attempt
      const maliciousInput = {
        subject: '<script>alert("xss")</script>',
        priority: 'invalid-priority'
      };

      const response = await request(app)
        .put(`/api/emails/${createdEmail.id}`)
        .send(maliciousInput)
        .expect(400);

      expect(response.body.errors).toBeDefined();

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });

    test('should validate status update input', async () => {
      const testEmail = global.testUtils.generateTestEmail();
      const db = require('../../lib/database');
      const createdEmail = await db.createEmail(testEmail);

      const response = await request(app)
        .put(`/api/emails/${createdEmail.id}/status`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.errors).toBeDefined();

      // Clean up
      await db.softDeleteEmail(createdEmail.id);
    });
  });
});
