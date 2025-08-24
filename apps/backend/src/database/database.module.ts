import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JsonFileDataSource } from './json-file-datasource';
import { FileManagerService } from './services/file-manager.service';
import { LockManagerService } from './services/lock-manager.service';
import { BackupService } from './services/backup.service';
import { LoggerService } from '../common/services/logger.service';
import { AppDataService } from '../common/services/app-data.service';

/**
 * @class DatabaseModule
 * @purpose Database layer module with JSON file storage adapter
 */
@Module({
  imports: [
    ScheduleModule,
    TypeOrmModule.forRootAsync({
      useFactory: async (configService: ConfigService, appDataService: AppDataService) => {
        const databaseType = configService.get<string>('DATABASE_TYPE', 'json');
        
        // Use AppDataService for OS-specific paths
        const databasePath = appDataService.getDataPath();

        if (databaseType === 'json') {
          // Use custom JSON file data source
          return {
            type: 'better-sqlite3', // Placeholder, will be overridden
            database: ':memory:', // Placeholder
            entities: [],
            synchronize: false,
            logging: false,
            // Custom data source will be injected
          };
        } else {
          // Use SQLite for development/testing
          return {
            type: 'better-sqlite3',
            database: `${databasePath}/aems.db`,
            entities: [__dirname + '/../**/*.entity{.ts,.js}'],
            synchronize: configService.get<boolean>('DATABASE_SYNCHRONIZE', true),
            logging: configService.get<boolean>('DATABASE_LOGGING', false),
          };
        }
      },
      inject: [ConfigService, AppDataService],
    }),
  ],
  providers: [
    LoggerService,
    JsonFileDataSource,
    FileManagerService,
    LockManagerService,
    BackupService,
  ],
  exports: [
    JsonFileDataSource,
    FileManagerService,
    LockManagerService,
    BackupService,
  ],
})
export class DatabaseModule {}
