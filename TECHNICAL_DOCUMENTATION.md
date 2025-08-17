# ΤΕΧΝΙΚΗ ΤΕΚΜΗΡΙΩΣΗ - AEMS (Automated Email Management System)

## Περιεχόμενα

1. [Επισκόπηση Συστήματος](#επισκόπηση-συστήματος)
2. [Αρχιτεκτονική](#αρχιτεκτονική)
3. [Τεχνολογίες & Εργαλεία](#τεχνολογίες--εργαλεία)
4. [Δομή Βάσης Δεδομένων](#δομή-βάσης-δεδομένων)
5. [API Endpoints](#api-endpoints)
6. [Χαρακτηριστικά Ασφαλείας](#χαρακτηριστικά-ασφαλείας)
7. [AI Integration](#ai-integration)
8. [Εγκατάσταση & Deployment](#εγκατάσταση--deployment)
9. [Monitoring & Logging](#monitoring--logging)
10. [Backup & Recovery](#backup--recovery)

---

## Επισκόπηση Συστήματος

Το AEMS είναι ένα πλήρες σύστημα αυτοματισμού για τη διαχείριση emails και την εξαγωγή δεδομένων. Σχεδιάστηκε ειδικά για την TechFlow Solutions για να αυτοματοποιήσει τη διαχείριση στοιχείων πελατών και τιμολογίων.

### Κύριες Λειτουργίες
- **Email Processing**: Αυτόματη λήψη και κατηγοριοποίηση emails από Gmail
- **AI Data Extraction**: Εξαγωγή δομημένων δεδομένων με χρήση OpenAI GPT-3.5-turbo
- **PDF Processing**: Επεξεργασία PDF τιμολογίων και εξαγωγή οικονομικών στοιχείων
- **Human-in-the-Loop**: Τριπλό workflow (Fetched → Review → Managed) με έλεγχο χρήστη
- **Real-time Dashboard**: Live monitoring και notifications
- **Data Export**: Εξαγωγή σε Excel format

---

## Αρχιτεκτονική

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  External APIs  │
│   (Vanilla JS)  │◄──►│  (Node.js)      │◄──►│  Gmail API      │
│                 │    │                 │    │  OpenAI API     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  JSON Database  │
                       │  (File System)  │
                       └─────────────────┘
```

### Backend Components

```
server.js                    # Main Express server
├── lib/
│   ├── ai.js               # OpenAI integration
│   ├── ai-extractor.js     # AI data extraction logic
│   ├── pdf-processor.js    # PDF content processing
│   ├── database.js         # JSON database operations
│   ├── gmail.js            # Gmail API integration
│   ├── health-monitor.js   # System health monitoring
│   ├── audit-logger.js     # Security audit logging
│   ├── retry-utils.js      # Retry logic with circuit breaker
│   ├── backup-manager.js   # Automated backup system
│   └── env-validator.js    # Environment validation
```

### Frontend Components

```
public/
├── index.html              # Main SPA
├── css/styles.css          # Modern dark theme
└── js/
    ├── app.js              # Main application logic
    ├── security-utils.js   # XSS prevention
    ├── performance-cache.js # Client-side caching
    └── ui-enhancements.js  # Advanced UI features
```

---

## Τεχνολογίες & Εργαλεία

### Backend Stack
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4.18.2
- **AI/ML**: OpenAI GPT-3.5-turbo v4.28.4, LangChain v0.1.30
- **Document Processing**: pdf-parse v1.1.1
- **Authentication**: Google OAuth2 (googleapis v128.0.0)
- **Data Storage**: JSON files with atomic writes (write-file-atomic v6.0.0)
- **Email API**: Gmail API v1
- **Task Scheduling**: node-cron v3.0.3
- **File Upload**: multer v1.4.5-lts.1
- **Data Export**: xlsx v0.18.5

### Security Stack
- **Web Security**: helmet v7.1.0 (CSP, HSTS, etc.)
- **Rate Limiting**: express-rate-limit v7.1.5
- **CSRF Protection**: csurf v1.11.0
- **Input Validation**: express-validator v7.0.1
- **XSS Prevention**: DOMPurify v3.0.6
- **Session Management**: express-session v1.17.3

### Frontend Stack
- **Core**: Vanilla JavaScript ES6+
- **Security**: Nonce-based CSP, XSS prevention
- **DOM Operations**: JSDOM v23.0.1 (server-side)
- **Icons**: Font Awesome 6.0
- **Design**: Custom dark theme, responsive design

---

## Δομή Βάσης Δεδομένων

Το σύστημα χρησιμοποιεί JSON files για αποθήκευση δεδομένων με modular structure:

### Email Storage Structure
```
data/emails/
├── fetched/                # Newly fetched emails
│   ├── customer-inquiries.json
│   ├── invoices.json
│   └── other.json
├── review/                 # Emails pending review
│   ├── customer-inquiries.json
│   ├── invoices.json
│   └── other.json
├── managed/                # Processed emails
│   ├── customer-inquiries.json
│   ├── invoices.json
│   └── other.json
└── deleted/                # Soft-deleted emails
    └── all.json
```

### Data Schema

#### Email Object
```json
{
  "id": "uuid",
  "gmailId": "gmail_message_id",
  "subject": "string",
  "body": "string",
  "fromAddress": "email",
  "toAddress": "email",
  "date": "ISO_string",
  "category": "customer_inquiry|invoice|other",
  "attachments": ["attachment_objects"],
  "extractedData": "object|null",
  "userId": "string",
  "createdAt": "ISO_string",
  "updatedAt": "ISO_string"
}
```

#### Extracted Data Schema

**Customer Inquiry:**
```json
{
  "customerName": "string",
  "customerEmail": "email",
  "customerPhone": "string",
  "company": "string",
  "serviceInterest": "string"
}
```

**Invoice:**
```json
{
  "invoiceNumber": "string",
  "invoiceDate": "string",
  "customerName": "string",
  "amount": "number",
  "vatAmount": "number",
  "totalAmount": "number"
}
```

### Additional Data Structures
```
data/
├── extracted-data/         # AI-extracted information
│   ├── customer-inquiries.json
│   └── invoices.json
├── attachments/            # Email attachments metadata
│   └── all.json
├── notifications/          # System notifications
│   └── all.json
├── users.json             # User authentication data
└── settings.json          # Application configuration
```

---

## API Endpoints

### Authentication Endpoints
```
GET  /auth/google          # Initiate Google OAuth
GET  /auth/google/callback # OAuth callback
POST /auth/logout          # Sign out user
GET  /api/user            # Get current user info
```

### Email Management
```
GET  /api/emails/fetched   # Get fetched emails
GET  /api/emails/review    # Get emails in review
GET  /api/emails/managed   # Get processed emails
GET  /api/emails/deleted   # Get deleted emails
POST /api/emails/sync      # Sync new emails from Gmail
POST /api/emails/approve   # Move email to review stage
POST /api/emails/process   # Move email to managed stage
POST /api/emails/decline   # Soft delete email
PUT  /api/emails/:id       # Update email data
DELETE /api/emails/:id     # Permanently delete email
```

### Data Extraction
```
POST /api/extract/customer # Extract customer data
POST /api/extract/invoice  # Extract invoice data
PUT  /api/extracted-data/:id # Update extracted data
```

### Export & Reporting
```
GET  /api/export/excel     # Export data to Excel
GET  /api/stats           # Get dashboard statistics
```

### System Management
```
GET  /api/health          # System health check
GET  /api/notifications   # Get notifications
GET  /api/notifications/stream # SSE notifications
POST /api/backup/create   # Create manual backup
GET  /api/backup/list     # List available backups
```

---

## Χαρακτηριστικά Ασφαλείας

### Web Security
- **Content Security Policy (CSP)**: Nonce-based με strict directives
- **HTTPS Enforcement**: HSTS headers σε production
- **XSS Protection**: DOMPurify sanitization
- **CSRF Protection**: Token-based με SameSite cookies
- **Rate Limiting**: Configurable limits ανά endpoint

### Authentication & Authorization
- **OAuth2**: Google OAuth με automatic token refresh
- **Session Management**: Secure cookies με HttpOnly/SameSite
- **Input Validation**: Comprehensive validation με express-validator
- **Audit Logging**: Detailed security event logging

### Data Protection
- **Atomic Writes**: File locking για data consistency
- **Backup Encryption**: Automated backups με integrity checks
- **Environment Validation**: Strict environment variable validation
- **Error Handling**: Secure error messages χωρίς sensitive data exposure

---

## AI Integration

### OpenAI Configuration
```javascript
{
  model: "gpt-3.5-turbo",
  temperature: 0.1,
  maxTokens: 1000,
  costTracking: true,
  retryLogic: true
}
```

### Data Extraction Prompts
- **Customer Inquiry Extraction**: Structured prompts για εξαγωγή contact information
- **Invoice Processing**: Specialized prompts για financial data extraction
- **PDF Content Integration**: Combined text + PDF content analysis

### Cost Control
- Request counting και daily limits
- Token usage monitoring
- Batch processing για efficiency
- Circuit breaker για API failures

---

## Εγκατάσταση & Deployment

### Prerequisites
```bash
Node.js v18+
npm v8+
Google Cloud Project με Gmail API enabled
OpenAI API key
```

### Installation Steps
```bash
# Clone repository
git clone <repository-url>
cd aems-02

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Configure environment variables

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables
```
# Required
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret

# Optional
PORT=3000
NODE_ENV=production
MAX_EMAILS_PER_SYNC=50
AI_BATCH_SIZE=5
AI_BATCH_DELAY=1000
```

### Production Deployment
- Process manager (PM2) για process management
- Reverse proxy (nginx) για load balancing
- SSL certificates για HTTPS
- Environment-specific configurations
- Automated backup scheduling

---

## Monitoring & Logging

### Health Monitoring
- **System Health**: CPU, memory, disk usage
- **Database Health**: Read/write operations testing
- **API Health**: Gmail API, OpenAI API connectivity
- **Real-time Metrics**: Performance και error tracking

### Logging System
```
logs/
├── audit.log      # Security events και user actions
├── error.log      # Application errors
└── security.log   # Security-related events
```

### Notification System
- Real-time notifications μέσω Server-Sent Events
- Email processing status updates
- Error alerts και warnings
- System health notifications

---

## Backup & Recovery

### Automated Backup System
- **Daily Backups**: Automated με retention policy
- **Integrity Checks**: Checksum verification
- **Incremental Backups**: Space-efficient storage
- **Recovery Testing**: Automated backup validation

### Backup Structure
```
backups/
├── backup-YYYY-MM-DD/     # Daily snapshots
│   ├── data/              # Complete data backup
│   ├── logs/              # Log files backup
│   └── manifest.json      # Backup metadata
└── manifest.json          # Global backup registry
```

### Recovery Procedures
1. **Data Recovery**: Restore από specific backup date
2. **Partial Recovery**: Selective data restoration
3. **System Recovery**: Complete system restoration
4. **Validation**: Post-recovery integrity checks

---

## Performance Optimization

### Backend Optimizations
- **Connection Pooling**: Efficient API connections
- **Caching Strategy**: In-memory caching για frequent data
- **Batch Processing**: Optimized AI API usage
- **Async Operations**: Non-blocking I/O operations

### Frontend Optimizations
- **Client-side Caching**: Performance cache με memory management
- **Progressive Enhancement**: Gradual feature loading
- **Event Listener Management**: Automatic cleanup
- **Resource Optimization**: Minimized network requests

---

## Troubleshooting

### Common Issues
1. **Gmail API Quota**: Rate limiting solutions
2. **OpenAI API Errors**: Retry logic και fallback strategies
3. **File Lock Issues**: Atomic write conflict resolution
4. **Memory Leaks**: Event listener cleanup procedures

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

### Log Analysis
```bash
# View recent errors
tail -f logs/error.log

# Security events
tail -f logs/security.log

# Audit trail
tail -f logs/audit.log
```

---

## Συντήρηση & Updates

### Regular Maintenance
- **Dependency Updates**: Monthly security updates
- **Backup Verification**: Weekly backup testing
- **Performance Monitoring**: Daily metrics review
- **Security Audits**: Quarterly security assessments

### Update Procedures
1. **Staging Testing**: Test updates σε staging environment
2. **Backup Creation**: Pre-update backup
3. **Rolling Deployment**: Zero-downtime updates
4. **Post-deployment Validation**: Functionality verification

---

*Τεχνική Τεκμηρίωση v1.0 - AEMS Project*
*Τελευταία ενημέρωση: Αύγουστος 2024*
