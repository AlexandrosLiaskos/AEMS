/**
 * Gmail Service Tests
 * Tests for Gmail API integration and email fetching
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const gmailService = require('../../lib/gmail');

// Mock dependencies
jest.mock('googleapis');
jest.mock('../../lib/database');
jest.mock('../../lib/ai');

describe('Gmail Service', () => {
    let mockGmail;
    let mockOAuth2;
    let mockDatabase;
    let mockAI;

    beforeEach(() => {
        // Mock googleapis
        const { google } = require('googleapis');

        mockOAuth2 = {
            setCredentials: jest.fn(),
            getAccessToken: jest.fn(),
            credentials: {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token'
            }
        };

        mockGmail = {
            users: {
                messages: {
                    list: jest.fn(),
                    get: jest.fn(),
                    modify: jest.fn()
                },
                getProfile: jest.fn()
            }
        };

        google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2);
        google.gmail = jest.fn().mockReturnValue(mockGmail);

        // Mock database
        mockDatabase = require('../../lib/database');
        mockDatabase.createEmails = jest.fn().mockResolvedValue([]);
        mockDatabase.getSettings = jest.fn().mockResolvedValue({
            syncInterval: 5,
            autoSync: true,
            lastSync: null
        });
        mockDatabase.updateSettings = jest.fn().mockResolvedValue({});

        // Mock AI service
        mockAI = require('../../lib/ai');
        mockAI.categorizeEmail = jest.fn().mockResolvedValue('other');

        // Reset Gmail service state
        gmailService.oauth2Client = null;
        gmailService.isConnected = false;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('OAuth2 Authentication', () => {
        test('should generate auth URL correctly', () => {
            const authUrl = gmailService.getAuthUrl();

            expect(authUrl).toBeDefined();
            expect(typeof authUrl).toBe('string');
            expect(authUrl).toContain('oauth2');
            expect(authUrl).toContain('gmail');
        });

        test('should handle OAuth2 callback successfully', async () => {
            const mockTokens = {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                scope: 'https://www.googleapis.com/auth/gmail.readonly',
                token_type: 'Bearer',
                expiry_date: Date.now() + 3600000
            };

            mockOAuth2.getToken = jest.fn().mockResolvedValue({ tokens: mockTokens });
            mockGmail.users.getProfile.mockResolvedValue({
                data: {
                    emailAddress: 'test@example.com',
                    messagesTotal: 100,
                    threadsTotal: 50
                }
            });

            const result = await gmailService.handleOAuthCallback('test-auth-code');

            expect(result.success).toBe(true);
            expect(result.user.email).toBe('test@example.com');
            expect(mockOAuth2.setCredentials).toHaveBeenCalledWith(mockTokens);
            expect(gmailService.isConnected).toBe(true);
        });

        test('should handle OAuth2 callback errors', async () => {
            mockOAuth2.getToken = jest.fn().mockRejectedValue(new Error('Invalid authorization code'));

            const result = await gmailService.handleOAuthCallback('invalid-code');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid authorization code');
            expect(gmailService.isConnected).toBe(false);
        });

        test('should initialize from stored tokens', async () => {
            const storedTokens = {
                access_token: 'stored-access-token',
                refresh_token: 'stored-refresh-token',
                expiry_date: Date.now() + 3600000
            };

            // Mock file system to return stored tokens
            const fs = require('fs').promises;
            jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(storedTokens));

            mockGmail.users.getProfile.mockResolvedValue({
                data: { emailAddress: 'test@example.com' }
            });

            const isInitialized = await gmailService.initializeFromStoredTokens();

            expect(isInitialized).toBe(true);
            expect(mockOAuth2.setCredentials).toHaveBeenCalledWith(storedTokens);
            expect(gmailService.isConnected).toBe(true);
        });

        test('should handle expired tokens with refresh', async () => {
            const expiredTokens = {
                access_token: 'expired-token',
                refresh_token: 'valid-refresh-token',
                expiry_date: Date.now() - 3600000 // Expired
            };

            const refreshedTokens = {
                access_token: 'new-access-token',
                refresh_token: 'valid-refresh-token',
                expiry_date: Date.now() + 3600000
            };

            const fs = require('fs').promises;
            jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(expiredTokens));
            jest.spyOn(fs, 'writeFile').mockResolvedValue();

            mockOAuth2.refreshAccessToken = jest.fn().mockResolvedValue({
                credentials: refreshedTokens
            });

            mockGmail.users.getProfile.mockResolvedValue({
                data: { emailAddress: 'test@example.com' }
            });

            const isInitialized = await gmailService.initializeFromStoredTokens();

            expect(isInitialized).toBe(true);
            expect(mockOAuth2.refreshAccessToken).toHaveBeenCalled();
            expect(mockOAuth2.setCredentials).toHaveBeenCalledWith(refreshedTokens);
        });
    });

    describe('Email Fetching', () => {
        beforeEach(() => {
            // Setup authenticated state
            gmailService.oauth2Client = mockOAuth2;
            gmailService.isConnected = true;
        });

        test('should fetch emails successfully', async () => {
            const mockMessagesList = {
                messages: [
                    { id: 'msg-1' },
                    { id: 'msg-2' }
                ]
            };

            const mockMessage1 = {
                id: 'msg-1',
                payload: {
                    headers: [
                        { name: 'Subject', value: 'Test Email 1' },
                        { name: 'From', value: 'sender1@example.com' },
                        { name: 'To', value: 'recipient@example.com' },
                        { name: 'Date', value: 'Mon, 15 Jan 2024 10:00:00 +0000' }
                    ],
                    body: { data: Buffer.from('Test email body 1').toString('base64') },
                    parts: []
                },
                labelIds: ['UNREAD', 'INBOX']
            };

            const mockMessage2 = {
                id: 'msg-2',
                payload: {
                    headers: [
                        { name: 'Subject', value: 'Test Email 2' },
                        { name: 'From', value: 'sender2@example.com' },
                        { name: 'To', value: 'recipient@example.com' },
                        { name: 'Date', value: 'Mon, 15 Jan 2024 11:00:00 +0000' }
                    ],
                    body: { data: Buffer.from('Test email body 2').toString('base64') },
                    parts: []
                },
                labelIds: ['UNREAD', 'INBOX']
            };

            mockGmail.users.messages.list.mockResolvedValue({ data: mockMessagesList });
            mockGmail.users.messages.get
                .mockResolvedValueOnce({ data: mockMessage1 })
                .mockResolvedValueOnce({ data: mockMessage2 });

            const emails = await gmailService.fetchEmails(10, 'is:unread');

            expect(emails).toHaveLength(2);
            expect(emails[0].subject).toBe('Test Email 1');
            expect(emails[0].fromAddress).toBe('sender1@example.com');
            expect(emails[1].subject).toBe('Test Email 2');
            expect(emails[1].fromAddress).toBe('sender2@example.com');
        });

        test('should handle emails with attachments', async () => {
            const mockMessagesList = {
                messages: [{ id: 'msg-with-attachment' }]
            };

            const mockMessageWithAttachment = {
                id: 'msg-with-attachment',
                payload: {
                    headers: [
                        { name: 'Subject', value: 'Email with PDF' },
                        { name: 'From', value: 'sender@example.com' },
                        { name: 'Date', value: 'Mon, 15 Jan 2024 10:00:00 +0000' }
                    ],
                    body: { data: Buffer.from('Email with attachment').toString('base64') },
                    parts: [
                        {
                            filename: 'document.pdf',
                            mimeType: 'application/pdf',
                            body: {
                                attachmentId: 'att-123',
                                size: 125000
                            }
                        }
                    ]
                },
                labelIds: ['UNREAD', 'INBOX']
            };

            mockGmail.users.messages.list.mockResolvedValue({ data: mockMessagesList });
            mockGmail.users.messages.get.mockResolvedValue({ data: mockMessageWithAttachment });

            const emails = await gmailService.fetchEmails(10);

            expect(emails).toHaveLength(1);
            expect(emails[0].attachments).toHaveLength(1);
            expect(emails[0].attachments[0].filename).toBe('document.pdf');
            expect(emails[0].attachments[0].mimeType).toBe('application/pdf');
            expect(emails[0].attachments[0].attachmentId).toBe('att-123');
        });

        test('should handle multipart email bodies', async () => {
            const mockMessagesList = {
                messages: [{ id: 'msg-multipart' }]
            };

            const mockMultipartMessage = {
                id: 'msg-multipart',
                payload: {
                    headers: [
                        { name: 'Subject', value: 'Multipart Email' },
                        { name: 'From', value: 'sender@example.com' },
                        { name: 'Date', value: 'Mon, 15 Jan 2024 10:00:00 +0000' }
                    ],
                    mimeType: 'multipart/alternative',
                    parts: [
                        {
                            mimeType: 'text/plain',
                            body: { data: Buffer.from('Plain text content').toString('base64') }
                        },
                        {
                            mimeType: 'text/html',
                            body: { data: Buffer.from('<p>HTML content</p>').toString('base64') }
                        }
                    ]
                },
                labelIds: ['UNREAD', 'INBOX']
            };

            mockGmail.users.messages.list.mockResolvedValue({ data: mockMessagesList });
            mockGmail.users.messages.get.mockResolvedValue({ data: mockMultipartMessage });

            const emails = await gmailService.fetchEmails(10);

            expect(emails).toHaveLength(1);
            expect(emails[0].body).toContain('Plain text content');
        });

        test('should handle empty message list', async () => {
            mockGmail.users.messages.list.mockResolvedValue({ data: {} });

            const emails = await gmailService.fetchEmails(10);

            expect(emails).toHaveLength(0);
        });

        test('should handle Gmail API errors', async () => {
            mockGmail.users.messages.list.mockRejectedValue(new Error('Gmail API error'));

            await expect(gmailService.fetchEmails(10)).rejects.toThrow('Gmail API error');
        });
    });

    describe('Email Synchronization', () => {
        beforeEach(() => {
            gmailService.oauth2Client = mockOAuth2;
            gmailService.isConnected = true;
        });

        test('should sync emails with AI categorization', async () => {
            const mockMessagesList = {
                messages: [{ id: 'msg-1' }]
            };

            const mockMessage = {
                id: 'msg-1',
                payload: {
                    headers: [
                        { name: 'Subject', value: 'Customer Support Request' },
                        { name: 'From', value: 'customer@example.com' },
                        { name: 'Date', value: 'Mon, 15 Jan 2024 10:00:00 +0000' }
                    ],
                    body: { data: Buffer.from('I need help with my order').toString('base64') },
                    parts: []
                },
                labelIds: ['UNREAD', 'INBOX']
            };

            mockGmail.users.messages.list.mockResolvedValue({ data: mockMessagesList });
            mockGmail.users.messages.get.mockResolvedValue({ data: mockMessage });
            mockAI.categorizeEmail.mockResolvedValue('customer_inquiry');
            mockDatabase.createEmails.mockResolvedValue([
                { id: 'email-1', category: 'customer_inquiry' }
            ]);

            const result = await gmailService.syncEmails();

            expect(result.count).toBe(1);
            expect(result.categorized).toBe(1);
            expect(result.errors).toBe(0);
            expect(mockAI.categorizeEmail).toHaveBeenCalledWith(
                'Customer Support Request',
                'I need help with my order',
                []
            );
        });

        test('should handle sync with no new emails', async () => {
            mockGmail.users.messages.list.mockResolvedValue({ data: {} });

            const result = await gmailService.syncEmails();

            expect(result.count).toBe(0);
            expect(result.categorized).toBe(0);
            expect(result.errors).toBe(0);
        });

        test('should handle sync errors gracefully', async () => {
            mockGmail.users.messages.list.mockRejectedValue(new Error('Sync error'));

            const result = await gmailService.syncEmails();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Sync error');
        });

        test('should update last sync time after successful sync', async () => {
            mockGmail.users.messages.list.mockResolvedValue({ data: {} });

            await gmailService.syncEmails();

            expect(mockDatabase.updateSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    lastSync: expect.any(String)
                })
            );
        });
    });

    describe('Email Management', () => {
        beforeEach(() => {
            gmailService.oauth2Client = mockOAuth2;
            gmailService.isConnected = true;
        });

        test('should mark email as read', async () => {
            mockGmail.users.messages.modify.mockResolvedValue({
                data: { id: 'msg-1', labelIds: ['INBOX'] }
            });

            const result = await gmailService.markAsRead('msg-1');

            expect(result.success).toBe(true);
            expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
                userId: 'me',
                id: 'msg-1',
                resource: {
                    removeLabelIds: ['UNREAD']
                }
            });
        });

        test('should handle mark as read errors', async () => {
            mockGmail.users.messages.modify.mockRejectedValue(new Error('API error'));

            const result = await gmailService.markAsRead('msg-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('API error');
        });
    });

    describe('Connection Status', () => {
        test('should return correct connection status when connected', () => {
            gmailService.isConnected = true;
            gmailService.oauth2Client = mockOAuth2;

            const status = gmailService.getConnectionStatus();

            expect(status.connected).toBe(true);
            expect(status.hasValidTokens).toBe(true);
        });

        test('should return correct connection status when not connected', () => {
            gmailService.isConnected = false;
            gmailService.oauth2Client = null;

            const status = gmailService.getConnectionStatus();

            expect(status.connected).toBe(false);
            expect(status.hasValidTokens).toBe(false);
        });

        test('should disconnect successfully', async () => {
            gmailService.isConnected = true;
            gmailService.oauth2Client = mockOAuth2;

            const fs = require('fs').promises;
            jest.spyOn(fs, 'unlink').mockResolvedValue();

            await gmailService.disconnect();

            expect(gmailService.isConnected).toBe(false);
            expect(gmailService.oauth2Client).toBeNull();
        });
    });
});
