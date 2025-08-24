# AEMS Project Overview

## Purpose
AEMS (Automated Email Management System) is a modern, full-stack email management system that leverages artificial intelligence to automatically categorize emails and extract structured data from invoices, receipts, and documents. Built with cutting-edge technologies and designed for zero-cost hosting with local data storage.

## Tech Stack

### Backend
- **Framework**: NestJS 10.0+ (Node.js framework with dependency injection)
- **Language**: TypeScript 5.2+
- **API**: GraphQL with Apollo Server 4.0+
- **Database**: Custom JSON file storage with TypeORM-compatible interface
- **Authentication**: Passport.js with JWT + Google OAuth2
- **AI Integration**: OpenAI API (GPT-3.5-turbo) + LangChain
- **External APIs**: Gmail API for email access

### Frontend
- **Framework**: React 18.2+ with TypeScript
- **Build Tool**: Vite 4.0+
- **UI Library**: ShadCN/UI with Radix UI primitives
- **Styling**: Tailwind CSS 3.0+
- **State Management**: Zustand + Apollo Client
- **GraphQL Client**: Apollo Client 3.0+

### Key Features
- AI-powered email classification and data extraction
- Gmail integration with OAuth2 security
- Human-in-the-loop workflow for AI validation
- Real-time notifications via WebSocket
- Local JSON file storage (zero hosting costs)
- Comprehensive audit logging
- Backup and restore functionality

## Architecture
- Monorepo structure with separate backend/frontend apps
- Modular NestJS architecture with dependency injection
- Custom JSON file data source compatible with TypeORM
- GraphQL API with real-time subscriptions
- Component-based React frontend with modern UI patterns