import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { LoggerService } from '../../common/services/logger.service';
import { AppDataService } from '../../common/services/app-data.service';
import { FileService } from '../../common/services/file.service';
import { Migration, MigrationRecord, MigrationStatus } from './migration.interface';

/**
 * @class MigrationService
 * @purpose Service for managing database migrations
 */
@Injectable()
export class MigrationService {
  private readonly migrationsFile: string;
  private migrations: Migration[] = [];

  constructor(
    private logger: LoggerService,
    private appDataService: AppDataService,
    private fileService: FileService,
  ) {
    this.migrationsFile = path.join(this.appDataService.getDataPath(), 'migrations.json');
  }

  /**
   * @method registerMigration
   * @purpose Register a migration
   */
  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * @method getMigrationStatus
   * @purpose Get current migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = executedMigrations.map(m => m.version);
    const pendingMigrations = this.migrations
      .filter(m => !executedVersions.includes(m.version))
      .map(m => m.version);

    const currentVersion = executedMigrations.length > 0 
      ? executedMigrations[executedMigrations.length - 1].version 
      : '0';

    return {
      currentVersion,
      pendingMigrations,
      executedMigrations,
      needsMigration: pendingMigrations.length > 0,
    };
  }

  /**
   * @method runMigrations
   * @purpose Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    const status = await this.getMigrationStatus();
    
    if (!status.needsMigration) {
      this.logger.log('No pending migrations', 'MigrationService');
      return;
    }

    this.logger.log(`Running ${status.pendingMigrations.length} pending migrations`, 'MigrationService');

    for (const version of status.pendingMigrations) {
      await this.runMigration(version);
    }

    this.logger.log('All migrations completed successfully', 'MigrationService');
  }

  /**
   * @method runMigration
   * @purpose Run a specific migration
   */
  async runMigration(version: string): Promise<void> {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    this.logger.log(`Running migration ${version}: ${migration.name}`, 'MigrationService');

    const startTime = Date.now();
    
    try {
      await migration.up();
      const executionTime = Date.now() - startTime;

      // Record successful migration
      await this.recordMigration({
        version: migration.version,
        name: migration.name,
        executedAt: new Date(),
        executionTime,
      });

      this.logger.log(
        `Migration ${version} completed successfully in ${executionTime}ms`, 
        'MigrationService'
      );

    } catch (error) {
      this.logger.error(
        `Migration ${version} failed: ${error.message}`, 
        'MigrationService',
        error.stack
      );
      throw error;
    }
  }

  /**
   * @method rollbackMigration
   * @purpose Rollback a specific migration
   */
  async rollbackMigration(version: string): Promise<void> {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    const executedMigrations = await this.getExecutedMigrations();
    const migrationRecord = executedMigrations.find(m => m.version === version);
    if (!migrationRecord) {
      throw new Error(`Migration ${version} has not been executed`);
    }

    this.logger.log(`Rolling back migration ${version}: ${migration.name}`, 'MigrationService');

    try {
      await migration.down();

      // Remove migration record
      await this.removeMigrationRecord(version);

      this.logger.log(`Migration ${version} rolled back successfully`, 'MigrationService');

    } catch (error) {
      this.logger.error(
        `Migration rollback ${version} failed: ${error.message}`, 
        'MigrationService',
        error.stack
      );
      throw error;
    }
  }

  /**
   * @method rollbackToVersion
   * @purpose Rollback to a specific version
   */
  async rollbackToVersion(targetVersion: string): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    const migrationsToRollback = executedMigrations
      .filter(m => m.version > targetVersion)
      .sort((a, b) => b.version.localeCompare(a.version)); // Rollback in reverse order

    if (migrationsToRollback.length === 0) {
      this.logger.log(`Already at or before version ${targetVersion}`, 'MigrationService');
      return;
    }

    this.logger.log(
      `Rolling back ${migrationsToRollback.length} migrations to version ${targetVersion}`, 
      'MigrationService'
    );

    for (const migrationRecord of migrationsToRollback) {
      await this.rollbackMigration(migrationRecord.version);
    }

    this.logger.log(`Rollback to version ${targetVersion} completed`, 'MigrationService');
  }

  /**
   * @method getExecutedMigrations
   * @purpose Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      if (await this.fileService.exists(this.migrationsFile)) {
        const content = await this.fileService.readFile(this.migrationsFile);
        const data = JSON.parse(content);
        
        return data.migrations.map((m: any) => ({
          ...m,
          executedAt: new Date(m.executedAt),
        }));
      }
    } catch (error) {
      this.logger.warn(`Failed to read migrations file: ${error.message}`, 'MigrationService');
    }

    return [];
  }

  /**
   * @method recordMigration
   * @purpose Record a successful migration
   */
  private async recordMigration(record: MigrationRecord): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    executedMigrations.push(record);
    executedMigrations.sort((a, b) => a.version.localeCompare(b.version));

    const data = {
      lastUpdated: new Date().toISOString(),
      migrations: executedMigrations,
    };

    await this.fileService.ensureDirectory(path.dirname(this.migrationsFile));
    await this.fileService.writeFile(this.migrationsFile, JSON.stringify(data, null, 2));
  }

  /**
   * @method removeMigrationRecord
   * @purpose Remove a migration record
   */
  private async removeMigrationRecord(version: string): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    const filteredMigrations = executedMigrations.filter(m => m.version !== version);

    const data = {
      lastUpdated: new Date().toISOString(),
      migrations: filteredMigrations,
    };

    await this.fileService.writeFile(this.migrationsFile, JSON.stringify(data, null, 2));
  }

  /**
   * @method createMigrationTemplate
   * @purpose Create a new migration template
   */
  createMigrationTemplate(name: string): string {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const className = name.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, str => str.toUpperCase());

    return `import { Migration } from '../migration.interface';
import { LoggerService } from '../../../common/services/logger.service';
import { AppDataService } from '../../../common/services/app-data.service';
import { FileService } from '../../../common/services/file.service';

/**
 * @class Migration${timestamp}${className}
 * @purpose ${name}
 */
export class Migration${timestamp}${className} implements Migration {
  version = '${timestamp}';
  name = '${name}';

  constructor(
    private logger: LoggerService,
    private appDataService: AppDataService,
    private fileService: FileService,
  ) {}

  /**
   * @method up
   * @purpose Execute the migration
   */
  async up(): Promise<void> {
    this.logger.log('Executing migration: ${name}', 'Migration${timestamp}${className}');
    
    // TODO: Implement migration logic here
    
    this.logger.log('Migration completed: ${name}', 'Migration${timestamp}${className}');
  }

  /**
   * @method down
   * @purpose Rollback the migration
   */
  async down(): Promise<void> {
    this.logger.log('Rolling back migration: ${name}', 'Migration${timestamp}${className}');
    
    // TODO: Implement rollback logic here
    
    this.logger.log('Migration rollback completed: ${name}', 'Migration${timestamp}${className}');
  }
}`;
  }

  /**
   * @method validateMigrations
   * @purpose Validate migration consistency
   */
  async validateMigrations(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate versions
    const versions = this.migrations.map(m => m.version);
    const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
    }

    // Check version format
    for (const migration of this.migrations) {
      if (!/^\d{14}$/.test(migration.version)) {
        errors.push(`Invalid version format for migration ${migration.version}: ${migration.name}`);
      }
    }

    // Check for gaps in executed migrations
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = executedMigrations.map(m => m.version).sort();
    
    for (let i = 1; i < executedVersions.length; i++) {
      const current = executedVersions[i];
      const previous = executedVersions[i - 1];
      
      // Check if there are any migrations between previous and current that should have been executed
      const missingMigrations = this.migrations.filter(m => 
        m.version > previous && m.version < current
      );
      
      if (missingMigrations.length > 0) {
        warnings.push(
          `Potential gap in migration execution between ${previous} and ${current}. ` +
          `Missing: ${missingMigrations.map(m => m.version).join(', ')}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}