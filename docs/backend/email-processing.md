# Email Processing Workflow

## Processing Pipeline Overview

### Email Processing Stages
| Stage | Input | Output | Duration | Trigger |
|-------|-------|--------|----------|---------|
| **Fetch** | Gmail API | Raw email data | 1-5s | Manual sync / Scheduled |
| **Parse** | Raw email | Structured email | <1s | Immediate after fetch |
| **Classify** | Structured email | Category + confidence | 2-10s | Automatic / Manual |
| **Extract** | Classified email | Structured data | 5-30s | Post-classification |
| **Review** | Extracted data | Human validation | Variable | Human-in-loop |
| **Finalize** | Validated data | Processed email | <1s | Post-review |

### Workflow State Machine
| Current State | Allowed Transitions | Trigger | Conditions |
|---------------|-------------------|---------|------------|
| **FETCHED** | → PROCESSING | AI processing starts | Email has content |
| **PROCESSING** | → REVIEW | AI processing complete | Classification confidence > 0.7 |
| **PROCESSING** | → FAILED | AI processing error | Processing timeout / API error |
| **REVIEW** | → APPROVED | Human approval | User approves classification |
| **REVIEW** | → REJECTED | Human rejection | User rejects classification |
| **REVIEW** | → PROCESSING | Re-process request | User requests re-classification |
| **APPROVED** | → MANAGED | Final processing | Data validation complete |
| **REJECTED** | → PROCESSING | Re-process | User provides feedback |
| **FAILED** | → PROCESSING | Retry | Manual retry / Auto-retry |
| **MANAGED** | → ARCHIVED | Archive | User archives email |

## AI Classification Service

### Classification Models
| Model | Purpose | Input | Output | Accuracy |
|-------|---------|-------|--------|----------|
| **Primary Classifier** | Email categorization | Email content + metadata | Category + confidence | 92% |
| **Confidence Scorer** | Reliability assessment | Classification result | Confidence score | 89% |
| **Fallback Classifier** | Backup classification | Email content only | Category + confidence | 85% |

### Classification Process
| Step | Action | Details | Error Handling |
|------|--------|---------|----------------|
| 1 | **Content Preparation** | Extract text, clean HTML, normalize | Skip if no content |
| 2 | **Feature Extraction** | Keywords, patterns, metadata | Use basic features if extraction fails |
| 3 | **Model Inference** | Run primary classification model | Fallback to secondary model |
| 4 | **Confidence Scoring** | Calculate reliability score | Default to 0.5 if scoring fails |
| 5 | **Result Validation** | Validate output format | Return error classification |
| 6 | **Storage** | Save classification result | Log error, continue processing |

### Classification Categories
| Category | Indicators | Confidence Threshold | Auto-Approve |
|----------|------------|---------------------|--------------|
| **CUSTOMER_INQUIRY** | Questions, requests, contact info | 0.8 | No |
| **INVOICE** | Payment terms, amounts, due dates | 0.9 | Yes (if confidence > 0.95) |
| **OTHER** | Default category | 0.6 | No |

### Classification Features
```typescript
interface ClassificationFeatures {
  // Content features
  subjectKeywords: string[];
  bodyKeywords: string[];
  emailLength: number;
  hasAttachments: boolean;
  attachmentTypes: string[];
  
  // Sender features
  senderDomain: string;
  senderName: string;
  isKnownSender: boolean;
  senderReputation: number;
  
  // Temporal features
  timeOfDay: number;
  dayOfWeek: number;
  isBusinessHours: boolean;
  
  // Structural features
  hasSignature: boolean;
  hasDisclaimer: boolean;
  htmlComplexity: number;
  linkCount: number;
}
```

## AI Data Extraction Service

### Extraction Models by Category
| Category | Model | Extracted Fields | Accuracy | Processing Time |
|----------|-------|------------------|----------|-----------------|
| **CUSTOMER_INQUIRY** | GPT-3.5-turbo | Name, email, phone, company, inquiry type | 87% | 3-8s |
| **INVOICE** | GPT-3.5-turbo + PDF parser | Invoice #, amount, due date, vendor | 94% | 5-15s |
| **OTHER** | Basic extractor | Sender info, key phrases | 78% | 1-3s |

