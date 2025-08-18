/**
 * Environment Validator Tests
 * Tests for environment configuration validation
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('Environment Validator', () => {
    let envValidator;
    let originalEnv;
    let originalExit;
    let mockExit;

    beforeEach(() => {
        // Save original environment
        originalEnv = { ...process.env };

        // Mock process.exit
        originalExit = process.exit;
        mockExit = jest.fn();
        process.exit = mockExit;

        // Clear module cache to get fresh instance
        delete require.cache[require.resolve('../../lib/env-validator')];
        envValidator = require('../../lib/env-validator');
    });

    afterEach(() => {
        // Restore original environment and process.exit
        process.env = originalEnv;
        process.exit = originalExit;
        jest.clearAllMocks();
    });

    describe('Required Environment Variables', () => {
        test('should validate all required variables are present', () => {
            // Set all required environment variables
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should fail validation when required variables are missing', () => {
            // Clear all environment variables
            delete process.env.GOOGLE_CLIENT_ID;
            delete process.env.GOOGLE_CLIENT_SECRET;
            delete process.env.GOOGLE_REDIRECT_URI;
            delete process.env.OPENAI_API_KEY;
            delete process.env.SESSION_SECRET;

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors).toContain('GOOGLE_CLIENT_ID is required');
            expect(result.errors).toContain('GOOGLE_CLIENT_SECRET is required');
            expect(result.errors).toContain('OPENAI_API_KEY is required');
        });

        test('should fail validation for placeholder values', () => {
            process.env.GOOGLE_CLIENT_ID = 'your_google_client_id_here';
            process.env.GOOGLE_CLIENT_SECRET = 'your_google_client_secret_here';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'your_openai_api_key_here';
            process.env.SESSION_SECRET = 'your_session_secret_here';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('GOOGLE_CLIENT_ID appears to be a placeholder value');
            expect(result.errors).toContain('OPENAI_API_KEY appears to be a placeholder value');
        });
    });

    describe('URL Validation', () => {
        test('should validate correct redirect URI format', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
        });

        test('should fail validation for invalid redirect URI', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'invalid-url';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('GOOGLE_REDIRECT_URI must be a valid URL');
        });

        test('should accept HTTPS redirect URI', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'https://myapp.com/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
        });
    });

    describe('Numeric Validation', () => {
        test('should validate numeric environment variables', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.PORT = '3000';
            process.env.AI_DAILY_LIMIT = '100';
            process.env.OPENAI_MAX_TOKENS = '1000';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
        });

        test('should fail validation for invalid numeric values', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.PORT = 'not-a-number';
            process.env.AI_DAILY_LIMIT = 'invalid';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('PORT must be a valid number');
            expect(result.errors).toContain('AI_DAILY_LIMIT must be a valid number');
        });

        test('should validate numeric ranges', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.PORT = '99999'; // Too high
            process.env.AI_DAILY_LIMIT = '-1'; // Negative

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('PORT must be between 1 and 65535');
            expect(result.errors).toContain('AI_DAILY_LIMIT must be greater than 0');
        });
    });

    describe('Boolean Validation', () => {
        test('should validate boolean environment variables', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.ENABLE_AUDIT_LOGGING = 'true';
            process.env.ENABLE_CSRF_PROTECTION = 'false';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
        });

        test('should fail validation for invalid boolean values', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.ENABLE_AUDIT_LOGGING = 'maybe';
            process.env.ENABLE_CSRF_PROTECTION = 'yes';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('ENABLE_AUDIT_LOGGING must be true or false');
            expect(result.errors).toContain('ENABLE_CSRF_PROTECTION must be true or false');
        });
    });

    describe('Enum Validation', () => {
        test('should validate enum environment variables', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.NODE_ENV = 'production';
            process.env.OPENAI_MODEL = 'gpt-3.5-turbo';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
        });

        test('should fail validation for invalid enum values', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'test-session-secret';
            process.env.NODE_ENV = 'invalid-env';
            process.env.OPENAI_MODEL = 'invalid-model';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('NODE_ENV must be one of: development, production, test');
            expect(result.errors).toContain('OPENAI_MODEL must be one of: gpt-3.5-turbo, gpt-4');
        });
    });

    describe('Security Validation', () => {
        test('should validate session secret strength', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'a-very-long-and-secure-session-secret-that-is-definitely-long-enough';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
        });

        test('should fail validation for weak session secret', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'weak';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('SESSION_SECRET must be at least 32 characters long');
        });

        test('should warn about development settings in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback'; // localhost in production
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'a-very-long-and-secure-session-secret-that-is-definitely-long-enough';

            const result = envValidator.validate();

            expect(result.warnings).toContain('Using localhost redirect URI in production environment');
        });
    });

    describe('validateOrExit Method', () => {
        test('should exit process when validation fails', () => {
            // Clear required environment variables
            delete process.env.GOOGLE_CLIENT_ID;
            delete process.env.OPENAI_API_KEY;

            envValidator.validateOrExit();

            expect(mockExit).toHaveBeenCalledWith(1);
        });

        test('should not exit when validation passes', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'a-very-long-and-secure-session-secret-that-is-definitely-long-enough';

            envValidator.validateOrExit();

            expect(mockExit).not.toHaveBeenCalled();
        });
    });

    describe('Default Values', () => {
        test('should provide default values for optional variables', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'a-very-long-and-secure-session-secret-that-is-definitely-long-enough';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
            expect(result.config.PORT).toBe(3000); // Default port
            expect(result.config.AI_DAILY_LIMIT).toBe(100); // Default AI limit
            expect(result.config.OPENAI_MODEL).toBe('gpt-3.5-turbo'); // Default model
        });

        test('should use provided values over defaults', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'a-very-long-and-secure-session-secret-that-is-definitely-long-enough';
            process.env.PORT = '8080';
            process.env.AI_DAILY_LIMIT = '200';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
            expect(result.config.PORT).toBe(8080);
            expect(result.config.AI_DAILY_LIMIT).toBe(200);
        });
    });

    describe('Error Reporting', () => {
        test('should provide detailed error messages', () => {
            delete process.env.GOOGLE_CLIENT_ID;
            process.env.PORT = 'invalid';
            process.env.GOOGLE_REDIRECT_URI = 'not-a-url';

            const result = envValidator.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(error => error.includes('GOOGLE_CLIENT_ID'))).toBe(true);
            expect(result.errors.some(error => error.includes('PORT'))).toBe(true);
            expect(result.errors.some(error => error.includes('GOOGLE_REDIRECT_URI'))).toBe(true);
        });

        test('should provide warnings for non-critical issues', () => {
            process.env.NODE_ENV = 'production';
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/gmail/callback';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.SESSION_SECRET = 'a-very-long-and-secure-session-secret-that-is-definitely-long-enough';

            const result = envValidator.validate();

            expect(result.isValid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });
});
