/**
 * AI Extractor Tests
 * Tests for AI-powered data extraction from emails
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const aiExtractor = require('../../lib/ai-extractor');

// Mock dependencies
jest.mock('openai');
jest.mock('@langchain/openai');
jest.mock('langchain/chains');
jest.mock('../../lib/pdf-processor');

describe('AI Extractor', () => {
    let mockLLMChain;
    let mockPDFProcessor;
    let originalIsConfigured;

    beforeEach(() => {
        // Reset extractor state
        aiExtractor.requestCount = 0;
        aiExtractor.tokenUsage = { prompt: 0, completion: 0, total: 0 };
        aiExtractor.lastResetDate = new Date().toDateString();
        aiExtractor.extractionStats = { successful: 0, failed: 0, byCategory: {} };

        // Mock LLM chain
        const { LLMChain } = require('langchain/chains');
        mockLLMChain = {
            call: jest.fn()
        };
        LLMChain.mockImplementation(() => mockLLMChain);

        // Mock PDF processor
        mockPDFProcessor = require('../../lib/pdf-processor');
        mockPDFProcessor.extractPDFContent = jest.fn().mockResolvedValue('');

        // Ensure extractor is configured for testing
        originalIsConfigured = aiExtractor.isConfigured;
        aiExtractor.isConfigured = true;
    });

    afterEach(() => {
        // Restore original configuration
        aiExtractor.isConfigured = originalIsConfigured;
        jest.clearAllMocks();
    });

    describe('Customer Inquiry Data Extraction', () => {
        test('should extract customer inquiry data correctly', async () => {
            const mockExtractedData = {
                customerName: 'John Doe',
                customerEmail: 'john.doe@example.com',
                inquiryType: 'product_issue',
                priority: 'medium',
                description: 'Product arrived damaged',
                orderNumber: '12345'
            };

            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 150, completion_tokens: 80, total_tokens: 230 }
            });

            const email = global.testUtils.generateCustomerInquiryEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(true);
            expect(result.category).toBe('customer_inquiry');
            expect(result.extractedData).toEqual(mockExtractedData);
            expect(result.agent).toBe('ai-extractor-v2');
            expect(result.extractedAt).toBeDefined();
        });

        test('should handle customer inquiry with Greek text', async () => {
            const mockExtractedData = {
                customerName: 'Γιάννης Παπαδόπουλος',
                customerEmail: 'giannis@example.gr',
                inquiryType: 'billing_issue',
                priority: 'high',
                description: 'Πρόβλημα με τιμολόγηση',
                orderNumber: 'ORD-2024-001'
            };

            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 160, completion_tokens: 90, total_tokens: 250 }
            });

            const email = global.testUtils.generateCustomerInquiryEmail({
                subject: 'Πρόβλημα με παραγγελία',
                body: 'Γεια σας, έχω πρόβλημα με την παραγγελία μου #ORD-2024-001. Παρακαλώ επικοινωνήστε μαζί μου.'
            });

            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(true);
            expect(result.extractedData.customerName).toBe('Γιάννης Παπαδόπουλος');
            expect(result.extractedData.description).toBe('Πρόβλημα με τιμολόγηση');
        });

        test('should handle missing customer information gracefully', async () => {
            const mockExtractedData = {
                customerName: null,
                customerEmail: null,
                inquiryType: 'general_inquiry',
                priority: 'low',
                description: 'General question about services',
                orderNumber: null
            };

            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 }
            });

            const email = global.testUtils.generateTestEmail({
                subject: 'General Question',
                body: 'I have a general question about your services.',
                category: 'customer_inquiry'
            });

            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(true);
            expect(result.extractedData.customerName).toBeNull();
            expect(result.extractedData.orderNumber).toBeNull();
            expect(result.extractedData.inquiryType).toBe('general_inquiry');
        });
    });

    describe('Invoice Data Extraction', () => {
        test('should extract invoice data correctly', async () => {
            const mockExtractedData = {
                invoiceNumber: 'INV-2024-001',
                invoiceDate: '2024-01-15',
                customerName: 'ABC Company Ltd',
                amount: 1500.00,
                vatAmount: 360.00,
                totalAmount: 1860.00,
                currency: 'EUR',
                dueDate: '2024-02-14'
            };

            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 180, completion_tokens: 100, total_tokens: 280 }
            });

            const email = global.testUtils.generateInvoiceEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'invoice');

            expect(result.success).toBe(true);
            expect(result.category).toBe('invoice');
            expect(result.extractedData).toEqual(mockExtractedData);
            expect(result.extractedData.amount).toBe(1500.00);
            expect(result.extractedData.currency).toBe('EUR');
        });

        test('should extract invoice data with PDF content', async () => {
            const pdfContent = `
        ΤΙΜΟΛΟΓΙΟ
        Αριθμός: INV-2024-002
        Ημερομηνία: 2024-01-20
        Πελάτης: XYZ Εταιρεία ΑΕ
        Ποσό: €2,500.00
        ΦΠΑ: €600.00
        Σύνολο: €3,100.00
      `;

            mockPDFProcessor.extractPDFContent.mockResolvedValue(pdfContent);

            const mockExtractedData = {
                invoiceNumber: 'INV-2024-002',
                invoiceDate: '2024-01-20',
                customerName: 'XYZ Εταιρεία ΑΕ',
                amount: 2500.00,
                vatAmount: 600.00,
                totalAmount: 3100.00,
                currency: 'EUR',
                dueDate: null
            };

            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 220, completion_tokens: 120, total_tokens: 340 }
            });

            const email = global.testUtils.generateInvoiceEmail({
                attachments: [{
                    filename: 'invoice-INV-2024-002.pdf',
                    mimeType: 'application/pdf',
                    size: 150000,
                    attachmentId: 'att-12345'
                }]
            });

            // Set OAuth2 client for PDF processing
            aiExtractor.setOAuth2Client({ credentials: { access_token: 'test' } });

            const result = await aiExtractor.extractDataFromEmail(email, 'invoice');

            expect(result.success).toBe(true);
            expect(result.extractedData.invoiceNumber).toBe('INV-2024-002');
            expect(result.extractedData.amount).toBe(2500.00);
            expect(mockPDFProcessor.extractPDFContent).toHaveBeenCalledWith(
                email.attachments,
                email.gmailId
            );
        });

        test('should handle Greek invoice data', async () => {
            const mockExtractedData = {
                invoiceNumber: 'ΤΙΜ-2024-001',
                invoiceDate: '2024-01-15',
                customerName: 'ΑΒΓΔ Εταιρεία ΕΠΕ',
                amount: 1200.00,
                vatAmount: 288.00,
                totalAmount: 1488.00,
                currency: 'EUR',
                dueDate: '2024-02-15'
            };

            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 170, completion_tokens: 95, total_tokens: 265 }
            });

            const email = global.testUtils.generateInvoiceEmail({
                subject: 'Τιμολόγιο #ΤΙΜ-2024-001',
                body: 'Παρακαλώ βρείτε συνημμένο το τιμολόγιο για τις υπηρεσίες μας.'
            });

            const result = await aiExtractor.extractDataFromEmail(email, 'invoice');

            expect(result.success).toBe(true);
            expect(result.extractedData.invoiceNumber).toBe('ΤΙΜ-2024-001');
            expect(result.extractedData.customerName).toBe('ΑΒΓΔ Εταιρεία ΕΠΕ');
        });
    });

    describe('Error Handling', () => {
        test('should handle unsupported category', async () => {
            const email = global.testUtils.generateTestEmail({ category: 'newsletter' });
            const result = await aiExtractor.extractDataFromEmail(email, 'newsletter');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Unsupported category for data extraction');
            expect(mockLLMChain.call).not.toHaveBeenCalled();
        });

        test('should handle AI service errors', async () => {
            mockLLMChain.call.mockRejectedValue(new Error('AI service unavailable'));

            const email = global.testUtils.generateCustomerInquiryEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI service unavailable');
            expect(result.extractedData).toBeNull();
        });

        test('should handle invalid JSON response', async () => {
            mockLLMChain.call.mockResolvedValue({
                text: 'invalid json response',
                usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
            });

            const email = global.testUtils.generateCustomerInquiryEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to parse extracted data');
        });

        test('should handle unconfigured extractor', async () => {
            aiExtractor.isConfigured = false;

            const email = global.testUtils.generateCustomerInquiryEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI Extraction Agent not configured');
            expect(mockLLMChain.call).not.toHaveBeenCalled();
        });

        test('should handle daily limit exceeded', async () => {
            aiExtractor.dailyLimit = 1;
            aiExtractor.requestCount = 1; // Already at limit

            const email = global.testUtils.generateCustomerInquiryEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI Extraction daily limit exceeded');
            expect(mockLLMChain.call).not.toHaveBeenCalled();
        });
    });

    describe('Usage Statistics', () => {
        test('should track extraction statistics correctly', async () => {
            const mockExtractedData = { customerName: 'Test User' };
            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
            });

            const email = global.testUtils.generateCustomerInquiryEmail();
            await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            const stats = aiExtractor.getExtractionStats();
            expect(stats.successful).toBeGreaterThanOrEqual(1);
            expect(stats.byCategory.customer_inquiry).toBeGreaterThanOrEqual(1);
        });

        test('should track failed extractions', async () => {
            mockLLMChain.call.mockRejectedValue(new Error('Test error'));

            const email = global.testUtils.generateCustomerInquiryEmail();
            await aiExtractor.extractDataFromEmail(email, 'customer_inquiry');

            const stats = aiExtractor.getExtractionStats();
            expect(stats.failed).toBeGreaterThanOrEqual(1);
        });

        test('should provide usage statistics', () => {
            aiExtractor.requestCount = 15;
            aiExtractor.tokenUsage = { prompt: 800, completion: 400, total: 1200 };

            const stats = aiExtractor.getUsageStats();
            expect(stats.requestCount).toBe(15);
            expect(stats.tokenUsage.total).toBe(1200);
            expect(stats.dailyLimit).toBeDefined();
        });
    });

    describe('OAuth2 Integration', () => {
        test('should set OAuth2 client correctly', () => {
            const mockOAuth2Client = { credentials: { access_token: 'test-token' } };
            aiExtractor.setOAuth2Client(mockOAuth2Client);

            expect(aiExtractor.oauth2Client).toBe(mockOAuth2Client);
        });

        test('should handle PDF processing without OAuth2 client', async () => {
            aiExtractor.oauth2Client = null;

            const mockExtractedData = { invoiceNumber: 'INV-001' };
            mockLLMChain.call.mockResolvedValue({
                text: JSON.stringify(mockExtractedData),
                usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
            });

            const email = global.testUtils.generateInvoiceEmail();
            const result = await aiExtractor.extractDataFromEmail(email, 'invoice');

            expect(result.success).toBe(true);
            expect(mockPDFProcessor.extractPDFContent).not.toHaveBeenCalled();
        });
    });
});
