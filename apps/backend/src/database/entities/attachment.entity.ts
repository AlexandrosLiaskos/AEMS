import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EmailMessage } from './email-message.entity';

/**
 * @enum AttachmentStatus
 * @purpose Attachment processing status
 */
export enum AttachmentStatus {
  PENDING = 'PENDING',
  DOWNLOADING = 'DOWNLOADING',
  DOWNLOADED = 'DOWNLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  QUARANTINED = 'QUARANTINED',
}

/**
 * @interface AttachmentMetadata
 * @purpose Attachment metadata interface
 */
export interface AttachmentMetadata {
  originalName: string;
  encoding: string;
  disposition: string;
  contentId?: string;
  isInline: boolean;
  checksum: string;
  virusScanResult?: {
    status: 'clean' | 'infected' | 'suspicious' | 'error';
    engine: string;
    signature?: string;
    scannedAt: string;
  };
  extractedText?: string;
  extractedData?: Record<string, any>;
  thumbnailPath?: string;
  previewAvailable: boolean;
}

/**
 * @entity Attachment
 * @purpose Email attachment entity
 */
@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gmailAttachmentId: string;

  @Column()
  filename: string;

  @Column()
  originalFilename: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ nullable: true })
  contentId: string;

  @Column({ default: false })
  isInline: boolean;

  @Column({
    type: 'enum',
    enum: AttachmentStatus,
    default: AttachmentStatus.PENDING,
  })
  status: AttachmentStatus;

  @Column({ nullable: true })
  filePath: string;

  @Column({ nullable: true })
  downloadUrl: string;

  @Column({ nullable: true })
  previewUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'json', nullable: true })
  metadata: AttachmentMetadata;

  @Column({ nullable: true })
  checksum: string;

  @Column({ default: 0 })
  downloadAttempts: number;

  @Column({ nullable: true })
  lastDownloadError: string;

  @Column({ nullable: true })
  downloadedAt: Date;

  @Column({ nullable: true })
  processedAt: Date;

  @Column({ default: 0 })
  processingAttempts: number;

  @Column({ nullable: true })
  lastProcessingError: string;

  @Column({ type: 'text', nullable: true })
  extractedText: string;

  @Column({ type: 'json', nullable: true })
  extractedData: Record<string, any>;

  @Column({ default: false })
  isProcessed: boolean;

  @Column({ default: false })
  hasPreview: boolean;

  @Column({ default: false })
  isQuarantined: boolean;

  @Column({ nullable: true })
  quarantineReason: string;

  @Column({ nullable: true })
  quarantinedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => EmailMessage, (email) => email.attachments)
  @JoinColumn({ name: 'emailId' })
  email: EmailMessage;

  @Column()
  emailId: string;

  /**
   * @method isDownloadable
   * @purpose Check if attachment can be downloaded
   */
  isDownloadable(): boolean {
    return (
      this.status === AttachmentStatus.PENDING &&
      this.downloadAttempts < 3 &&
      !this.isQuarantined
    );
  }

  /**
   * @method isProcessable
   * @purpose Check if attachment can be processed
   */
  isProcessable(): boolean {
    return (
      this.status === AttachmentStatus.DOWNLOADED &&
      this.processingAttempts < 3 &&
      !this.isQuarantined &&
      this.isProcessableType()
    );
  }

  /**
   * @method isProcessableType
   * @purpose Check if attachment type can be processed
   */
  isProcessableType(): boolean {
    const processableTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/tiff',
    ];

    return processableTypes.includes(this.mimeType);
  }

  /**
   * @method isImage
   * @purpose Check if attachment is an image
   */
  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  /**
   * @method isDocument
   * @purpose Check if attachment is a document
   */
  isDocument(): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    return documentTypes.includes(this.mimeType);
  }

  /**
   * @method getFileExtension
   * @purpose Get file extension
   */
  getFileExtension(): string {
    return this.filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * @method getHumanReadableSize
   * @purpose Get human-readable file size
   */
  getHumanReadableSize(): string {
    const bytes = Number(this.size);
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * @method markAsDownloading
   * @purpose Mark attachment as downloading
   */
  markAsDownloading(): void {
    this.status = AttachmentStatus.DOWNLOADING;
    this.updatedAt = new Date();
  }

  /**
   * @method markAsDownloaded
   * @purpose Mark attachment as downloaded
   */
  markAsDownloaded(filePath: string, checksum: string): void {
    this.status = AttachmentStatus.DOWNLOADED;
    this.filePath = filePath;
    this.checksum = checksum;
    this.downloadedAt = new Date();
    this.downloadAttempts = 0;
    this.lastDownloadError = null;
    this.updatedAt = new Date();
  }

  /**
   * @method markDownloadFailed
   * @purpose Mark download as failed
   */
  markDownloadFailed(error: string): void {
    this.status = AttachmentStatus.FAILED;
    this.downloadAttempts += 1;
    this.lastDownloadError = error;
    this.updatedAt = new Date();
  }

  /**
   * @method markAsProcessing
   * @purpose Mark attachment as processing
   */
  markAsProcessing(): void {
    this.status = AttachmentStatus.PROCESSING;
    this.updatedAt = new Date();
  }

  /**
   * @method markAsProcessed
   * @purpose Mark attachment as processed
   */
  markAsProcessed(extractedText?: string, extractedData?: Record<string, any>): void {
    this.status = AttachmentStatus.PROCESSED;
    this.isProcessed = true;
    this.processedAt = new Date();
    this.processingAttempts = 0;
    this.lastProcessingError = null;
    
    if (extractedText) {
      this.extractedText = extractedText;
    }
    
    if (extractedData) {
      this.extractedData = extractedData;
    }
    
    this.updatedAt = new Date();
  }

  /**
   * @method markProcessingFailed
   * @purpose Mark processing as failed
   */
  markProcessingFailed(error: string): void {
    this.status = AttachmentStatus.FAILED;
    this.processingAttempts += 1;
    this.lastProcessingError = error;
    this.updatedAt = new Date();
  }

  /**
   * @method quarantine
   * @purpose Quarantine attachment
   */
  quarantine(reason: string): void {
    this.status = AttachmentStatus.QUARANTINED;
    this.isQuarantined = true;
    this.quarantineReason = reason;
    this.quarantinedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * @method releaseFromQuarantine
   * @purpose Release attachment from quarantine
   */
  releaseFromQuarantine(): void {
    this.isQuarantined = false;
    this.quarantineReason = null;
    this.quarantinedAt = null;
    
    // Reset status based on current state
    if (this.downloadedAt) {
      this.status = AttachmentStatus.DOWNLOADED;
    } else {
      this.status = AttachmentStatus.PENDING;
    }
    
    this.updatedAt = new Date();
  }

  /**
   * @method setVirusScanResult
   * @purpose Set virus scan result
   */
  setVirusScanResult(result: {
    status: 'clean' | 'infected' | 'suspicious' | 'error';
    engine: string;
    signature?: string;
  }): void {
    this.metadata = {
      ...this.metadata,
      virusScanResult: {
        ...result,
        scannedAt: new Date().toISOString(),
      },
    };

    // Quarantine if infected or suspicious
    if (result.status === 'infected' || result.status === 'suspicious') {
      this.quarantine(`Virus scan result: ${result.status}${result.signature ? ` (${result.signature})` : ''}`);
    }

    this.updatedAt = new Date();
  }

  /**
   * @method setPreviewUrls
   * @purpose Set preview and thumbnail URLs
   */
  setPreviewUrls(previewUrl?: string, thumbnailUrl?: string): void {
    if (previewUrl) {
      this.previewUrl = previewUrl;
      this.hasPreview = true;
    }
    
    if (thumbnailUrl) {
      this.thumbnailUrl = thumbnailUrl;
    }
    
    this.updatedAt = new Date();
  }

  /**
   * @method canGeneratePreview
   * @purpose Check if preview can be generated
   */
  canGeneratePreview(): boolean {
    const previewableTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ];

    return previewableTypes.includes(this.mimeType) && this.status === AttachmentStatus.DOWNLOADED;
  }

  /**
   * @method isSafe
   * @purpose Check if attachment is safe
   */
  isSafe(): boolean {
    if (this.isQuarantined) return false;
    
    const virusScanResult = this.metadata?.virusScanResult;
    if (virusScanResult) {
      return virusScanResult.status === 'clean';
    }
    
    // If no virus scan result, consider safe for now
    return true;
  }

  /**
   * @method toSummary
   * @purpose Convert to summary object
   */
  toSummary(): Partial<Attachment> {
    return {
      id: this.id,
      filename: this.filename,
      mimeType: this.mimeType,
      size: this.size,
      status: this.status,
      isInline: this.isInline,
      hasPreview: this.hasPreview,
      isProcessed: this.isProcessed,
      isQuarantined: this.isQuarantined,
      downloadUrl: this.downloadUrl,
      previewUrl: this.previewUrl,
      thumbnailUrl: this.thumbnailUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}