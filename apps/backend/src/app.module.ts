import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

// Core modules
import { CommonModule } from './common/common.module';
import { RepositoryModule } from './database/repositories/repository.module';
import { MigrationModule } from './database/migrations/migration.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { AIModule } from './modules/ai/ai.module';
import { EmailModule } from './modules/email/email.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { AuditModule } from './modules/audit/audit.module';
import { BackupModule } from './modules/backup/backup.module';
import { ExportModule } from './modules/export/export.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { WebSocketModule } from './modules/websocket/websocket.module';

// Configuration
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { aiConfig } from './config/ai.config';
import { gmailConfig } from './config/gmail.config';

/**
 * @class AppModule
 * @purpose Main application module
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, aiConfig, gmailConfig],
      envFilePath: [
        '.env.local',
        '.env.development',
        '.env',
      ],
      expandVariables: true,
    }),

    // GraphQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV === 'development',
      introspection: process.env.NODE_ENV === 'development',
      context: ({ req, res }) => ({ req, res }),
      formatError: (error) => {
        console.error('GraphQL Error:', error);
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
        };
      },
    }),

    // Core modules
    CommonModule,
    RepositoryModule,
    MigrationModule,

    // Feature modules
    AuthModule,
    GmailModule,
    AIModule,
    EmailModule,
    WorkflowModule,
    AuditModule,
    BackupModule,
    ExportModule,
    PipelineModule,
    WebSocketModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}