import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LoggerService } from '../../../common/services/logger.service';
import { FileService } from '../../../common/services/file.service';
import { AppDataService } from '../../../common/services/app-data.service';
import { GoogleAuthService, GoogleTokens } from '../../auth/services/google-auth.service';
import { BaseAttachmentService, BaseAttachmentInfo } from '../../../common/services/base-attachment.service';

/**
 * @interface AttachmentInfo
 * @purpose Extended attachment information for email module
 */
export interface AttachmentInfo extends BaseAttachmentInfo {
  attachmentId: string;
  messageId: string;
  userId: string;
  downloadPath?: string;
  isDownloaded: boolean;
  downloadedAt?: Date;
  checksum?: string;
}

/**
 * @interface DownloadOptions
 * @purpose Attachment download options
 */
export interface DownloadOptions {
  overwrite?: boolean;
  validateChecksum?: boolean;
  createThumbnail?: boolean;
  extractText?: boolean;
}

/**
 * @interface DownloadResult
 * @purpose Attachment download result
 */
export interface DownloadResult {
  success: boolean;
  filePath?: string;
  size?: number;
  checksum?: string;
  error?: string;
  thumbnail?: string;
  extractedText?: string;
}

/**
 * @class AttachmentService
 * @purpose Email attachment management service extending base functionality
 */
@Injectable()
export class AttachmentService extends BaseAttachmentService {
  constructor(
    configService: ConfigService,
    logger: LoggerService,
    fileService: FileService,
    private appDataService: AppDataService,
    private googleAuthService: GoogleAuthService,
  ) {
    super(configService, logger, fileService);

    // Override attachments path to use app data path
    (this as any).attachmentsPath = path.join(this.appDataService.getDataPath(), 'attachments');
  }



