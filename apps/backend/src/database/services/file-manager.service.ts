import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerService } from '../../common/services/logger.service';

/**
 * @interface FileStats
 * @purpose File statistics interface
 */
export interface FileStats {
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * @class FileManagerService
 * @purpose Service for managing JSON file operations with atomic writes
 */
@Injectable()
export class FileManagerService {
  private readonly basePath: string;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.basePath = this.configService.get<string>('DATABASE_PATH', 'data');
  }

  /**
   * @method ensureDirectory
   * @purpose Ensure directory exists, create if not
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      
      this.logger.debug(
        `Directory ensured: ${fullPath}`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to ensure directory: ${dirPath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method fileExists
   * @purpose Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @method directoryExists
   * @purpose Check if directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(dirPath);
      const stats = await fs.stat(fullPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * @method readFile
   * @purpose Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      this.logger.debug(
        `File read: ${fullPath} (${content.length} bytes)`,
        'FileManagerService'
      );
      
      return content;
    } catch (error) {
      this.logger.error(
        `Failed to read file: ${filePath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method writeFile
   * @purpose Write file content with atomic operation
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      const tempPath = `${fullPath}.tmp`;
      
      // Ensure directory exists
      await this.ensureDirectory(path.dirname(fullPath));
      
      // Write to temporary file first
      await fs.writeFile(tempPath, content, 'utf-8');
      
      // Atomic rename
      await fs.rename(tempPath, fullPath);
      
      this.logger.debug(
        `File written: ${fullPath} (${content.length} bytes)`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to write file: ${filePath}`,
        error.stack,
        'FileManagerService'
      );
      
      // Clean up temp file if it exists
      try {
        const tempPath = `${this.resolvePath(filePath)}.tmp`;
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  /**
   * @method appendFile
   * @purpose Append content to file
   */
  async appendFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      
      // Ensure directory exists
      await this.ensureDirectory(path.dirname(fullPath));
      
      await fs.appendFile(fullPath, content, 'utf-8');
      
      this.logger.debug(
        `Content appended to file: ${fullPath} (${content.length} bytes)`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to append to file: ${filePath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method deleteFile
   * @purpose Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.unlink(fullPath);
      
      this.logger.debug(
        `File deleted: ${fullPath}`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete file: ${filePath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method deleteDirectory
   * @purpose Delete directory and all contents
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.rm(fullPath, { recursive: true, force: true });
      
      this.logger.debug(
        `Directory deleted: ${fullPath}`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete directory: ${dirPath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method copyFile
   * @purpose Copy file
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      const fullSourcePath = this.resolvePath(sourcePath);
      const fullDestPath = this.resolvePath(destPath);
      
      // Ensure destination directory exists
      await this.ensureDirectory(path.dirname(fullDestPath));
      
      await fs.copyFile(fullSourcePath, fullDestPath);
      
      this.logger.debug(
        `File copied: ${fullSourcePath} -> ${fullDestPath}`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to copy file: ${sourcePath} -> ${destPath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method moveFile
   * @purpose Move/rename file
   */
  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      const fullSourcePath = this.resolvePath(sourcePath);
      const fullDestPath = this.resolvePath(destPath);
      
      // Ensure destination directory exists
      await this.ensureDirectory(path.dirname(fullDestPath));
      
      await fs.rename(fullSourcePath, fullDestPath);
      
      this.logger.debug(
        `File moved: ${fullSourcePath} -> ${fullDestPath}`,
        'FileManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to move file: ${sourcePath} -> ${destPath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method getFileStats
   * @purpose Get file statistics
   */
  async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const fullPath = this.resolvePath(filePath);
      const stats = await fs.stat(fullPath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get file stats: ${filePath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method listDirectory
   * @purpose List directory contents
   */
  async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const fullPath = this.resolvePath(dirPath);
      const files = await fs.readdir(fullPath);
      
      this.logger.debug(
        `Directory listed: ${fullPath} (${files.length} items)`,
        'FileManagerService'
      );
      
      return files;
    } catch (error) {
      this.logger.error(
        `Failed to list directory: ${dirPath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method readJsonFile
   * @purpose Read and parse JSON file
   */
  async readJsonFile<T = any>(filePath: string): Promise<T> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger.error(
          `Invalid JSON in file: ${filePath}`,
          error.stack,
          'FileManagerService'
        );
        throw new Error(`Invalid JSON in file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * @method writeJsonFile
   * @purpose Write object as JSON file
   */
  async writeJsonFile(filePath: string, data: any): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await this.writeFile(filePath, content);
    } catch (error) {
      this.logger.error(
        `Failed to write JSON file: ${filePath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method getDirectorySize
   * @purpose Get total size of directory
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const fullPath = this.resolvePath(dirPath);
      let totalSize = 0;

      const calculateSize = async (currentPath: string): Promise<void> => {
        const stats = await fs.stat(currentPath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          const files = await fs.readdir(currentPath);
          for (const file of files) {
            await calculateSize(path.join(currentPath, file));
          }
        }
      };

      await calculateSize(fullPath);
      return totalSize;
    } catch (error) {
      this.logger.error(
        `Failed to calculate directory size: ${dirPath}`,
        error.stack,
        'FileManagerService'
      );
      throw error;
    }
  }

  /**
   * @method cleanupTempFiles
   * @purpose Clean up temporary files
   */
  async cleanupTempFiles(): Promise<number> {
    try {
      const fullPath = this.resolvePath('');
      let cleanedCount = 0;

      const cleanup = async (currentPath: string): Promise<void> => {
        const files = await fs.readdir(currentPath);
        
        for (const file of files) {
          const filePath = path.join(currentPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile() && file.endsWith('.tmp')) {
            // Check if temp file is old (older than 1 hour)
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (stats.mtime.getTime() < oneHourAgo) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          } else if (stats.isDirectory()) {
            await cleanup(filePath);
          }
        }
      };

      await cleanup(fullPath);
      
      this.logger.log(
        `Cleaned up ${cleanedCount} temporary files`,
        'FileManagerService'
      );
      
      return cleanedCount;
    } catch (error) {
      this.logger.error(
        'Failed to cleanup temporary files',
        error.stack,
        'FileManagerService'
      );
      return 0;
    }
  }

  /**
   * @method resolvePath
   * @purpose Resolve path relative to base path
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.basePath, filePath);
  }
}