import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { CommonModule } from '../../common/common.module';

// Import all migrations
import { Migration20241223120000InitialSchema } from './migrations/20241223120000-initial-schema.migration';
import { Migration20241223120001AddUserRoles } from './migrations/20241223120001-add-user-roles.migration';
import { Migration20241223120002AddEmailWorkflowState } from './migrations/20241223120002-add-email-workflow-state.migration';

/**
 * @class MigrationModule
 * @purpose Module for database migrations
 */
@Module({
  imports: [CommonModule],
  providers: [
    MigrationService,
    Migration20241223120000InitialSchema,
    Migration20241223120001AddUserRoles,
    Migration20241223120002AddEmailWorkflowState,
  ],
  exports: [MigrationService],
})
export class MigrationModule {
  constructor(
    private migrationService: MigrationService,
    private migration20241223120000: Migration20241223120000InitialSchema,
    private migration20241223120001: Migration20241223120001AddUserRoles,
    private migration20241223120002: Migration20241223120002AddEmailWorkflowState,
  ) {
    // Register all migrations
    this.migrationService.registerMigration(this.migration20241223120000);
    this.migrationService.registerMigration(this.migration20241223120001);
    this.migrationService.registerMigration(this.migration20241223120002);
  }
}