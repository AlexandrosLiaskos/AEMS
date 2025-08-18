/**
 * Audit Logger Tests
 * Tests for security audit logging and activity tracking
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const auditLogger = require('../../lib/audit-logger');

// Mock fs operations
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        writeFile: jest.fn(),
        appendFile: jest.fn(),
        stat: jest.fn(),
        rename: jest.fn(),
        mkdir: jest.fn()
    }
}));

describe('Audit Logger', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock successful file operations by default
        fs.access.mockResolvedValue();
        fs.writeFile.mockResolvedValue();
        fs.appendFile.mockResolvedValue();
        fs.stat.mockResolvedValue({ size: 1000 });
        fs.rename.mockResolvedValue();
        fs.mkdir.mockResolvedValue();
    });

    describe('Log Entry Formatting', () => {
        test('should format log entry correctly', () => {
            const entry = auditLogger.formatLogEntry('TEST_EVENT', {
                userId: 'user123',
                action: 'test_action',
                details: 'test details'
            });

            expect(entry).toContain('TEST_EVENT');
            expect(entry).toContain('user123');
            expect(entry).toContain('test_action');
            expect(entry).toContain('test details');
            expect(entry).toContain(new Date().toISOString().split('T')[0]); // Check date
        });

        test('should handle missing data gracefully', () => {
            const entry = auditLogger.formatLogEntry('TEST_EVENT', {});

            expect(entry).toContain('TEST_EVENT');
            expect(entry).toContain('undefined'); // Missing fields should show as undefined
        });

        test('should include timestamp in correct format', () => {
            const entry = auditLogger.formatLogEntry('TEST_EVENT', { test: 'data' });

            // Should contain ISO timestamp
            const timestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
            expect(entry).toMatch(timestampRegex);
        });
    });

    describe('File Operations', () => {
        test('should create log file if it does not exist', async () => {
            fs.access.mockRejectedValueOnce(new Error('File not found'));

            await auditLogger.writeToLog('/test/path/audit.log', 'test entry\n');

            expect(fs.writeFile).toHaveBeenCalledWith('/test/path/audit.log', '');
            expect(fs.appendFile).toHaveBeenCalledWith('/test/path/audit.log', 'test entry\n');
        });

        test('should append to existing log file', async () => {
            await auditLogger.writeToLog('/test/path/audit.log', 'test entry\n');

            expect(fs.access).toHaveBeenCalledWith('/test/path/audit.log');
            expect(fs.appendFile).toHaveBeenCalledWith('/test/path/audit.log', 'test entry\n');
        });

        test('should rotate log file when size limit exceeded', async () => {
            fs.stat.mockResolvedValue({ size: 11 * 1024 * 1024 }); // 11MB

            await auditLogger.writeToLog('/test/path/audit.log', 'test entry\n');

            expect(fs.rename).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalledWith('/test/path/audit.log', '');
        });

        test('should handle file operation errors gracefully', async () => {
            fs.appendFile.mockRejectedValue(new Error('Write permission denied'));

            // Should not throw error
            await expect(auditLogger.writeToLog('/test/path/audit.log', 'test entry\n'))
                .resolves.toBeUndefined();
        });
    });

    describe('Authentication Logging', () => {
        test('should log successful authentication', async () => {
            await auditLogger.logAuthentication('login', 'user123', true, {
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0...'
            });

            expect(fs.appendFile).toHaveBeenCalled();
            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('AUTHENTICATION');
            expect(logEntry).toContain('login');
            expect(logEntry).toContain('user123');
            expect(logEntry).toContain('true');
            expect(logEntry).toContain('192.168.1.1');
        });

        test('should log failed authentication', async () => {
            await auditLogger.logAuthentication('login', 'user123', false, {
                ipAddress: '192.168.1.1',
                reason: 'Invalid password'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('AUTHENTICATION');
            expect(logEntry).toContain('false');
            expect(logEntry).toContain('Invalid password');
        });

        test('should log token refresh', async () => {
            await auditLogger.logAuthentication('token_refresh', 'user123', true);

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('token_refresh');
        });
    });

    describe('Authorization Logging', () => {
        test('should log authorization failure', async () => {
            await auditLogger.logAuthorizationFailure('user123', '/api/admin', 'DELETE', 'Insufficient permissions');

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('AUTHORIZATION_FAILURE');
            expect(logEntry).toContain('user123');
            expect(logEntry).toContain('/api/admin');
            expect(logEntry).toContain('DELETE');
            expect(logEntry).toContain('Insufficient permissions');
        });
    });

    describe('Data Access Logging', () => {
        test('should log data access', async () => {
            await auditLogger.logDataAccess('user123', 'emails', 'READ', {
                emailId: 'email-456',
                category: 'customer_inquiry'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('DATA_ACCESS');
            expect(logEntry).toContain('emails');
            expect(logEntry).toContain('READ');
            expect(logEntry).toContain('email-456');
        });

        test('should log data modification', async () => {
            await auditLogger.logDataModification('user123', 'emails', 'UPDATE', 'email-456', {
                field: 'status',
                oldValue: 'FETCHED',
                newValue: 'REVIEW'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('DATA_MODIFICATION');
            expect(logEntry).toContain('UPDATE');
            expect(logEntry).toContain('email-456');
            expect(logEntry).toContain('FETCHED');
            expect(logEntry).toContain('REVIEW');
        });
    });

    describe('Security Event Logging', () => {
        test('should log suspicious activity', async () => {
            await auditLogger.logSuspiciousActivity('user123', 'multiple_failed_logins', {
                attempts: 5,
                timeWindow: '5 minutes',
                ipAddress: '192.168.1.1'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('SUSPICIOUS_ACTIVITY');
            expect(logEntry).toContain('multiple_failed_logins');
            expect(logEntry).toContain('5');
        });

        test('should log rate limit violations', async () => {
            await auditLogger.logRateLimitViolation('192.168.1.1', '/api/sync', 100, 50);

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('RATE_LIMIT_VIOLATION');
            expect(logEntry).toContain('/api/sync');
            expect(logEntry).toContain('100');
            expect(logEntry).toContain('50');
        });

        test('should log input validation failures', async () => {
            await auditLogger.logInputValidationFailure('/api/emails', 'POST', {
                field: 'subject',
                value: '<script>alert("xss")</script>',
                reason: 'Contains script tags'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('INPUT_VALIDATION_FAILURE');
            expect(logEntry).toContain('subject');
            expect(logEntry).toContain('script tags');
        });
    });

    describe('System Event Logging', () => {
        test('should log system startup', async () => {
            await auditLogger.logSystemEvent('startup', {
                version: '1.0.0',
                nodeVersion: 'v18.0.0',
                environment: 'production'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('SYSTEM_EVENT');
            expect(logEntry).toContain('startup');
            expect(logEntry).toContain('1.0.0');
        });

        test('should log configuration changes', async () => {
            await auditLogger.logConfigurationChange('user123', 'syncInterval', '5', '10');

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('CONFIGURATION_CHANGE');
            expect(logEntry).toContain('syncInterval');
            expect(logEntry).toContain('5');
            expect(logEntry).toContain('10');
        });
    });

    describe('Error Logging', () => {
        test('should log API failures', async () => {
            const error = new Error('Gmail API quota exceeded');
            error.response = { status: 429 };

            await auditLogger.logAPIFailure('gmail', '/users/messages/list', error, 2);

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('API_FAILURE');
            expect(logEntry).toContain('gmail');
            expect(logEntry).toContain('quota exceeded');
            expect(logEntry).toContain('429');
            expect(logEntry).toContain('2');
        });

        test('should log database errors', async () => {
            await auditLogger.logDatabaseError('createEmail', new Error('Connection timeout'), {
                emailId: 'email-123',
                operation: 'INSERT'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('DATABASE_ERROR');
            expect(logEntry).toContain('createEmail');
            expect(logEntry).toContain('Connection timeout');
            expect(logEntry).toContain('email-123');
        });

        test('should log application errors', async () => {
            await auditLogger.logApplicationError('EmailProcessor', new Error('Invalid email format'), {
                emailId: 'email-123',
                step: 'parsing'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('APPLICATION_ERROR');
            expect(logEntry).toContain('EmailProcessor');
            expect(logEntry).toContain('Invalid email format');
        });
    });

    describe('Performance Logging', () => {
        test('should log performance metrics', async () => {
            await auditLogger.logPerformanceMetric('email_sync', 1500, {
                emailCount: 25,
                categorized: 20,
                errors: 1
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('PERFORMANCE_METRIC');
            expect(logEntry).toContain('email_sync');
            expect(logEntry).toContain('1500');
            expect(logEntry).toContain('25');
        });

        test('should log slow operations', async () => {
            await auditLogger.logSlowOperation('ai_extraction', 5000, {
                emailId: 'email-123',
                category: 'invoice'
            });

            const logEntry = fs.appendFile.mock.calls[0][1];
            expect(logEntry).toContain('SLOW_OPERATION');
            expect(logEntry).toContain('ai_extraction');
            expect(logEntry).toContain('5000');
        });
    });

    describe('Log Rotation', () => {
        test('should rotate log with timestamp', async () => {
            fs.stat.mockResolvedValue({ size: 11 * 1024 * 1024 });

            await auditLogger.rotateLog('/test/path/audit.log');

            expect(fs.rename).toHaveBeenCalled();
            const renameCall = fs.rename.mock.calls[0];
            expect(renameCall[0]).toBe('/test/path/audit.log');
            expect(renameCall[1]).toMatch(/audit\.log\.\d{4}-\d{2}-\d{2}-\d{6}/);
        });

        test('should handle rotation errors gracefully', async () => {
            fs.rename.mockRejectedValue(new Error('Permission denied'));

            await expect(auditLogger.rotateLog('/test/path/audit.log'))
                .resolves.toBeUndefined();
        });
    });

    describe('Initialization', () => {
        test('should create log directories on initialization', async () => {
            fs.access.mockRejectedValue(new Error('Directory not found'));

            await auditLogger.init();

            expect(fs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('logs'),
                { recursive: true }
            );
        });

        test('should handle existing log directories', async () => {
            fs.access.mockResolvedValue(); // Directory exists

            await auditLogger.init();

            expect(fs.mkdir).not.toHaveBeenCalled();
        });
    });
});
