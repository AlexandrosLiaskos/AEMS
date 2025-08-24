import { IsOptional, IsString, IsEnum, IsBoolean, IsArray, IsDate, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field, ObjectType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';

// Enums
import { 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus, 
  DeliveryChannel,
  NotificationData 
} from '../../../database/entities/notification.entity';

/**
 * @class CreateNotificationDto
 * @purpose DTO for creating notifications
 */
@InputType()
export class CreateNotificationDto {
  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.EMAIL_PROCESSED,
  })
  @Field(() => String)
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Priority level of notification',
    enum: NotificationPriority,
    example: NotificationPriority.NORMAL,
    required: false,
  })
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiProperty({
    description: 'Notification title',
    example: 'Email Processing Complete',
  })
  @Field()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your email has been successfully processed and categorized.',
  })
  @Field()
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Structured notification data',
    example: { emailId: 'email-123', category: 'invoice' },
    required: false,
  })
  @Field(() => String, { nullable: true }) // JSON string
  @IsOptional()
  @IsObject()
  data?: NotificationData;

  @ApiProperty({
    description: 'URL for notification action',
    example: '/emails/email-123',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiProperty({
    description: 'Label for notification action',
    example: 'View Email',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiProperty({
    description: 'Additional action data',
    example: { emailId: 'email-123' },
    required: false,
  })
  @Field(() => String, { nullable: true }) // JSON string
  @IsOptional()
  @IsObject()
  actionData?: Record<string, any>;

  @ApiProperty({
    description: 'Delivery channels for notification',
    enum: DeliveryChannel,
    isArray: true,
    example: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
    required: false,
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  channels?: DeliveryChannel[];

  @ApiProperty({
    description: 'When notification expires',
    example: '2023-12-31T23:59:59.000Z',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiProperty({
    description: 'When notification should be delivered',
    example: '2023-01-01T09:00:00.000Z',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledFor?: Date;

  @ApiProperty({
    description: 'Related resource ID',
    example: 'email-123',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedResourceId?: string;

  @ApiProperty({
    description: 'Related resource type',
    example: 'email',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedResourceType?: string;

  @ApiProperty({
    description: 'Template ID to use for notification',
    example: 'email-processed-template',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({
    description: 'Template variables',
    example: { userName: 'John', emailCount: 5 },
    required: false,
  })
  @Field(() => String, { nullable: true }) // JSON string
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;

  @ApiProperty({
    description: 'Additional metadata',
    example: { source: 'ai-processing', version: '1.0' },
    required: false,
  })
  @Field(() => String, { nullable: true }) // JSON string
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * @class NotificationFiltersDto
 * @purpose DTO for filtering notifications
 */
@InputType()
export class NotificationFiltersDto {
  @ApiProperty({
    description: 'Filter by notification types',
    enum: NotificationType,
    isArray: true,
    required: false,
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  types?: NotificationType[];

  @ApiProperty({
    description: 'Filter by priority levels',
    enum: NotificationPriority,
    isArray: true,
    required: false,
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationPriority, { each: true })
  priorities?: NotificationPriority[];

  @ApiProperty({
    description: 'Filter by notification statuses',
    enum: NotificationStatus,
    isArray: true,
    required: false,
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationStatus, { each: true })
  statuses?: NotificationStatus[];

  @ApiProperty({
    description: 'Show only unread notifications',
    example: false,
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiProperty({
    description: 'Show only notifications requiring action',
    example: false,
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  actionRequired?: boolean;

  @ApiProperty({
    description: 'Filter from date',
    example: '2023-01-01T00:00:00.000Z',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateFrom?: Date;

  @ApiProperty({
    description: 'Filter to date',
    example: '2023-12-31T23:59:59.000Z',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateTo?: Date;

  @ApiProperty({
    description: 'Filter by related resource type',
    example: 'email',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedResourceType?: string;

  @ApiProperty({
    description: 'Filter by related resource ID',
    example: 'email-123',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedResourceId?: string;
}

/**
 * @class NotificationDto
 * @purpose DTO for notification response
 */
@ObjectType()
export class NotificationDto {
  @ApiProperty({
    description: 'Notification ID',
    example: 'notification-uuid-123',
  })
  @Field()
  id: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.EMAIL_PROCESSED,
  })
  @Field()
  type: string;

  @ApiProperty({
    description: 'Priority level',
    enum: NotificationPriority,
    example: NotificationPriority.NORMAL,
  })
  @Field()
  priority: string;

  @ApiProperty({
    description: 'Current status',
    enum: NotificationStatus,
    example: NotificationStatus.DELIVERED,
  })
  @Field()
  status: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Email Processing Complete',
  })
  @Field()
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your email has been successfully processed.',
  })
  @Field()
  message: string;

  @ApiProperty({
    description: 'Action URL',
    example: '/emails/email-123',
    required: false,
  })
  @Field({ nullable: true })
  actionUrl?: string;

  @ApiProperty({
    description: 'Action label',
    example: 'View Email',
    required: false,
  })
  @Field({ nullable: true })
  actionLabel?: string;

  @ApiProperty({
    description: 'Whether action has been taken',
    example: false,
  })
  @Field()
  actionTaken: boolean;

  @ApiProperty({
    description: 'When notification was read',
    example: '2023-01-01T10:30:00.000Z',
    required: false,
  })
  @Field({ nullable: true })
  readAt?: Date;

  @ApiProperty({
    description: 'When notification was dismissed',
    example: '2023-01-01T10:35:00.000Z',
    required: false,
  })
  @Field({ nullable: true })
  dismissedAt?: Date;

  @ApiProperty({
    description: 'When notification expires',
    example: '2023-12-31T23:59:59.000Z',
    required: false,
  })
  @Field({ nullable: true })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Related resource ID',
    example: 'email-123',
    required: false,
  })
  @Field({ nullable: true })
  relatedResourceId?: string;

  @ApiProperty({
    description: 'Related resource type',
    example: 'email',
    required: false,
  })
  @Field({ nullable: true })
  relatedResourceType?: string;

  @ApiProperty({
    description: 'When notification was created',
    example: '2023-01-01T10:00:00.000Z',
  })
  @Field()
  createdAt: Date;

  @ApiProperty({
    description: 'When notification was last updated',
    example: '2023-01-01T10:30:00.000Z',
  })
  @Field()
  updatedAt: Date;
}

/**
 * @class NotificationListDto
 * @purpose DTO for notification list response
 */
@ObjectType()
export class NotificationListDto {
  @ApiProperty({
    description: 'List of notifications',
    type: [NotificationDto],
  })
  @Field(() => [NotificationDto])
  notifications: NotificationDto[];

  @ApiProperty({
    description: 'Total number of notifications',
    example: 150,
  })
  @Field(() => Int)
  total: number;

  @ApiProperty({
    description: 'Number of unread notifications',
    example: 5,
  })
  @Field(() => Int)
  unread: number;

  @ApiProperty({
    description: 'Current offset',
    example: 0,
  })
  @Field(() => Int)
  offset: number;

  @ApiProperty({
    description: 'Current limit',
    example: 20,
  })
  @Field(() => Int)
  limit: number;

  @ApiProperty({
    description: 'Whether there are more notifications',
    example: true,
  })
  @Field()
  hasMore: boolean;
}

/**
 * @class NotificationStatsDto
 * @purpose DTO for notification statistics
 */
@ObjectType()
export class NotificationStatsDto {
  @ApiProperty({
    description: 'Total notifications',
    example: 150,
  })
  @Field(() => Int)
  total: number;

  @ApiProperty({
    description: 'Unread notifications',
    example: 5,
  })
  @Field(() => Int)
  unread: number;

  @ApiProperty({
    description: 'High priority notifications',
    example: 2,
  })
  @Field(() => Int)
  highPriority: number;

  @ApiProperty({
    description: 'Notifications requiring action',
    example: 3,
  })
  @Field(() => Int)
  actionRequired: number;

  @ApiProperty({
    description: 'Breakdown by type',
    example: { email_processed: 50, sync_completed: 25 },
  })
  @Field(() => String) // JSON string
  byType: string;

  @ApiProperty({
    description: 'Breakdown by status',
    example: { delivered: 100, read: 45, pending: 5 },
  })
  @Field(() => String) // JSON string
  byStatus: string;

  @ApiProperty({
    description: 'Delivery rate',
    example: 0.95,
  })
  @Field()
  deliveryRate: number;

  @ApiProperty({
    description: 'Read rate',
    example: 0.85,
  })
  @Field()
  readRate: number;

  @ApiProperty({
    description: 'Action rate',
    example: 0.75,
  })
  @Field()
  actionRate: number;
}

/**
 * @class BulkNotificationDto
 * @purpose DTO for bulk notification operations
 */
@InputType()
export class BulkNotificationDto extends CreateNotificationDto {
  @ApiProperty({
    description: 'User IDs to send notification to',
    example: ['user-1', 'user-2', 'user-3'],
  })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

/**
 * @class NotificationPreferencesDto
 * @purpose DTO for notification preferences
 */
@InputType()
export class NotificationPreferencesDto {
  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
  })
  @Field()
  @IsBoolean()
  emailNotifications: boolean;

  @ApiProperty({
    description: 'Enable push notifications',
    example: true,
  })
  @Field()
  @IsBoolean()
  pushNotifications: boolean;

  @ApiProperty({
    description: 'Enable in-app notifications',
    example: true,
  })
  @Field()
  @IsBoolean()
  inAppNotifications: boolean;

  @ApiProperty({
    description: 'Enable desktop notifications',
    example: false,
  })
  @Field()
  @IsBoolean()
  desktopNotifications: boolean;

  @ApiProperty({
    description: 'Notification types to enable',
    enum: NotificationType,
    isArray: true,
    example: [NotificationType.EMAIL_PROCESSED, NotificationType.SYNC_COMPLETED],
  })
  @Field(() => [String])
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  enabledTypes: NotificationType[];

  @ApiProperty({
    description: 'Quiet hours start time (24h format)',
    example: '22:00',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiProperty({
    description: 'Quiet hours end time (24h format)',
    example: '08:00',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @ApiProperty({
    description: 'Enable notification batching',
    example: true,
  })
  @Field()
  @IsBoolean()
  enableBatching: boolean;

  @ApiProperty({
    description: 'Batch interval in minutes',
    example: 30,
  })
  @Field(() => Int)
  batchInterval: number;
}