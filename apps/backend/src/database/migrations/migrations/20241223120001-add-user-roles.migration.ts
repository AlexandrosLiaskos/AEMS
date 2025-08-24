import { Migration } from '../migration.interface';
import { LoggerService } from '../../../common/services/logger.service';
import { AppDataService } from '../../../common/services/app-data.service';
import { FileService } from '../../../common/services/file.service';
import * as path from 'path';

/**
 * @class Migration20241223120001AddUserRoles
 * @purpose Add role and status fields to existing users
 */
export class Migration20241223120001AddUserRoles implements Migration {
  version = '20241223120001';
  name = 'Add role and status fields to users';

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
    this.logger.log('Executing migration: Add role and status fields to users', 'Migration20241223120001AddUserRoles');
    
    const dataPath = this.appDataService.getDataPath();
    const usersFilePath = path.join(dataPath, 'users.json');
    
    if (await this.fileService.exists(usersFilePath)) {
      const content = await this.fileService.readFile(usersFilePath);
      const users = JSON.parse(content);
      
      let updatedCount = 0;
      
      for (const user of users) {
        // Add role field if missing
        if (!user.role) {
          user.role = 'USER'; // Default role
          updatedCount++;
        }
        
        // Add status field if missing
        if (!user.status) {
          user.status = 'ACTIVE'; // Default status
          updatedCount++;
        }
        
        // Add isActive field if missing
        if (user.isActive === undefined) {
          user.isActive = true; // Default to active
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        await this.fileService.writeFile(usersFilePath, JSON.stringify(users, null, 2));
        this.logger.log(`Updated ${updatedCount} user records with role/status fields`, 'Migration20241223120001AddUserRoles');
      } else {
        this.logger.log('No users needed updating', 'Migration20241223120001AddUserRoles');
      }
    } else {
      this.logger.log('Users file does not exist, skipping migration', 'Migration20241223120001AddUserRoles');
    }
    
    this.logger.log('Migration completed: Add role and status fields to users', 'Migration20241223120001AddUserRoles');
  }

  /**
   * @method down
   * @purpose Rollback the migration
   */
  async down(): Promise<void> {
    this.logger.log('Rolling back migration: Add role and status fields to users', 'Migration20241223120001AddUserRoles');
    
    const dataPath = this.appDataService.getDataPath();
    const usersFilePath = path.join(dataPath, 'users.json');
    
    if (await this.fileService.exists(usersFilePath)) {
      const content = await this.fileService.readFile(usersFilePath);
      const users = JSON.parse(content);
      
      let updatedCount = 0;
      
      for (const user of users) {
        // Remove role field
        if (user.role) {
          delete user.role;
          updatedCount++;
        }
        
        // Remove status field
        if (user.status) {
          delete user.status;
          updatedCount++;
        }
        
        // Remove isActive field
        if (user.isActive !== undefined) {
          delete user.isActive;
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        await this.fileService.writeFile(usersFilePath, JSON.stringify(users, null, 2));
        this.logger.log(`Removed role/status fields from ${updatedCount} user records`, 'Migration20241223120001AddUserRoles');
      }
    }
    
    this.logger.log('Migration rollback completed: Add role and status fields to users', 'Migration20241223120001AddUserRoles');
  }
}