import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileManagerService } from './file-manager.service';
import { LockManagerService } from './lock-manager.service';
import { LoggerService } from '../../common/services/logger.service';

/**
 * @interface BackupInfo
 * @purpose Backup information interface
 */
export interface BackupInfo {
  id: string;
  timestamp: Date;
  size: number;
  checksum: string;
  files: string[];
  compressed: boolean;
  encrypted: boolean;
  metadata: {
    version: string;
    environment: string;
    totalFiles: number;
    totalSize: number;
  };
}

/**
 * @interface BackupOptions
 * @purpose Backup configuration options
 */
export interface BackupOptions {
  compress?: boolean;
  encrypt?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxBackups?: number;
  verifyIntegrity?: boolean;
}

/**
 * @class BackupService
 * @purpose Service for creating and managing data backups
 */
@Injectable()
export class BackupService {
  private readonly dataPath: string;
  private readonly backupPath: string;
  private readonly defaultOptions: BackupOptions;

  constructor(
    private configService: ConfigService,
    private fileManager: FileManagerService,
    private lockManager: LockManagerService,
    private logger: LoggerService
  ) {
    this.dataPath = this.configService.get<string>('DATABASE_PATH', 'data');
    this.backupPath = this.configService.get<string>('BACKUP_PATH', 'backups');
    
    this.defaultOptions = {
      compress: this.configService.get<boolean>('BACKUP_COMPRESS', true),
      encrypt: this.configService.get<boolean>('BACKUP_ENCRYPT', false),
      includePatterns: ['*.json', '*.log'],
      excludePatterns: ['.locks/**', '*.tmp', '*.temp'],
      maxBackups: this.configService.get<number>('BACKUP_MAX_COUNT', 30),
      verifyIntegrity: this.configService.get<boolean>('BACKUP_VERIFY', true),
    };

    // Ensure backup directory exists
    this.ensureBackupDirectory();
  }

