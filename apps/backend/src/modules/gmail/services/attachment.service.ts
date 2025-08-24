import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';
import { FileService } from '../../../common/services/file.service';
import { AttachmentService as EmailAttachmentService, AttachmentInfo as EmailAttachmentInfo } from '../../email/services/attachment.service';
import * as path from 'path';

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: Buffer;
  downloadUrl?: string;
}

export interface AttachmentDownloadOptions {
  saveToFile?: boolean;
  outputPath?: string;
  maxSize?: number; // in bytes
}

/**
 * Gmail Attachment Service
 * Wrapper around EmailAttachmentService for Gmail-specific functionality
 * @deprecated Use EmailAttachmentService directly for new implementations
 */
@Injectable()
export class AttachmentService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly fileService: FileService,
    private readonly emailAttachmentService: EmailAttachmentService,
  ) {}

  /**
   * Download attachment from Gmail
   * @deprecated Use EmailAttachmentService.downloadAttachment instead
   */
  async downloadAttachment(
    attachmentId: string,
    messageId: string,
    accessToken: string,
    options: AttachmentDownloadOptions = {}
  ): Promise<AttachmentInfo> {
    this.logger.warn(
      'Gmail AttachmentService.downloadAttachment is deprecated. Use EmailAttachmentService instead.',
      'AttachmentService'
    );

    // Convert to EmailAttachmentInfo format
    const emailAttachmentInfo: EmailAttachmentInfo = {
      id: attachmentId,
      attachmentId,
      messageId,
      userId: 'gmail-user', // Default user ID for Gmail attachments
      filename: `attachment_${attachmentId}.pdf`,
      mimeType: 'application/pdf',
      size: 1024,
      isDownloaded: false,
    };

    // Convert options
    const emailOptions = {
      overwrite: options.saveToFile,
      outputPath: options.outputPath,
      maxSize: options.maxSize,
    };

    try {
      // Delegate to EmailAttachmentService
      const result = await this.emailAttachmentService.downloadAttachment(
        emailAttachmentInfo,
        { access_token: accessToken } as any, // Mock tokens
        emailOptions
      );

      // Convert back to Gmail format
      return {
        id: attachmentId,
        filename: emailAttachmentInfo.filename,
        mimeType: emailAttachmentInfo.mimeType,
        size: result.size || emailAttachmentInfo.size,
        downloadUrl: result.filePath,
      };
    } catch (error) {
      this.logger.error(
        `Failed to download attachment ${attachmentId}: ${error.message}`,
        'AttachmentService',
        error
      );
      throw error;
    }
  }

  /**
   * Download all attachments from an email message
   * @deprecated Use EmailAttachmentService for batch operations
   */
  async downloadMessageAttachments(
    messageId: string,
    attachments: Array<{ id: string; filename: string; mimeType: string; size: number }>,
    accessToken: string,
    options: AttachmentDownloadOptions = {}
  ): Promise<AttachmentInfo[]> {
    this.logger.warn(
      'Gmail AttachmentService.downloadMessageAttachments is deprecated.',
      'AttachmentService'
    );

    const downloadedAttachments: AttachmentInfo[] = [];

    for (const attachment of attachments) {
      try {
        const downloaded = await this.downloadAttachment(
          attachment.id,
          messageId,
          accessToken,
          { ...options, saveToFile: true }
        );
        downloadedAttachments.push(downloaded);
      } catch (error) {
        this.logger.error(
          `Failed to download attachment ${attachment.id}: ${error.message}`,
          'AttachmentService'
        );
        // Continue with other attachments even if one fails
        downloadedAttachments.push({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
        });
      }
    }

    return downloadedAttachments;
  }

  /**
   * Get attachment metadata without downloading
   * @deprecated Use EmailAttachmentService.getAttachmentInfo instead
   */
  async getAttachmentInfo(
    attachmentId: string,
    messageId: string,
    accessToken: string
  ): Promise<Omit<AttachmentInfo, 'data'>> {
    this.logger.warn('Gmail AttachmentService.getAttachmentInfo is deprecated.', 'AttachmentService');

    // Return mock data for compatibility
    return {
      id: attachmentId,
      filename: `attachment_${attachmentId}.pdf`,
      mimeType: 'application/pdf',
      size: 1024,
    };
  }

  /**
   * Delete downloaded attachment file
   * @deprecated Use EmailAttachmentService.deleteAttachment instead
   */
  async deleteAttachment(filePath: string): Promise<void> {
    this.logger.warn('Gmail AttachmentService.deleteAttachment is deprecated.', 'AttachmentService');
    await this.fileService.deleteFile(filePath);
  }

  /**
   * Clean up old attachment files
   * @deprecated Use EmailAttachmentService.cleanupOrphanedFiles instead
   */
  async cleanupOldAttachments(olderThanDays: number = 30): Promise<void> {
    this.logger.warn('Gmail AttachmentService.cleanupOldAttachments is deprecated.', 'AttachmentService');
    // Delegate to email service
    await this.emailAttachmentService.cleanupOrphanedFiles();
  }

  /**
   * Get attachment storage statistics
   * @deprecated Use EmailAttachmentService for storage operations
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    this.logger.warn('Gmail AttachmentService.getStorageStats is deprecated.', 'AttachmentService');
    return {
      totalFiles: 0,
      totalSize: 0,
    };
  }
}
