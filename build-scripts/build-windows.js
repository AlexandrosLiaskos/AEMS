#!/usr/bin/env node

/**
 * Windows Build Script for AEMS Desktop
 * Creates Windows installer with proper configuration
 */

const { build } = require('electron-builder');
const path = require('path');

async function buildWindows() {
    console.log('🏗️  Building AEMS for Windows...');
    
    try {
        const result = await build({
            targets: {
                win: ['nsis:x64']
            },
            config: {
                appId: 'com.aems.desktop',
                productName: 'AEMS - Agentic Email Management System',
                directories: {
                    output: 'dist'
                },
                win: {
                    target: [
                        {
                            target: 'nsis',
                            arch: ['x64']
                        }
                    ],
                    icon: 'assets/icon.ico',
                    verifyUpdateCodeSignature: false
                },
                nsis: {
                    oneClick: false,
                    perMachine: false,
                    allowToChangeInstallationDirectory: true,
                    deleteAppDataOnUninstall: false,
                    createDesktopShortcut: true,
                    createStartMenuShortcut: true,
                    shortcutName: 'AEMS',
                    installerIcon: 'assets/icon.ico',
                    uninstallerIcon: 'assets/icon.ico',
                    installerHeaderIcon: 'assets/icon.ico',
                    displayLanguageSelector: true,
                    installerLanguages: ['en_US'],
                    language: 'en_US'
                },
                publish: null // Don't publish during build
            }
        });
        
        console.log('✅ Windows build completed successfully!');
        console.log('📦 Installer created in dist/ directory');
        
    } catch (error) {
        console.error('❌ Windows build failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    buildWindows();
}

module.exports = { buildWindows };
