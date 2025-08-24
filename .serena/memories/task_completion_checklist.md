# Task Completion Checklist

## Before Committing Code

### 1. Code Quality Checks
```bash
# Run linting
npm run lint

# Fix any linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### 2. Testing
```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Ensure coverage meets requirements (>80%)
```

### 3. Build Verification
```bash
# Verify backend builds
npm run build:backend

# Verify frontend builds  
npm run build:frontend

# Test production build
npm run build
```

### 4. Documentation Updates
- [ ] Update relevant documentation files
- [ ] Add/update function documentation
- [ ] Update API documentation if needed
- [ ] Update README if new features added

### 5. Database/Storage Considerations
- [ ] Verify JSON file storage compatibility
- [ ] Test data migration if schema changed
- [ ] Ensure backup compatibility

## Production Deployment Checklist

### 1. Environment Configuration
- [ ] All required environment variables set
- [ ] Secrets properly generated and secured
- [ ] Database path configured for production
- [ ] Logging configured appropriately

### 2. Security Review
- [ ] No hardcoded secrets in code
- [ ] JWT secrets are strong and unique
- [ ] OAuth credentials properly configured
- [ ] CORS settings appropriate for production

### 3. Performance Verification
- [ ] No memory leaks in long-running processes
- [ ] Proper error handling and logging
- [ ] Rate limiting configured
- [ ] File system permissions correct

### 4. User Experience
- [ ] Initial setup wizard tested
- [ ] Error messages are user-friendly
- [ ] All required features working
- [ ] Performance acceptable for end users

## Git Workflow

### Commit Message Format
```
type(scope): brief description

Longer description if needed

- List any breaking changes
- Reference any issues: Fixes #123
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes