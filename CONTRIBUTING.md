# Contributing to AEMS

Thank you for your interest in contributing to AEMS (Automated Email Management System)! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Feature Requests](#feature-requests)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 18.0+ and npm 9.0+
- **Git** for version control
- **Google Cloud Console** account (for testing Gmail integration)
- **OpenAI API** key (for testing AI features)
- Basic knowledge of **TypeScript**, **NestJS**, and **React**

### First Contribution

1. **Star the repository** ⭐ to show your support
2. **Fork the repository** to your GitHub account
3. **Clone your fork** locally
4. **Set up the development environment**
5. **Find a good first issue** labeled with `good first issue`
6. **Make your changes** following our guidelines
7. **Submit a pull request**

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/yourusername/AEMS.git
cd AEMS

# Add the original repository as upstream
git remote add upstream https://github.com/AlexandrosLiaskos/AEMS.git
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all

# Verify installation
npm run build:check
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

### 4. Start Development

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend    # Backend on http://localhost:3001
npm run dev:frontend   # Frontend on http://localhost:3000
```

### 5. Verify Setup

```bash
# Run tests
npm run test

# Check code quality
npm run lint

# Type checking
npm run type-check
```

## Contributing Guidelines

### Branch Naming

Use descriptive branch names with prefixes:

```bash
feature/email-classification    # New features
fix/gmail-api-rate-limit       # Bug fixes
docs/api-documentation         # Documentation updates
refactor/auth-service          # Code refactoring
test/email-processing          # Test improvements
chore/dependency-updates       # Maintenance tasks
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Format
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# Examples
feat: add email classification with confidence scores
fix(auth): resolve JWT token refresh issue
docs: update installation instructions
style: format code with prettier
refactor(ai): improve error handling in classification service
test: add unit tests for email processing module
chore: update dependencies to latest versions

# Breaking changes
feat!: change API response format for email classification
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes
- **build**: Build system changes

## Code Standards

### TypeScript

- **Strict Mode**: All code must pass TypeScript strict mode
- **Type Safety**: Avoid `any` types, use proper interfaces
- **Naming**: Use PascalCase for classes, camelCase for variables/functions
- **Exports**: Use named exports over default exports

```typescript
// Good
export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  date: Date;
}

export class EmailService {
  async processEmail(email: EmailMessage): Promise<void> {
    // Implementation
  }
}

// Avoid
export default class EmailService {
  async processEmail(email: any): Promise<any> {
    // Implementation
  }
}
```

### Backend (NestJS)

- **Decorators**: Use appropriate NestJS decorators
- **Dependency Injection**: Leverage NestJS DI container
- **Error Handling**: Use proper exception filters
- **Validation**: Use class-validator for input validation
- **Documentation**: Add JSDoc comments for public methods

```typescript
@Injectable()
export class EmailService {
  constructor(
    private readonly gmailService: GmailService,
    private readonly aiService: AIService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Process email with AI classification
   * @param emailId - The email ID to process
   * @returns Promise<ProcessedEmail>
   */
  async processEmail(emailId: string): Promise<ProcessedEmail> {
    try {
      const email = await this.gmailService.getEmail(emailId);
      const classification = await this.aiService.classifyEmail(email);
      
      return {
        ...email,
        classification,
      };
    } catch (error) {
      this.logger.error(`Failed to process email ${emailId}`, error);
      throw new InternalServerErrorException('Email processing failed');
    }
  }
}
```

### Frontend (React)

- **Functional Components**: Use function components with hooks
- **TypeScript**: Proper typing for props and state
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Error Boundaries**: Implement error boundaries for error handling
- **Accessibility**: Follow WCAG guidelines

```typescript
interface EmailListProps {
  emails: EmailMessage[];
  onEmailSelect: (email: EmailMessage) => void;
  loading?: boolean;
}

export function EmailList({ emails, onEmailSelect, loading = false }: EmailListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleEmailClick = useCallback((email: EmailMessage) => {
    setSelectedId(email.id);
    onEmailSelect(email);
  }, [onEmailSelect]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="email-list" role="list">
      {emails.map((email) => (
        <EmailListItem
          key={email.id}
          email={email}
          selected={selectedId === email.id}
          onClick={() => handleEmailClick(email)}
        />
      ))}
    </div>
  );
}
```

### CSS/Styling

- **Tailwind CSS**: Use Tailwind utility classes
- **Component Classes**: Create reusable component classes
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Support both light and dark themes

```css
/* Component-specific styles in globals.css */
.email-list-item {
  @apply border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer;
}

.email-list-item.selected {
  @apply bg-primary/10 border-primary/20;
}

.email-list-item.unread {
  @apply bg-background border-l-4 border-l-primary font-semibold;
}
```

## Testing

### Test Structure

```
src/
├── __tests__/           # Test utilities and setup
├── module/
│   ├── service.ts
│   ├── service.spec.ts  # Unit tests
│   ├── controller.ts
│   └── controller.spec.ts
└── test/
    ├── integration/     # Integration tests
    └── e2e/            # End-to-end tests
```

### Unit Tests

```typescript
describe('EmailService', () => {
  let service: EmailService;
  let gmailService: jest.Mocked<GmailService>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: GmailService,
          useValue: {
            getEmail: jest.fn(),
          },
        },
        {
          provide: AIService,
          useValue: {
            classifyEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    gmailService = module.get(GmailService);
    aiService = module.get(AIService);
  });

  describe('processEmail', () => {
    it('should process email successfully', async () => {
      // Arrange
      const emailId = 'test-email-id';
      const mockEmail = { id: emailId, subject: 'Test' };
      const mockClassification = { category: 'business', confidence: 0.9 };

      gmailService.getEmail.mockResolvedValue(mockEmail);
      aiService.classifyEmail.mockResolvedValue(mockClassification);

      // Act
      const result = await service.processEmail(emailId);

      // Assert
      expect(result).toEqual({
        ...mockEmail,
        classification: mockClassification,
      });
      expect(gmailService.getEmail).toHaveBeenCalledWith(emailId);
      expect(aiService.classifyEmail).toHaveBeenCalledWith(mockEmail);
    });
  });
});
```

### Integration Tests

```typescript
describe('Email Processing Integration', () => {
  let app: INestApplication;
  let emailService: EmailService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    emailService = app.get<EmailService>(EmailService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should process email end-to-end', async () => {
    // Test with real services but mocked external APIs
  });
});
```

### Frontend Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmailList } from './EmailList';

const mockEmails = [
  { id: '1', subject: 'Test Email 1', from: 'test1@example.com' },
  { id: '2', subject: 'Test Email 2', from: 'test2@example.com' },
];

describe('EmailList', () => {
  it('renders email list correctly', () => {
    const onEmailSelect = jest.fn();
    
    render(<EmailList emails={mockEmails} onEmailSelect={onEmailSelect} />);
    
    expect(screen.getByText('Test Email 1')).toBeInTheDocument();
    expect(screen.getByText('Test Email 2')).toBeInTheDocument();
  });

  it('calls onEmailSelect when email is clicked', async () => {
    const onEmailSelect = jest.fn();
    
    render(<EmailList emails={mockEmails} onEmailSelect={onEmailSelect} />);
    
    fireEvent.click(screen.getByText('Test Email 1'));
    
    await waitFor(() => {
      expect(onEmailSelect).toHaveBeenCalledWith(mockEmails[0]);
    });
  });
});
```

### Test Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- email.service.spec.ts

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

## Documentation

### Code Documentation

- **JSDoc Comments**: Document all public methods and classes
- **Type Definitions**: Provide clear interfaces and types
- **README Updates**: Update relevant README sections
- **API Documentation**: Update GraphQL schema documentation

```typescript
/**
 * Service for processing emails with AI classification and data extraction
 * 
 * @example
 * ```typescript
 * const emailService = new EmailService(gmailService, aiService);
 * const result = await emailService.processEmail('email-id');
 * ```
 */
@Injectable()
export class EmailService {
  /**
   * Process an email with AI classification
   * 
   * @param emailId - The unique identifier of the email to process
   * @param options - Processing options
   * @param options.skipClassification - Skip AI classification step
   * @param options.extractData - Enable data extraction
   * @returns Promise that resolves to processed email with classification
   * 
   * @throws {NotFoundException} When email is not found
   * @throws {InternalServerErrorException} When processing fails
   */
  async processEmail(
    emailId: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessedEmail> {
    // Implementation
  }
}
```

### Documentation Updates

When adding features, update:

- **README.md** - Installation, usage, and feature descriptions
- **API Documentation** - GraphQL schema and REST endpoints
- **Architecture Docs** - System design and data flow
- **Deployment Guides** - Production setup instructions

## Pull Request Process

### Before Submitting

1. **Sync with upstream**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **Run quality checks**
   ```bash
   npm run lint
   npm run type-check
   npm run test
   npm run build
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Template

When creating a PR, use this template:

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented, particularly in hard-to-understand areas
- [ ] Documentation updated
- [ ] No new warnings or errors introduced
- [ ] Tests added for new functionality
- [ ] All checks pass

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information or context.
```

### Review Process

1. **Automated Checks** - CI/CD pipeline runs tests and quality checks
2. **Code Review** - Maintainers review code for quality and standards
3. **Feedback** - Address any requested changes
4. **Approval** - PR approved by maintainers
5. **Merge** - Squash and merge into main branch

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
A clear and concise description of the bug.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. macOS 13.0]
- Node.js: [e.g. 18.17.0]
- Browser: [e.g. Chrome 115.0]
- AEMS Version: [e.g. 2.0.0]

**Additional Context**
Add any other context about the problem here.

**Logs**
```
Paste relevant logs here
```
```

### Security Issues

For security vulnerabilities:

1. **Do NOT** create a public issue
2. **Email** security@aems.example.com
3. **Include** detailed description and reproduction steps
4. **Wait** for acknowledgment before public disclosure

## Feature Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Use Cases**
Describe specific use cases for this feature.

**Additional Context**
Add any other context or screenshots about the feature request.

**Implementation Ideas**
If you have ideas about how to implement this feature, please share them.
```

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and community discussions
- **Discord** - Real-time chat and community support
- **Email** - Direct contact for sensitive issues

### Getting Help

1. **Check Documentation** - README and docs folder
2. **Search Issues** - Existing issues and discussions
3. **Ask Questions** - GitHub Discussions or Discord
4. **Report Bugs** - GitHub Issues with proper template

### Recognition

Contributors are recognized in:

- **README.md** - Contributors section
- **Release Notes** - Feature and fix attributions
- **Hall of Fame** - Top contributors page
- **Discord Roles** - Special contributor roles

## Development Tips

### Useful Commands

```bash
# Development
npm run dev:debug          # Start with debugging enabled
npm run dev:watch          # Watch mode with auto-restart

# Code Quality
npm run lint:fix           # Auto-fix linting issues
npm run format             # Format code with Prettier
npm run type-check:watch   # Watch mode type checking

# Database
npm run db:reset           # Reset database to initial state
npm run db:seed            # Seed with test data
npm run db:backup          # Create backup

# Testing
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # End-to-end tests only
npm run test:debug         # Debug test mode

# Analysis
npm run analyze            # Bundle analysis
npm run audit              # Security audit
npm run outdated           # Check outdated dependencies
```

### IDE Setup

#### VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-jest",
    "GraphQL.vscode-graphql",
    "ms-vscode.vscode-json"
  ]
}
```

#### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "jest.autoRun": "watch"
}
```

### Common Patterns

#### Error Handling

```typescript
// Backend
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  this.logger.error('Operation failed', error);
  throw new InternalServerErrorException('Operation failed');
}

// Frontend
const [data, setData] = useState(null);
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    const result = await api.getData();
    setData(result);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

#### State Management

```typescript
// Context pattern
const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function useEmails() {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmails must be used within EmailProvider');
  }
  return context;
}

// Custom hooks
export function useEmailProcessing() {
  const [processing, setProcessing] = useState(false);
  
  const processEmail = useCallback(async (emailId: string) => {
    setProcessing(true);
    try {
      await emailService.processEmail(emailId);
    } finally {
      setProcessing(false);
    }
  }, []);
  
  return { processing, processEmail };
}
```

Thank you for contributing to AEMS! Your contributions help make email management more intelligent and accessible for everyone. 🚀