  /**
   * @method createBackup
   * @purpose Create a new backup
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const backupId = this.generateBackupId();
    
    return await this.lockManager.withLock('backup-operation', async () => {
      try {
        this.logger.log(
          `Starting backup creation: ${backupId}`,
          'BackupService',
          { backupId, options: mergedOptions }
        );

        // Get list of files to backup
        const filesToBackup = await this.getFilesToBackup(mergedOptions);
        
        if (filesToBackup.length === 0) {
          throw new Error('No files found to backup');
        }

        // Create backup directory
        const backupDir = path.join(this.backupPath, backupId);
        await this.fileManager.ensureDirectory(backupDir);

        // Copy files to backup directory
        let totalSize = 0;
        const copiedFiles: string[] = [];

        for (const filePath of filesToBackup) {
          const relativePath = path.relative(this.dataPath, filePath);
          const backupFilePath = path.join(backupDir, relativePath);
          
          // Ensure subdirectory exists
          await this.fileManager.ensureDirectory(path.dirname(backupFilePath));
          
          // Copy file
          await this.fileManager.copyFile(filePath, backupFilePath);
          
          // Get file size
          const stats = await this.fileManager.getFileStats(filePath);
          totalSize += stats.size;
          
          copiedFiles.push(relativePath);
        }

        // Create backup info
        const backupInfo: BackupInfo = {
          id: backupId,
          timestamp: new Date(),
          size: totalSize,
          checksum: '',
          files: copiedFiles,
          compressed: mergedOptions.compress || false,
          encrypted: mergedOptions.encrypt || false,
          metadata: {
            version: this.configService.get<string>('APP_VERSION', '1.0.0'),
            environment: this.configService.get<string>('NODE_ENV', 'development'),
            totalFiles: copiedFiles.length,
            totalSize: totalSize,
          },
        };

        // Calculate checksum
        backupInfo.checksum = await this.calculateBackupChecksum(backupDir);

        // Save backup info
        const backupInfoPath = path.join(backupDir, 'backup-info.json');
        await this.fileManager.writeJsonFile(backupInfoPath, backupInfo);

        // Compress if requested
        if (mergedOptions.compress) {
          await this.compressBackup(backupDir);
        }

        // Encrypt if requested
        if (mergedOptions.encrypt) {
          await this.encryptBackup(backupDir);
        }

        // Verify integrity if requested
        if (mergedOptions.verifyIntegrity) {
          const isValid = await this.verifyBackupIntegrity(backupInfo);
          if (!isValid) {
            throw new Error('Backup integrity verification failed');
          }
        }

        // Cleanup old backups
        await this.cleanupOldBackups(mergedOptions.maxBackups || this.defaultOptions.maxBackups);

        this.logger.log(
          `Backup created successfully: ${backupId}`,
          'BackupService',
          {
            backupId,
            totalFiles: copiedFiles.length,
            totalSize,
            compressed: backupInfo.compressed,
            encrypted: backupInfo.encrypted,
          }
        );

        return backupInfo;
      } catch (error) {
        this.logger.error(
          `Failed to create backup: ${backupId}`,
          error.stack,
          'BackupService'
        );
        
        // Cleanup failed backup
        try {
          const backupDir = path.join(this.backupPath, backupId);
          await this.fileManager.deleteDirectory(backupDir);
        } catch (cleanupError) {
          this.logger.error('Failed to cleanup failed backup', cleanupError.stack, 'BackupService');
        }
        
        throw error;
      }
    });
  }

  /**
   * @method restoreBackup
   * @purpose Restore from a backup
   */
  async restoreBackup(backupId: string, targetPath?: string): Promise<void> {
    const restorePath = targetPath || this.dataPath;
    
    return await this.lockManager.withLock('restore-operation', async () => {
      try {
        this.logger.log(
          `Starting backup restore: ${backupId}`,
          'BackupService',
          { backupId, restorePath }
        );

        // Get backup info
        const backupInfo = await this.getBackupInfo(backupId);
        if (!backupInfo) {
          throw new Error(`Backup not found: ${backupId}`);
        }

        // Verify backup integrity
        const isValid = await this.verifyBackupIntegrity(backupInfo);
        if (!isValid) {
          throw new Error('Backup integrity verification failed');
        }

        const backupDir = path.join(this.backupPath, backupId);

        // Decrypt if needed
        if (backupInfo.encrypted) {
          await this.decryptBackup(backupDir);
        }

        // Decompress if needed
        if (backupInfo.compressed) {
          await this.decompressBackup(backupDir);
        }

        // Create restore directory
        await this.fileManager.ensureDirectory(restorePath);

        // Restore files
        for (const filePath of backupInfo.files) {
          const sourceFile = path.join(backupDir, filePath);
          const targetFile = path.join(restorePath, filePath);
          
          // Ensure target directory exists
          await this.fileManager.ensureDirectory(path.dirname(targetFile));
          
          // Copy file
          await this.fileManager.copyFile(sourceFile, targetFile);
        }

        this.logger.log(
          `Backup restored successfully: ${backupId}`,
          'BackupService',
          {
            backupId,
            restoredFiles: backupInfo.files.length,
            restorePath,
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to restore backup: ${backupId}`,
          error.stack,
          'BackupService'
        );
        throw error;
      }
    });
  }

  /**
   * @method listBackups
   * @purpose List available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const backupDirs = await this.fileManager.listDirectory(this.backupPath);
      const backups: BackupInfo[] = [];

      for (const backupDir of backupDirs) {
        try {
          const backupInfo = await this.getBackupInfo(backupDir);
          if (backupInfo) {
            backups.push(backupInfo);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to read backup info for: ${backupDir}`,
            'BackupService'
          );
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return backups;
    } catch (error) {
      this.logger.error(
        'Failed to list backups',
        error.stack,
        'BackupService'
      );
      throw error;
    }
  }

  /**
   * @method deleteBackup
   * @purpose Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupDir = path.join(this.backupPath, backupId);
      
      if (!(await this.fileManager.directoryExists(backupDir))) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      await this.fileManager.deleteDirectory(backupDir);

      this.logger.log(
        `Backup deleted: ${backupId}`,
        'BackupService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete backup: ${backupId}`,
        error.stack,
        'BackupService'
      );
      throw error;
    }
  }

  /**
   * @method verifyBackupIntegrity
   * @purpose Verify backup integrity
   */
  async verifyBackupIntegrity(backupInfo: BackupInfo): Promise<boolean> {
    try {
      const backupDir = path.join(this.backupPath, backupInfo.id);
      const currentChecksum = await this.calculateBackupChecksum(backupDir);
      
      return currentChecksum === backupInfo.checksum;
    } catch (error) {
      this.logger.error(
        `Failed to verify backup integrity: ${backupInfo.id}`,
        error.stack,
        'BackupService'
      );
      return false;
    }
  }

  /**
   * @method scheduledBackup
   * @purpose Scheduled backup creation (daily at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup(): Promise<void> {
    try {
      this.logger.log('Starting scheduled backup', 'BackupService');
      
      const backupInfo = await this.createBackup({
        ...this.defaultOptions,
        verifyIntegrity: true,
      });
      
      this.logger.log(
        `Scheduled backup completed: ${backupInfo.id}`,
        'BackupService'
      );
    } catch (error) {
      this.logger.error(
        'Scheduled backup failed',
        error.stack,
        'BackupService'
      );
    }
  }

  /**
   * @method getBackupInfo
   * @purpose Get backup information
   */
  private async getBackupInfo(backupId: string): Promise<BackupInfo | null> {
    try {
      const backupInfoPath = path.join(this.backupPath, backupId, 'backup-info.json');
      return await this.fileManager.readJsonFile<BackupInfo>(backupInfoPath);
    } catch (error) {
      return null;
    }
  }

  /**
   * @method getFilesToBackup
   * @purpose Get list of files to backup based on patterns
   */
  private async getFilesToBackup(options: BackupOptions): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dirPath: string): Promise<void> => {
      const items = await this.fileManager.listDirectory(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await this.fileManager.getFileStats(itemPath);
        
        if (stats.isDirectory) {
          await scanDirectory(itemPath);
        } else if (stats.isFile) {
          const relativePath = path.relative(this.dataPath, itemPath);
          
          // Check include patterns
          const shouldInclude = options.includePatterns?.some(pattern =>
            this.matchPattern(relativePath, pattern)
          ) ?? true;
          
          // Check exclude patterns
          const shouldExclude = options.excludePatterns?.some(pattern =>
            this.matchPattern(relativePath, pattern)
          ) ?? false;
          
          if (shouldInclude && !shouldExclude) {
            files.push(itemPath);
          }
        }
      }
    };
    
    await scanDirectory(this.dataPath);
    return files;
  }

  /**
   * @method matchPattern
   * @purpose Simple pattern matching (supports * wildcard)
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    );
    
    return regex.test(filePath);
  }

  /**
   * @method calculateBackupChecksum
   * @purpose Calculate checksum for backup directory
   */
  private async calculateBackupChecksum(backupDir: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    
    const processDirectory = async (dirPath: string): Promise<void> => {
      const items = await this.fileManager.listDirectory(dirPath);
      items.sort(); // Ensure consistent ordering
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await this.fileManager.getFileStats(itemPath);
        
        if (stats.isFile && item !== 'backup-info.json') {
          const content = await this.fileManager.readFile(itemPath);
          hash.update(content);
        } else if (stats.isDirectory) {
          await processDirectory(itemPath);
        }
      }
    };
    
    await processDirectory(backupDir);
    return hash.digest('hex');
  }

