#!/usr/bin/env node

/**
 * AEMS Startup Script
 * 
 * This script handles the complete startup process for AEMS:
 * 1. Environment validation and initialization
 * 2. Data directory setup
 * 3. Configuration validation
 * 4. Service health checks
 * 5. Application startup
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Configuration
const CONFIG = {
  appName: 'AEMS',
  version: '2.0.0',
  requiredNodeVersion: '18.0.0',
  ports: {
    backend: 3001,
    frontend: 3000,
  },
  timeouts: {
    startup: 60000, // 60 seconds
    healthCheck: 10000, // 10 seconds
  },
};

/**
 * @function log
 * @purpose Enhanced logging with timestamps and colors
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    reset: '\x1b[0m',    // Reset
  };
  
  const color = colors[level] || colors.info;
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }[level] || 'ℹ️';
  
  console.log(`${color}${prefix} [${timestamp}] ${message}${colors.reset}`);
}

/**
 * @function checkNodeVersion
 * @purpose Verify Node.js version compatibility
 */
function checkNodeVersion() {
  const currentVersion = process.version.slice(1); // Remove 'v' prefix
  const [currentMajor] = currentVersion.split('.').map(Number);
  const [requiredMajor] = CONFIG.requiredNodeVersion.split('.').map(Number);
  
  if (currentMajor < requiredMajor) {
    log(`Node.js ${CONFIG.requiredNodeVersion}+ is required. Current version: ${process.version}`, 'error');
    process.exit(1);
  }
  
  log(`Node.js version check passed: ${process.version}`, 'success');
}

/**
 * @function checkSystemRequirements
 * @purpose Check system requirements
 */
async function checkSystemRequirements() {
  log('Checking system requirements...', 'info');
  
  // Check Node.js version
  checkNodeVersion();
  
  // Check available memory
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryMB = Math.round(totalMemory / 1024 / 1024);
  const freeMB = Math.round(freeMemory / 1024 / 1024);
  
  log(`System memory: ${memoryMB}MB total, ${freeMB}MB free`, 'info');
  
  if (memoryMB < 512) {
    log('Warning: Less than 512MB RAM available. Performance may be affected.', 'warning');
  }
  
  // Check disk space
  try {
    const stats = await fs.stat(process.cwd());
    log('Disk access check passed', 'success');
  } catch (error) {
    log(`Disk access check failed: ${error.message}`, 'error');
    process.exit(1);
  }
  
  log('System requirements check completed', 'success');
}

/**
 * @function checkPortAvailability
 * @purpose Check if required ports are available
 */
function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    
    server.on('error', () => resolve(false));
  });
}

/**
 * @function validatePorts
 * @purpose Validate that required ports are available
 */
async function validatePorts() {
  log('Checking port availability...', 'info');
  
  const backendAvailable = await checkPortAvailability(CONFIG.ports.backend);
  const frontendAvailable = await checkPortAvailability(CONFIG.ports.frontend);
  
  if (!backendAvailable) {
    log(`Port ${CONFIG.ports.backend} is already in use. Please stop any existing AEMS instances or change the port.`, 'error');
    process.exit(1);
  }
  
  if (!frontendAvailable) {
    log(`Port ${CONFIG.ports.frontend} is already in use. Frontend may not be accessible.`, 'warning');
  }
  
  log('Port availability check completed', 'success');
}

/**
 * @function getDataDirectories
 * @purpose Get OS-specific data directories
 */
function getDataDirectories() {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  let baseDir;
  
  switch (platform) {
    case 'win32':
      baseDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), CONFIG.appName);
      break;
    case 'darwin':
      baseDir = path.join(homeDir, 'Library', 'Application Support', CONFIG.appName);
      break;
    default:
      const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
      baseDir = path.join(xdgDataHome, CONFIG.appName);
      break;
  }
  
  return {
    base: baseDir,
    data: path.join(baseDir, 'data'),
    logs: path.join(baseDir, 'logs'),
    backups: path.join(baseDir, 'backups'),
    cache: path.join(baseDir, 'cache'),
  };
}

/**
 * @function ensureDirectories
 * @purpose Ensure all required directories exist
 */
async function ensureDirectories() {
  log('Setting up data directories...', 'info');
  
  const dirs = getDataDirectories();
  
  for (const [name, dirPath] of Object.entries(dirs)) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      log(`Directory ensured: ${name} -> ${dirPath}`, 'info');
    } catch (error) {
      log(`Failed to create directory ${dirPath}: ${error.message}`, 'error');
      process.exit(1);
    }
  }
  
  log('Data directories setup completed', 'success');
  return dirs;
}

/**
 * @function checkConfiguration
 * @purpose Check if configuration exists and is valid
 */
async function checkConfiguration(dirs) {
  log('Checking configuration...', 'info');
  
  const configPath = path.join(dirs.base, '.env');
  
  try {
    await fs.access(configPath);
    log(`Configuration file found: ${configPath}`, 'success');
    
    // Basic validation
    const configContent = await fs.readFile(configPath, 'utf-8');
    const hasApiKeys = configContent.includes('OPENAI_API_KEY') && 
                      configContent.includes('GOOGLE_CLIENT_ID');
    
    if (!hasApiKeys) {
      log('Configuration exists but API keys may be missing. Setup wizard will be required.', 'warning');
      return { exists: true, complete: false, path: configPath };
    }
    
    return { exists: true, complete: true, path: configPath };
    
  } catch (error) {
    log('No configuration file found. First-time setup will be required.', 'info');
    return { exists: false, complete: false, path: configPath };
  }
}

