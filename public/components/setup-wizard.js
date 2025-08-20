/**
 * Setup Wizard Component
 * Beautiful onboarding flow for AEMS
 */

class SetupWizard {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                id: 'openai',
                title: 'OpenAI API Key',
                description: '',
                icon: 'fas fa-robot',
                required: false
            },
            {
                id: 'google',
                title: 'Google OAuth',
                description: '',
                icon: 'fab fa-google',
                required: true
            }
        ];
        this.dialog = null;
        this.data = {};
    }

    async start() {
        this.dialog = new Dialog();
        this.showStep(0);
        return new Promise((resolve) => {
            this.onComplete = resolve;
        });
    }

    showStep(stepIndex) {
        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];

        if (!step) {
            this.complete();
            return;
        }

        const content = this.renderStep(step);

        if (this.dialog.isOpen) {
            this.dialog.updateContent(content);
        } else {
            this.dialog.create({
                title: '',
                content: content,
                className: 'setup-wizard',
                showClose: false
            }).open();
        }

        this.bindStepEvents(step);
    }

    renderStep(step) {
        let formHTML = '';
        if (step.id === 'openai') {
            formHTML = this.renderOpenAIForm();
        } else if (step.id === 'google') {
            formHTML = this.renderGoogleForm();
        }

        return `
            <div class="setup-step">
                <h3 class="setup-step-title">${step.title}</h3>
                ${formHTML}
            </div>
        `;
    }



    renderOpenAIForm() {
        return `
            <form class="setup-form" id="openai-form">
                <div class="setup-form-group">
                    <label for="openai-key" class="setup-form-label">API Key</label>
                    <input
                        type="password"
                        id="openai-key"
                        class="setup-form-input"
                        placeholder="sk-..."
                        value="${this.data.openaiKey || ''}"
                    >
                    <div class="setup-form-help">
                        Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Platform</a>
                    </div>
                </div>
                <div class="setup-actions">
                    <button type="button" class="setup-btn setup-btn-secondary" id="skip-openai">
                        Skip for now
                    </button>
                    <button type="submit" class="setup-btn setup-btn-primary" id="test-openai">
                        Continue
                    </button>
                </div>
            </form>
        `;
    }

    renderGoogleForm() {
        return `
            <form class="setup-form" id="google-form">
                <div class="setup-form-group">
                    <label for="google-client-id" class="setup-form-label">Client ID</label>
                    <input
                        type="text"
                        id="google-client-id"
                        class="setup-form-input"
                        placeholder="123456789-abc.apps.googleusercontent.com"
                        value="${this.data.googleClientId || ''}"
                        required
                    >
                </div>
                <div class="setup-form-group">
                    <label for="google-client-secret" class="setup-form-label">Client Secret</label>
                    <input
                        type="password"
                        id="google-client-secret"
                        class="setup-form-input"
                        placeholder="GOCSPX-..."
                        value="${this.data.googleClientSecret || ''}"
                        required
                    >
                    <div class="setup-form-help">
                        Get your credentials from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>
                    </div>
                </div>
                <div class="setup-actions">
                    <button type="button" class="setup-btn setup-btn-secondary" id="back-step">
                        Back
                    </button>
                    <button type="submit" class="setup-btn setup-btn-primary" id="test-google">
                        Continue
                    </button>
                </div>
            </form>
        `;
    }

    bindStepEvents(step) {
        if (step.id === 'openai') {
            this.bindOpenAIEvents();
        } else if (step.id === 'google') {
            this.bindGoogleEvents();
        }
    }

    bindOpenAIEvents() {
        const form = document.getElementById('openai-form');
        const skipBtn = document.getElementById('skip-openai');
        const testBtn = document.getElementById('test-openai');

        skipBtn.addEventListener('click', () => {
            this.nextStep();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('openai-key').value.trim();

            if (apiKey) {
                this.data.openaiKey = apiKey;
            }

            this.nextStep();
        });
    }

    bindGoogleEvents() {
        const form = document.getElementById('google-form');
        const backBtn = document.getElementById('back-step');
        const testBtn = document.getElementById('test-google');

        backBtn.addEventListener('click', () => {
            this.previousStep();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientId = document.getElementById('google-client-id').value.trim();
            const clientSecret = document.getElementById('google-client-secret').value.trim();

            if (!clientId || !clientSecret) {
                return;
            }

            this.data.googleClientId = clientId;
            this.data.googleClientSecret = clientSecret;
            this.complete();
        });
    }



    nextStep() {
        this.showStep(this.currentStep + 1);
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    async complete() {
        // Save settings
        if (Object.keys(this.data).length > 0) {
            await this.saveSettings();
        }

        this.dialog.close();

        // Redirect to Gmail connection
        if (this.onComplete) {
            this.onComplete(this.data);
        }
    }

    async saveSettings() {
        const settings = {};

        if (this.data.openaiKey) {
            settings.OPENAI_API_KEY = this.data.openaiKey;
        }

        if (this.data.googleClientId && this.data.googleClientSecret) {
            settings.GOOGLE_CLIENT_ID = this.data.googleClientId;
            settings.GOOGLE_CLIENT_SECRET = this.data.googleClientSecret;
        }

        try {
            await fetch('/api/desktop/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
}

// Export for use
window.SetupWizard = SetupWizard;
