import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { WebSocketNotificationService } from '../services/websocket-notification.service';

// DTOs
import {
  CreateNotificationDto,
  NotificationFiltersDto,
  NotificationDto,
  NotificationListDto,
  NotificationStatsDto,
  BulkNotificationDto,
  NotificationPreferencesDto,
} from '../dto/notification.dto';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../auth/guards/roles.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User, UserRole } from '../../../database/entities/user.entity';

/**
 * @class NotificationController
 * @purpose REST API controller for notification operations
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private notificationPreferenceService: NotificationPreferenceService,
    private webSocketNotificationService: WebSocketNotificationService
  ) {}

  /**
   * @method getNotifications
   * @purpose Get user notifications with filtering and pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: NotificationListDto,
  })
  async getNotifications(
    @CurrentUser() user: User,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
    @Query() filters: NotificationFiltersDto
  ): Promise<NotificationListDto> {
    const { notifications, total } = await this.notificationService.findByUser(
      user.id,
      filters,
      limit,
      offset
    );

    // Count unread notifications
    const unread = notifications.filter(n => 
      ['pending', 'delivered'].includes(n.status)
    ).length;

    return {
      notifications: notifications.map(n => this.transformNotificationToDto(n)),
      total,
      unread,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * @method getNotification
   * @purpose Get single notification by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get single notification by ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
    type: NotificationDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async getNotification(
    @CurrentUser() user: User,
    @Param('id') id: string
  ): Promise<NotificationDto> {
    const notification = await this.notificationService.findById(id, user.id);
    return this.transformNotificationToDto(notification);
  }

  /**
   * @method createNotification
   * @purpose Create a new notification (Admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new notification (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    type: NotificationDto,
  })
  async createNotification(
    @Body('userId') userId: string,
    @Body() notificationData: CreateNotificationDto
  ): Promise<NotificationDto> {
    const notification = await this.notificationService.create(userId, notificationData);
    return this.transformNotificationToDto(notification);
  }

  /**
   * @method createBulkNotification
   * @purpose Create bulk notifications (Admin only)
   */
  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create bulk notifications (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Bulk notifications created successfully',
  })
  async createBulkNotification(
    @Body() bulkData: BulkNotificationDto
  ): Promise<{
    success: boolean;
    totalProcessed: number;
    successful: number;
    failed: number;
  }> {
    const { userIds, ...notificationData } = bulkData;
    const result = await this.notificationService.createBulk(userIds, notificationData);
    
    return {
      success: result.success,
      totalProcessed: result.totalProcessed,
      successful: result.successful,
      failed: result.failed,
    };
  }

  /**
   * @method markAsRead
   * @purpose Mark notification as read
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
    type: NotificationDto,
  })
  async markAsRead(
    @CurrentUser() user: User,
    @Param('id') id: string
  ): Promise<NotificationDto> {
    const notification = await this.notificationService.markAsRead(id, user.id);
    return this.transformNotificationToDto(notification);
  }

  /**
   * @method markAllAsRead
   * @purpose Mark all notifications as read
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  async markAllAsRead(@CurrentUser() user: User): Promise<{
    success: boolean;
    markedCount: number;
  }> {
    const markedCount = await this.notificationService.markAllAsRead(user.id);
    
    return {
      success: true,
      markedCount,
    };
  }

  /**
   * @method dismissNotification
   * @purpose Dismiss notification
   */
  @Patch(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification dismissed successfully',
    type: NotificationDto,
  })
  async dismissNotification(
    @CurrentUser() user: User,
    @Param('id') id: string
  ): Promise<NotificationDto> {
    const notification = await this.notificationService.dismiss(id, user.id);
    return this.transformNotificationToDto(notification);
  }

  /**
   * @method takeAction
   * @purpose Take action on notification
   */
  @Patch(':id/action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take action on notification' })
  @ApiResponse({
    status: 200,
    description: 'Action taken on notification successfully',
    type: NotificationDto,
  })
  async takeAction(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('actionData') actionData?: Record<string, any>
  ): Promise<NotificationDto> {
    const notification = await this.notificationService.takeAction(id, user.id, actionData);
    return this.transformNotificationToDto(notification);
  }

  /**
   * @method deleteNotification
   * @purpose Delete notification
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted successfully',
  })
  async deleteNotification(
    @CurrentUser() user: User,
    @Param('id') id: string
  ): Promise<void> {
    await this.notificationService.delete(id, user.id);
  }

  /**
   * @method getStats
   * @purpose Get notification statistics
   */
  @Get('stats/summary')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({
    status: 200,
    description: 'Notification statistics retrieved successfully',
    type: NotificationStatsDto,
  })
  async getStats(@CurrentUser() user: User): Promise<NotificationStatsDto> {
    const stats = await this.notificationService.getStats(user.id);
    
    return {
      total: stats.total,
      unread: stats.unread,
      highPriority: stats.highPriority,
      actionRequired: stats.actionRequired,
      byType: JSON.stringify(stats.byType),
      byStatus: JSON.stringify(stats.byStatus),
      deliveryRate: stats.deliveryRate,
      readRate: stats.readRate,
      actionRate: stats.actionRate,
    };
  }

  /**
   * @method getPreferences
   * @purpose Get notification preferences
   */
  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences retrieved successfully',
  })
  async getPreferences(@CurrentUser() user: User): Promise<any> {
    return await this.notificationPreferenceService.getPreferences(user.id);
  }

  /**
   * @method updatePreferences
   * @purpose Update notification preferences
   */
  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully',
  })
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() preferences: NotificationPreferencesDto
  ): Promise<{ success: boolean; message: string }> {
    // Transform DTO to match the expected NotificationPreferences structure
    const preferencesUpdate = {
      emailNotifications: {
        enabled: preferences.emailNotifications,
        emailProcessed: preferences.enabledTypes.includes('EMAIL_PROCESSED' as any),
        processingErrors: preferences.enabledTypes.includes('PROCESSING_ERROR' as any),
        dailyDigest: preferences.enabledTypes.includes('DAILY_DIGEST' as any),
        weeklyReport: preferences.enabledTypes.includes('WEEKLY_REPORT' as any),
        costWarnings: preferences.enabledTypes.includes('COST_WARNING' as any),
      },
      pushNotifications: {
        enabled: preferences.pushNotifications,
        emailProcessed: preferences.enabledTypes.includes('EMAIL_PROCESSED' as any),
        processingErrors: preferences.enabledTypes.includes('PROCESSING_ERROR' as any),
        batchComplete: preferences.enabledTypes.includes('BATCH_COMPLETE' as any),
        costWarnings: preferences.enabledTypes.includes('COST_WARNING' as any),
      },
      inAppNotifications: {
        enabled: preferences.inAppNotifications,
        emailProcessed: preferences.enabledTypes.includes('EMAIL_PROCESSED' as any),
        processingErrors: preferences.enabledTypes.includes('PROCESSING_ERROR' as any),
        batchComplete: preferences.enabledTypes.includes('BATCH_COMPLETE' as any),
        costWarnings: preferences.enabledTypes.includes('COST_WARNING' as any),
        systemUpdates: preferences.enabledTypes.includes('SYSTEM_UPDATE' as any),
      },
      quietHours: {
        enabled: !!(preferences.quietHoursStart && preferences.quietHoursEnd),
        startTime: preferences.quietHoursStart || '22:00',
        endTime: preferences.quietHoursEnd || '08:00',
        timezone: 'UTC', // Default timezone
      },
      frequency: {
        digestFrequency: 'daily' as const,
        maxNotificationsPerHour: preferences.enableBatching ? Math.ceil(60 / preferences.batchInterval) : 60,
      },
    };

    await this.notificationPreferenceService.updatePreferences(user.id, preferencesUpdate);
    
    return {
      success: true,
      message: 'Notification preferences updated successfully',
    };
  }

  /**
   * @method getConnectionStats
   * @purpose Get WebSocket connection statistics (Admin only)
   */
  @Get('websocket/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get WebSocket connection statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Connection statistics retrieved successfully',
  })
  async getConnectionStats(): Promise<{
    totalConnections: number;
    uniqueUsers: number;
    averageConnectionsPerUser: number;
    connectedUsers: string[];
  }> {
    const stats = this.webSocketNotificationService.getConnectionStats();
    const connectedUsers = this.webSocketNotificationService.getConnectedUsers();
    
    return {
      ...stats,
      connectedUsers,
    };
  }

  /**
   * @method broadcastNotification
   * @purpose Broadcast notification to all users (Admin only)
   */
  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Broadcast notification to all users (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Notification broadcasted successfully',
  })
  async broadcastNotification(
    @Body() notificationData: CreateNotificationDto
  ): Promise<{ success: boolean; message: string }> {
    // Get all connected users
    const connectedUsers = this.webSocketNotificationService.getConnectedUsers();
    
    if (connectedUsers.length === 0) {
      return {
        success: false,
        message: 'No users currently connected',
      };
    }

    // Create notifications for all connected users
    await this.notificationService.createBulk(connectedUsers, notificationData);
    
    return {
      success: true,
      message: `Notification broadcasted to ${connectedUsers.length} connected users`,
    };
  }

  /**
   * @method testNotification
   * @purpose Send test notification to current user
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test notification to current user' })
  @ApiResponse({
    status: 200,
    description: 'Test notification sent successfully',
  })
  async testNotification(@CurrentUser() user: User): Promise<{
    success: boolean;
    message: string;
  }> {
    const testNotification: CreateNotificationDto = {
      type: 'system_update' as any,
      priority: 'normal' as any,
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working correctly.',
      actionUrl: '/notifications',
      actionLabel: 'View Notifications',
    };

    await this.notificationService.create(user.id, testNotification);
    
    return {
      success: true,
      message: 'Test notification sent successfully',
    };
  }

  /**
   * @method transformNotificationToDto
   * @purpose Transform Notification entity to DTO
   */
  private transformNotificationToDto(notification: any): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      status: notification.status,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      actionTaken: notification.actionTaken,
      readAt: notification.readAt,
      dismissedAt: notification.dismissedAt,
      expiresAt: notification.expiresAt,
      relatedResourceId: notification.relatedResourceId,
      relatedResourceType: notification.relatedResourceType,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}