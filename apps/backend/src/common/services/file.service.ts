import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerService } from './logger.service';

/**
 * @class FileService
 * @purpose File system operations service
 */
@Injectable()
export class FileService {
  constructor(private logger: LoggerService) {}

  /**
   * @method exists
   * @purpose Check if file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @method readFile
   * @purpose Read file content
   */
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * @method writeFile
   * @purpose Write file content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * @method writeBinaryFile
   * @purpose Write binary data to file
   */
  async writeBinaryFile(filePath: string, content: Buffer): Promise<void> {
    await fs.writeFile(filePath, content);
  }

  /**
   * @method ensureDirectory
   * @purpose Ensure directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * @method deleteFile
   * @purpose Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * @method copyFile
   * @purpose Copy file
   */
  async copyFile(source: string, destination: string): Promise<void> {
    await fs.copyFile(source, destination);
  }

  /**
   * @method getFileStats
   * @purpose Get file statistics
   */
  async getFileStats(filePath: string): Promise<any> {
    return fs.stat(filePath);
  }
}