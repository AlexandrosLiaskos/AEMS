import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

// Modules
import { AuthModule } from '../modules/auth/auth.module';
import { GmailModule } from '../modules/gmail/gmail.module';
import { AIModule } from '../modules/ai/ai.module';

// Resolvers
import { UserResolver } from './resolvers/user.resolver';
import { EmailResolver } from './resolvers/email.resolver';
import { ClassificationResolver } from './resolvers/classification.resolver';
import { ExtractionResolver } from './resolvers/extraction.resolver';
import { NotificationResolver } from './resolvers/notification.resolver';
import { AuditLogResolver } from './resolvers/audit-log.resolver';

// Scalars
import { DateTimeScalar } from './scalars/datetime.scalar';
import { JSONScalar } from './scalars/json.scalar';

/**
 * @class GraphQLConfigModule
 * @purpose GraphQL configuration and resolver module
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => ({
        // Schema configuration
        autoSchemaFile: join(process.cwd(), 'apps/backend/src/graphql/schema.gql'),
        sortSchema: true,
        
        // Development features
        playground: configService.get<string>('NODE_ENV') !== 'production',
        introspection: true,
        
        // Context configuration
        context: ({ req, res }) => ({ req, res }),
        
        // Error handling
        formatError: (error) => {
          console.error('GraphQL Error:', error);
          return {
            message: error.message,
            code: error.extensions?.code,
            path: error.path,
            timestamp: new Date().toISOString(),
          };
        },
        
        // Performance
        cache: 'bounded',
        
        // Security
        cors: {
          origin: configService.get<string>('app.corsOrigin', 'http://localhost:3000'),
          credentials: true,
        },
        
        // Subscriptions (for real-time features)
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': true,
        },
        
        // Plugin configuration
        plugins: [],
        
        // Field resolver enhancement
        fieldResolverEnhancers: ['guards', 'interceptors', 'filters'],
      }),
      inject: [ConfigService],
    }),

    // Import feature modules
    AuthModule,
    GmailModule,
    AIModule,
  ],
  providers: [
    // Resolvers
    UserResolver,
    EmailResolver,
    ClassificationResolver,
    ExtractionResolver,
    NotificationResolver,
    AuditLogResolver,

    // Custom scalars
    DateTimeScalar,
    JSONScalar,
  ],
  exports: [GraphQLModule],
})
export class GraphQLConfigModule {}