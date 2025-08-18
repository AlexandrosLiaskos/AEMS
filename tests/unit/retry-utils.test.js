/**
 * Retry Utils Tests
 * Tests for retry logic and circuit breaker functionality
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const retryUtils = require('../../lib/retry-utils');

describe('Retry Utils', () => {
    beforeEach(() => {
        // Reset circuit breaker state
        if (retryUtils.circuits) {
            retryUtils.circuits.clear();
        }
    });

    describe('Basic Retry Logic', () => {
        test('should succeed on first attempt', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');

            const result = await retryUtils.withRetry(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure and eventually succeed', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValueOnce('success');

            const result = await retryUtils.withRetry(mockFn, {
                maxAttempts: 3,
                initialDelay: 10 // Short delay for testing
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        test('should fail after max attempts', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

            await expect(retryUtils.withRetry(mockFn, {
                maxAttempts: 3,
                initialDelay: 10
            })).rejects.toThrow('Persistent failure');

            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        test('should use exponential backoff', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValueOnce('success');

            const delays = [];
            const mockOnRetry = jest.fn((error, attempt, delay) => {
                delays.push(delay);
            });

            await retryUtils.withRetry(mockFn, {
                maxAttempts: 3,
                initialDelay: 100,
                backoffMultiplier: 2,
                onRetry: mockOnRetry
            });

            expect(delays).toHaveLength(2);
            expect(delays[0]).toBe(100);
            expect(delays[1]).toBe(200);
        });

        test('should respect max delay', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValueOnce('success');

            const delays = [];
            const mockOnRetry = jest.fn((error, attempt, delay) => {
                delays.push(delay);
            });

            await retryUtils.withRetry(mockFn, {
                maxAttempts: 3,
                initialDelay: 1000,
                maxDelay: 1500,
                backoffMultiplier: 3,
                onRetry: mockOnRetry
            });

            expect(delays[0]).toBe(1000);
            expect(delays[1]).toBe(1500); // Capped at maxDelay
        });

        test('should use custom shouldRetry function', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('Retryable error'))
                .mockRejectedValueOnce(new Error('Non-retryable error'));

            const customShouldRetry = jest.fn((error) => {
                return error.message === 'Retryable error';
            });

            await expect(retryUtils.withRetry(mockFn, {
                maxAttempts: 3,
                initialDelay: 10,
                shouldRetry: customShouldRetry
            })).rejects.toThrow('Non-retryable error');

            expect(mockFn).toHaveBeenCalledTimes(2);
            expect(customShouldRetry).toHaveBeenCalledTimes(2);
        });
    });

    describe('Default Retry Conditions', () => {
        test('should retry on network errors', async () => {
            const networkError = new Error('ECONNRESET');
            const mockFn = jest.fn()
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce('success');

            const result = await retryUtils.withRetry(mockFn, {
                maxAttempts: 2,
                initialDelay: 10
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        test('should retry on timeout errors', async () => {
            const timeoutError = new Error('Request timeout');
            const mockFn = jest.fn()
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValueOnce('success');

            const result = await retryUtils.withRetry(mockFn, {
                maxAttempts: 2,
                initialDelay: 10
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        test('should retry on rate limit errors', async () => {
            const rateLimitError = new Error('Rate limit exceeded');
            rateLimitError.code = 429;
            const mockFn = jest.fn()
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce('success');

            const result = await retryUtils.withRetry(mockFn, {
                maxAttempts: 2,
                initialDelay: 10
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        test('should not retry on authentication errors', async () => {
            const authError = new Error('Unauthorized');
            authError.code = 401;
            const mockFn = jest.fn().mockRejectedValue(authError);

            await expect(retryUtils.withRetry(mockFn, {
                maxAttempts: 3,
                initialDelay: 10
            })).rejects.toThrow('Unauthorized');

            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('Parallel Retry', () => {
        test('should retry multiple functions in parallel', async () => {
            const mockFn1 = jest.fn()
                .mockRejectedValueOnce(new Error('Failure 1'))
                .mockResolvedValueOnce('Success 1');

            const mockFn2 = jest.fn()
                .mockRejectedValueOnce(new Error('Failure 2'))
                .mockResolvedValueOnce('Success 2');

            const mockFn3 = jest.fn().mockResolvedValue('Success 3');

            const results = await retryUtils.withRetryParallel([mockFn1, mockFn2, mockFn3], {
                maxAttempts: 2,
                initialDelay: 10
            });

            expect(results).toEqual(['Success 1', 'Success 2', 'Success 3']);
            expect(mockFn1).toHaveBeenCalledTimes(2);
            expect(mockFn2).toHaveBeenCalledTimes(2);
            expect(mockFn3).toHaveBeenCalledTimes(1);
        });

        test('should handle parallel failures', async () => {
            const mockFn1 = jest.fn().mockResolvedValue('Success 1');
            const mockFn2 = jest.fn().mockRejectedValue(new Error('Persistent failure'));

            await expect(retryUtils.withRetryParallel([mockFn1, mockFn2], {
                maxAttempts: 2,
                initialDelay: 10
            })).rejects.toThrow('Persistent failure');
        });
    });

    describe('Circuit Breaker', () => {
        test('should allow requests when circuit is closed', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');

            const result = await retryUtils.withCircuitBreaker(mockFn, {
                threshold: 3,
                timeout: 1000
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should open circuit after threshold failures', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Service unavailable'));

            // Fail enough times to open the circuit
            for (let i = 0; i < 5; i++) {
                try {
                    await retryUtils.withCircuitBreaker(mockFn, {
                        threshold: 3,
                        timeout: 1000
                    });
                } catch (error) {
                    // Expected failures
                }
            }

            // Circuit should now be open
            await expect(retryUtils.withCircuitBreaker(mockFn, {
                threshold: 3,
                timeout: 1000
            })).rejects.toThrow('Circuit breaker is OPEN');

            // Function should not be called when circuit is open
            const callCountBeforeOpen = mockFn.mock.calls.length;
            expect(callCountBeforeOpen).toBe(3); // Only called until threshold reached
        });

        test('should transition to half-open after timeout', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('Failure 1'))
                .mockRejectedValueOnce(new Error('Failure 2'))
                .mockRejectedValueOnce(new Error('Failure 3'))
                .mockResolvedValue('success');

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await retryUtils.withCircuitBreaker(mockFn, {
                        threshold: 3,
                        timeout: 50 // Short timeout for testing
                    });
                } catch (error) {
                    // Expected failures
                }
            }

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 60));

            // Should now be in half-open state and allow one request
            const result = await retryUtils.withCircuitBreaker(mockFn, {
                threshold: 3,
                timeout: 50
            });

            expect(result).toBe('success');
        });

        test('should close circuit after successful half-open attempts', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('Failure 1'))
                .mockRejectedValueOnce(new Error('Failure 2'))
                .mockRejectedValueOnce(new Error('Failure 3'))
                .mockResolvedValue('success');

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await retryUtils.withCircuitBreaker(mockFn, {
                        threshold: 3,
                        timeout: 50,
                        halfOpenAttempts: 2
                    });
                } catch (error) {
                    // Expected failures
                }
            }

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 60));

            // Make successful requests to close circuit
            await retryUtils.withCircuitBreaker(mockFn, {
                threshold: 3,
                timeout: 50,
                halfOpenAttempts: 2
            });

            await retryUtils.withCircuitBreaker(mockFn, {
                threshold: 3,
                timeout: 50,
                halfOpenAttempts: 2
            });

            // Circuit should now be closed and allow normal operation
            const result = await retryUtils.withCircuitBreaker(mockFn, {
                threshold: 3,
                timeout: 50,
                halfOpenAttempts: 2
            });

            expect(result).toBe('success');
        });
    });

    describe('Utility Functions', () => {
        test('should delay execution', async () => {
            const startTime = Date.now();
            await retryUtils.delay(100);
            const endTime = Date.now();

            expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
        });

        test('should handle zero delay', async () => {
            const startTime = Date.now();
            await retryUtils.delay(0);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(10);
        });
    });

    describe('Error Handling', () => {
        test('should handle function that throws synchronously', async () => {
            const mockFn = jest.fn(() => {
                throw new Error('Synchronous error');
            });

            await expect(retryUtils.withRetry(mockFn, {
                maxAttempts: 2,
                initialDelay: 10
            })).rejects.toThrow('Synchronous error');

            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        test('should handle function that returns rejected promise', async () => {
            const mockFn = jest.fn().mockReturnValue(Promise.reject(new Error('Rejected promise')));

            await expect(retryUtils.withRetry(mockFn, {
                maxAttempts: 2,
                initialDelay: 10
            })).rejects.toThrow('Rejected promise');

            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });
});
