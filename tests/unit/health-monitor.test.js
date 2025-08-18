/**
 * Health Monitor Tests
 * Tests for system health monitoring and metrics
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const healthMonitor = require('../../lib/health-monitor');

// Mock dependencies
jest.mock('../../lib/database');

describe('Health Monitor', () => {
    let mockDatabase;

    beforeEach(() => {
        // Mock database
        mockDatabase = require('../../lib/database');
        mockDatabase.createEmail = jest.fn();
        mockDatabase.getEmailById = jest.fn();
        mockDatabase.softDeleteEmail = jest.fn();

        // Reset health monitor state
        healthMonitor.metrics = {
            requests: 0,
            errors: 0,
            totalResponseTime: 0,
            lastReset: Date.now()
        };
        healthMonitor.history = [];
        healthMonitor.lastResults.clear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Health Check Registration', () => {
        test('should register custom health check', () => {
            const customCheck = jest.fn().mockResolvedValue({
                status: 'healthy',
                message: 'Custom check passed'
            });

            healthMonitor.registerCheck('custom-test', customCheck, {
                critical: true,
                timeout: 3000
            });

            expect(healthMonitor.checks.has('custom-test')).toBe(true);
            const registeredCheck = healthMonitor.checks.get('custom-test');
            expect(registeredCheck.critical).toBe(true);
            expect(registeredCheck.timeout).toBe(3000);
        });

        test('should have default health checks registered', () => {
            expect(healthMonitor.checks.has('database')).toBe(true);
            expect(healthMonitor.checks.has('memory')).toBe(true);
            expect(healthMonitor.checks.has('disk')).toBe(true);
        });
    });

    describe('Database Health Check', () => {
        test('should pass database health check', async () => {
            const mockEmail = { id: 'test-email-id' };
            mockDatabase.createEmail.mockResolvedValue(mockEmail);
            mockDatabase.getEmailById.mockResolvedValue(mockEmail);
            mockDatabase.softDeleteEmail.mockResolvedValue();

            const result = await healthMonitor.runCheck('database');

            expect(result.status).toBe('healthy');
            expect(result.message).toBe('Database operations working');
            expect(result.latency).toBeDefined();
            expect(mockDatabase.createEmail).toHaveBeenCalled();
            expect(mockDatabase.getEmailById).toHaveBeenCalled();
            expect(mockDatabase.softDeleteEmail).toHaveBeenCalled();
        });

        test('should fail database health check on error', async () => {
            mockDatabase.createEmail.mockRejectedValue(new Error('Database connection failed'));

            const result = await healthMonitor.runCheck('database');

            expect(result.status).toBe('unhealthy');
            expect(result.message).toContain('Database error');
            expect(result.error).toBe('Database connection failed');
        });

        test('should fail database health check on read failure', async () => {
            const mockEmail = { id: 'test-email-id' };
            mockDatabase.createEmail.mockResolvedValue(mockEmail);
            mockDatabase.getEmailById.mockResolvedValue(null); // Read failed

            const result = await healthMonitor.runCheck('database');

            expect(result.status).toBe('unhealthy');
            expect(result.message).toContain('Database error');
            expect(result.error).toBe('Read failed');
        });
    });

    describe('Memory Health Check', () => {
        test('should pass memory health check with normal usage', async () => {
            // Mock process.memoryUsage to return normal values
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                rss: 50 * 1024 * 1024, // 50MB
                heapTotal: 30 * 1024 * 1024, // 30MB
                heapUsed: 20 * 1024 * 1024, // 20MB
                external: 5 * 1024 * 1024 // 5MB
            });

            const result = await healthMonitor.runCheck('memory');

            expect(result.status).toBe('healthy');
            expect(result.message).toBe('Memory usage normal');
            expect(result.memoryUsage).toBeDefined();
            expect(result.memoryUsage.heapUsedMB).toBe(20);

            // Restore original function
            process.memoryUsage = originalMemoryUsage;
        });

        test('should warn on high memory usage', async () => {
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                rss: 500 * 1024 * 1024, // 500MB
                heapTotal: 400 * 1024 * 1024, // 400MB
                heapUsed: 350 * 1024 * 1024, // 350MB (87.5% of total)
                external: 50 * 1024 * 1024 // 50MB
            });

            const result = await healthMonitor.runCheck('memory');

            expect(result.status).toBe('warning');
            expect(result.message).toContain('High memory usage');
            expect(result.memoryUsage.heapUsedMB).toBe(350);

            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('Disk Health Check', () => {
        test('should check disk space', async () => {
            const result = await healthMonitor.runCheck('disk');

            expect(result.status).toMatch(/healthy|warning|unhealthy/);
            expect(result.message).toBeDefined();
            expect(result.diskUsage).toBeDefined();
            expect(result.diskUsage.totalGB).toBeGreaterThan(0);
            expect(result.diskUsage.freeGB).toBeGreaterThan(0);
        });
    });

    describe('Overall Health Assessment', () => {
        test('should run all health checks', async () => {
            // Mock successful database check
            mockDatabase.createEmail.mockResolvedValue({ id: 'test' });
            mockDatabase.getEmailById.mockResolvedValue({ id: 'test' });
            mockDatabase.softDeleteEmail.mockResolvedValue();

            const result = await healthMonitor.runAllChecks();

            expect(result.status).toMatch(/healthy|warning|unhealthy/);
            expect(result.timestamp).toBeDefined();
            expect(result.checks).toBeDefined();
            expect(result.system).toBeDefined();
            expect(result.checks.database).toBeDefined();
            expect(result.checks.memory).toBeDefined();
            expect(result.checks.disk).toBeDefined();
        });

        test('should calculate overall health correctly', () => {
            const mockResults = {
                database: { status: 'healthy' },
                memory: { status: 'healthy' },
                disk: { status: 'warning' },
                custom: { status: 'healthy' }
            };

            const overall = healthMonitor.calculateOverallHealth(mockResults);
            expect(overall).toBe('warning'); // Should be warning due to disk
        });

        test('should prioritize critical failures', () => {
            const mockResults = {
                database: { status: 'unhealthy' }, // Critical check
                memory: { status: 'healthy' },
                disk: { status: 'warning' }
            };

            const overall = healthMonitor.calculateOverallHealth(mockResults);
            expect(overall).toBe('unhealthy'); // Should be unhealthy due to critical failure
        });
    });

    describe('Metrics Tracking', () => {
        test('should record request metrics', () => {
            const initialRequests = healthMonitor.metrics.requests;
            const initialResponseTime = healthMonitor.metrics.totalResponseTime;

            healthMonitor.recordRequest(150); // 150ms response time

            expect(healthMonitor.metrics.requests).toBe(initialRequests + 1);
            expect(healthMonitor.metrics.totalResponseTime).toBe(initialResponseTime + 150);
        });

        test('should record error metrics', () => {
            const initialErrors = healthMonitor.metrics.errors;

            healthMonitor.recordError();

            expect(healthMonitor.metrics.errors).toBe(initialErrors + 1);
        });

        test('should calculate average response time', () => {
            healthMonitor.metrics.requests = 10;
            healthMonitor.metrics.totalResponseTime = 1500; // 1500ms total

            const avgResponseTime = healthMonitor.getAverageResponseTime();
            expect(avgResponseTime).toBe(150); // 150ms average
        });

        test('should handle zero requests for average calculation', () => {
            healthMonitor.metrics.requests = 0;
            healthMonitor.metrics.totalResponseTime = 0;

            const avgResponseTime = healthMonitor.getAverageResponseTime();
            expect(avgResponseTime).toBe(0);
        });

        test('should calculate error rate', () => {
            healthMonitor.metrics.requests = 100;
            healthMonitor.metrics.errors = 5;

            const errorRate = healthMonitor.getErrorRate();
            expect(errorRate).toBe(5); // 5% error rate
        });

        test('should reset metrics', () => {
            healthMonitor.metrics.requests = 100;
            healthMonitor.metrics.errors = 5;
            healthMonitor.metrics.totalResponseTime = 5000;

            healthMonitor.resetMetrics();

            expect(healthMonitor.metrics.requests).toBe(0);
            expect(healthMonitor.metrics.errors).toBe(0);
            expect(healthMonitor.metrics.totalResponseTime).toBe(0);
            expect(healthMonitor.metrics.lastReset).toBeCloseTo(Date.now(), -2);
        });
    });

    describe('History Management', () => {
        test('should add entries to history', () => {
            const initialHistoryLength = healthMonitor.history.length;

            const healthData = {
                timestamp: new Date().toISOString(),
                overall: 'healthy',
                checks: { database: { status: 'healthy' } }
            };

            healthMonitor.addToHistory(healthData);

            expect(healthMonitor.history.length).toBe(initialHistoryLength + 1);
            expect(healthMonitor.history[healthMonitor.history.length - 1]).toEqual(healthData);
        });

        test('should limit history size', () => {
            // Fill history beyond max size
            for (let i = 0; i < 105; i++) {
                healthMonitor.addToHistory({
                    timestamp: new Date().toISOString(),
                    overall: 'healthy',
                    checks: {}
                });
            }

            expect(healthMonitor.history.length).toBe(healthMonitor.maxHistorySize);
        });

        test('should get health history', () => {
            const history = healthMonitor.getHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBeLessThanOrEqual(healthMonitor.maxHistorySize);
        });
    });

    describe('System Information', () => {
        test('should provide system information', () => {
            const systemInfo = healthMonitor.getSystemInfo();

            expect(systemInfo.platform).toBeDefined();
            expect(systemInfo.nodeVersion).toBeDefined();
            expect(systemInfo.uptime).toBeDefined();
            expect(systemInfo.loadAverage).toBeDefined();
            expect(systemInfo.cpuCount).toBeDefined();
        });
    });

    describe('Timeout Handling', () => {
        test('should handle check timeouts', async () => {
            const slowCheck = () => new Promise(resolve => {
                setTimeout(() => resolve({ status: 'healthy' }), 10000); // 10 second delay
            });

            healthMonitor.registerCheck('slow-check', slowCheck, { timeout: 100 }); // 100ms timeout

            const result = await healthMonitor.runCheck('slow-check');

            expect(result.status).toBe('unhealthy');
            expect(result.message).toContain('timeout');
        });

        test('should complete fast checks within timeout', async () => {
            const fastCheck = () => Promise.resolve({
                status: 'healthy',
                message: 'Fast check completed'
            });

            healthMonitor.registerCheck('fast-check', fastCheck, { timeout: 1000 });

            const result = await healthMonitor.runCheck('fast-check');

            expect(result.status).toBe('healthy');
            expect(result.message).toBe('Fast check completed');
        });
    });

    describe('Error Handling', () => {
        test('should handle non-existent check gracefully', async () => {
            const result = await healthMonitor.runCheck('non-existent-check');

            expect(result.status).toBe('unknown');
            expect(result.message).toContain('not found');
        });

        test('should handle check function errors', async () => {
            const errorCheck = () => {
                throw new Error('Check function error');
            };

            healthMonitor.registerCheck('error-check', errorCheck);

            const result = await healthMonitor.runCheck('error-check');

            expect(result.status).toBe('unhealthy');
            expect(result.message).toContain('Check failed');
            expect(result.error).toBe('Check function error');
        });
    });
});
