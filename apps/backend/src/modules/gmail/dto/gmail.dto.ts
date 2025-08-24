import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field, ObjectType, Int } from '@nestjs/graphql';

/**
 * @class GmailSyncOptionsDto
 * @purpose Gmail synchronization options DTO
 */
@InputType()
export class GmailSyncOptionsDto {
  @ApiProperty({
    description: 'Maximum number of emails to sync',
    example: 100,
    required: false,
    minimum: 1,
    maximum: 1000,
  })
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxResults?: number = 100;

  @ApiProperty({
    description: 'Perform full sync (ignore last sync time)',
    example: false,
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  fullSync?: boolean = false;

  @ApiProperty({
    description: 'Gmail label IDs to sync',
    example: ['INBOX', 'SENT'],
    required: false,
    type: [String],
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[] = ['INBOX'];

  @ApiProperty({
    description: 'Gmail search query',
    example: 'is:unread',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  query?: string = '';

  @ApiProperty({
    description: 'Include spam and trash emails',
    example: false,
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeSpamTrash?: boolean = false;
}

/**
 * @class EmailFiltersDto
 * @purpose Email filtering options DTO
 */
@InputType()
export class EmailFiltersDto {
  @ApiProperty({
    description: 'Filter by sender email',
    example: 'sender@example.com',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({
    description: 'Filter by recipient email',
    example: 'recipient@example.com',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({
    description: 'Filter by subject keywords',
    example: 'invoice',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    description: 'Filter by date range start',
    example: '2023-01-01',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter by date range end',
    example: '2023-12-31',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiProperty({
    description: 'Filter by labels',
    example: ['INBOX', 'IMPORTANT'],
    required: false,
    type: [String],
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiProperty({
    description: 'Filter by attachment presence',
    example: true,
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasAttachment?: boolean;

  @ApiProperty({
    description: 'Filter by read status',
    example: false,
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

/**
 * @class GmailAuthUrlDto
 * @purpose Gmail authorization URL response DTO
 */
@ObjectType()
export class GmailAuthUrlDto {
  @ApiProperty({
    description: 'Gmail OAuth2 authorization URL',
    example: 'https://accounts.google.com/o/oauth2/v2/auth?...',
  })
  @Field()
  authUrl: string;

  @ApiProperty({
    description: 'State parameter for OAuth flow',
    example: 'user-id-123',
  })
  @Field()
  state: string;

  @ApiProperty({
    description: 'OAuth scopes requested',
    example: ['https://www.googleapis.com/auth/gmail.readonly'],
    type: [String],
  })
  @Field(() => [String])
  scopes: string[];
}

/**
 * @class GmailTokenInfoDto
 * @purpose Gmail token information DTO
 */
@ObjectType()
export class GmailTokenInfoDto {
  @ApiProperty({
    description: 'Whether Gmail access is configured',
    example: true,
  })
  @Field()
  isValid: boolean;

  @ApiProperty({
    description: 'Whether the access token is expired',
    example: false,
  })
  @Field()
  isExpired: boolean;

  @ApiProperty({
    description: 'Token expiration date',
    example: '2023-12-31T23:59:59.000Z',
    required: false,
  })
  @Field({ nullable: true })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Remaining time in seconds',
    example: 3600,
  })
  @Field(() => Int)
  remainingSeconds: number;

  @ApiProperty({
    description: 'OAuth scopes granted',
    example: ['https://www.googleapis.com/auth/gmail.readonly'],
    type: [String],
  })
  @Field(() => [String])
  scopes: string[];
}

/**
 * @class GmailSyncResultDto
 * @purpose Gmail synchronization result DTO
 */
@ObjectType()
export class GmailSyncResultDto {
  @ApiProperty({
    description: 'Whether the sync was successful',
    example: true,
  })
  @Field()
  success: boolean;

  @ApiProperty({
    description: 'Total emails processed',
    example: 150,
  })
  @Field(() => Int)
  totalProcessed: number;

  @ApiProperty({
    description: 'Total emails added',
    example: 25,
  })
  @Field(() => Int)
  totalAdded: number;

  @ApiProperty({
    description: 'Total emails updated',
    example: 5,
  })
  @Field(() => Int)
  totalUpdated: number;

  @ApiProperty({
    description: 'Total emails skipped',
    example: 115,
  })
  @Field(() => Int)
  totalSkipped: number;

  @ApiProperty({
    description: 'Total emails failed to process',
    example: 5,
  })
  @Field(() => Int)
  totalFailed: number;

  @ApiProperty({
    description: 'Sync start time',
    example: '2023-01-01T10:00:00.000Z',
  })
  @Field()
  startedAt: Date;

  @ApiProperty({
    description: 'Sync completion time',
    example: '2023-01-01T10:05:30.000Z',
  })
  @Field()
  completedAt: Date;

  @ApiProperty({
    description: 'Sync duration in milliseconds',
    example: 330000,
  })
  @Field(() => Int)
  duration: number;

  @ApiProperty({
    description: 'Sync errors',
    example: [],
    type: [Object],
  })
  @Field(() => [GmailSyncErrorDto])
  errors: GmailSyncErrorDto[];
}

/**
 * @class GmailSyncErrorDto
 * @purpose Gmail sync error DTO
 */
@ObjectType()
export class GmailSyncErrorDto {
  @ApiProperty({
    description: 'Gmail message ID that failed',
    example: '1234567890abcdef',
  })
  @Field()
  messageId: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Failed to parse email headers',
  })
  @Field()
  error: string;

  @ApiProperty({
    description: 'Additional error details',
    example: 'Stack trace or additional context',
    required: false,
  })
  @Field({ nullable: true })
  details?: string;
}

/**
 * @class GmailProfileDto
 * @purpose Gmail user profile DTO
 */
@ObjectType()
export class GmailProfileDto {
  @ApiProperty({
    description: 'Gmail email address',
    example: 'user@gmail.com',
  })
  @Field()
  emailAddress: string;

  @ApiProperty({
    description: 'Total number of messages',
    example: 15420,
  })
  @Field(() => Int)
  messagesTotal: number;

  @ApiProperty({
    description: 'Total number of threads',
    example: 8750,
  })
  @Field(() => Int)
  threadsTotal: number;

  @ApiProperty({
    description: 'Gmail history ID',
    example: '1234567890',
  })
  @Field()
  historyId: string;
}

/**
 * @class GmailLabelDto
 * @purpose Gmail label DTO
 */
@ObjectType()
export class GmailLabelDto {
  @ApiProperty({
    description: 'Label ID',
    example: 'INBOX',
  })
  @Field()
  id: string;

  @ApiProperty({
    description: 'Label name',
    example: 'Inbox',
  })
  @Field()
  name: string;

  @ApiProperty({
    description: 'Label type',
    example: 'system',
  })
  @Field()
  type: string;

  @ApiProperty({
    description: 'Number of messages with this label',
    example: 42,
    required: false,
  })
  @Field(() => Int, { nullable: true })
  messagesTotal?: number;

  @ApiProperty({
    description: 'Number of unread messages with this label',
    example: 5,
    required: false,
  })
  @Field(() => Int, { nullable: true })
  messagesUnread?: number;

  @ApiProperty({
    description: 'Number of threads with this label',
    example: 38,
    required: false,
  })
  @Field(() => Int, { nullable: true })
  threadsTotal?: number;

  @ApiProperty({
    description: 'Number of unread threads with this label',
    example: 4,
    required: false,
  })
  @Field(() => Int, { nullable: true })
  threadsUnread?: number;
}

/**
 * @class GmailQuotaDto
 * @purpose Gmail API quota information DTO
 */
@ObjectType()
export class GmailQuotaDto {
  @ApiProperty({
    description: 'Daily quota limit',
    example: 1000000000,
  })
  @Field(() => Int)
  dailyLimit: number;

  @ApiProperty({
    description: 'Daily quota used',
    example: 150000,
  })
  @Field(() => Int)
  dailyUsed: number;

  @ApiProperty({
    description: 'Daily quota remaining',
    example: 999850000,
  })
  @Field(() => Int)
  dailyRemaining: number;

  @ApiProperty({
    description: 'Requests per second limit',
    example: 100,
  })
  @Field(() => Int)
  rateLimit: number;

  @ApiProperty({
    description: 'Current requests per second',
    example: 5,
  })
  @Field(() => Int)
  currentRate: number;

  @ApiProperty({
    description: 'Whether quota is available',
    example: true,
  })
  @Field()
  isAvailable: boolean;

  @ApiProperty({
    description: 'Time until quota reset (seconds)',
    example: 43200,
  })
  @Field(() => Int)
  resetInSeconds: number;
}