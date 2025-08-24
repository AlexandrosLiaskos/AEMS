# Project Structure

## Monorepo Layout

| Directory | Purpose | Technology |
|-----------|---------|------------|
| `apps/backend/` | NestJS API server | NestJS + TypeScript + GraphQL |
| `apps/frontend/` | React web application | React + TypeScript + ShadCN/UI |
| `packages/types/` | Shared TypeScript types | TypeScript definitions |
| `packages/constants/` | Shared constants | Static values, enums |
| `packages/utils/` | Shared utilities | Pure functions, helpers |
| `packages/ui/` | UI component library | ShadCN/RadixUI components |
| `scripts/` | Development scripts | Build, validation, analysis |
| `docs/` | Documentation | Markdown files |

## Backend Structure (`apps/backend/`)

| Directory | Purpose | Contents |
|-----------|---------|----------|
| `src/modules/` | Feature modules | `auth/`, `email/`, `ai/`, `notifications/` |
| `src/common/` | Shared backend code | Guards, decorators, pipes, filters |
| `src/config/` | Configuration | Environment, database, app config |
| `src/graphql/` | GraphQL schema | Schema files, resolvers |
| `src/database/` | Database layer | Entities, repositories, migrations |

## Frontend Structure (`apps/frontend/`)

| Directory | Purpose | Contents |
|-----------|---------|----------|
| `src/components/` | React components | Reusable UI components |
| `src/pages/` | Page components | Route-level components |
| `src/hooks/` | Custom React hooks | State management, API calls |
| `src/services/` | API services | GraphQL queries, mutations |
| `src/types/` | Frontend types | UI-specific type definitions |
| `src/utils/` | Frontend utilities | Helper functions, formatters |

## Shared Packages

| Package | Purpose | Exports |
|---------|---------|---------|
| `@aems/types` | Type definitions | Domain types, API types, utility types |
| `@aems/constants` | Static values | Enums, configuration constants |
| `@aems/utils` | Utilities | Pure functions, validators, formatters |
| `@aems/ui` | UI components | ShadCN/RadixUI component library |