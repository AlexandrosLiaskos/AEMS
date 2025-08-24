# Data Storage & Management

## JSON File Storage Architecture

### Storage Strategy
| Aspect | Implementation | Rationale |
|--------|----------------|-----------|
| **Storage Type** | JSON files on local filesystem | Zero-cost hosting, full data ownership |
| **File Organization** | Entity-based files with partitioning | Performance and maintainability |
| **Consistency** | Atomic writes with file locking | Data integrity |
| **Backup Strategy** | Automated incremental backups | Data protection |
| **Scalability** | Horizontal partitioning | Handle growth |

### File Structure
```
data/
├── users/
│   ├── users.json                 # User entities
│   └── sessions.json              # User sessions
├── emails/
│   ├── {userId}/
│   │   ├── fetched.json          # Fetched emails
│   │   ├── processing.json       # Processing emails
│   │   ├── review.json           # Review emails
│   │   ├── managed.json          # Managed emails
│   │   └── deleted.json          # Soft-deleted emails
│   └── attachments/
│       └── {userId}/
│           └── {emailId}/
│               └── {attachmentId}.{ext}
├── ai/
│   ├── classifications.json       # AI classifications
│   ├── extractions.json          # AI extractions
│   └── models.json               # AI model metadata
├── workflow/
│   ├── states.json               # Workflow states
│   ├── transitions.json          # State transitions
│   └── approvals.json            # Approval requests
├── notifications/
│   └── {userId}.json             # User notifications
├── audit/
│   ├── {year}/
│   │   └── {month}/
│   │       └── audit-{day}.json  # Daily audit logs
├── settings/
│   ├── system.json               # System settings
│   └── user-preferences.json     # User preferences
└── backups/
    ├── incremental/
    │   └── {timestamp}/
    └── full/
        └── {timestamp}/
```

## Data Partitioning Strategy

### Email Partitioning
| Partition Key | Strategy | Benefits | Limitations |
|---------------|----------|----------|-------------|
| **User ID** | Separate files per user | User isolation, parallel processing | Large users may have large files |
| **Workflow State** | Separate files per state | State-based queries, smaller files | Cross-state queries require multiple files |
| **Date Range** | Monthly/yearly partitions | Time-based queries, archive old data | Complex date range queries |
| **Category** | Separate files per category | Category-based analytics | Category changes require file moves |

### Partition Size Management
| File Type | Target Size | Split Threshold | Merge Threshold |
|-----------|-------------|-----------------|-----------------|
| **Email Files** | 10-50 MB | 100 MB | 1 MB |
| **Audit Logs** | 5-20 MB | 50 MB | 500 KB |
| **Notifications** | 1-5 MB | 10 MB | 100 KB |
| **Metadata Files** | 100 KB - 1 MB | 5 MB | 10 KB |

## TypeORM JSON Adapter

### Custom DataSource Implementation
```typescript
class JsonFileDataSource extends DataSource {
  private fileManager: FileManager;
  private lockManager: LockManager;
  private cacheManager: CacheManager;
  
  async initialize(): Promise<void> {
    // Initialize file system structure
    // Set up file locks
    // Initialize cache
  }
  
  async query(sql: string, parameters?: any[]): Promise<any> {
    // Convert SQL to file operations
    // Handle joins across files
    // Return results in expected format
  }
  
  async save<Entity>(entity: Entity): Promise<Entity> {
    // Determine target file
    // Acquire file lock
    // Perform atomic write
    // Update cache
    // Release lock
  }
}
```

### Entity-to-File Mapping
| Entity | File Pattern | Indexing | Caching |
|--------|--------------|----------|---------|
| **User** | `users/users.json` | By ID, email | 1 hour TTL |
| **EmailMessage** | `emails/{userId}/{state}.json` | By ID, date, category | 30 minutes TTL |
| **Classification** | `ai/classifications.json` | By emailId | 2 hours TTL |
| **Extraction** | `ai/extractions.json` | By emailId | 2 hours TTL |
| **Notification** | `notifications/{userId}.json` | By ID, timestamp | 15 minutes TTL |
| **AuditLog** | `audit/{year}/{month}/audit-{day}.json` | By timestamp, userId | No cache |

### Query Translation
| TypeORM Query | File Operation | Performance | Limitations |
|---------------|----------------|-------------|-------------|
| `findOne({ id })` | Direct object lookup | O(1) with index | None |
| `find({ where })` | Filter array | O(n) | Large datasets |
| `find({ order })` | Sort array | O(n log n) | Memory usage |
| `find({ relations })` | Cross-file lookup | O(m) | Multiple file reads |
| `count()` | Array length | O(1) | None |
| `delete()` | Soft delete flag | O(1) | Cleanup required |

