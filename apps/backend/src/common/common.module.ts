import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { LoggerService } from './services/logger.service';
import { AppDataService } from './services/app-data.service';
import { EnvironmentService } from './services/environment.service';
import { EnvironmentInitializerService } from './services/environment-initializer.service';
import { ValidationService } from './services/validation.service';
import { CryptoService } from './services/crypto.service';
import { FileService } from './services/file.service';
import { DateService } from './services/date.service';
import { EventService } from './services/event.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { LockManagerService } from './services/lock-manager.service';

/**
 * @class CommonModule
 * @purpose Common services and utilities module
 */
@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    LoggerService,
    AppDataService,
    EnvironmentService,
    EnvironmentInitializerService,
    ValidationService,
    CryptoService,
    FileService,
    DateService,
    EventService,
    ErrorHandlerService,
    LockManagerService,
  ],
  exports: [
    LoggerService,
    AppDataService,
    EnvironmentService,
    EnvironmentInitializerService,
    ValidationService,
    CryptoService,
    FileService,
    DateService,
    EventService,
    ErrorHandlerService,
    LockManagerService,
  ],
})
export class CommonModule {}