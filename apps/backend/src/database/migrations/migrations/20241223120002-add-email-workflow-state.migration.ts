import { Migration } from '../migration.interface';
import { LoggerService } from '../../../common/services/logger.service';
import { AppDataService } from '../../../common/services/app-data.service';
import { FileService } from '../../../common/services/file.service';
import * as path from 'path';

/**
 * @class Migration20241223120002AddEmailWorkflowState
 * @purpose Add workflow state and priority fields to email messages
 */
export class Migration20241223120002AddEmailWorkflowState implements Migration {
  version = '20241223120002';
  name = 'Add workflow state and priority to email messages';

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
    this.logger.log('Executing migration: Add workflow state and priority to email messages', 'Migration20241223120002AddEmailWorkflowState');
    
    const dataPath = this.appDataService.getDataPath();
    const emailsFilePath = path.join(dataPath, 'email-messages.json');
    
    if (await this.fileService.exists(emailsFilePath)) {
      const content = await this.fileService.readFile(emailsFilePath);
      const emails = JSON.parse(content);
      
      let updatedCount = 0;
      
      for (const email of emails) {
        // Add workflowState field if missing
        if (!email.workflowState) {
          email.workflowState = 'FETCHED'; // Default workflow state
          updatedCount++;
        }
        
        // Add priority field if missing
        if (!email.priority) {
          email.priority = 'NORMAL'; // Default priority
          updatedCount++;
        }
        
        // Add isRead field if missing
        if (email.isRead === undefined) {
          email.isRead = false; // Default to unread
          updatedCount++;
        }
        
        // Add isStarred field if missing
        if (email.isStarred === undefined) {
          email.isStarred = false; // Default to not starred
          updatedCount++;
        }
        
        // Add tags field if missing
        if (!email.tags) {
          email.tags = []; // Default to empty tags
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        await this.fileService.writeFile(emailsFilePath, JSON.stringify(emails, null, 2));
        this.logger.log(`Updated ${updatedCount} email records with workflow/priority fields`, 'Migration20241223120002AddEmailWorkflowState');
      } else {
        this.logger.log('No emails needed updating', 'Migration20241223120002AddEmailWorkflowState');
      }
    } else {
      this.logger.log('Email messages file does not exist, skipping migration', 'Migration20241223120002AddEmailWorkflowState');
    }
    
    this.logger.log('Migration completed: Add workflow state and priority to email messages', 'Migration20241223120002AddEmailWorkflowState');
  }

  /**
   * @method down
   * @purpose Rollback the migration
   */
  async down(): Promise<void> {
    this.logger.log('Rolling back migration: Add workflow state and priority to email messages', 'Migration20241223120002AddEmailWorkflowState');
    
    const dataPath = this.appDataService.getDataPath();
    const emailsFilePath = path.join(dataPath, 'email-messages.json');
    
    if (await this.fileService.exists(emailsFilePath)) {
      const content = await this.fileService.readFile(emailsFilePath);
      const emails = JSON.parse(content);
      
      let updatedCount = 0;
      
      for (const email of emails) {
        // Remove workflow state field
        if (email.workflowState) {
          delete email.workflowState;
          updatedCount++;
        }
        
        // Remove priority field
        if (email.priority) {
          delete email.priority;
          updatedCount++;
        }
        
        // Remove isRead field
        if (email.isRead !== undefined) {
          delete email.isRead;
          updatedCount++;
        }
        
        // Remove isStarred field
        if (email.isStarred !== undefined) {
          delete email.isStarred;
          updatedCount++;
        }
        
        // Remove tags field
        if (email.tags) {
          delete email.tags;
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        await this.fileService.writeFile(emailsFilePath, JSON.stringify(emails, null, 2));
        this.logger.log(`Removed workflow/priority fields from ${updatedCount} email records`, 'Migration20241223120002AddEmailWorkflowState');
      }
    }
    
    this.logger.log('Migration rollback completed: Add workflow state and priority to email messages', 'Migration20241223120002AddEmailWorkflowState');
  }
}