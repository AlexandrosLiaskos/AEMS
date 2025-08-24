# Authentication & Security

## Authentication Flow

### Google OAuth2 Flow
| Step | Actor | Action | Details |
|------|-------|--------|---------|
| 1 | User | Click "Sign in with Google" | Frontend redirects to `/auth/google` |
| 2 | Backend | Redirect to Google OAuth | Uses Passport GoogleStrategy |
| 3 | Google | User authorizes application | Grants access to Gmail and profile |
| 4 | Google | Redirect to callback | Sends authorization code |
| 5 | Backend | Exchange code for tokens | Gets access_token, refresh_token |
| 6 | Backend | Create/update user record | Store encrypted tokens |
| 7 | Backend | Generate JWT tokens | Create access_token, refresh_token |
| 8 | Backend | Redirect to frontend | With JWT tokens in secure cookies |

### JWT Token Management
| Token Type | Purpose | Expiry | Storage | Refresh Strategy |
|------------|---------|--------|---------|------------------|
| **Access Token** | API authentication | 15 minutes | HTTP-only cookie | Auto-refresh on expiry |
| **Refresh Token** | Token renewal | 7 days | HTTP-only cookie | Rotate on use |
| **Gmail Access Token** | Gmail API calls | 1 hour | Encrypted in database | Auto-refresh via refresh_token |
| **Gmail Refresh Token** | Gmail token renewal | No expiry | Encrypted in database | Long-lived |

## Security Configuration

### JWT Configuration
```typescript
interface JWTConfig {
  accessTokenSecret: string;      // 256-bit secret
  refreshTokenSecret: string;     // 256-bit secret
  accessTokenExpiry: string;      // '15m'
  refreshTokenExpiry: string;     // '7d'
  issuer: string;                 // 'aems-backend'
  audience: string;               // 'aems-frontend'
}
```

### Google OAuth2 Configuration
```typescript
interface GoogleOAuthConfig {
  clientId: string;               // Google Client ID
  clientSecret: string;           // Google Client Secret
  redirectUri: string;            // OAuth callback URL
  scope: string[];                // ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly']
}
```

### Session Configuration
```typescript
interface SessionConfig {
  secret: string;                 // Session secret
  resave: boolean;                // false
  saveUninitialized: boolean;     // false
  cookie: {
    secure: boolean;              // true in production
    httpOnly: boolean;            // true
    sameSite: 'strict';           // CSRF protection
    maxAge: number;               // 7 days
  };
}
```

## Authentication Guards

### JwtAuthGuard
| Property | Value | Purpose |
|----------|-------|---------|
| **Strategy** | JWT | Validate JWT access tokens |
| **Token Source** | HTTP-only cookie | Secure token storage |
| **Validation** | Signature + expiry | Ensure token integrity |
| **User Context** | Inject user into request | Available in resolvers/controllers |
| **Error Handling** | 401 Unauthorized | Clear error responses |

### GoogleOAuthGuard
| Property | Value | Purpose |
|----------|-------|---------|
| **Strategy** | Google OAuth2 | Handle OAuth flow |
| **Scope** | Profile + Gmail | Required permissions |
| **Callback Handling** | Create/update user | User management |
| **Token Storage** | Encrypted database | Secure token persistence |
| **Error Handling** | Redirect with error | User-friendly errors |

### OptionalAuthGuard
| Property | Value | Purpose |
|----------|-------|---------|
| **Strategy** | JWT (optional) | Optional authentication |
| **Use Case** | Public endpoints with user context | Enhanced experience for logged-in users |
| **Fallback** | Anonymous access | Graceful degradation |

## Authorization System

### Role-Based Access Control (RBAC)
| Role | Permissions | Description |
|------|-------------|-------------|
| **User** | Own emails, own settings | Standard user permissions |
| **Admin** | All emails, system settings | Administrative access |
| **System** | Internal operations | Service-to-service calls |

### Resource-Based Permissions
| Resource | Permission | Check |
|----------|------------|-------|
| **Email** | Read | User owns email OR admin |
| **Email** | Update | User owns email OR admin |
| **Email** | Delete | User owns email OR admin |
| **Workflow** | Transition | User owns email + valid transition |
| **Settings** | Read | User owns settings OR admin |
| **Settings** | Update | User owns settings OR admin |
| **System** | Monitor | Admin only |

### Permission Guards
```typescript
@UseGuards(JwtAuthGuard, EmailOwnershipGuard)
@Query(() => Email)
async email(@Args('id') id: string, @CurrentUser() user: User) {
  // User can only access their own emails
}

@UseGuards(JwtAuthGuard, WorkflowPermissionGuard)
@Mutation(() => Email)
async transitionEmailState(
  @Args('emailId') emailId: string,
  @Args('newState') newState: WorkflowState,
  @CurrentUser() user: User
) {
  // User can only transition emails they own with valid transitions
}
```

## Security Measures

### Input Validation
| Layer | Technology | Purpose |
|-------|------------|---------|
| **DTO Validation** | class-validator | Validate request structure |
| **GraphQL Validation** | GraphQL schema | Type and field validation |
| **Database Validation** | TypeORM | Entity constraints |
| **Business Logic** | Custom validators | Domain-specific rules |

### Data Protection
| Measure | Implementation | Purpose |
|---------|----------------|---------|
| **Encryption at Rest** | AES-256 | Encrypt sensitive data |
| **Encryption in Transit** | TLS 1.3 | Secure communication |
| **Token Encryption** | JWT + AES | Secure token storage |
| **Password Hashing** | bcrypt | Secure password storage |
| **Data Sanitization** | DOMPurify | Prevent XSS attacks |

