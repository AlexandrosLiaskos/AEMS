/**
 * @interface Migration
 * @purpose Interface for database migrations
 */
export interface Migration {
  /**
   * Migration version (timestamp format: YYYYMMDDHHMMSS)
   */
  version: string;

  /**
   * Migration name/description
   */
  name: string;

  /**
   * Execute the migration
   */
  up(): Promise<void>;

  /**
   * Rollback the migration
   */
  down(): Promise<void>;
}

/**
 * @interface MigrationRecord
 * @purpose Record of executed migrations
 */
export interface MigrationRecord {
  version: string;
  name: string;
  executedAt: Date;
  executionTime: number; // milliseconds
}

/**
 * @interface MigrationStatus
 * @purpose Status of migration system
 */
export interface MigrationStatus {
  currentVersion: string;
  pendingMigrations: string[];
  executedMigrations: MigrationRecord[];
  needsMigration: boolean;
}