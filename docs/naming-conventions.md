# Naming Conventions

## File & Directory Naming

| Type | Convention | Example | Notes |
|------|------------|---------|-------|
| **Services** | `domain.service.ts` | `email.service.ts` | Business logic |
| **Controllers** | `domain.controller.ts` | `email.controller.ts` | API endpoints |
| **Entities** | `domain.entity.ts` | `email.entity.ts` | Database models |
| **Types** | `domain.types.ts` | `email.types.ts` | TypeScript definitions |
| **Constants** | `domain.constants.ts` | `email.constants.ts` | Static values |
| **Utils** | `domain.utils.ts` | `email.utils.ts` | Helper functions |
| **Components** | `ComponentName.tsx` | `EmailTable.tsx` | React components |
| **Pages** | `PageName.tsx` | `EmailsPage.tsx` | Route components |
| **Hooks** | `useSomething.ts` | `useEmails.ts` | Custom React hooks |

## Code Element Naming

| Type | Convention | Example | Notes |
|------|------------|---------|-------|
| **Functions** | `camelCase` | `processEmail` | Verb-based, descriptive |
| **Variables** | `camelCase` | `emailResult` | Descriptive, semantic |
| **Constants** | `UPPER_SNAKE_CASE` | `EMAIL_CATEGORIES` | Module-level constants |
| **Classes** | `PascalCase` | `EmailService` | Clear, descriptive |
| **Interfaces** | `PascalCase` | `EmailMessage` | No 'I' prefix |
| **Types** | `PascalCase` | `EmailCategory` | Union types, aliases |
| **Enums** | `PascalCase` | `WorkflowState` | Enum names |
| **Enum Values** | `UPPER_SNAKE_CASE` | `PENDING_REVIEW` | Enum members |

## GraphQL Naming

| Type | Convention | Example | Notes |
|------|------------|---------|-------|
| **Queries** | `camelCase` | `emails`, `user` | Noun-based |
| **Mutations** | `camelCase` | `createEmail` | Verb-based |
| **Subscriptions** | `camelCase` | `emailUpdates` | Event-based |
| **Input Types** | `PascalCase` + `Input` | `CreateEmailInput` | Clear input type |
| **Object Types** | `PascalCase` | `EmailMessage` | Domain objects |