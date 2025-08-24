# AEMS Production Setup Guide

This guide covers the complete production setup process for AEMS (Automated Email Management System), including OS-specific data storage, PKG bundling, and initial setup wizard for non-technical users.

## Overview

AEMS v2.0 includes several production-ready features:

- **OS-Specific Data Storage**: Automatically uses appropriate system directories
- **PKG Bundling**: Creates standalone executables for Windows, macOS, and Linux
- **Initial Setup Wizard**: User-friendly configuration for non-technical users
- **Environment Auto-Generation**: Automatically generates secrets and validates configuration
- **Health Monitoring**: Comprehensive health checks and monitoring endpoints

## Quick Start

### For End Users (Non-Technical)

1. **Download** the appropriate executable for your system:
   - Windows: `aems-v2.0.0-windows-x64.zip`
   - macOS Intel: `aems-v2.0.0-macos-x64.tar.gz`
   - macOS Apple Silicon: `aems-v2.0.0-macos-arm64.tar.gz`
   - Linux: `aems-v2.0.0-linux-x64.tar.gz`

2. **Extract** the archive to your desired location

3. **Run** the startup script:
   - Windows: Double-click `start-aems.bat`
   - macOS/Linux: Run `./start-aems.sh` in terminal

4. **Open** your web browser to `http://localhost:3000`

