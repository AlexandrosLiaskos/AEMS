/**
 * Database Module Tests
 * Comprehensive functional tests for the modular JSON database
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const db = require('../../lib/database');

describe('Database Module', () => {
    let testEmails = [];
    let testExtractedData = [];

    beforeEach(async () => {
        // Reset database state
        testEmails = [];
        testExtractedData = [];

        // Wait for database initialization
        await global.testUtils.wait(100);
    });

    afterEach(async () => {
        // Clean up any test data
        for (const email of testEmails) {
            try {
                await db.softDeleteEmail(email.id);
            } catch (error) {
                // Email might already be deleted
            }
        }
    });

    describe('Email Operations', () => {
        test('should create and retrieve email successfully', async () => {
            const emailData = global.testUtils.generateTestEmail({
                subject: 'Database Test Email',
                category: 'customer_inquiry'
            });

            // Create email
            const createdEmail = await db.createEmail(emailData);
            testEmails.push(createdEmail);

            expect(createdEmail).toBeDefined();
            expect(createdEmail.id).toBeDefined();
            expect(createdEmail.subject).toBe(emailData.subject);
            expect(createdEmail.category).toBe(emailData.category);
            expect(createdEmail.status).toBe('FETCHED');

            // Retrieve email
            const retrievedEmail = await db.getEmailById(createdEmail.id);
            expect(retrievedEmail).toBeDefined();
            expect(retrievedEmail.id).toBe(createdEmail.id);
            expect(retrievedEmail.subject).toBe(emailData.subject);
        });

        test('should handle different email categories correctly', async () => {
            const categories = ['customer_inquiry', 'invoice', 'other'];
            const createdEmails = [];

            for (const category of categories) {
                const emailData = global.testUtils.generateTestEmail({
                    subject: `Test ${category} Email`,
                    category
                });

                const email = await db.createEmail(emailData);
                createdEmails.push(email);
                testEmails.push(email);

                expect(email.category).toBe(category);
            }

            // Verify emails are stored in correct category files
            const fetchedEmails = await db.getFetchedEmails();
            expect(fetchedEmails.length).toBeGreaterThanOrEqual(3);

            for (const email of createdEmails) {
                const found = fetchedEmails.find(e => e.id === email.id);
                expect(found).toBeDefined();
                expect(found.category).toBe(email.category);
            }
        });

        test('should move email between statuses correctly', async () => {
            const emailData = global.testUtils.generateTestEmail({
                category: 'customer_inquiry'
            });

            // Create email (starts as FETCHED)
            const email = await db.createEmail(emailData);
            testEmails.push(email);
            expect(email.status).toBe('FETCHED');

            // Move to REVIEW
            const reviewEmail = await db.moveEmailToReview(email.id);
            expect(reviewEmail.status).toBe('REVIEW');

            // Verify it's no longer in fetched
            const fetchedEmails = await db.getFetchedEmails();
            const foundInFetched = fetchedEmails.find(e => e.id === email.id);
            expect(foundInFetched).toBeUndefined();

            // Verify it's in review
            const reviewEmails = await db.getReviewEmails();
            const foundInReview = reviewEmails.find(e => e.id === email.id);
            expect(foundInReview).toBeDefined();
            expect(foundInReview.status).toBe('REVIEW');

            // Move to MANAGED
            const managedEmail = await db.moveEmailToManaged(email.id);
            expect(managedEmail.status).toBe('MANAGED');

            // Verify it's in managed
            const managedEmails = await db.getManagedEmails();
            const foundInManaged = managedEmails.find(e => e.id === email.id);
            expect(foundInManaged).toBeDefined();
            expect(foundInManaged.status).toBe('MANAGED');
        });

        test('should handle soft delete correctly', async () => {
            const emailData = global.testUtils.generateTestEmail();
            const email = await db.createEmail(emailData);

            // Soft delete
            const deletedEmail = await db.softDeleteEmail(email.id);
            expect(deletedEmail.isDeleted).toBe(true);
            expect(deletedEmail.status).toBe('DELETED');

            // Should not appear in regular queries
            const fetchedEmails = await db.getFetchedEmails();
            const found = fetchedEmails.find(e => e.id === email.id);
            expect(found).toBeUndefined();

            // Should be retrievable by ID
            const retrievedDeleted = await db.getEmailById(email.id);
            expect(retrievedDeleted).toBeDefined();
            expect(retrievedDeleted.isDeleted).toBe(true);
        });

        test('should handle bulk email creation correctly', async () => {
            const emailsData = [
                global.testUtils.generateCustomerInquiryEmail(),
                global.testUtils.generateInvoiceEmail(),
                global.testUtils.generateTestEmail({ category: 'other' })
            ];

            const createdEmails = await db.addMultipleFetchedEmails(emailsData);
            testEmails.push(...createdEmails);

            expect(createdEmails).toHaveLength(3);

            // Verify each email was created correctly
            for (let i = 0; i < createdEmails.length; i++) {
                expect(createdEmails[i].subject).toBe(emailsData[i].subject);
                expect(createdEmails[i].category).toBe(emailsData[i].category);
            }

            // Verify they're stored in correct category files
            const fetchedEmails = await db.getFetchedEmails();
            for (const email of createdEmails) {
                const found = fetchedEmails.find(e => e.id === email.id);
                expect(found).toBeDefined();
            }
        });

        test('should update email correctly', async () => {
            const emailData = global.testUtils.generateTestEmail();
            const email = await db.createEmail(emailData);
            testEmails.push(email);

            const updates = {
                subject: 'Updated Subject',
                isRead: true,
                priority: 'high'
            };

            const updatedEmail = await db.updateEmail(email.id, updates);
            expect(updatedEmail.subject).toBe(updates.subject);
            expect(updatedEmail.isRead).toBe(true);
            expect(updatedEmail.priority).toBe('high');
            expect(updatedEmail.updatedAt).not.toBe(email.updatedAt);
        });
    });

    describe('Extracted Data Operations', () => {
        test('should store and retrieve extracted data correctly', async () => {
            const emailData = global.testUtils.generateCustomerInquiryEmail();
            const email = await db.createEmail(emailData);
            testEmails.push(email);

            const extractedData = global.testUtils.generateExtractedData('customer_inquiry', {
                emailId: email.id
            });

            // Store extracted data
            const stored = await db.createExtractedData(extractedData);
            testExtractedData.push(stored);

            expect(stored).toBeDefined();
            expect(stored.id).toBeDefined();
            expect(stored.emailId).toBe(email.id);
            expect(stored.category).toBe('customer_inquiry');

            // Retrieve extracted data
            const retrieved = await db.getExtractedDataByEmailId(email.id);
            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(stored.id);
            expect(retrieved.data.customerName).toBe(extractedData.data.customerName);
        });

        test('should handle different extraction categories', async () => {
            const customerEmail = await db.createEmail(global.testUtils.generateCustomerInquiryEmail());
            const invoiceEmail = await db.createEmail(global.testUtils.generateInvoiceEmail());
            testEmails.push(customerEmail, invoiceEmail);

            const customerData = global.testUtils.generateExtractedData('customer_inquiry', {
                emailId: customerEmail.id
            });
            const invoiceData = global.testUtils.generateExtractedData('invoice', {
                emailId: invoiceEmail.id
            });

            const storedCustomer = await db.createExtractedData(customerData);
            const storedInvoice = await db.createExtractedData(invoiceData);
            testExtractedData.push(storedCustomer, storedInvoice);

            // Verify customer inquiry data
            expect(storedCustomer.category).toBe('customer_inquiry');
            expect(storedCustomer.data.customerName).toBeDefined();
            expect(storedCustomer.data.inquiryType).toBeDefined();

            // Verify invoice data
            expect(storedInvoice.category).toBe('invoice');
            expect(storedInvoice.data.invoiceNumber).toBeDefined();
            expect(storedInvoice.data.amount).toBeDefined();

            // Retrieve by email ID
            const customerExtraction = await db.getExtractedDataByEmailId(customerEmail.id);
            const invoiceExtraction = await db.getExtractedDataByEmailId(invoiceEmail.id);

            expect(customerExtraction).toBeDefined();
            expect(invoiceExtraction).toBeDefined();
            expect(customerExtraction.category).toBe('customer_inquiry');
            expect(invoiceExtraction.category).toBe('invoice');
        });
    });

    describe('Statistics and Metrics', () => {
        test('should calculate email statistics correctly', async () => {
            // Create emails in different statuses
            const fetchedEmail = await db.createEmail(global.testUtils.generateTestEmail());
            const reviewEmail = await db.createEmail(global.testUtils.generateTestEmail());
            const managedEmail = await db.createEmail(global.testUtils.generateTestEmail());

            testEmails.push(fetchedEmail, reviewEmail, managedEmail);

            // Move emails to different statuses
            await db.moveEmailToReview(reviewEmail.id);
            await db.moveEmailToManaged(managedEmail.id);

            const stats = await db.getStats();
            expect(stats.fetched).toBeGreaterThanOrEqual(1);
            expect(stats.review).toBeGreaterThanOrEqual(1);
            expect(stats.managed).toBeGreaterThanOrEqual(1);
            expect(stats.total).toBe(stats.fetched + stats.review + stats.managed);
        });
    });

    describe('Settings Management', () => {
        test('should manage settings correctly', async () => {
            const newSettings = {
                syncInterval: 10,
                autoSync: false,
                language: 'greek',
                notifications: false
            };

            await db.updateSettings(newSettings);
            const retrievedSettings = await db.getSettings();

            expect(retrievedSettings.syncInterval).toBe(10);
            expect(retrievedSettings.autoSync).toBe(false);
            expect(retrievedSettings.language).toBe('greek');
            expect(retrievedSettings.notifications).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle non-existent email gracefully', async () => {
            const nonExistentId = 'non-existent-id';
            const result = await db.getEmailById(nonExistentId);
            expect(result).toBeNull();
        });

        test('should handle invalid email data gracefully', async () => {
            const invalidEmailData = {
                // Missing required fields
                subject: 'Test'
            };

            await expect(db.createEmail(invalidEmailData)).rejects.toThrow();
        });
    });
});
