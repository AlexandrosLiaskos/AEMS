/**
 * PDF Processor Tests
 * Tests for PDF content extraction functionality
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const pdfProcessor = require('../../lib/pdf-processor');

// Mock dependencies
jest.mock('pdf-parse');
jest.mock('googleapis');

describe('PDF Processor', () => {
    let mockGmail;
    let mockPdfParse;
    let mockOAuth2Client;

    beforeEach(() => {
        // Mock googleapis
        const { google } = require('googleapis');
        mockGmail = {
            users: {
                messages: {
                    attachments: {
                        get: jest.fn()
                    }
                }
            }
        };
        google.gmail = jest.fn().mockReturnValue(mockGmail);

        // Mock pdf-parse
        mockPdfParse = require('pdf-parse');

        // Mock OAuth2 client
        mockOAuth2Client = {
            credentials: {
                access_token: 'test-access-token'
            }
        };

        // Set OAuth2 client
        pdfProcessor.setOAuth2Client(mockOAuth2Client);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('OAuth2 Client Management', () => {
        test('should set OAuth2 client correctly', () => {
            const newClient = { credentials: { access_token: 'new-token' } };
            pdfProcessor.setOAuth2Client(newClient);
            expect(pdfProcessor.oauth2Client).toBe(newClient);
        });

        test('should handle missing OAuth2 client gracefully', async () => {
            pdfProcessor.setOAuth2Client(null);

            const attachments = [
                { filename: 'test.pdf', mimeType: 'application/pdf', attachmentId: 'att-123' }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');
            expect(result).toBe('');
        });
    });

    describe('PDF Content Extraction', () => {
        test('should extract text from PDF successfully', async () => {
            const mockPdfBuffer = Buffer.from('mock pdf content');
            const mockExtractedText = 'Invoice #INV-2024-001\nAmount: €1,500.00\nCustomer: ABC Company';

            // Mock Gmail API response
            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: {
                    data: mockPdfBuffer.toString('base64')
                }
            });

            // Mock pdf-parse response
            mockPdfParse.mockResolvedValue({
                text: mockExtractedText,
                numpages: 1,
                info: {}
            });

            const attachments = [
                {
                    filename: 'invoice.pdf',
                    mimeType: 'application/pdf',
                    size: 125000,
                    attachmentId: 'att-12345'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toContain('invoice.pdf');
            expect(result).toContain(mockExtractedText);
            expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledWith({
                userId: 'me',
                messageId: 'msg-123',
                id: 'att-12345'
            });
        });

        test('should handle multiple PDF attachments', async () => {
            const mockPdfBuffer1 = Buffer.from('pdf content 1');
            const mockPdfBuffer2 = Buffer.from('pdf content 2');
            const mockText1 = 'Invoice #INV-001\nAmount: €1,000.00';
            const mockText2 = 'Invoice #INV-002\nAmount: €2,000.00';

            // Mock Gmail API responses
            mockGmail.users.messages.attachments.get
                .mockResolvedValueOnce({
                    data: { data: mockPdfBuffer1.toString('base64') }
                })
                .mockResolvedValueOnce({
                    data: { data: mockPdfBuffer2.toString('base64') }
                });

            // Mock pdf-parse responses
            mockPdfParse
                .mockResolvedValueOnce({ text: mockText1 })
                .mockResolvedValueOnce({ text: mockText2 });

            const attachments = [
                {
                    filename: 'invoice1.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-111'
                },
                {
                    filename: 'invoice2.pdf',
                    mimeType: 'application/pdf',
                    size: 120000,
                    attachmentId: 'att-222'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toContain('invoice1.pdf');
            expect(result).toContain('invoice2.pdf');
            expect(result).toContain(mockText1);
            expect(result).toContain(mockText2);
            expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledTimes(2);
        });

        test('should filter non-PDF attachments', async () => {
            const attachments = [
                {
                    filename: 'document.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-pdf'
                },
                {
                    filename: 'image.jpg',
                    mimeType: 'image/jpeg',
                    size: 50000,
                    attachmentId: 'att-jpg'
                },
                {
                    filename: 'document.docx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    size: 80000,
                    attachmentId: 'att-docx'
                }
            ];

            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('pdf content').toString('base64') }
            });

            mockPdfParse.mockResolvedValue({
                text: 'PDF content extracted'
            });

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toContain('document.pdf');
            expect(result).not.toContain('image.jpg');
            expect(result).not.toContain('document.docx');
            expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledTimes(1);
        });

        test('should skip large PDF files', async () => {
            const attachments = [
                {
                    filename: 'small.pdf',
                    mimeType: 'application/pdf',
                    size: 1000000, // 1MB - should process
                    attachmentId: 'att-small'
                },
                {
                    filename: 'large.pdf',
                    mimeType: 'application/pdf',
                    size: 6000000, // 6MB - should skip
                    attachmentId: 'att-large'
                }
            ];

            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('pdf content').toString('base64') }
            });

            mockPdfParse.mockResolvedValue({
                text: 'Small PDF content'
            });

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toContain('small.pdf');
            expect(result).not.toContain('large.pdf');
            expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledTimes(1);
        });

        test('should handle empty attachments array', async () => {
            const result = await pdfProcessor.extractPDFContent([], 'msg-123');
            expect(result).toBe('');
            expect(mockGmail.users.messages.attachments.get).not.toHaveBeenCalled();
        });

        test('should handle null/undefined attachments', async () => {
            const result1 = await pdfProcessor.extractPDFContent(null, 'msg-123');
            const result2 = await pdfProcessor.extractPDFContent(undefined, 'msg-123');

            expect(result1).toBe('');
            expect(result2).toBe('');
            expect(mockGmail.users.messages.attachments.get).not.toHaveBeenCalled();
        });
    });

    describe('Text Cleaning and Processing', () => {
        test('should clean extracted text properly', async () => {
            const dirtyText = `
        Invoice    #INV-2024-001


        Amount:   €1,500.00
        Customer:     ABC Company   Ltd


        Special chars: àáâãäåæçèéêë
      `;

            const cleanedText = 'Invoice #INV-2024-001\nAmount: €1,500.00\nCustomer: ABC Company Ltd\nSpecial chars: ';

            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('pdf content').toString('base64') }
            });

            mockPdfParse.mockResolvedValue({
                text: dirtyText
            });

            const attachments = [
                {
                    filename: 'test.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-123'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toContain('Invoice #INV-2024-001');
            expect(result).toContain('Amount: €1,500.00');
            expect(result).toContain('Customer: ABC Company Ltd');
            // Should remove excessive whitespace and special characters
            expect(result).not.toContain('    ');
            expect(result).not.toContain('\n\n\n');
        });

        test('should handle Greek text correctly', async () => {
            const greekText = `
        ΤΙΜΟΛΟΓΙΟ #ΤΙΜ-2024-001
        Πελάτης: ΑΒΓΔ Εταιρεία ΕΠΕ
        Ποσό: €2,500.00
        ΦΠΑ: €600.00
        Σύνολο: €3,100.00
      `;

            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('pdf content').toString('base64') }
            });

            mockPdfParse.mockResolvedValue({
                text: greekText
            });

            const attachments = [
                {
                    filename: 'greek-invoice.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-123'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toContain('ΤΙΜΟΛΟΓΙΟ #ΤΙΜ-2024-001');
            expect(result).toContain('ΑΒΓΔ Εταιρεία ΕΠΕ');
            expect(result).toContain('€2,500.00');
        });
    });

    describe('Error Handling', () => {
        test('should handle Gmail API errors gracefully', async () => {
            mockGmail.users.messages.attachments.get.mockRejectedValue(
                new Error('Gmail API error')
            );

            const attachments = [
                {
                    filename: 'test.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-123'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toBe('');
            expect(mockPdfParse).not.toHaveBeenCalled();
        });

        test('should handle PDF parsing errors gracefully', async () => {
            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('invalid pdf').toString('base64') }
            });

            mockPdfParse.mockRejectedValue(new Error('Invalid PDF format'));

            const attachments = [
                {
                    filename: 'invalid.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-123'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toBe('');
        });

        test('should handle empty PDF content', async () => {
            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('pdf content').toString('base64') }
            });

            mockPdfParse.mockResolvedValue({
                text: ''
            });

            const attachments = [
                {
                    filename: 'empty.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-123'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toBe('');
        });

        test('should handle image-based PDFs', async () => {
            mockGmail.users.messages.attachments.get.mockResolvedValue({
                data: { data: Buffer.from('pdf content').toString('base64') }
            });

            mockPdfParse.mockResolvedValue({
                text: '   \n\n   \n   ' // Only whitespace
            });

            const attachments = [
                {
                    filename: 'scanned.pdf',
                    mimeType: 'application/pdf',
                    size: 100000,
                    attachmentId: 'att-123'
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toBe('');
        });

        test('should handle missing attachment ID', async () => {
            const attachments = [
                {
                    filename: 'test.pdf',
                    mimeType: 'application/pdf',
                    size: 100000
                    // Missing attachmentId
                }
            ];

            const result = await pdfProcessor.extractPDFContent(attachments, 'msg-123');

            expect(result).toBe('');
            expect(mockGmail.users.messages.attachments.get).not.toHaveBeenCalled();
        });
    });
});
