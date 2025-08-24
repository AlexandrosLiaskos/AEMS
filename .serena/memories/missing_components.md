# Missing Components Analysis

## Missing Services (High Priority)

### 1. ExtractionService
**Location**: `apps/backend/src/modules/ai/services/extraction.service.ts`
**Status**: Missing - imported in multiple files but doesn't exist
**Used by**:
- `extraction.resolver.ts`
- `ai.controller.ts` 
- `ai.service.ts`
- `ai.module.ts`

**Required Methods**:
- `correctField(id, fieldName, correctedValue, userId, reason)`
- `validateExtraction(id, isCorrect, userId, feedback)`

### 2. CostTrackingService
**Location**: `apps/backend/src/modules/ai/services/cost-tracking.service.ts`
**Status**: Missing - imported but doesn't exist
**Used by**:
- `ai.controller.ts`
- `ai.service.ts`
- `ai.module.ts`

### 3. Additional Missing Services
Based on imports in `ai.module.ts`:
- `PromptService` - AI prompt management
- `ValidationService` - Data validation
- `CacheService` - Caching layer

### 4. Missing Resolvers/Controllers
- `AIResolver` - GraphQL resolver for AI operations

## Production Setup Requirements

### 1. OS-Specific Data Directory Support
- Current: Uses `./data` relative path
- Needed: OS-specific app data directories
  - Windows: `%APPDATA%/AEMS`
  - macOS: `~/Library/Application Support/AEMS`
  - Linux: `~/.local/share/AEMS`

### 2. PKG Bundling Setup
- Need to configure `pkg` for creating executable bundles
- Target platforms: Windows, macOS, Linux
- Bundle both backend and frontend

### 3. Initial Setup Wizard
- For non-technical users
- GUI setup for:
  - OpenAI API key
  - Google OAuth credentials
  - Generate JWT secrets
  - Create initial .env file

### 4. Environment Configuration
- Auto-generate missing secrets
- Validate required configurations
- Handle missing .env gracefully