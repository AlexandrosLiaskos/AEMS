# Suggested Commands for AEMS Development

## Development Commands

### Project Setup
```bash
# Install all dependencies
npm install

# Install workspace dependencies (if using workspaces)
npm run install:all
```

### Development Servers
```bash
# Start both backend and frontend
npm run dev

# Start backend only (NestJS)
npm run dev:backend
# Backend runs on: http://localhost:3001
# GraphQL Playground: http://localhost:3001/graphql

# Start frontend only (React + Vite)
npm run dev:frontend  
# Frontend runs on: http://localhost:3000
```

### Building
```bash
# Build all applications
npm run build

# Build backend only
npm run build:backend

# Build frontend only  
npm run build:frontend
```

### Testing
```bash
# Run all tests
npm run test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run with coverage
npm run test:coverage
```

### Code Quality
```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# TypeScript type checking
npm run type-check
```

### Production
```bash
# Start production server
npm run start:prod

# Build for production
NODE_ENV=production npm run build
```

## System Commands (Linux)

### File Operations
```bash
ls -la          # List files with details
find . -name    # Find files by name
grep -r         # Search in files recursively
```

### Process Management
```bash
ps aux          # List running processes
kill -9 <pid>   # Kill process by ID
```

### System Info
```bash
df -h           # Disk usage
free -h         # Memory usage
top             # System monitor
```