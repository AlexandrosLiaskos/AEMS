# Code Style and Conventions

## File Naming Conventions

### Backend (NestJS)
- **Services**: `domain.service.ts` (e.g., `email.service.ts`)
- **Controllers**: `domain.controller.ts` (e.g., `email.controller.ts`)
- **Entities**: `domain.entity.ts` (e.g., `email-message.entity.ts`)
- **DTOs**: `domain.dto.ts` (e.g., `ai.dto.ts`)
- **Modules**: `domain.module.ts` (e.g., `ai.module.ts`)
- **Resolvers**: `domain.resolver.ts` (e.g., `extraction.resolver.ts`)

### Frontend (React)
- **Components**: `ComponentName.tsx` (PascalCase)
- **Pages**: `page-name-page.tsx` (kebab-case with -page suffix)
- **Hooks**: `useSomething.ts` (camelCase with use prefix)
- **Services**: `service-name.ts` (kebab-case)
- **Utils**: `util-name.ts` (kebab-case)

## Code Element Naming

### TypeScript/JavaScript
- **Functions**: `camelCase` - verb-based, descriptive
- **Variables**: `camelCase` - descriptive, semantic
- **Constants**: `UPPER_SNAKE_CASE` - module-level constants
- **Classes**: `PascalCase` - clear, descriptive
- **Interfaces**: `PascalCase` - no 'I' prefix
- **Types**: `PascalCase` - union types, aliases
- **Enums**: `PascalCase` - enum names
- **Enum Values**: `UPPER_SNAKE_CASE` - enum members

### GraphQL
- **Queries**: `camelCase` - noun-based (e.g., `emails`, `user`)
- **Mutations**: `camelCase` - verb-based (e.g., `createEmail`)
- **Subscriptions**: `camelCase` - event-based (e.g., `emailUpdates`)
- **Input Types**: `PascalCase` + `Input` suffix
- **Object Types**: `PascalCase` - domain objects

## Documentation Standards

### Function Documentation
```typescript
/**
 * @method functionName
 * @purpose Brief description of what the function does
 * @param paramName - Description of parameter
 * @returns Description of return value
 */
```

### Class Documentation
```typescript
/**
 * @class ClassName
 * @purpose Brief description of class responsibility
 */
```

### Interface Documentation
```typescript
/**
 * @interface InterfaceName
 * @purpose Description of interface purpose
 */
```

## Code Organization

### Module Structure
- Each domain has its own module directory
- Services contain business logic
- Controllers handle HTTP requests
- Resolvers handle GraphQL operations
- DTOs define data transfer objects
- Entities define data models

### Import Organization
1. Node.js built-in modules
2. Third-party packages
3. NestJS framework imports
4. Local application imports (services, entities, etc.)
5. Type-only imports at the end