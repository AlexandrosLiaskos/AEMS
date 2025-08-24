import { Migration } from '../migration.interface';
import { LoggerService } from '../../../common/services/logger.service';
import { AppDataService } from '../../../common/services/app-data.service';
import { FileService } from '../../../common/services/file.service';
import * as path from 'path';

/**
 * @class Migration20241223120000InitialSchema
 * @purpose Create initial JSON schema files for all entities
 */
export class Migration20241223120000InitialSchema implements Migration {
  version = '20241223120000';
  name = 'Create initial schema files';

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
    this.logger.log('Executing migration: Create initial schema files', 'Migration20241223120000InitialSchema');
    
    const dataPath = this.appDataService.getDataPath();
    
    // Create initial JSON files for all entities
    const initialFiles = [
      { name: 'users.json', data: [] },
      { name: 'email-messages.json', data: [] },
      { name: 'classifications.json', data: [] },
      { name: 'extractions.json', data: [] },
    ];

    for (const file of initialFiles) {
      const filePath = path.join(dataPath, file.name);
      
      if (!(await this.fileService.exists(filePath))) {
        await this.fileService.writeFile(filePath, JSON.stringify(file.data, null, 2));
        this.logger.debug(`Created initial file: ${file.name}`, 'Migration20241223120000InitialSchema');
      } else {
        this.logger.debug(`File already exists: ${file.name}`, 'Migration20241223120000InitialSchema');
      }
    }

    // Create schema metadata file
    const schemaMetadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      entities: {
        users: {
          file: 'users.json',
          primaryKey: 'id',
          indexes: ['email', 'googleId'],
        },
        emailMessages: {
          file: 'email-messages.json',
          primaryKey: 'id',
          indexes: ['userId', 'gmailId', 'threadId', 'workflowState'],
        },
        classifications: {
          file: 'classifications.json',
          primaryKey: 'id',
          indexes: ['emailId', 'category', 'isValidated'],
        },
        extractions: {
          file: 'extractions.json',
          primaryKey: 'id',
          indexes: ['emailId', 'category', 'isComplete'],
        },
      },
    };

    const schemaPath = path.join(dataPath, 'schema.json');
    await this.fileService.writeFile(schemaPath, JSON.stringify(schemaMetadata, null, 2));
    
    this.logger.log('Migration completed: Create initial schema files', 'Migration20241223120000InitialSchema');
  }

  /**
   * @method down
   * @purpose Rollback the migration
   */
  async down(): Promise<void> {
    this.logger.log('Rolling back migration: Create initial schema files', 'Migration20241223120000InitialSchema');
    
    const dataPath = this.appDataService.getDataPath();
    
    // Remove schema metadata file
    const schemaPath = path.join(dataPath, 'schema.json');
    if (await this.fileService.exists(schemaPath)) {
      await this.fileService.deleteFile(schemaPath);
      this.logger.debug('Removed schema.json', 'Migration20241223120000InitialSchema');
    }

    // Note: We don't remove the data files as they might contain user data
    this.logger.warn('Data files were not removed to preserve user data', 'Migration20241223120000InitialSchema');
    
    this.logger.log('Migration rollback completed: Create initial schema files', 'Migration20241223120000InitialSchema');
  }
}