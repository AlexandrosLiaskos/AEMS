import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';
import { AppDataService } from './common/services/app-data.service';
import { EnvironmentInitializerService } from './common/services/environment-initializer.service';
import { MigrationService } from './database/migrations/migration.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { ErrorHandlingInterceptor } from './common/interceptors/error-handling.interceptor';
import { AuditService } from './modules/audit/services/audit.service';
import { ErrorHandlerService } from './common/services/error-handler.service';

/**
 * @function bootstrap
 * @purpose Bootstrap the NestJS application
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get configuration service
  const configService = app.get(ConfigService);
  const loggerService = app.get(LoggerService);
  const appDataService = app.get(AppDataService);
  const environmentInitializer = app.get(EnvironmentInitializerService);
  const migrationService = app.get(MigrationService);
  const auditService = app.get(AuditService);
  const errorHandlerService = app.get(ErrorHandlerService);

  // Initialize environment and data directories
  try {
    await environmentInitializer.initializeEnvironment();
    await appDataService.ensureDirectories();
    loggerService.log('Environment and data directories initialized', 'Bootstrap');

    // Run database migrations
    loggerService.log('Running database migrations...', 'Bootstrap');
    await migrationService.runMigrations();
    loggerService.log('Database migrations completed', 'Bootstrap');

  } catch (error) {
    loggerService.error(`Failed to initialize environment: ${error.message}`, 'Bootstrap');
    process.exit(1);
  }

  // Global validation pipe
  app.useGlobalPipes(new CustomValidationPipe());

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter(loggerService, auditService));

  // Global error handling interceptor
  app.useGlobalInterceptors(new ErrorHandlingInterceptor(errorHandlerService));

  // CORS configuration
  app.enableCors({
    origin: configService.get('app.corsOrigin'),
    credentials: configService.get('app.corsCredentials'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global prefix for API routes
  app.setGlobalPrefix('api', {
    exclude: ['/health', '/metrics'],
  });

  // Swagger documentation (only in development)
  if (configService.get('app.environment') === 'development') {
    const config = new DocumentBuilder()
      .setTitle('AEMS API')
      .setDescription('Automated Email Management System API Documentation')
      .setVersion(configService.get('app.version'))
      .addBearerAuth()
      .addTag('Authentication', 'User authentication and session management')
      .addTag('Gmail', 'Gmail integration and synchronization')
      .addTag('AI', 'AI-powered email classification and data extraction')
      .addTag('Email', 'Email management operations')
      .addTag('Workflow', 'Email workflow management')
      .addTag('Audit', 'Audit logging and tracking')
      .addTag('Backup', 'Data backup and restore')
      .addTag('Export', 'Data export functionality')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    loggerService.log('Swagger documentation available at /api/docs', 'Bootstrap');
  }

  // Health check endpoint
  app.use('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: configService.get('app.version'),
      environment: configService.get('app.environment'),
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    loggerService.log('SIGTERM received, shutting down gracefully', 'Bootstrap');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    loggerService.log('SIGINT received, shutting down gracefully', 'Bootstrap');
    await app.close();
    process.exit(0);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    loggerService.error(`Unhandled Promise Rejection at: ${promise}, reason: ${reason}`, 'Bootstrap');
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    loggerService.error(`Uncaught Exception: ${error.message}`, 'Bootstrap', error.stack);
    process.exit(1);
  });

  // Start the server
  const port = configService.get('app.port');
  const host = configService.get('app.host');
  
  await app.listen(port, host);

  loggerService.log(`🚀 AEMS Backend started successfully!`, 'Bootstrap');
  loggerService.log(`📍 Server running on: http://${host}:${port}`, 'Bootstrap');
  loggerService.log(`🔍 GraphQL Playground: http://${host}:${port}/graphql`, 'Bootstrap');
  
  if (configService.get('app.environment') === 'development') {
    loggerService.log(`📚 API Documentation: http://${host}:${port}/api/docs`, 'Bootstrap');
  }

  loggerService.log(`🏠 Data directory: ${appDataService.getDataPath()}`, 'Bootstrap');
  loggerService.log(`⚙️  Environment: ${configService.get('app.environment')}`, 'Bootstrap');
  loggerService.log(`📦 Version: ${configService.get('app.version')}`, 'Bootstrap');
}

// Start the application
bootstrap().catch((error) => {
  Logger.error(`Failed to start application: ${error.message}`, 'Bootstrap');
  console.error(error);
  process.exit(1);
});