### Rate Limiting
| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| **Authentication** | 5 attempts | 15 minutes | Prevent brute force |
| **Password Reset** | 3 attempts | 1 hour | Prevent abuse |
| **Gmail Sync** | 10 requests | 1 hour | API quota management |
| **GraphQL** | 100 requests | 1 minute | General protection |
| **File Upload** | 5 uploads | 5 minutes | Resource protection |

### CORS Configuration
```typescript
interface CORSConfig {
  origin: string[];               // Allowed origins
  credentials: boolean;           // true - allow cookies
  methods: string[];              // ['GET', 'POST', 'PUT', 'DELETE']
  allowedHeaders: string[];       // ['Content-Type', 'Authorization']
  exposedHeaders: string[];       // ['X-Total-Count']
  maxAge: number;                 // 86400 (24 hours)
}
```

### Content Security Policy (CSP)
```typescript
interface CSPConfig {
  defaultSrc: string[];           // ["'self'"]
  scriptSrc: string[];            // ["'self'", "'unsafe-inline'"]
  styleSrc: string[];             // ["'self'", "'unsafe-inline'"]
  imgSrc: string[];               // ["'self'", "data:", "https:"]
  connectSrc: string[];           // ["'self'"]
  fontSrc: string[];              // ["'self'"]
  objectSrc: string[];            // ["'none'"]
  mediaSrc: string[];             // ["'self'"]
  frameSrc: string[];             // ["'none'"]
}
```

## Token Management

### JWT Payload Structure
```typescript
interface JWTPayload {
  sub: string;                    // User ID
  email: string;                  // User email
  name: string;                   // User name
  role: string;                   // User role
  iat: number;                    // Issued at
  exp: number;                    // Expires at
  iss: string;                    // Issuer
  aud: string;                    // Audience
}
```

### Token Refresh Flow
| Step | Action | Details |
|------|--------|---------|
| 1 | Access token expires | 401 Unauthorized response |
| 2 | Frontend detects expiry | Automatic refresh attempt |
| 3 | Send refresh token | POST /auth/refresh |
| 4 | Validate refresh token | Check signature and expiry |
| 5 | Generate new tokens | New access + refresh tokens |
| 6 | Update cookies | Set new HTTP-only cookies |
| 7 | Retry original request | With new access token |

### Token Revocation
| Scenario | Action | Implementation |
|----------|--------|----------------|
| **User Logout** | Revoke all tokens | Clear cookies + blacklist tokens |
| **Password Change** | Revoke all tokens | Force re-authentication |
| **Suspicious Activity** | Revoke all tokens | Security measure |
| **Token Compromise** | Revoke specific token | Blacklist compromised token |

## Audit & Monitoring

### Security Events
| Event | Log Level | Details |
|-------|-----------|---------|
| **Login Success** | INFO | User, IP, timestamp |
| **Login Failure** | WARN | Email, IP, reason |
| **Token Refresh** | INFO | User, IP, timestamp |
| **Permission Denied** | WARN | User, resource, action |
| **Rate Limit Hit** | WARN | IP, endpoint, count |
| **Suspicious Activity** | ERROR | User, IP, details |

### Audit Log Structure
```typescript
interface SecurityAuditLog {
  id: string;
  userId?: string;
  action: string;                 // 'LOGIN', 'LOGOUT', 'TOKEN_REFRESH'
  resource?: string;              // Resource accessed
  success: boolean;               // Operation success
  ipAddress: string;              // Client IP
  userAgent: string;              // Client user agent
  details: Record<string, any>;   // Additional context
  timestamp: Date;                // Event timestamp
}
```

### Security Metrics
| Metric | Purpose | Alert Threshold |
|--------|---------|-----------------|
| **Failed Login Rate** | Detect brute force | >10 failures/minute |
| **Token Refresh Rate** | Detect token abuse | >100 refreshes/hour |
| **Permission Denials** | Detect privilege escalation | >50 denials/hour |
| **Rate Limit Hits** | Detect DoS attempts | >1000 hits/minute |
| **Suspicious IPs** | Detect malicious activity | Geo-location anomalies |

## Environment Security

### Development Environment
| Setting | Value | Purpose |
|---------|-------|---------|
| **HTTPS** | Optional | Development convenience |
| **JWT Secret** | Development key | Non-production secret |
| **CORS** | Permissive | Allow localhost origins |
| **Logging** | Verbose | Debug information |
| **Rate Limiting** | Relaxed | Development convenience |

### Production Environment
| Setting | Value | Purpose |
|---------|-------|---------|
| **HTTPS** | Required | Secure communication |
| **JWT Secret** | 256-bit random | Production security |
| **CORS** | Restrictive | Only allowed origins |
| **Logging** | Structured | Security monitoring |
| **Rate Limiting** | Strict | Production protection |

### Environment Variables
```bash
# Authentication
JWT_ACCESS_SECRET=<256-bit-secret>
JWT_REFRESH_SECRET=<256-bit-secret>
SESSION_SECRET=<256-bit-secret>

# Google OAuth
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=<callback-url>

# Security
ENCRYPTION_KEY=<256-bit-encryption-key>
ALLOWED_ORIGINS=<comma-separated-origins>
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Database
DATABASE_ENCRYPTION_KEY=<database-encryption-key>
```