5. **Complete** the setup wizard with your API keys:
   - OpenAI API key (from https://platform.openai.com/api-keys)
   - Google OAuth credentials (from Google Cloud Console)

### For Developers

```bash
# Clone and setup
git clone https://github.com/your-org/aems.git
cd aems
npm run setup:dev

# Development
npm run dev

# Production build
npm run production:build

# Start production
npm run start:production
```

## Data Storage

### OS-Specific Directories

AEMS automatically uses the appropriate system directories for data storage:

#### Windows
- **Location**: `%APPDATA%\AEMS`
- **Full Path**: `C:\Users\[Username]\AppData\Roaming\AEMS`

#### macOS
- **Location**: `~/Library/Application Support/AEMS`
- **Full Path**: `/Users/[Username]/Library/Application Support/AEMS`

#### Linux
- **Location**: `~/.local/share/AEMS`
- **Full Path**: `/home/[username]/.local/share/AEMS`

### Directory Structure

```
AEMS/
├── data/           # JSON database files
│   ├── emails.json
│   ├── classifications.json
│   ├── extractions.json
│   └── users.json
├── logs/           # Application logs
│   ├── aems.log
│   └── error.log
├── backups/        # Automatic backups
│   └── backup-YYYYMMDD.tar.gz
├── cache/          # Temporary cache files
└── .env            # Environment configuration
```

### Portable Mode

For portable installations, set `PORTABLE_MODE=true` in environment variables. This will use the current directory for data storage instead of OS-specific directories.

## PKG Bundling

### Building Executables

```bash
# Build all platforms
npm run production:build

# Build specific platforms
npm run pkg:build:win     # Windows x64
npm run pkg:build:mac     # macOS (Intel & Apple Silicon)
npm run pkg:build:linux   # Linux x64 & ARM64
```

### Output Structure

```
dist/
├── executables/          # PKG executables
│   ├── aems-windows-x64.exe
│   ├── aems-macos-x64
│   ├── aems-macos-arm64
│   ├── aems-linux-x64
│   └── aems-linux-arm64
└── packages/            # Distribution packages
    ├── aems-windows-x64/
    │   ├── aems-windows-x64.exe
    │   ├── start-aems.bat
    │   ├── public/
    │   ├── README.txt
    │   └── package-info.json
    └── archives/        # Compressed packages
        ├── aems-v2.0.0-windows-x64.zip
        └── aems-v2.0.0-linux-x64.tar.gz
```

### PKG Configuration

The PKG configuration is defined in `pkg.config.json`:

```json
{
  "targets": [
    "node18-win-x64",
    "node18-macos-x64",
    "node18-macos-arm64",
    "node18-linux-x64",
    "node18-linux-arm64"
  ],
  "assets": [
    "dist/apps/frontend/**/*",
    "apps/backend/src/database/migrations/**/*"
  ],
  "scripts": [
    "dist/apps/backend/**/*.js"
  ]
}
```

## Initial Setup Wizard

### Features

- **Step-by-step Configuration**: Guided setup process
- **API Key Validation**: Real-time validation of API credentials
- **Secret Generation**: Automatic generation of JWT and session secrets
- **Configuration Preview**: Review settings before completion
- **Error Handling**: Clear error messages and recovery options

### Setup Steps

1. **Welcome**: Introduction and requirements
2. **API Configuration**: OpenAI and Google OAuth credentials
3. **AI Settings**: Model selection and confidence thresholds
4. **Application Settings**: URLs, logging, and features
5. **Review & Complete**: Final validation and completion

### API Endpoints

```
GET  /api/setup/progress        # Get setup progress
GET  /api/setup/status          # Check if setup is required
GET  /api/setup/steps/:stepId   # Get specific step details
POST /api/setup/steps/:stepId   # Save step data
POST /api/setup/complete        # Complete setup
GET  /api/setup/system-info     # Get system information
```

### Frontend Components

- `SetupPage`: Main setup wizard page
- `SetupWizardStep`: Individual step component
- `useSetup`: React hook for setup state management

## Environment Auto-Generation

### Features

- **Automatic Secret Generation**: JWT and session secrets
- **Configuration Validation**: Comprehensive validation of all settings
- **Migration Support**: Automatic migration from portable mode
- **Health Monitoring**: Continuous configuration health checks

### Generated Secrets

- **JWT_SECRET**: 64-character hex string for JWT signing
- **SESSION_SECRET**: 32-character hex string for session encryption
- **GOOGLE_REDIRECT_URI**: Automatically configured OAuth redirect

### Validation Rules

```typescript
// Required fields
const required = [
  'JWT_SECRET',
  'SESSION_SECRET', 
  'DATABASE_PATH',
  'PORT'
];

// API keys (required for full functionality)
const apiKeys = [
  'OPENAI_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

// Format validation
const validation = {
  JWT_SECRET: { minLength: 32 },
  SESSION_SECRET: { minLength: 16 },
  OPENAI_API_KEY: { pattern: /^sk-/ },
  GOOGLE_CLIENT_ID: { pattern: /\.googleusercontent\.com$/ },
  PORT: { range: [1024, 65535] }
};
```

## Health Monitoring

### Endpoints

```
GET /api/health          # Basic health check
GET /api/health/detailed # Detailed health with service status
GET /api/health/ready    # Kubernetes readiness probe
GET /api/health/live     # Kubernetes liveness probe
```

### Health Check Response

```json
{
  "status": "ok",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 3600,
  "version": "2.0.0",
  "environment": "production",
  "setup": {
    "initialized": true,
    "complete": true,
    "required": false,
    "dataPath": "/Users/user/Library/Application Support/AEMS/data",
    "configPath": "/Users/user/Library/Application Support/AEMS/.env"
  },
  "system": {
    "platform": "darwin",
    "nodeVersion": "v18.17.0",
    "memory": {
      "used": 45,
      "total": 128,
      "percentage": 35
    }
  }
}
```

## Security Considerations

### API Key Security

- **Environment Variables**: Store API keys in environment variables
- **File Permissions**: Restrict access to configuration files
- **Secret Rotation**: Regular rotation of generated secrets
- **Validation**: Real-time validation of API key formats

### Application Security

- **Non-Root Execution**: Run with minimal privileges
- **HTTPS Support**: SSL/TLS configuration for production
- **Rate Limiting**: Built-in API rate limiting
- **Input Validation**: Comprehensive input validation

### Data Security

- **Local Storage**: All data stored locally by default
- **Encryption**: Optional encryption for sensitive data
- **Backups**: Automatic encrypted backups
- **Access Control**: User-based access control

## Troubleshooting

### Common Issues

#### Setup Wizard Not Accessible

```bash
# Check if application is running
curl http://localhost:3001/api/health

# Check logs
tail -f ~/.local/share/AEMS/logs/aems.log
```

#### API Key Validation Errors

- Verify API key format (OpenAI keys start with `sk-`)
- Check API key permissions and quotas
- Ensure Google OAuth credentials are for a web application

#### Data Directory Issues

```bash
# Check directory permissions
ls -la ~/.local/share/AEMS

# Recreate directories
rm -rf ~/.local/share/AEMS
# Restart application to recreate
```

#### Port Conflicts

```bash
# Check what's using the port
lsof -i :3001
netstat -tulpn | grep 3001

# Change port in configuration
echo "PORT=3002" >> ~/.local/share/AEMS/.env
```

### Log Locations

- **Standalone**: `~/.local/share/AEMS/logs/aems.log`
- **Docker**: `docker logs aems`
- **Development**: `./logs/aems.log`

### Support Resources

- **Documentation**: https://github.com/your-org/aems/wiki
- **Issues**: https://github.com/your-org/aems/issues
- **Discussions**: https://github.com/your-org/aems/discussions
- **Email**: support@your-domain.com

## Migration Guide

### From v1.x to v2.0

1. **Backup Data**: Create backup of existing data
2. **Install v2.0**: Download and install new version
3. **Run Migration**: Application will automatically migrate data
4. **Complete Setup**: Run setup wizard for new features
5. **Verify**: Check that all data migrated correctly

### From Portable to OS-Specific

The application automatically detects and migrates portable installations:

1. **Automatic Detection**: Checks for `./data` directory
2. **Migration Prompt**: Offers to migrate to OS-specific location
3. **Data Copy**: Copies all data to new location
4. **Verification**: Verifies migration success
5. **Cleanup**: Optionally removes old portable data

## Performance Optimization

### System Requirements

- **Minimum**: 512MB RAM, 100MB disk space
- **Recommended**: 1GB RAM, 500MB disk space
- **Optimal**: 2GB RAM, 1GB disk space

### Configuration Tuning

```env
# Performance settings
MAX_CONCURRENT_EMAILS=5
CACHE_TTL=300
API_RATE_LIMIT=1000

# AI processing
CLASSIFICATION_CONFIDENCE_THRESHOLD=0.8
EXTRACTION_CONFIDENCE_THRESHOLD=0.9

# Logging
LOG_LEVEL=info
```

### Monitoring

- **Memory Usage**: Monitor heap usage and garbage collection
- **API Costs**: Track OpenAI API usage and costs
- **Processing Time**: Monitor email processing performance
- **Error Rates**: Track and alert on error rates

## Deployment Checklist

### Pre-Deployment

- [ ] System requirements verified
- [ ] API keys obtained and validated
- [ ] Network ports available
- [ ] Disk space sufficient
- [ ] Backup strategy planned

### Deployment

- [ ] Application installed
- [ ] Configuration completed
- [ ] Health checks passing
- [ ] Setup wizard completed
- [ ] Data directories created

### Post-Deployment

- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] Documentation updated
- [ ] Users trained
- [ ] Support contacts established

## Conclusion

AEMS v2.0 provides a comprehensive, production-ready email management solution with:

- **Easy Installation**: Standalone executables for all platforms
- **User-Friendly Setup**: Guided configuration wizard
- **Secure Storage**: OS-specific data directories with proper permissions
- **Automatic Configuration**: Self-configuring environment with validation
- **Production Monitoring**: Comprehensive health checks and logging

The system is designed to be accessible to non-technical users while providing the flexibility and monitoring capabilities required for production deployments.