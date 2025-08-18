#!/usr/bin/env node

/**
 * Multi-Platform Build Script for AEMS Desktop
 * Creates installers for Windows, macOS, and Linux
 */

const { build } = require('electron-builder');
const fs = require('fs').promises;
const path = require('path');

async function buildAll() {
    console.log('🏗️  Building AEMS for all platforms...');
    
    const buildConfig = {
        appId: 'com.aems.desktop',
        productName: 'AEMS - Agentic Email Management System',
        directories: {
            output: 'dist'
        },
        files: [
            'electron-main.js',
            'electron-preload.js',
            'server.js',
            'lib/**/*',
            'public/**/*',
            'node_modules/**/*',
            '!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
            '!node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
            '!node_modules/*.d.ts',
            '!node_modules/.bin',
            '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
            '!.editorconfig',
            '!**/._*',
            '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
            '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
            '!**/{appveyor.yml,.travis.yml,circle.yml}',
            '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}',
            '!tests/**/*',
            '!coverage/**/*',
            '!dummy_data/**/*',
            '!build-scripts/**/*',
            '!*.md',
            '!.env*'
        ],
        extraResources: [
            {
                from: 'assets',
                to: 'assets',
                filter: ['**/*']
            }
        ],
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
            installerHeaderIcon: 'assets/icon.ico'
        },
        mac: {
            target: 'dmg',
            icon: 'assets/icon.icns',
            category: 'public.app-category.productivity'
        },
        linux: {
            target: [
                {
                    target: 'AppImage',
                    arch: ['x64']
                },
                {
                    target: 'deb',
                    arch: ['x64']
                }
            ],
            icon: 'assets/icon.png',
            category: 'Office'
        },
        publish: null // Don't publish during build
    };
    
    try {
        // Build for current platform first
        console.log('📦 Building for current platform...');
        await build({
            config: buildConfig
        });
        
        console.log('✅ Build completed successfully!');
        
        // List created files
        const distDir = path.join(process.cwd(), 'dist');
        const files = await fs.readdir(distDir);
        
        console.log('\n📁 Created files:');
        for (const file of files) {
            if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage') || file.endsWith('.deb')) {
                const stats = await fs.stat(path.join(distDir, file));
                const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`   ${file} (${sizeMB} MB)`);
            }
        }
        
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    buildAll();
}

module.exports = { buildAll };