## File Operations & Concurrency

### Atomic Write Operations
```typescript
interface AtomicWriteOperation {
  acquireLock(filePath: string): Promise<FileLock>;
  readFile(filePath: string): Promise<any[]>;
  validateData(data: any[]): boolean;
  writeTemporary(data: any[], tempPath: string): Promise<void>;
  atomicMove(tempPath: string, finalPath: string): Promise<void>;
  releaseLock(lock: FileLock): Promise<void>;
}
```

### Concurrency Control
| Mechanism | Implementation | Use Case | Performance Impact |
|-----------|----------------|----------|-------------------|
| **File Locking** | OS-level file locks | Write operations | Low |
| **Read-Write Locks** | Custom implementation | Concurrent reads | Medium |
| **Optimistic Locking** | Version numbers | Conflict detection | Low |
| **Transaction Log** | Write-ahead logging | Crash recovery | Medium |

### Lock Management
| Lock Type | Scope | Duration | Timeout |
|-----------|-------|----------|---------|
| **Exclusive Write** | Single file | Write operation | 30 seconds |
| **Shared Read** | Single file | Read operation | 10 seconds |
| **Cross-File** | Multiple files | Transaction | 60 seconds |
| **Backup Lock** | Entire data directory | Backup operation | 5 minutes |

## Caching Layer

### Cache Architecture
| Cache Level | Technology | TTL | Size Limit | Eviction Policy |
|-------------|------------|-----|------------|-----------------|
| **L1 - Memory** | Map/WeakMap | 5-60 minutes | 100 MB | LRU |
| **L2 - Redis** | Redis (optional) | 1-24 hours | 500 MB | LRU |
| **L3 - File System** | OS page cache | OS managed | OS managed | OS managed |

### Cache Strategies
| Data Type | Strategy | Invalidation | Warming |
|-----------|----------|--------------|---------|
| **User Data** | Cache-aside | On update | On login |
| **Email Lists** | Write-through | On email change | Background |
| **Metadata** | Write-behind | Time-based | Startup |
| **Search Results** | Cache-aside | On data change | On search |

### Cache Key Patterns
```typescript
interface CacheKeyPatterns {
  user: (id: string) => `user:${id}`;
  userEmails: (userId: string, state: string) => `emails:${userId}:${state}`;
  emailDetails: (id: string) => `email:${id}`;
  searchResults: (query: string, filters: string) => `search:${hash(query + filters)}`;
  aggregations: (type: string, period: string) => `agg:${type}:${period}`;
}
```

## Backup & Recovery

### Backup Strategy
| Backup Type | Frequency | Retention | Storage Location | Compression |
|-------------|-----------|-----------|------------------|-------------|
| **Incremental** | Every 15 minutes | 7 days | Local + Cloud | gzip |
| **Daily Full** | Daily at 2 AM | 30 days | Local + Cloud | gzip |
| **Weekly Archive** | Weekly | 1 year | Cloud only | tar.gz |
| **Monthly Archive** | Monthly | 5 years | Cold storage | tar.gz |

### Backup Process
| Step | Action | Validation | Error Handling |
|------|--------|------------|----------------|
| 1 | **Acquire Global Lock** | Ensure no writes | Timeout after 5 minutes |
| 2 | **Create Snapshot** | Copy all data files | Verify file integrity |
| 3 | **Compress Archive** | gzip compression | Check compression ratio |
| 4 | **Calculate Checksums** | SHA-256 hashes | Store in manifest |
| 5 | **Upload to Storage** | Cloud storage | Retry with exponential backoff |
| 6 | **Verify Upload** | Download and compare | Alert on failure |
| 7 | **Release Lock** | Allow writes | Log completion |
| 8 | **Cleanup Old Backups** | Apply retention policy | Preserve on error |

### Recovery Procedures
| Scenario | Recovery Method | RTO | RPO | Validation |
|----------|-----------------|-----|-----|------------|
| **File Corruption** | Restore from latest backup | 5 minutes | 15 minutes | Checksum verification |
| **Accidental Deletion** | Selective restore | 10 minutes | 15 minutes | Data integrity check |
| **System Failure** | Full system restore | 30 minutes | 15 minutes | Full system test |
| **Data Center Loss** | Cloud backup restore | 2 hours | 24 hours | Complete validation |

