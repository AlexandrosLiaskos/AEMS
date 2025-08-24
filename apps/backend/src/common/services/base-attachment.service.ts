import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LoggerService } from './logger.service';
import { FileService } from './file.service';

/**
 * @interface BaseAttachmentInfo
 * @purpose Basic attachment information
 */
export interface BaseAttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: Buffer;
  downloadUrl?: string;
}

/**
 * @interface BaseDownloadOptions
 * @purpose Base options for attachment download
 */
export interface BaseDownloadOptions {
  overwrite?: boolean;
  createThumbnail?: boolean;
  extractText?: boolean;
  maxSize?: number;
  outputPath?: string;
}

/**
 * @interface BaseDownloadResult
 * @purpose Base result of attachment download
 */
export interface BaseDownloadResult {
  success: boolean;
  filePath?: string;
  size?: number;
  checksum?: string;
  thumbnail?: string;
  extractedText?: string;
  error?: string;
}

/**
 * @class BaseAttachmentService
 * @purpose Base service for attachment operations
 */
@Injectable()
export class BaseAttachmentService {
  protected readonly attachmentsPath: string;
  protected readonly maxFileSize: number;
  protected readonly allowedMimeTypes: Set<string>;

  constructor(
    protected configService: ConfigService,
    protected logger: LoggerService,
    protected fileService: FileService,
  ) {
    this.attachmentsPath = this.configService.get<string>('ATTACHMENT_STORE_PATH', 'data/attachments');
    this.maxFileSize = this.configService.get<number>('MAX_ATTACHMENT_SIZE', 25 * 1024 * 1024); // 25MB

    // Initialize allowed MIME types
    this.allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed',
    ]);

    this.initializeAttachmentsDirectory();
  }

  /**
   * @method initializeAttachmentsDirectory
   * @purpose Initialize attachments directory
   */
  protected async initializeAttachmentsDirectory(): Promise<void> {
    try {
      await this.fileService.ensureDirectory(this.attachmentsPath);
      this.logger.debug('Attachments directory initialized', 'BaseAttachmentService', {
        path: this.attachmentsPath,
      });
    } catch (error) {
      this.logger.error(`Failed to initialize attachments directory: ${error.message}`, 'BaseAttachmentService');
      throw error;
    }
  }

  /**
   * @method validateAttachment
   * @purpose Validate attachment before processing
   */
  protected validateAttachment(attachment: BaseAttachmentInfo): { isValid: boolean; error?: string } {
    // Check file size
    if (attachment.size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size ${attachment.size} exceeds maximum allowed size ${this.maxFileSize}`,
      };
    }

    // Check MIME type
    if (!this.allowedMimeTypes.has(attachment.mimeType)) {
      return {
        isValid: false,
        error: `MIME type ${attachment.mimeType} is not allowed`,
      };
    }

    // Check filename
    if (!attachment.filename || attachment.filename.trim() === '') {
      return {
        isValid: false,
        error: 'Invalid filename',
      };
    }

    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileExtension = path.extname(attachment.filename).toLowerCase();

    if (dangerousExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File extension ${fileExtension} is not allowed`,
      };
    }

    return { isValid: true };
  }

  /**
   * @method getAttachmentPath
   * @purpose Get file path for attachment
   */
  protected getAttachmentPath(attachment: BaseAttachmentInfo, userId?: string): string {
    // Create user-specific directory if userId is provided
    const baseDir = userId
      ? path.join(this.attachmentsPath, userId)
      : this.attachmentsPath;

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(attachment.filename);

    // Add unique identifier to prevent conflicts
    const uniqueFilename = attachment.id
      ? `${attachment.id}_${sanitizedFilename}`
      : sanitizedFilename;

    return path.join(baseDir, uniqueFilename);
  }

  /**
   * @method sanitizeFilename
   * @purpose Sanitize filename for safe storage
   */
  protected sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();
  }

  /**
   * @method saveAttachmentFile
   * @purpose Save attachment data to file
   */
  protected async saveAttachmentFile(filePath: string, data: Buffer): Promise<void> {
    try {
      // Ensure directory exists
      const directory = path.dirname(filePath);
      await this.fileService.ensureDirectory(directory);

      // Write file
      await fs.writeFile(filePath, data);

      this.logger.debug('Attachment file saved', 'BaseAttachmentService', {
        filePath,
        size: data.length,
      });

    } catch (error) {
      this.logger.error(`Failed to save attachment file: ${error.message}`, 'BaseAttachmentService');
      throw error;
    }
  }

  /**
   * @method calculateChecksum
   * @purpose Calculate file checksum
   */
  protected async calculateChecksum(filePath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const data = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      this.logger.warn(`Failed to calculate checksum: ${error.message}`, 'BaseAttachmentService');
      return '';
    }
  }

  /**
   * @method isImageFile
   * @purpose Check if file is an image
   */
  protected isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * @method isTextExtractable
   * @purpose Check if text can be extracted from file
   */
  protected isTextExtractable(mimeType: string): boolean {
    const extractableTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    return extractableTypes.includes(mimeType);
  }

  /**
   * @method deleteAttachment
   * @purpose Delete attachment file
   */
  async deleteAttachment(attachment: BaseAttachmentInfo, userId?: string): Promise<boolean> {
    try {
      const filePath = this.getAttachmentPath(attachment, userId);

      if (await this.fileService.exists(filePath)) {
        await this.fileService.deleteFile(filePath);
        this.logger.info('Attachment deleted', 'BaseAttachmentService', {
          attachmentId: attachment.id,
          filePath,
        });
        return true;
      }

      return false;

    } catch (error) {
      this.logger.error(`Failed to delete attachment: ${error.message}`, 'BaseAttachmentService');
      return false;
    }
  }
}
