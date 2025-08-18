/**
 * AI Service Tests
 * Tests for email categorization and AI processing functionality
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const aiService = require('../../lib/ai');

// Mock OpenAI to avoid actual API calls during testing
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: jest.fn()
                }
            }
        }))
    };
});

jest.mock('@langchain/openai', () => {
    return {
        ChatOpenAI: jest.fn().mockImplementation(() => ({
            call: jest.fn()
        }))
    };
});

jest.mock('langchain/chains', () => {
    return {
        LLMChain: jest.fn().mockImplementation(() => ({
            call: jest.fn()
        }))
    };
});

describe('AI Service', () => {
    let mockLLMChain;
    let originalIsConfigured;

    beforeEach(() => {
        // Reset AI service state
        aiService.requestCount = 0;
        aiService.tokenUsage = { prompt: 0, completion: 0, total: 0 };
        aiService.lastResetDate = new Date().toDateString();

        // Mock LLM chain
        const { LLMChain } = require('langchain/chains');
        mockLLMChain = {
            call: jest.fn()
        };
        LLMChain.mockImplementation(() => mockLLMChain);

        // Ensure AI service is configured for testing
        originalIsConfigured = aiService.isConfigured;
        aiService.isConfigured = true;
    });

    afterEach(() => {
        // Restore original configuration
        aiService.isConfigured = originalIsConfigured;
        jest.clearAllMocks();
    });

    describe('Email Categorization', () => {
        test('should categorize customer inquiry email correctly', async () => {
            // Mock AI response for customer inquiry
            mockLLMChain.call.mockResolvedValue({
                text: 'customer_inquiry',
                usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
            });

            const subject = 'Help with my order - Product not working';
            const body = 'I purchased a product last week and it stopped working. Can you help me with a replacement?';

            const category = await aiService.categorizeEmail(subject, body);

            expect(category).toBe('customer_inquiry');
            expect(mockLLMChain.call).toHaveBeenCalledWith({
                subject,
                body: body.substring(0, 1000),
                attachments: ''
            });
        });

        test('should categorize invoice email correctly', async () => {
            // Mock AI response for invoice
            mockLLMChain.call.mockResolvedValue({
                text: 'invoice',
                usage: { prompt_tokens: 45, completion_tokens: 8, total_tokens: 53 }
            });

            const subject = 'Invoice #INV-2024-001 - Payment Due';
            const body = 'Please find attached invoice for services rendered. Amount: €1,500.00';
            const attachments = [{ filename: 'invoice.pdf', mimeType: 'application/pdf' }];

            const category = await aiService.categorizeEmail(subject, body, attachments);

            expect(category).toBe('invoice');
            expect(mockLLMChain.call).toHaveBeenCalledWith({
                subject,
                body: body.substring(0, 1000),
                attachments: 'invoice.pdf (application/pdf)'
            });
        });

        test('should categorize other emails correctly', async () => {
            // Mock AI response for other category
            mockLLMChain.call.mockResolvedValue({
                text: 'other',
                usage: { prompt_tokens: 40, completion_tokens: 5, total_tokens: 45 }
            });

            const subject = 'Newsletter - Weekly Updates';
            const body = 'Here are this week\'s updates and news from our company.';

            const category = await aiService.categorizeEmail(subject, body);

            expect(category).toBe('other');
        });

        test('should handle invalid AI responses gracefully', async () => {
            // Mock invalid AI response
            mockLLMChain.call.mockResolvedValue({
                text: 'invalid_category',
                usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35 }
            });

            const subject = 'Test Email';
            const body = 'Test content';

            const category = await aiService.categorizeEmail(subject, body);

            expect(category).toBe('other'); // Should default to 'other'
        });

        test('should handle AI service errors gracefully', async () => {
            // Mock AI service error
            mockLLMChain.call.mockRejectedValue(new Error('API Error'));

            const subject = 'Test Email';
            const body = 'Test content';

            const category = await aiService.categorizeEmail(subject, body);

            expect(category).toBe('other'); // Should default to 'other' on error
        });

        test('should respect daily limits', async () => {
            // Set daily limit to a low number
            aiService.dailyLimit = 2;
            aiService.requestCount = 2; // Already at limit

            const subject = 'Test Email';
            const body = 'Test content';

            const category = await aiService.categorizeEmail(subject, body);

            expect(category).toBe('other'); // Should default when limit exceeded
            expect(mockLLMChain.call).not.toHaveBeenCalled();
        });

        test('should handle unconfigured AI service', async () => {
            aiService.isConfigured = false;

            const subject = 'Test Email';
            const body = 'Test content';

            const category = await aiService.categorizeEmail(subject, body);

            expect(category).toBe('other'); // Should default when not configured
            expect(mockLLMChain.call).not.toHaveBeenCalled();
        });
    });

    describe('Batch Processing', () => {
        test('should process multiple emails in batches', async () => {
            // Mock AI responses
            mockLLMChain.call
                .mockResolvedValueOnce({
                    text: 'customer_inquiry',
                    usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
                })
                .mockResolvedValueOnce({
                    text: 'invoice',
                    usage: { prompt_tokens: 45, completion_tokens: 8, total_tokens: 53 }
                })
                .mockResolvedValueOnce({
                    text: 'other',
                    usage: { prompt_tokens: 40, completion_tokens: 5, total_tokens: 45 }
                });

            const emails = [
                { subject: 'Customer Support', body: 'Need help with order' },
                { subject: 'Invoice #123', body: 'Payment due' },
                { subject: 'Newsletter', body: 'Weekly updates' }
            ];

            const categories = await aiService.batchCategorizeEmails(emails);

            expect(categories).toHaveLength(3);
            expect(categories[0]).toBe('customer_inquiry');
            expect(categories[1]).toBe('invoice');
            expect(categories[2]).toBe('other');
            expect(mockLLMChain.call).toHaveBeenCalledTimes(3);
        });

        test('should handle large batches correctly', async () => {
            // Mock AI responses for a large batch
            const mockResponse = {
                text: 'other',
                usage: { prompt_tokens: 40, completion_tokens: 5, total_tokens: 45 }
            };
            mockLLMChain.call.mockResolvedValue(mockResponse);

            // Create 12 emails (should be processed in batches of 5)
            const emails = Array.from({ length: 12 }, (_, i) => ({
                subject: `Email ${i}`,
                body: `Content ${i}`
            }));

            const categories = await aiService.batchCategorizeEmails(emails);

            expect(categories).toHaveLength(12);
            expect(categories.every(cat => cat === 'other')).toBe(true);
            expect(mockLLMChain.call).toHaveBeenCalledTimes(12);
        });
    });

    describe('Usage Statistics', () => {
        test('should track token usage correctly', async () => {
            const initialUsage = { ...aiService.tokenUsage };

            mockLLMChain.call.mockResolvedValue({
                text: 'customer_inquiry',
                usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
            });

            await aiService.categorizeEmail('Test Subject', 'Test Body');

            expect(aiService.tokenUsage.prompt).toBe(initialUsage.prompt + 100);
            expect(aiService.tokenUsage.completion).toBe(initialUsage.completion + 20);
            expect(aiService.tokenUsage.total).toBe(initialUsage.total + 120);
        });

        test('should track request count correctly', async () => {
            const initialCount = aiService.requestCount;

            mockLLMChain.call.mockResolvedValue({
                text: 'other',
                usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
            });

            await aiService.categorizeEmail('Test Subject', 'Test Body');

            expect(aiService.requestCount).toBe(initialCount + 1);
        });

        test('should reset daily statistics correctly', async () => {
            // Set some usage
            aiService.requestCount = 10;
            aiService.tokenUsage = { prompt: 500, completion: 100, total: 600 };
            aiService.lastResetDate = '2024-01-01'; // Old date

            // Mock current date to trigger reset
            const originalDate = Date;
            global.Date = jest.fn(() => new originalDate('2024-01-02'));
            global.Date.now = originalDate.now;

            mockLLMChain.call.mockResolvedValue({
                text: 'other',
                usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
            });

            await aiService.categorizeEmail('Test Subject', 'Test Body');

            // Should have reset and then added new usage
            expect(aiService.requestCount).toBe(1);
            expect(aiService.tokenUsage.total).toBe(60);

            // Restore original Date
            global.Date = originalDate;
        });

        test('should provide usage statistics', () => {
            aiService.requestCount = 25;
            aiService.tokenUsage = { prompt: 1000, completion: 200, total: 1200 };

            const stats = aiService.getUsageStats();

            expect(stats.requestCount).toBe(25);
            expect(stats.tokenUsage.total).toBe(1200);
            expect(stats.dailyLimit).toBeDefined();
            expect(stats.remainingRequests).toBeDefined();
        });
    });

    describe('Rate Limiting and Retry Logic', () => {
        test('should handle rate limit errors with retry', async () => {
            // First call fails with rate limit, second succeeds
            mockLLMChain.call
                .mockRejectedValueOnce(new Error('rate limit exceeded'))
                .mockResolvedValueOnce({
                    text: 'customer_inquiry',
                    usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
                });

            const category = await aiService.categorizeEmail('Test Subject', 'Test Body');

            expect(category).toBe('customer_inquiry');
            expect(mockLLMChain.call).toHaveBeenCalledTimes(2);
        });

        test('should handle timeout errors with retry', async () => {
            // First call times out, second succeeds
            mockLLMChain.call
                .mockRejectedValueOnce(new Error('timeout'))
                .mockResolvedValueOnce({
                    text: 'invoice',
                    usage: { prompt_tokens: 45, completion_tokens: 8, total_tokens: 53 }
                });

            const category = await aiService.categorizeEmail('Invoice Test', 'Invoice content');

            expect(category).toBe('invoice');
            expect(mockLLMChain.call).toHaveBeenCalledTimes(2);
        });

        test('should give up after max retries', async () => {
            // All calls fail
            mockLLMChain.call.mockRejectedValue(new Error('persistent error'));

            const category = await aiService.categorizeEmail('Test Subject', 'Test Body');

            expect(category).toBe('other'); // Should default to 'other'
            expect(mockLLMChain.call).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });
    });
});
