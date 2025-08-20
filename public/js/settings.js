/**
 * Desktop Settings Management
 * Handles configuration of API credentials and application preferences
 */

(function () {
    'use strict';

    // Private state
    let currentSettings = {};
    let isInitialized = false;

    // Constants
    const ENDPOINTS = {
        SETTINGS: '/api/desktop/settings',
        TEST_CONNECTION: '/api/desktop/test-connection'
    };

    const ELEMENTS = {
        CONFIG_STATUS: 'configStatus',
        GOOGLE_CLIENT_ID: 'googleClientId',
        GOOGLE_CLIENT_SECRET: 'googleClientSecret',
        OPENAI_API_KEY: 'openaiApiKey',
        GOOGLE_STATUS: 'googleStatus',
        OPENAI_STATUS: 'openaiStatus'
    };

    /**
     * Initialize settings module
     */
    function initializeSettings() {
        if (isInitialized) return;

        try {
            loadSettings();
            checkForSetupMode();
            isInitialized = true;

            // Notify that settings script is loaded
            document.dispatchEvent(new Event('settingsScriptLoaded'));
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            showAlert('error', 'Failed to initialize settings');
        }
    }

    /**
     * Check if this is first-time setup and show appropriate message
     */
    function checkForSetupMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('setup') === 'true') {
            // Setup message will be shown via configuration status instead
            console.log('First-time setup mode detected');
        }
    }

    /**
     * Load settings from server and populate form
     */
    async function loadSettings() {
        try {
            const response = await fetch(ENDPOINTS.SETTINGS);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            currentSettings = data.settings || {};

            populateForm(data.settings || {});
            updateStatusBadges(data);

        } catch (error) {
            console.error('Failed to load settings:', error);
            showAlert('error', `Failed to load settings: ${error.message}`);
        }
    }

    /**
     * Populate form fields with settings data
     */
    function populateForm(settings) {
        const formFields = [
            { id: ELEMENTS.GOOGLE_CLIENT_ID, key: 'GOOGLE_CLIENT_ID', defaultValue: '' },
            { id: ELEMENTS.GOOGLE_CLIENT_SECRET, key: 'GOOGLE_CLIENT_SECRET', defaultValue: '' },
            { id: ELEMENTS.OPENAI_API_KEY, key: 'OPENAI_API_KEY', defaultValue: '' }
        ];

        formFields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element) {
                element.value = settings[field.key] || field.defaultValue;
            }
        });
    }

    /**
     * Update status badges based on configuration data
     */
    function updateStatusBadges(data) {
        updateServiceStatus(ELEMENTS.GOOGLE_STATUS, data.hasGoogle, 'Not configured');
        updateServiceStatus(ELEMENTS.OPENAI_STATUS, data.hasOpenAI, 'Not configured');
    }

    /**
     * Update main configuration status indicator
     */
    function updateMainStatus() {
        // Configuration status UI removed
        return;
    }

    /**
     * Update individual service status badge
     */
    function updateServiceStatus(elementId, isConfigured, fallbackText) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (isConfigured) {
            element.className = 'service-status configured';
            element.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Configured';
        } else {
            element.className = 'service-status missing';
            element.innerHTML = `<i class="fas fa-times" aria-hidden="true"></i> ${fallbackText}`;
        }
    }

    /**
     * Toggle password visibility for input fields
     */
    function togglePassword(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const button = input.nextElementSibling;
        const icon = button?.querySelector('i');
        if (!button || !icon) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';

        // Update aria-label for accessibility
        button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    }

    // Removed: Test connection functionality from settings page

    /**
     * Build request data for connection testing
     */
    /* Removed: connection testing helpers
    function buildTestRequestData(service) {
        const requestData = { service };

        if (service === 'openai') {
            const apiKey = document.getElementById(ELEMENTS.OPENAI_API_KEY)?.value;
            if (!apiKey) {
                showTestResult(`${service}TestResult`, false, 'Please enter an API key');
                return null;
            }
            requestData.apiKey = apiKey;
        } else if (service === 'google') {
            const clientId = document.getElementById(ELEMENTS.GOOGLE_CLIENT_ID)?.value;
            const clientSecret = document.getElementById(ELEMENTS.GOOGLE_CLIENT_SECRET)?.value;
            if (!clientId || !clientSecret) {
                showTestResult(`${service}TestResult`, false, 'Please enter both Client ID and Client Secret');
                return null;
            }
            requestData.clientId = clientId;
            requestData.clientSecret = clientSecret;
        }

        return requestData;
    }

    /**
     * Display test result with appropriate styling
     */
    /* Removed: connection testing helpers
    function showTestResult(elementId, success, message) {
        const resultEl = document.getElementById(elementId);
        if (!resultEl) return;

        resultEl.style.display = 'flex';
        resultEl.className = `test-result ${success ? 'success' : 'error'}`;
        resultEl.innerHTML = `<i class="fas fa-${success ? 'check-circle' : 'times-circle'}" aria-hidden="true"></i> <span>${message}</span>`;
    }

    /**
     * Save settings to server
     */
    async function saveSettings() {
        try {
            const settings = collectFormData();

            const response = await fetch(ENDPOINTS.SETTINGS, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                showAlert('success', 'Settings saved successfully!');
                updateStatusBadges(result);
                handlePostSaveActions(result);
            } else {
                showAlert('error', result.error || 'Failed to save settings');
            }

        } catch (error) {
            console.error('Failed to save settings:', error);
            showAlert('error', `Failed to save settings: ${error.message}`);
        }
    }

    /**
     * Collect form data into settings object
     */
    function collectFormData() {
        return {
            GOOGLE_CLIENT_ID: document.getElementById(ELEMENTS.GOOGLE_CLIENT_ID)?.value || '',
            GOOGLE_CLIENT_SECRET: document.getElementById(ELEMENTS.GOOGLE_CLIENT_SECRET)?.value || '',
            OPENAI_API_KEY: document.getElementById(ELEMENTS.OPENAI_API_KEY)?.value || ''
        };
    }

    /**
     * Handle actions after successful save
     */
    function handlePostSaveActions(result) {
        // If this was first-time setup and now configured, offer to go to dashboard
        if (result.isMinimallyConfigured && window.app) {
            setTimeout(() => {
                if (confirm('Settings saved! Would you like to go to the dashboard now?')) {
                    window.app.showDashboard();
                }
            }, 1000);
        }
    }

    function goToApp() {
        if (window.app && window.app.showDashboard) {
            window.app.showDashboard();
        } else {
            window.location.href = '/';
        }
    }

    /**
     * Show alert message with consistent styling
     */
    function showAlert(type, message) {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.settings-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `settings-alert alert alert-${type}`;
        alert.setAttribute('role', 'alert');
        alert.setAttribute('aria-live', 'assertive');

        const iconClass = type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle';

        alert.innerHTML = `
            <div class="alert-content">
                <i class="fas fa-${iconClass}" aria-hidden="true"></i>
                <span class="alert-message">${message}</span>
                <button type="button" class="alert-close" onclick="this.parentElement.parentElement.remove()" aria-label="Close alert">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
        `;

        document.body.appendChild(alert);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }



    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSettings);
    } else {
        initializeSettings();
    }

    // Export functions to global scope for HTML onclick handlers
    window.loadSettings = loadSettings;
    window.saveSettings = saveSettings;
    // window.testConnection removed; no longer exposed
    window.togglePassword = togglePassword;
    window.initializeSettings = initializeSettings;

})();