### Customer Inquiry Extraction
| Field | Extraction Method | Validation | Confidence Impact |
|-------|------------------|------------|-------------------|
| **Customer Name** | NER + pattern matching | Name format validation | High |
| **Email Address** | Regex + validation | Email format check | High |
| **Phone Number** | Regex + normalization | Phone format validation | Medium |
| **Company Name** | NER + domain matching | Company database lookup | Medium |
| **Inquiry Type** | Classification + keywords | Predefined categories | High |
| **Urgency Level** | Keyword analysis | Urgency indicators | Low |
| **Budget Range** | Number extraction + context | Currency validation | Low |
| **Timeline** | Date/time extraction | Date format validation | Medium |

### Invoice Extraction
| Field | Extraction Method | Validation | Confidence Impact |
|-------|------------------|------------|-------------------|
| **Invoice Number** | Pattern matching | Format validation | High |
| **Invoice Date** | Date extraction | Date range validation | High |
| **Due Date** | Date extraction | Future date validation | High |
| **Total Amount** | Number extraction | Currency validation | High |
| **Currency** | Currency detection | ISO code validation | Medium |
| **Vendor Name** | Header extraction | Vendor database lookup | High |
| **Vendor Address** | Address extraction | Address format validation | Medium |
| **Line Items** | Table extraction | Item format validation | Medium |
| **Tax Amount** | Calculation + extraction | Tax rate validation | Medium |
| **Payment Terms** | Text extraction | Terms standardization | Low |

### Extraction Validation
```typescript
interface ExtractionValidation {
  // Field-level validation
  fieldValidations: {
    [fieldName: string]: {
      isRequired: boolean;
      validator: (value: any) => boolean;
      errorMessage: string;
    };
  };
  
  // Cross-field validation
  businessRules: {
    name: string;
    validator: (data: any) => boolean;
    errorMessage: string;
  }[];
  
  // Confidence scoring
  confidenceFactors: {
    fieldPresence: number;      // 0.4
    fieldAccuracy: number;      // 0.3
    businessRuleCompliance: number; // 0.2
    modelConfidence: number;    // 0.1
  };
}
```

## Processing Queue Management

### Queue Configuration
| Queue | Priority | Concurrency | Retry Policy | Dead Letter |
|-------|----------|-------------|--------------|-------------|
| **Classification** | High | 5 workers | 3 attempts, exponential backoff | classification-dlq |
| **Extraction** | Medium | 3 workers | 3 attempts, exponential backoff | extraction-dlq |
| **Notification** | Low | 10 workers | 2 attempts, linear backoff | notification-dlq |
| **Sync** | Medium | 2 workers | 5 attempts, exponential backoff | sync-dlq |

### Job Types
```typescript
interface ClassificationJob {
  type: 'CLASSIFY_EMAIL';
  emailId: string;
  userId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
}

interface ExtractionJob {
  type: 'EXTRACT_DATA';
  emailId: string;
  category: EmailCategory;
  userId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
}
```

### Error Handling Strategy
| Error Type | Retry Strategy | Escalation | User Impact |
|------------|----------------|------------|-------------|
| **API Rate Limit** | Exponential backoff (1m, 2m, 4m) | Admin notification | Processing delay |
| **Model Timeout** | Immediate retry with fallback model | Log warning | Reduced accuracy |
| **Invalid Input** | No retry, mark as failed | User notification | Manual review required |
| **Network Error** | Linear backoff (30s, 60s, 90s) | Auto-recovery | Temporary delay |
| **Quota Exceeded** | Pause until reset | Admin alert | Processing suspended |

## Performance Optimization

### Caching Strategy
| Cache Type | TTL | Invalidation | Purpose |
|------------|-----|--------------|---------|
| **Model Results** | 24 hours | On model update | Avoid re-processing identical content |
| **Feature Extraction** | 1 hour | On content change | Speed up classification |
| **Sender Reputation** | 6 hours | On new data | Improve classification accuracy |
| **Domain Patterns** | 12 hours | On pattern update | Enhance extraction rules |

