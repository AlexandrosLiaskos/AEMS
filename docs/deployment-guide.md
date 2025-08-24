# AEMS Deployment Guide

This guide covers different deployment options for AEMS (Automated Email Management System) in production environments.

## Table of Contents

1. [Standalone Executable Deployment](#standalone-executable-deployment)
2. [Docker Deployment](#docker-deployment)
3. [Manual Node.js Deployment](#manual-nodejs-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Data Storage](#data-storage)
6. [Security Considerations](#security-considerations)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Standalone Executable Deployment

The easiest way to deploy AEMS is using the pre-built executables. These are self-contained binaries that include Node.js and all dependencies.

### Building Executables

```bash
# Build for all platforms
npm run production:build

# Build for specific platforms
npm run pkg:build:win     # Windows x64
npm run pkg:build:mac     # macOS (Intel & Apple Silicon)
npm run pkg:build:linux   # Linux x64 & ARM64
```

### Platform-Specific Instructions

#### Windows

1. Download `aems-v2.0.0-windows-x64.zip`
2. Extract to desired location (e.g., `C:\Program Files\AEMS`)
3. Run `start-aems.bat` to start the application
4. Open browser to `http://localhost:3000` for setup wizard

#### macOS

1. Download `aems-v2.0.0-macos-x64.tar.gz` (Intel) or `aems-v2.0.0-macos-arm64.tar.gz` (Apple Silicon)
2. Extract: `tar -xzf aems-v2.0.0-macos-*.tar.gz`
3. Move to Applications: `mv aems-macos-* /Applications/AEMS`
4. Run: `./start-aems.sh`
5. Open browser to `http://localhost:3000` for setup wizard

#### Linux

1. Download `aems-v2.0.0-linux-x64.tar.gz`
2. Extract: `tar -xzf aems-v2.0.0-linux-x64.tar.gz`
3. Move to `/opt`: `sudo mv aems-linux-x64 /opt/aems`
4. Create symlink: `sudo ln -s /opt/aems/start-aems.sh /usr/local/bin/aems`
5. Run: `aems` or `./start-aems.sh`
6. Open browser to `http://localhost:3000` for setup wizard

### System Service Setup

#### Windows Service

Create a Windows service using NSSM (Non-Sucking Service Manager):

```cmd
# Download NSSM from https://nssm.cc/
nssm install AEMS "C:\Program Files\AEMS\aems-windows-x64.exe"
nssm set AEMS DisplayName "AEMS - Automated Email Management System"
nssm set AEMS Description "AI-powered email management and data extraction"
nssm set AEMS Start SERVICE_AUTO_START
nssm start AEMS
```

#### Linux Systemd Service

Create `/etc/systemd/system/aems.service`:

```ini
[Unit]
Description=AEMS - Automated Email Management System
After=network.target

[Service]
Type=simple
User=aems
Group=aems
WorkingDirectory=/opt/aems
ExecStart=/opt/aems/aems-linux-x64
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/aems/data /opt/aems/logs

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aems
sudo systemctl start aems
```

#### macOS LaunchDaemon

Create `/Library/LaunchDaemons/com.aems.app.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.aems.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/AEMS/aems-macos-x64</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Applications/AEMS</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/aems.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/aems.error.log</string>
</dict>
</plist>
```

Load the service:

```bash
sudo launchctl load /Library/LaunchDaemons/com.aems.app.plist
```

## Docker Deployment

Docker provides a consistent deployment environment across different platforms.

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/aems.git
cd aems

# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t aems:latest .
docker run -d -p 3000:3000 -p 3001:3001 --name aems aems:latest
```

### Production Docker Deployment

1. **Create environment file** (`.env.production`):

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# API Keys (use Docker secrets in production)
OPENAI_API_KEY=your_openai_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database
DATABASE_TYPE=json
DATABASE_PATH=/app/data

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
```

2. **Use Docker Compose with production profile**:

```bash
# Start with production configuration
docker-compose --profile production up -d

# Or use production compose file
docker-compose -f docker-compose.prod.yml up -d
```

3. **Set up reverse proxy** (Nginx example):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Frontend
    location / {
        proxy_pass http://aems:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://aems:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support for real-time features
    location /graphql {
        proxy_pass http://aems:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Manual Node.js Deployment

For custom deployments or when you need more control over the environment.

### Prerequisites

- Node.js 18+ 
- npm 8+
- Git

### Deployment Steps

1. **Clone and build**:

```bash
git clone https://github.com/your-org/aems.git
cd aems
npm run setup:prod
```

2. **Configure environment**:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start with PM2** (recommended):

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'aems',
    script: 'dist/apps/backend/main.js',
    cwd: '/path/to/aems',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Environment Configuration

### Required Environment Variables

```env
# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# API Keys
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# Security
JWT_SECRET=your-jwt-secret-min-32-chars
SESSION_SECRET=your-session-secret-min-32-chars

# Database
DATABASE_TYPE=json
DATABASE_PATH=/path/to/data

# OAuth
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
```

### Optional Environment Variables

```env
# AI Processing
OPENAI_MODEL=gpt-3.5-turbo
CLASSIFICATION_CONFIDENCE_THRESHOLD=0.8
EXTRACTION_CONFIDENCE_THRESHOLD=0.9
ENABLE_AI_PROCESSING=true

# Logging
LOG_LEVEL=info
LOG_FILE=/path/to/logs/aems.log

# Performance
MAX_CONCURRENT_EMAILS=5
CACHE_TTL=300
API_RATE_LIMIT=1000

# Features
ENABLE_NOTIFICATIONS=true
ENABLE_METRICS=true

# Backup
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
```

## Data Storage

AEMS uses OS-specific directories for data storage:

- **Windows**: `%APPDATA%\AEMS`
- **macOS**: `~/Library/Application Support/AEMS`
- **Linux**: `~/.local/share/AEMS`

### Directory Structure

```
AEMS/
├── data/           # JSON database files
├── logs/           # Application logs
├── backups/        # Automatic backups
├── cache/          # Temporary cache files
└── .env            # Environment configuration
```

### Backup Strategy

1. **Automatic Backups**: Enabled by default, creates daily backups
2. **Manual Backup**: Copy the entire AEMS data directory
3. **Cloud Backup**: Sync data directory to cloud storage (optional)

```bash
# Manual backup example
tar -czf aems-backup-$(date +%Y%m%d).tar.gz ~/.local/share/AEMS
```

## Security Considerations

### API Key Security

- Store API keys in environment variables, not in code
- Use Docker secrets for containerized deployments
- Rotate API keys regularly
- Monitor API usage for unusual activity

### Network Security

- Use HTTPS in production (SSL/TLS certificates)
- Configure firewall to restrict access to necessary ports only
- Use reverse proxy (Nginx/Apache) for additional security
- Enable rate limiting to prevent abuse

### Application Security

- Run application with non-root user
- Keep dependencies updated
- Enable security headers
- Use strong JWT and session secrets
- Regular security audits

### Data Security

- Encrypt sensitive data at rest
- Regular backups with encryption
- Secure file permissions on data directories
- Consider database encryption for sensitive environments

## Monitoring and Maintenance

### Health Checks

AEMS provides health check endpoints:

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system status

### Logging

Configure appropriate log levels:

- **Production**: `info` or `warn`
- **Development**: `debug`
- **Troubleshooting**: `debug` with detailed logging

### Monitoring Tools

Recommended monitoring solutions:

1. **Application Monitoring**:
   - PM2 monitoring
   - New Relic
   - DataDog

2. **Infrastructure Monitoring**:
   - Prometheus + Grafana
   - CloudWatch (AWS)
   - Azure Monitor

3. **Log Management**:
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Splunk
   - Fluentd

### Maintenance Tasks

#### Daily
- Check application health
- Monitor disk space
- Review error logs

#### Weekly
- Update dependencies (security patches)
- Review performance metrics
- Check backup integrity

#### Monthly
- Full system backup
- Security audit
- Performance optimization review
- Update documentation

### Troubleshooting

#### Common Issues

1. **Application won't start**:
   - Check environment variables
   - Verify file permissions
   - Check port availability
   - Review logs for errors

2. **API key errors**:
   - Verify API key format
   - Check API key permissions
   - Monitor API usage limits
   - Test API connectivity

3. **Performance issues**:
   - Check system resources (CPU, memory, disk)
   - Review database performance
   - Monitor network connectivity
   - Optimize AI processing settings

4. **Data corruption**:
   - Restore from backup
   - Check file system integrity
   - Review application logs
   - Contact support if needed

#### Log Locations

- **Standalone**: `./logs/` in application directory
- **Docker**: Container logs via `docker logs aems`
- **Systemd**: `journalctl -u aems`
- **PM2**: `pm2 logs aems`

For additional support, please refer to:
- [GitHub Issues](https://github.com/your-org/aems/issues)
- [Documentation](https://github.com/your-org/aems/wiki)
- [Support Email](mailto:support@your-domain.com)