/**
 * Dialog Component - shadcn/ui inspired
 * Vanilla JS implementation for modal dialogs
 */

class Dialog {
    constructor() {
        this.isOpen = false;
        this.overlay = null;
        this.dialog = null;
        this.onClose = null;
    }

    create(options = {}) {
        const {
            title = '',
            description = '',
            content = '',
            showClose = true,
            className = '',
            onClose = null
        } = options;

        this.onClose = onClose;

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'dialog-overlay';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Create dialog
        this.dialog = document.createElement('div');
        this.dialog.className = `dialog-content ${className}`;
        this.dialog.setAttribute('role', 'dialog');
        this.dialog.setAttribute('aria-modal', 'true');
        if (title) {
            this.dialog.setAttribute('aria-labelledby', 'dialog-title');
        }

        let dialogHTML = '';

        if (title || showClose) {
            dialogHTML += `
                <div class="dialog-header">
                    ${title ? `<h2 id="dialog-title" class="dialog-title">${title}</h2>` : ''}
                    ${showClose ? `
                        <button type="button" class="dialog-close" aria-label="Close dialog">
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        if (description) {
            dialogHTML += `<div class="dialog-description">${description}</div>`;
        }

        dialogHTML += `<div class="dialog-body">${content}</div>`;

        this.dialog.innerHTML = dialogHTML;

        // Add close button event
        if (showClose) {
            const closeBtn = this.dialog.querySelector('.dialog-close');
            closeBtn.addEventListener('click', () => this.close());
        }

        this.overlay.appendChild(this.dialog);
        document.body.appendChild(this.overlay);

        // Handle escape key
        this.handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.handleEscape);

        return this;
    }

    open() {
        if (this.overlay) {
            this.isOpen = true;
            this.overlay.classList.add('dialog-open');
            document.body.classList.add('dialog-body-open');
            
            // Focus management
            const firstFocusable = this.dialog.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                setTimeout(() => firstFocusable.focus(), 100);
            }
        }
        return this;
    }

    close() {
        if (this.overlay && this.isOpen) {
            this.isOpen = false;
            this.overlay.classList.remove('dialog-open');
            document.body.classList.remove('dialog-body-open');
            
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                document.removeEventListener('keydown', this.handleEscape);
                
                if (this.onClose) {
                    this.onClose();
                }
            }, 200);
        }
        return this;
    }

    updateContent(content) {
        if (this.dialog) {
            const body = this.dialog.querySelector('.dialog-body');
            if (body) {
                body.innerHTML = content;
            }
        }
        return this;
    }

    updateTitle(title) {
        if (this.dialog) {
            const titleEl = this.dialog.querySelector('.dialog-title');
            if (titleEl) {
                titleEl.textContent = title;
            }
        }
        return this;
    }
}

// Export for use
window.Dialog = Dialog;