  /**
   * @method cleanupOldBackups
   * @purpose Remove old backups beyond the limit
   */
  private async cleanupOldBackups(maxBackups: number): Promise<void> {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= maxBackups) {
        return;
      }
      
      const backupsToDelete = backups.slice(maxBackups);
      
      for (const backup of backupsToDelete) {
        await this.deleteBackup(backup.id);
      }
      
      this.logger.log(
        `Cleaned up ${backupsToDelete.length} old backups`,
        'BackupService'
      );
    } catch (error) {
      this.logger.error(
        'Failed to cleanup old backups',
        error.stack,
        'BackupService'
      );
    }
  }

  /**
   * @method generateBackupId
   * @purpose Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    return `backup-${timestamp}-${random}`;
  }

  /**
   * @method ensureBackupDirectory
   * @purpose Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await this.fileManager.ensureDirectory(this.backupPath);
    } catch (error) {
      this.logger.error(
        'Failed to create backup directory',
        error.stack,
        'BackupService'
      );
    }
  }

  // Placeholder methods for compression and encryption
  private async compressBackup(backupDir: string): Promise<void> {
    // TODO: Implement compression using tar/gzip
    this.logger.debug(`Compression not implemented for: ${backupDir}`, 'BackupService');
  }

  private async decompressBackup(backupDir: string): Promise<void> {
    // TODO: Implement decompression
    this.logger.debug(`Decompression not implemented for: ${backupDir}`, 'BackupService');
  }

  private async encryptBackup(backupDir: string): Promise<void> {
    // TODO: Implement encryption
    this.logger.debug(`Encryption not implemented for: ${backupDir}`, 'BackupService');
  }

  private async decryptBackup(backupDir: string): Promise<void> {
    // TODO: Implement decryption
    this.logger.debug(`Decryption not implemented for: ${backupDir}`, 'BackupService');
  }
}