/**
 * @function startApplication
 * @purpose Start the AEMS application
 */
function startApplication() {
  return new Promise((resolve, reject) => {
    log('Starting AEMS application...', 'info');
    
    // Determine the correct entry point
    const entryPoints = [
      'dist/apps/backend/main.js',
      'apps/backend/dist/main.js',
      'build/main.js',
      'main.js',
    ];
    
    let entryPoint = null;
    for (const ep of entryPoints) {
      try {
        require.resolve(path.resolve(ep));
        entryPoint = ep;
        break;
      } catch (error) {
        // Continue to next entry point
      }
    }
    
    if (!entryPoint) {
      reject(new Error('Could not find application entry point. Please ensure the application is built.'));
      return;
    }
    
    log(`Using entry point: ${entryPoint}`, 'info');
    
    // Set environment variables
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    process.env.PORT = process.env.PORT || CONFIG.ports.backend.toString();
    
    // Start the application
    const app = spawn('node', [entryPoint], {
      stdio: 'inherit',
      env: process.env,
    });
    
    app.on('error', (error) => {
      log(`Failed to start application: ${error.message}`, 'error');
      reject(error);
    });
    
    app.on('exit', (code) => {
      if (code === 0) {
        log('Application exited normally', 'info');
      } else {
        log(`Application exited with code ${code}`, 'error');
      }
      resolve(code);
    });
    
    // Wait for startup
    setTimeout(() => {
      log('Application startup initiated', 'success');
      resolve(app);
    }, 2000);
  });
}

/**
 * @function waitForHealthCheck
 * @purpose Wait for application to be healthy
 */
async function waitForHealthCheck() {
  log('Waiting for application to be ready...', 'info');
  
  const maxAttempts = 30;
  const interval = 2000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const http = require('http');
      
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${CONFIG.ports.backend}/api/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Health check failed with status ${res.statusCode}`));
          }
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Health check timeout')));
      });
      
      log('Application is ready and healthy!', 'success');
      return true;
      
    } catch (error) {
      if (attempt === maxAttempts) {
        log(`Health check failed after ${maxAttempts} attempts: ${error.message}`, 'error');
        return false;
      }
      
      log(`Health check attempt ${attempt}/${maxAttempts} failed, retrying...`, 'info');
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  return false;
}

/**
 * @function displayStartupInfo
 * @purpose Display startup information to user
 */
function displayStartupInfo(config, dirs) {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 ${CONFIG.appName} v${CONFIG.version} - Startup Complete!`);
  console.log('='.repeat(60));
  console.log('');
  console.log('📍 Access URLs:');
  console.log(`   Frontend: http://localhost:${CONFIG.ports.frontend}`);
  console.log(`   Backend:  http://localhost:${CONFIG.ports.backend}`);
  console.log(`   API Docs: http://localhost:${CONFIG.ports.backend}/api/docs`);
  console.log('');
  console.log('📁 Data Locations:');
  console.log(`   Data:     ${dirs.data}`);
  console.log(`   Logs:     ${dirs.logs}`);
  console.log(`   Backups:  ${dirs.backups}`);
  console.log(`   Config:   ${config.path}`);
  console.log('');
  
  if (!config.complete) {
    console.log('⚠️  Setup Required:');
    console.log('   Please open the frontend URL and complete the setup wizard');
    console.log('   You will need:');
    console.log('   • OpenAI API key (from https://platform.openai.com/api-keys)');
    console.log('   • Google OAuth credentials (from Google Cloud Console)');
    console.log('');
  }
  
  console.log('🛑 To stop AEMS:');
  console.log('   Press Ctrl+C in this terminal');
  console.log('');
  console.log('📚 Documentation:');
  console.log('   https://github.com/your-org/aems/wiki');
  console.log('');
  console.log('='.repeat(60));
}

/**
 * @function handleShutdown
 * @purpose Handle graceful shutdown
 */
function handleShutdown(signal) {
  log(`Received ${signal}, shutting down gracefully...`, 'info');
  
  // Perform cleanup if needed
  setTimeout(() => {
    log('Shutdown complete', 'success');
    process.exit(0);
  }, 1000);
}

/**
 * @function main
 * @purpose Main startup process
 */
async function main() {
  try {
    console.log(`\n🚀 Starting ${CONFIG.appName} v${CONFIG.version}...\n`);
    
    // Step 1: System checks
    await checkSystemRequirements();
    await validatePorts();
    
    // Step 2: Setup directories
    const dirs = await ensureDirectories();
    
    // Step 3: Check configuration
    const config = await checkConfiguration(dirs);
    
    // Step 4: Start application
    const app = await startApplication();
    
    // Step 5: Wait for health check
    const isHealthy = await waitForHealthCheck();
    
    if (!isHealthy) {
      log('Application failed to start properly. Check logs for details.', 'error');
      process.exit(1);
    }
    
    // Step 6: Display startup info
    displayStartupInfo(config, dirs);
    
    // Setup signal handlers
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    
    // Keep process alive
    if (typeof app === 'object' && app.pid) {
      // If we have a child process, wait for it
      return new Promise((resolve) => {
        app.on('exit', resolve);
      });
    }
    
  } catch (error) {
    log(`Startup failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run startup process
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal startup error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  CONFIG,
  getDataDirectories,
};