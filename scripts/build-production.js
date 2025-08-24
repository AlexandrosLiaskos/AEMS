#!/usr/bin/env node

/**
 * Production Build Script for AEMS
 * 
 * This script handles the complete production build process:
 * 1. Clean previous builds
 * 2. Build backend and frontend
 * 3. Create PKG executables for all platforms
 * 4. Package with necessary assets
 * 5. Create distribution packages
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const CONFIG = {
  distDir: 'dist',
  executablesDir: 'dist/executables',
  packagesDir: 'dist/packages',
  platforms: [
    { target: 'node18-win-x64', name: 'windows-x64', ext: '.exe' },
    { target: 'node18-macos-x64', name: 'macos-x64', ext: '' },
    { target: 'node18-macos-arm64', name: 'macos-arm64', ext: '' },
    { target: 'node18-linux-x64', name: 'linux-x64', ext: '' },
    { target: 'node18-linux-arm64', name: 'linux-arm64', ext: '' },
  ],
  requiredAssets: [
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ],
};

/**
 * @function log
 * @purpose Enhanced logging with timestamps
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    build: '🔨',
    package: '📦',
  }[level] || 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

/**
 * @function execCommand
 * @purpose Execute shell command with error handling
 */
function execCommand(command, description) {
  log(`${description}...`, 'build');
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    log(`${description} completed`, 'success');
  } catch (error) {
    log(`${description} failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

/**
 * @function ensureDirectory
 * @purpose Ensure directory exists
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * @function cleanBuildDirectories
 * @purpose Clean previous build artifacts
 */
async function cleanBuildDirectories() {
  log('Cleaning previous build artifacts...', 'build');
  
  const dirsToClean = [CONFIG.distDir];
  
  for (const dir of dirsToClean) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      log(`Cleaned ${dir}`, 'success');
    } catch (error) {
      log(`Warning: Could not clean ${dir}: ${error.message}`, 'warning');
    }
  }
}

/**
 * @function buildApplications
 * @purpose Build backend and frontend applications
 */
async function buildApplications() {
  log('Building applications...', 'build');
  
  // Build backend
  execCommand('npm run build:backend', 'Building backend');
  
  // Build frontend
  execCommand('npm run build:frontend', 'Building frontend');
  
  // Verify builds
  const backendMain = path.join(CONFIG.distDir, 'apps/backend/main.js');
  const frontendIndex = path.join(CONFIG.distDir, 'apps/frontend/index.html');
  
  try {
    await fs.access(backendMain);
    await fs.access(frontendIndex);
    log('Application builds verified', 'success');
  } catch (error) {
    log('Build verification failed', 'error');
    throw error;
  }
}

/**
 * @function createExecutables
 * @purpose Create PKG executables for all platforms
 */
async function createExecutables() {
  log('Creating PKG executables...', 'build');
  
  await ensureDirectory(CONFIG.executablesDir);
  
  // Install pkg if not available
  try {
    execSync('pkg --version', { stdio: 'ignore' });
  } catch (error) {
    log('Installing pkg...', 'build');
    execCommand('npm install -g pkg', 'Installing pkg globally');
  }
  
  // Create executables for each platform
  for (const platform of CONFIG.platforms) {
    log(`Creating executable for ${platform.name}...`, 'package');
    
    const outputName = `aems-${platform.name}${platform.ext}`;
    const outputPath = path.join(CONFIG.executablesDir, outputName);
    
    const pkgCommand = `pkg dist/apps/backend/main.js --targets ${platform.target} --output "${outputPath}" --compress GZip`;
    
    try {
      execSync(pkgCommand, { stdio: 'inherit' });
      log(`Created ${outputName}`, 'success');
    } catch (error) {
      log(`Failed to create ${outputName}: ${error.message}`, 'error');
      // Continue with other platforms
    }
  }
}

/**
 * @function createPackages
 * @purpose Create distribution packages with all necessary files
 */
async function createPackages() {
  log('Creating distribution packages...', 'package');
  
  await ensureDirectory(CONFIG.packagesDir);
  
  for (const platform of CONFIG.platforms) {
    const executableName = `aems-${platform.name}${platform.ext}`;
    const executablePath = path.join(CONFIG.executablesDir, executableName);
    
    // Check if executable exists
    try {
      await fs.access(executablePath);
    } catch (error) {
      log(`Skipping package for ${platform.name} - executable not found`, 'warning');
      continue;
    }
    
    const packageDir = path.join(CONFIG.packagesDir, `aems-${platform.name}`);
    await ensureDirectory(packageDir);
    
    // Copy executable
    await fs.copyFile(executablePath, path.join(packageDir, executableName));
    
    // Copy frontend assets
    const frontendSrc = path.join(CONFIG.distDir, 'apps/frontend');
    const frontendDest = path.join(packageDir, 'public');
    await copyDirectory(frontendSrc, frontendDest);
    
    // Copy required assets
    for (const asset of CONFIG.requiredAssets) {
      try {
        await fs.copyFile(asset, path.join(packageDir, asset));
      } catch (error) {
        log(`Warning: Could not copy ${asset}: ${error.message}`, 'warning');
      }
    }
    
    // Create startup scripts
    await createStartupScripts(packageDir, executableName, platform);
    
    // Create package info
    await createPackageInfo(packageDir, platform);
    
    log(`Package created for ${platform.name}`, 'success');
  }
}

/**
 * @function copyDirectory
 * @purpose Recursively copy directory
 */
async function copyDirectory(src, dest) {
  await ensureDirectory(dest);
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * @function createStartupScripts
 * @purpose Create platform-specific startup scripts
 */
async function createStartupScripts(packageDir, executableName, platform) {
  if (platform.name.startsWith('windows')) {
    // Windows batch file
    const batchContent = `@echo off
echo Starting AEMS...
echo.
echo AEMS will be available at: http://localhost:3001
echo Frontend will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the application
echo.
"${executableName}"
pause`;
    
    await fs.writeFile(path.join(packageDir, 'start-aems.bat'), batchContent);
  } else {
    // Unix shell script
    const shellContent = `#!/bin/bash

echo "Starting AEMS..."
echo ""
echo "AEMS will be available at: http://localhost:3001"
echo "Frontend will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the application"
echo ""

./${executableName}`;
    
    const scriptPath = path.join(packageDir, 'start-aems.sh');
    await fs.writeFile(scriptPath, shellContent);
    
    // Make executable
    try {
      await fs.chmod(scriptPath, 0o755);
    } catch (error) {
      log(`Warning: Could not make script executable: ${error.message}`, 'warning');
    }
  }
}

/**
 * @function createPackageInfo
 * @purpose Create package information file
 */
async function createPackageInfo(packageDir, platform) {
  const packageInfo = {
    name: 'AEMS - Automated Email Management System',
    version: '2.0.0',
    platform: platform.name,
    buildDate: new Date().toISOString(),
    description: 'AI-powered email management and data extraction system',
    requirements: {
      os: platform.name.split('-')[0],
      architecture: platform.name.split('-')[1],
      memory: '512MB minimum, 1GB recommended',
      disk: '100MB for application, additional space for data',
    },
    quickStart: [
      '1. Run the startup script (start-aems.bat on Windows, start-aems.sh on Unix)',
      '2. Open your web browser to http://localhost:3000',
      '3. Follow the setup wizard to configure your API keys',
      '4. Start managing your emails with AI!',
    ],
    support: {
      documentation: 'https://github.com/your-org/aems/wiki',
      issues: 'https://github.com/your-org/aems/issues',
      email: 'support@your-domain.com',
    },
  };
  
  await fs.writeFile(
    path.join(packageDir, 'package-info.json'),
    JSON.stringify(packageInfo, null, 2)
  );
  
  // Also create a human-readable README
  const readmeContent = `# AEMS - Automated Email Management System

Version: ${packageInfo.version}
Platform: ${packageInfo.platform}
Build Date: ${packageInfo.buildDate}

## Quick Start

${packageInfo.quickStart.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## System Requirements

- OS: ${packageInfo.requirements.os}
- Architecture: ${packageInfo.requirements.architecture}
- Memory: ${packageInfo.requirements.memory}
- Disk Space: ${packageInfo.requirements.disk}

## What You'll Need

Before starting AEMS, make sure you have:

1. **OpenAI API Key**: Get one from https://platform.openai.com/api-keys
2. **Google OAuth Credentials**: Set up at https://console.cloud.google.com/apis/credentials

## Support

- Documentation: ${packageInfo.support.documentation}
- Report Issues: ${packageInfo.support.issues}
- Email Support: ${packageInfo.support.email}

## Data Storage

AEMS stores all data locally on your machine:
- Windows: %APPDATA%\\AEMS
- macOS: ~/Library/Application Support/AEMS  
- Linux: ~/.local/share/AEMS

Your data never leaves your machine unless you explicitly configure external services.
`;
  
  await fs.writeFile(path.join(packageDir, 'README.txt'), readmeContent);
}

/**
 * @function createArchives
 * @purpose Create compressed archives for distribution
 */
async function createArchives() {
  log('Creating distribution archives...', 'package');
  
  const archivesDir = path.join(CONFIG.packagesDir, 'archives');
  await ensureDirectory(archivesDir);
  
  for (const platform of CONFIG.platforms) {
    const packageDir = path.join(CONFIG.packagesDir, `aems-${platform.name}`);
    
    try {
      await fs.access(packageDir);
    } catch (error) {
      continue; // Skip if package doesn't exist
    }
    
    const archiveName = `aems-v2.0.0-${platform.name}`;
    const isWindows = platform.name.startsWith('windows');
    
    if (isWindows) {
      // Create ZIP for Windows
      const zipCommand = `cd "${CONFIG.packagesDir}" && zip -r "archives/${archiveName}.zip" "aems-${platform.name}"`;
      try {
        execSync(zipCommand, { stdio: 'inherit' });
        log(`Created ${archiveName}.zip`, 'success');
      } catch (error) {
        log(`Warning: Could not create ZIP archive: ${error.message}`, 'warning');
      }
    } else {
      // Create tar.gz for Unix systems
      const tarCommand = `cd "${CONFIG.packagesDir}" && tar -czf "archives/${archiveName}.tar.gz" "aems-${platform.name}"`;
      try {
        execSync(tarCommand, { stdio: 'inherit' });
        log(`Created ${archiveName}.tar.gz`, 'success');
      } catch (error) {
        log(`Warning: Could not create tar.gz archive: ${error.message}`, 'warning');
      }
    }
  }
}

/**
 * @function generateBuildReport
 * @purpose Generate build report
 */
async function generateBuildReport() {
  log('Generating build report...', 'build');
  
  const report = {
    buildDate: new Date().toISOString(),
    version: '2.0.0',
    platform: os.platform(),
    nodeVersion: process.version,
    executables: [],
    packages: [],
    totalSize: 0,
  };
  
  // Check executables
  try {
    const executables = await fs.readdir(CONFIG.executablesDir);
    for (const executable of executables) {
      const execPath = path.join(CONFIG.executablesDir, executable);
      const stats = await fs.stat(execPath);
      report.executables.push({
        name: executable,
        size: stats.size,
        sizeHuman: formatBytes(stats.size),
      });
      report.totalSize += stats.size;
    }
  } catch (error) {
    // Ignore if directory doesn't exist
  }
  
  // Check packages
  try {
    const packages = await fs.readdir(CONFIG.packagesDir);
    for (const pkg of packages) {
      if (pkg === 'archives') continue;
      
      const pkgPath = path.join(CONFIG.packagesDir, pkg);
      const stats = await fs.stat(pkgPath);
      if (stats.isDirectory()) {
        const size = await getDirectorySize(pkgPath);
        report.packages.push({
          name: pkg,
          size,
          sizeHuman: formatBytes(size),
        });
      }
    }
  } catch (error) {
    // Ignore if directory doesn't exist
  }
  
  await fs.writeFile(
    path.join(CONFIG.distDir, 'build-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  // Log summary
  log('Build Report:', 'info');
  log(`  Total executables: ${report.executables.length}`, 'info');
  log(`  Total packages: ${report.packages.length}`, 'info');
  log(`  Total size: ${formatBytes(report.totalSize)}`, 'info');
}

/**
 * @function formatBytes
 * @purpose Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * @function getDirectorySize
 * @purpose Get total size of directory
 */
async function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      totalSize += await getDirectorySize(entryPath);
    } else {
      const stats = await fs.stat(entryPath);
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

/**
 * @function main
 * @purpose Main build process
 */
async function main() {
  const startTime = Date.now();
  
  log('🚀 Starting AEMS production build process...', 'build');
  
  try {
    // Step 1: Clean previous builds
    await cleanBuildDirectories();
    
    // Step 2: Build applications
    await buildApplications();
    
    // Step 3: Create executables
    await createExecutables();
    
    // Step 4: Create packages
    await createPackages();
    
    // Step 5: Create archives
    await createArchives();
    
    // Step 6: Generate build report
    await generateBuildReport();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`🎉 Production build completed successfully in ${duration}s`, 'success');
    log(`📦 Distribution packages available in: ${CONFIG.packagesDir}`, 'info');
    
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run the build process
if (require.main === module) {
  main();
}

module.exports = {
  main,
  CONFIG,
};