### Backup Integrity
```typescript
interface BackupManifest {
  timestamp: Date;
  backupType: 'INCREMENTAL' | 'FULL' | 'ARCHIVE';
  files: {
    path: string;
    size: number;
    checksum: string;
    lastModified: Date;
  }[];
  totalSize: number;
  compressionRatio: number;
  encryptionKey?: string;
  metadata: {
    version: string;
    creator: string;
    description?: string;
  };
}
```

## Data Migration & Versioning

### Schema Versioning
| Version | Changes | Migration Required | Backward Compatible |
|---------|---------|-------------------|-------------------|
| **1.0** | Initial schema | N/A | N/A |
| **1.1** | Add email tags field | Yes | Yes |
| **1.2** | Restructure workflow states | Yes | No |
| **2.0** | New AI extraction format | Yes | No |

### Migration Framework
```typescript
interface Migration {
  version: string;
  description: string;
  up: (data: any) => Promise<any>;
  down: (data: any) => Promise<any>;
  validate: (data: any) => boolean;
}

class MigrationRunner {
  async runMigrations(targetVersion: string): Promise<void> {
    // Get current version
    // Find required migrations
    // Create backup
    // Run migrations in order
    // Validate results
    // Update version
  }
}
```

### Data Validation
| Validation Type | Frequency | Scope | Action on Failure |
|-----------------|-----------|-------|-------------------|
| **Schema Validation** | On read/write | Individual records | Log error, use defaults |
| **Referential Integrity** | Daily | Cross-file references | Generate report |
| **Data Consistency** | Weekly | Full dataset | Alert administrators |
| **Backup Integrity** | On backup | Backup files | Retry backup |

## Performance Optimization

### File I/O Optimization
| Technique | Implementation | Benefits | Trade-offs |
|-----------|----------------|----------|------------|
| **Batch Operations** | Group multiple writes | Reduced I/O overhead | Increased memory usage |
| **Lazy Loading** | Load data on demand | Faster startup | Slower first access |
| **Streaming** | Process large files in chunks | Lower memory usage | More complex code |
| **Compression** | gzip for large files | Reduced storage | CPU overhead |

### Index Management
```typescript
interface FileIndex {
  filePath: string;
  indexes: {
    [fieldName: string]: {
      [value: string]: number[];  // Array of record positions
    };
  };
  lastUpdated: Date;
  recordCount: number;
}
```

### Query Optimization
| Query Pattern | Optimization | Performance Gain | Implementation |
|---------------|--------------|------------------|----------------|
| **ID Lookup** | Hash index | O(1) vs O(n) | In-memory map |
| **Range Queries** | Sorted index | O(log n) vs O(n) | B-tree structure |
| **Text Search** | Inverted index | O(k) vs O(n) | Elasticsearch-like |
| **Aggregations** | Pre-computed | O(1) vs O(n) | Background jobs |

## Monitoring & Maintenance

### Storage Metrics
| Metric | Purpose | Alert Threshold | Action |
|--------|---------|-----------------|--------|
| **Disk Usage** | Capacity planning | > 80% | Archive old data |
| **File Count** | Performance monitoring | > 10,000 files | Partition data |
| **Average File Size** | Optimization | > 100 MB | Split large files |
| **I/O Wait Time** | Performance | > 100ms average | Optimize queries |
| **Lock Contention** | Concurrency | > 10 waits/minute | Review locking strategy |

### Maintenance Tasks
| Task | Frequency | Purpose | Duration |
|------|-----------|---------|----------|
| **Index Rebuild** | Weekly | Query performance | 10-30 minutes |
| **File Compaction** | Monthly | Storage optimization | 1-2 hours |
| **Orphan Cleanup** | Daily | Data consistency | 5-10 minutes |
| **Archive Old Data** | Quarterly | Storage management | 2-4 hours |
| **Integrity Check** | Weekly | Data validation | 30-60 minutes |

### Health Monitoring
```typescript
interface StorageHealth {
  diskUsage: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  fileMetrics: {
    totalFiles: number;
    averageSize: number;
    largestFile: number;
    oldestFile: Date;
  };
  performance: {
    averageReadTime: number;
    averageWriteTime: number;
    lockWaitTime: number;
    cacheHitRate: number;
  };
  integrity: {
    lastCheck: Date;
    corruptedFiles: number;
    missingReferences: number;
    inconsistencies: number;
  };
}
```