  /**
   * @method downloadAttachment
   * @purpose Download attachment from Gmail
   */
  async downloadAttachment(
    attachment: AttachmentInfo,
    tokens: GoogleTokens,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    try {
      this.logger.info('Starting attachment download', 'AttachmentService', {
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        size: attachment.size,
      });

      // Validate attachment
      const validation = this.validateAttachment(attachment);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Check if already downloaded and not overwriting
      const filePath = this.getAttachmentPath(attachment, attachment.userId);
      if (!options.overwrite && await this.fileService.exists(filePath)) {
        this.logger.debug('Attachment already exists, skipping download', 'AttachmentService', {
          filePath,
        });

        return {
          success: true,
          filePath,
          size: attachment.size,
        };
      }

      // Get Gmail client
      const gmail = await this.getGmailClient(tokens);

      // Download attachment data
      const attachmentData = await this.fetchAttachmentData(gmail, attachment);

      if (!attachmentData) {
        return {
          success: false,
          error: 'Failed to fetch attachment data',
        };
      }

      // Save attachment to file
      await this.saveAttachmentFile(filePath, attachmentData);

      // Calculate checksum
      const checksum = await this.calculateChecksum(filePath);

      // Create thumbnail if requested and supported
      let thumbnail: string | undefined;
      if (options.createThumbnail && this.isImageFile(attachment.mimeType)) {
        thumbnail = await this.createThumbnail(filePath, attachment);
      }

      // Extract text if requested and supported
      let extractedText: string | undefined;
      if (options.extractText && this.isTextExtractable(attachment.mimeType)) {
        extractedText = await this.extractText(filePath, attachment.mimeType);
      }

      const result: DownloadResult = {
        success: true,
        filePath,
        size: attachmentData.length,
        checksum,
        thumbnail,
        extractedText,
      };

      this.logger.info('Attachment downloaded successfully', 'AttachmentService', {
        attachmentId: attachment.attachmentId,
        filePath,
        size: result.size,
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to download attachment: ${error.message}`, error.stack, 'AttachmentService');

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * @method getGmailClient
   * @purpose Get authenticated Gmail client
   */
  private async getGmailClient(tokens: GoogleTokens): Promise<gmail_v1.Gmail> {
    try {
      const auth = this.googleAuthService.getAuthenticatedClient(tokens);
      return google.gmail({ version: 'v1', auth });
    } catch (error) {
      this.logger.error(`Failed to create Gmail client: ${error.message}`, 'AttachmentService');
      throw new Error('Failed to authenticate with Gmail');
    }
  }

  /**
   * @method fetchAttachmentData
   * @purpose Fetch attachment data from Gmail
   */
  private async fetchAttachmentData(
    gmail: gmail_v1.Gmail,
    attachment: AttachmentInfo
  ): Promise<Buffer | null> {
    try {
      const response = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: attachment.messageId,
        id: attachment.attachmentId,
      });

      if (!response.data.data) {
        throw new Error('No attachment data received');
      }

      return Buffer.from(response.data.data, 'base64');

    } catch (error) {
      this.logger.error(`Failed to fetch attachment data: ${error.message}`, 'AttachmentService');
      return null;
    }
  }

  /**
   * @method validateAttachment
   * @purpose Validate attachment before download
   */
  private validateAttachment(attachment: AttachmentInfo): { isValid: boolean; error?: string } {
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
  private getAttachmentPath(attachment: AttachmentInfo): string {
    // Create user-specific directory
    const userDir = path.join(this.attachmentsPath, attachment.userId);

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(attachment.filename);

    // Add unique identifier to prevent conflicts
    const uniqueFilename = `${attachment.attachmentId}_${sanitizedFilename}`;

    return path.join(userDir, uniqueFilename);
  }

  /**
   * @method sanitizeFilename
   * @purpose Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
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
  private async saveAttachmentFile(filePath: string, data: Buffer): Promise<void> {
    try {
      // Ensure directory exists
      const directory = path.dirname(filePath);
      await this.fileService.ensureDirectory(directory);

      // Write file
      await fs.writeFile(filePath, data);

      this.logger.debug('Attachment file saved', 'AttachmentService', {
        filePath,
        size: data.length,
      });

    } catch (error) {
      this.logger.error(`Failed to save attachment file: ${error.message}`, 'AttachmentService');
      throw error;
    }
  }

  /**
   * @method calculateChecksum
   * @purpose Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const data = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      this.logger.warn(`Failed to calculate checksum: ${error.message}`, 'AttachmentService');
      return '';
    }
  }

  /**
   * @method isImageFile
   * @purpose Check if file is an image
   */
  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * @method isTextExtractable
   * @purpose Check if text can be extracted from file
   */
  private isTextExtractable(mimeType: string): boolean {
    const extractableTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    return extractableTypes.includes(mimeType);
  }

  /**
   * @method createThumbnail
   * @purpose Create thumbnail for image files
   */
  private async createThumbnail(filePath: string, attachment: AttachmentInfo): Promise<string | undefined> {
    try {
      // This would typically use an image processing library like Sharp
      // For now, just return the original file path as placeholder
      this.logger.debug('Thumbnail creation requested', 'AttachmentService', {
        filePath,
        mimeType: attachment.mimeType,
      });

      return filePath; // Placeholder

    } catch (error) {
      this.logger.warn(`Failed to create thumbnail: ${error.message}`, 'AttachmentService');
      return undefined;
    }
  }

  /**
   * @method extractText
   * @purpose Extract text from supported file types
   */
  private async extractText(filePath: string, mimeType: string): Promise<string | undefined> {
    try {
      // This would typically use libraries like pdf-parse, mammoth, etc.
      // For now, just handle plain text files
      if (mimeType === 'text/plain') {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      }

      this.logger.debug('Text extraction requested', 'AttachmentService', {
        filePath,
        mimeType,
      });

      return undefined; // Placeholder for other types

    } catch (error) {
      this.logger.warn(`Failed to extract text: ${error.message}`, 'AttachmentService');
      return undefined;
    }
  }

  /**
   * @method deleteAttachment
   * @purpose Delete attachment file
   */
  async deleteAttachment(attachment: AttachmentInfo): Promise<boolean> {
    try {
      const filePath = this.getAttachmentPath(attachment);

      if (await this.fileService.exists(filePath)) {
        await this.fileService.deleteFile(filePath);
        this.logger.info('Attachment deleted', 'AttachmentService', {
          attachmentId: attachment.attachmentId,
          filePath,
        });
        return true;
      }

      return false;

    } catch (error) {
      this.logger.error(`Failed to delete attachment: ${error.message}`, 'AttachmentService');
      return false;
    }
  }

  /**
   * @method getAttachmentInfo
   * @purpose Get attachment information
   */
  async getAttachmentInfo(attachmentId: string, userId: string): Promise<AttachmentInfo | null> {
    try {
      // This would typically query the database for attachment info
      // For now, return null as placeholder
      return null;

    } catch (error) {
      this.logger.error(`Failed to get attachment info: ${error.message}`, 'AttachmentService');
      return null;
    }
  }

  /**
   * @method listUserAttachments
   * @purpose List all attachments for a user
   */
  async listUserAttachments(userId: string): Promise<AttachmentInfo[]> {
    try {
      // This would typically query the database for user attachments
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      this.logger.error(`Failed to list user attachments: ${error.message}`, 'AttachmentService');
      return [];
    }
  }

  /**
   * @method cleanupOrphanedFiles
   * @purpose Clean up orphaned attachment files
   */
  async cleanupOrphanedFiles(): Promise<number> {
    try {
      let cleanedCount = 0;

      // This would typically:
      // 1. List all files in attachments directory
      // 2. Check which ones are not referenced in database
      // 3. Delete orphaned files

      this.logger.info('Orphaned files cleanup completed', 'AttachmentService', {
        cleanedCount,
      });

      return cleanedCount;

    } catch (error) {
      this.logger.error(`Failed to cleanup orphaned files: ${error.message}`, 'AttachmentService');
      return 0;
    }
  }
}