### Batch Processing
| Operation | Batch Size | Frequency | Benefits |
|-----------|------------|-----------|----------|
| **Classification** | 10 emails | Every 30s | Reduced API calls |
| **Feature Extraction** | 20 emails | Every 60s | Improved throughput |
| **Notification Sending** | 50 notifications | Every 10s | Reduced overhead |
| **Database Updates** | 25 records | Every 15s | Improved I/O efficiency |

### Resource Management
```typescript
interface ResourceLimits {
  // Memory limits
  maxMemoryPerWorker: string;     // '512MB'
  maxTotalMemory: string;         // '2GB'
  
  // CPU limits
  maxCpuPerWorker: number;        // 0.5 cores
  maxTotalCpu: number;            // 2 cores
  
  // API limits
  openaiRequestsPerMinute: number; // 60
  gmailRequestsPerMinute: number;  // 250
  
  // Queue limits
  maxQueueSize: number;           // 1000
  maxJobAge: number;              // 24 hours
}
```

## Monitoring & Metrics

### Processing Metrics
| Metric | Purpose | Alert Threshold | Action |
|--------|---------|-----------------|--------|
| **Classification Accuracy** | Model performance | < 85% | Retrain model |
| **Extraction Accuracy** | Data quality | < 80% | Review extraction rules |
| **Processing Time** | Performance | > 30s average | Scale resources |
| **Queue Depth** | Backlog monitoring | > 100 jobs | Add workers |
| **Error Rate** | System health | > 5% | Investigate errors |
| **API Usage** | Cost control | > 80% quota | Throttle requests |

### Quality Metrics
```typescript
interface QualityMetrics {
  // Accuracy metrics
  classificationAccuracy: number;
  extractionAccuracy: number;
  humanOverrideRate: number;
  
  // Performance metrics
  averageProcessingTime: number;
  p95ProcessingTime: number;
  throughputPerHour: number;
  
  // Reliability metrics
  successRate: number;
  retryRate: number;
  deadLetterRate: number;
  
  // Cost metrics
  apiCallsPerEmail: number;
  costPerEmail: number;
  monthlyApiCost: number;
}
```

### Alerting Rules
| Alert | Condition | Severity | Recipients |
|-------|-----------|----------|------------|
| **High Error Rate** | Error rate > 10% for 5 minutes | Critical | Dev team + Admin |
| **Processing Delay** | Queue depth > 200 for 10 minutes | Warning | Dev team |
| **API Quota Warning** | Usage > 80% of daily quota | Warning | Admin |
| **Model Accuracy Drop** | Accuracy < 80% for 1 hour | Warning | ML team |
| **System Overload** | CPU > 90% for 5 minutes | Critical | DevOps team |

## Human-in-the-Loop Integration

### Review Interface Requirements
| Component | Purpose | Data Required | Actions Available |
|-----------|---------|---------------|-------------------|
| **Email Preview** | Show original email | Full email content + metadata | View attachments |
| **Classification Display** | Show AI classification | Category, confidence, reasoning | Override classification |
| **Extraction Display** | Show extracted data | Structured data + confidence | Edit extracted fields |
| **Validation Controls** | Human feedback | Current extraction | Approve/reject/modify |
| **Feedback Form** | Improvement data | User corrections | Submit feedback |

### Feedback Loop
| Feedback Type | Collection Method | Usage | Impact |
|---------------|------------------|-------|--------|
| **Classification Override** | User selects correct category | Model retraining data | Improved accuracy |
| **Extraction Correction** | User edits extracted fields | Validation rules update | Better extraction |
| **Confidence Feedback** | User rates AI confidence | Confidence calibration | More accurate thresholds |
| **Processing Time** | System measurement | Performance optimization | Faster processing |

### Learning Integration
```typescript
interface FeedbackData {
  emailId: string;
  originalClassification: Classification;
  userClassification?: Classification;
  originalExtraction: Extraction;
  userExtraction?: Extraction;
  userConfidenceRating: number;
  processingTime: number;
  userSatisfaction: number;
  comments?: string;
  timestamp: Date;
}
```