#!/usr/bin/env node

/**
 * AEMS Desktop Application
 * Desktop executable that starts the server and opens browser
 * Handles proper window management and user interaction
 */

const { exec } = require('child_process');

// Set desktop mode
process.env.AEMS_MODE = 'desktop';

// Set console title for Windows
if (process.platform === 'win32') {
    process.title = 'AEMS - Agentic Email Management System';
}

// Initialize settings using desktop settings manager
function initializeSettings() {
    const DesktopSettings = require('./lib/desktop-settings');
    const settingsManager = new DesktopSettings();

    console.log('📁 Data directory:', settingsManager.getDataDirectory());
    console.log('⚙️ Settings file:', settingsManager.getEnvFilePath());

    const config = settingsManager.isConfigured();

    return {
        settingsManager,
        isConfigured: config.isMinimallyConfigured,
        needsSetup: !config.isMinimallyConfigured
    };
}

// Open browser with better error handling and retry logic
function openBrowser(url) {
    const platform = process.platform;

    console.log(`🌐 Opening browser to: ${url}`);

    let command;
    if (platform === 'win32') {
        // Use cmd /c start to ensure proper window handling
        command = `cmd /c start "" "${url}"`;
    } else if (platform === 'darwin') {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
        if (error) {
            console.log(`⚠️  Could not automatically open browser: ${error.message}`);
            console.log(`📱 Please manually open your browser to: ${url}`);
            console.log('');

            // Try alternative method for Windows
            if (platform === 'win32') {
                console.log('💡 Alternative: Copy and paste the URL above into your browser');
            }
        } else {
            console.log('✅ Browser opened successfully');
        }
    });
}

// Wait for server to be ready
function waitForServer(port, callback) {
    const http = require('http');

    const checkServer = () => {
        const req = http.get(`http://localhost:${port}`, () => {
            callback();
        });

        req.on('error', () => {
            setTimeout(checkServer, 100);
        });
    };

    checkServer();
}

// Clear console and show header
function showHeader() {
    // Clear console
    console.clear();

    // Show header
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    AEMS Desktop Application                  ║');
    console.log('║              Agentic Email Management System                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
}

// Show status with proper formatting
function showStatus(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Main function
async function main() {
    showHeader();
    showStatus('Starting AEMS Desktop Application...');

    try {
        // Initialize settings
        const { settingsManager, needsSetup } = initializeSettings();

        // Start the server
        showStatus('Starting server...');
        require('./server.js');

        // Wait for server to start
        const port = process.env.PORT || 3000;

        waitForServer(port, () => {
            showStatus(`Server running on http://localhost:${port}`, 'success');

            // Open browser - go to settings if setup needed
            const url = needsSetup
                ? `http://localhost:${port}/?setup=true`
                : `http://localhost:${port}`;

            setTimeout(() => {
                openBrowser(url);

                console.log('');
                if (needsSetup) {
                    console.log('🔧 FIRST TIME SETUP REQUIRED');
                    console.log('Please configure your Google OAuth credentials in the browser to get started.');
                } else {
                    console.log('✅ AEMS is ready to use!');
                    console.log('You can now manage your emails through the web interface.');
                }

                console.log('');
                console.log('📋 Application Information:');
                console.log(`   • Server URL: http://localhost:${port}`);
                console.log(`   • Data Directory: ${settingsManager.getDataDirectory()}`);
                console.log(`   • Settings File: ${settingsManager.getEnvFilePath()}`);
                console.log('');
                console.log('💡 Important:');
                console.log('   • Keep this window open while using AEMS');
                console.log('   • Close this window or press Ctrl+C to stop the application');
                console.log('   • If the browser doesn\'t open, copy the Server URL above');
                console.log('');
                console.log('🔄 Application is running... Press Ctrl+C to stop');

            }, 1500);
        });

    } catch (error) {
        showStatus(`Failed to start AEMS: ${error.message}`, 'error');
        console.log('');
        console.log('Press any key to exit...');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', () => process.exit(1));
    }
}

// Handle shutdown gracefully
function handleShutdown() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                     Shutting down AEMS...                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    showStatus('Received shutdown signal, stopping server...', 'warning');

    // Give a moment for cleanup
    setTimeout(() => {
        showStatus('AEMS stopped successfully', 'success');
        console.log('');
        console.log('Thank you for using AEMS! 👋');
        process.exit(0);
    }, 1000);
}

// Handle different shutdown signals
process.on('SIGINT', () => handleShutdown());
process.on('SIGTERM', () => handleShutdown());

// Handle Windows-specific signals
if (process.platform === 'win32') {
    // Handle Ctrl+C on Windows
    process.on('SIGBREAK', () => handleShutdown());

    // Handle window close
    process.on('SIGHUP', () => handleShutdown());
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.log('');
    showStatus(`Unexpected error: ${error.message}`, 'error');
    console.log('');
    console.log('Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.log('');
    showStatus(`Unhandled promise rejection: ${reason}`, 'error');
    console.log('The application will continue running, but this should be investigated.');
});

// Start the application
if (require.main === module) {
    main();
}

module.exports = { main };
