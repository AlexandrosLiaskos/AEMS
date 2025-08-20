/**
 * Desktop Settings Manager
 * Manages .env file in AppData for desktop app
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class DesktopSettings {
    constructor() {
        this.appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'AEMS');
        this.dataDir = path.join(this.appDataDir, 'aems-data');
        this.envFile = path.join(this.appDataDir, '.env');
        this.settingsFile = path.join(this.appDataDir, 'settings.json');

        this.ensureDirectories();
        this.loadSettings();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.appDataDir)) {
            fs.mkdirSync(this.appDataDir, { recursive: true });
        }
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    loadSettings() {
        // Load from .env file if exists
        if (fs.existsSync(this.envFile)) {
            const envContent = fs.readFileSync(this.envFile, 'utf8');
            const envLines = envContent.split('\n');

            for (const line of envLines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                        process.env[key.trim()] = value;
                    }
                }
            }
        }

        // Set defaults for desktop mode
        this.setDefaults();
    }

    setDefaults() {
        const defaults = {
            AEMS_MODE: 'desktop',
            NODE_ENV: 'production',
            PORT: '3000',
            AEMS_DATA_DIR: this.dataDir,
            SESSION_SECRET: process.env.SESSION_SECRET || this.generateSessionSecret(),
            SESSION_TIMEOUT: '3600000',
            SYNC_INTERVAL_MINUTES: '5',
            MAX_EMAILS_PER_SYNC: '50',
            OPENAI_MODEL: 'gpt-3.5-turbo',
            OPENAI_MAX_TOKENS: '1000',
            GOOGLE_REDIRECT_URL: 'http://localhost:3000/auth/google/callback'
        };

        for (const [key, value] of Object.entries(defaults)) {
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    }

    generateSessionSecret() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    getSetting(key) {
        return process.env[key] || '';
    }

    setSetting(key, value) {
        try {
            process.env[key] = value;
            this.saveToEnvFile();
            return true;
        } catch (error) {
            console.error('Failed to save setting:', error);
            return false;
        }
    }

    saveToEnvFile() {
        const envVars = [
            '# AEMS Desktop Application Settings',
            '# Generated automatically - you can edit this file',
            '',
            '# Application Settings',
            `AEMS_MODE=desktop`,
            `NODE_ENV=production`,
            `PORT=${process.env.PORT || '3000'}`,
            `AEMS_DATA_DIR=${this.dataDir}`,
            `SESSION_SECRET=${process.env.SESSION_SECRET}`,
            `SESSION_TIMEOUT=${process.env.SESSION_TIMEOUT || '3600000'}`,
            '',
            '# Email Sync Settings',
            `SYNC_INTERVAL_MINUTES=${process.env.SYNC_INTERVAL_MINUTES || '5'}`,
            `MAX_EMAILS_PER_SYNC=${process.env.MAX_EMAILS_PER_SYNC || '50'}`,
            '',
            '# OpenAI Settings (Optional)',
            `OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ''}`,
            `OPENAI_MODEL=${process.env.OPENAI_MODEL || 'gpt-3.5-turbo'}`,
            `OPENAI_MAX_TOKENS=${process.env.OPENAI_MAX_TOKENS || '1000'}`,
            '',
            '# Google OAuth Settings (Required for Gmail)',
            `GOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || ''}`,
            `GOOGLE_CLIENT_SECRET=${process.env.GOOGLE_CLIENT_SECRET || ''}`,
            `GOOGLE_REDIRECT_URL=${process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/auth/google/callback'}`,
            ''
        ];

        fs.writeFileSync(this.envFile, envVars.join('\n'));
    }

    getSettings() {
        return {
            OPENAI_API_KEY: this.maskValue(process.env.OPENAI_API_KEY),
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
            GOOGLE_CLIENT_SECRET: this.maskValue(process.env.GOOGLE_CLIENT_SECRET),
            SYNC_INTERVAL_MINUTES: process.env.SYNC_INTERVAL_MINUTES || '5',
            MAX_EMAILS_PER_SYNC: process.env.MAX_EMAILS_PER_SYNC || '50',
            OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS || '1000'
        };
    }

    updateSettings(settings) {
        try {
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined && value !== null) {
                    process.env[key] = String(value);
                }
            }
            this.saveToEnvFile();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    maskValue(value) {
        if (!value || value.length < 8) return value;
        return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
    }

    isConfigured() {
        const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        const hasOpenAI = !!process.env.OPENAI_API_KEY;

        return {
            hasGoogle,
            hasOpenAI,
            isFullyConfigured: hasGoogle && hasOpenAI,
            isMinimallyConfigured: hasGoogle // Can work with just Google OAuth
        };
    }

    getMissingSettings() {
        const missing = [];

        if (!process.env.GOOGLE_CLIENT_ID) {
            missing.push({ key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', required: true });
        }
        if (!process.env.GOOGLE_CLIENT_SECRET) {
            missing.push({ key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', required: true });
        }
        if (!process.env.OPENAI_API_KEY) {
            missing.push({ key: 'OPENAI_API_KEY', label: 'OpenAI API Key', required: false });
        }

        return missing;
    }

    validateSetting(key, value) {
        switch (key) {
            case 'OPENAI_API_KEY':
                return value.startsWith('sk-') && value.length > 20;
            case 'GOOGLE_CLIENT_ID':
                return value.includes('.apps.googleusercontent.com');
            case 'GOOGLE_CLIENT_SECRET':
                return value.startsWith('GOCSPX-') && value.length > 20;
            case 'SYNC_INTERVAL_MINUTES':
                const interval = parseInt(value);
                return interval >= 1 && interval <= 60;
            case 'MAX_EMAILS_PER_SYNC':
                const maxEmails = parseInt(value);
                return maxEmails >= 10 && maxEmails <= 500;
            default:
                return true;
        }
    }

    getSetupMessage() {
        const config = this.isConfigured();

        if (config.isFullyConfigured) {
            return 'All settings configured! You can use all features.';
        } else if (config.isMinimallyConfigured) {
            return 'Basic setup complete! Add OpenAI API key for AI features.';
        } else {
            return 'Setup required! Please configure your Google OAuth credentials to get started.';
        }
    }

    getEnvFilePath() {
        return this.envFile;
    }

    getDataDirectory() {
        return this.dataDir;
    }

    loadEnv() {
        // Reload environment variables from .env file
        if (fs.existsSync(this.envFile)) {
            const envContent = fs.readFileSync(this.envFile, 'utf8');
            const envLines = envContent.split('\n');

            for (const line of envLines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                        process.env[key.trim()] = value;
                    }
                }
            }
        }
    }
}

module.exports = DesktopSettings;
