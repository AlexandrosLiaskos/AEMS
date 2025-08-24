import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

// Services
import { NotificationService } from '../services/notification.service';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

// GraphQL Types
import { ObjectType, Field, ID, Int, InputType } from '@nestjs/graphql';

/**
 * @class NotificationType
 * @purpose GraphQL type for Notification
 */
@ObjectType()
class NotificationType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field()
  type: string;

  @Field()
  category: string;

  @Field()
  isRead: boolean;

  @Field()
  priority: string;

  @Field({ nullable: true })
  actionUrl?: string;

  @Field({ nullable: true })
  actionText?: string;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  readAt?: Date;
}

/**
 * @class NotificationPreferencesType
 * @purpose GraphQL type for notification preferences
 */
@ObjectType()
class NotificationPreferencesType {
  @Field()
  emailNotificationsEnabled: boolean;

  @Field()
  pushNotificationsEnabled: boolean;

  @Field()
  inAppNotificationsEnabled: boolean;

  @Field()
  digestFrequency: string;

  @Field()
  quietHoursEnabled: boolean;

  @Field({ nullable: true })
  quietHoursStart?: string;

  @Field({ nullable: true })
  quietHoursEnd?: string;
}

/**
 * @class CreateNotificationInput
 * @purpose Input for creating notifications
 */
@InputType()
class CreateNotificationInput {
  @Field()
  title: string;

  @Field()
  message: string;

  @Field()
  type: string;

  @Field()
  category: string;

  @Field({ defaultValue: 'normal' })
  priority: string;

  @Field({ nullable: true })
  actionUrl?: string;

  @Field({ nullable: true })
  actionText?: string;
}

/**
 * @class UpdatePreferencesInput
 * @purpose Input for updating notification preferences
 */
@InputType()
class UpdatePreferencesInput {
  @Field({ nullable: true })
  emailNotificationsEnabled?: boolean;

  @Field({ nullable: true })
  pushNotificationsEnabled?: boolean;

  @Field({ nullable: true })
  inAppNotificationsEnabled?: boolean;

  @Field({ nullable: true })
  digestFrequency?: string;

  @Field({ nullable: true })
  quietHoursEnabled?: boolean;

  @Field({ nullable: true })
  quietHoursStart?: string;

  @Field({ nullable: true })
  quietHoursEnd?: string;
}

/**
 * @class NotificationResolver
 * @purpose GraphQL resolver for notifications
 */
@Resolver(() => NotificationType)
@UseGuards(JwtAuthGuard)
export class NotificationResolver {
  private pubSub: PubSub = new PubSub();

  constructor(private notificationService: NotificationService) {}

  /**
   * Get user notifications
   */
  @Query(() => [NotificationType], { description: 'Get user notifications' })
  async getNotifications(
    @CurrentUser() user: User,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @Args('unreadOnly', { nullable: true, defaultValue: false }) unreadOnly: boolean
  ): Promise<NotificationType[]> {
    const result = await this.notificationService.findByUser(
      user.id,
      { unreadOnly },
      limit,
      offset
    );
    const notifications = result.notifications;

    return notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      category: notification.type, // Use type as category since category doesn't exist
      isRead: !!notification.readAt, // Derive isRead from readAt timestamp
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      actionText: notification.actionLabel, // Use actionLabel instead of actionText
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    }));
  }

  /**
   * Get unread notification count
   */
  @Query(() => Int, { description: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: User): Promise<number> {
    return this.notificationService.getUnreadCount(user.id);
  }

  /**
   * Mark notification as read
   */
  @Mutation(() => Boolean, { description: 'Mark notification as read' })
  async markAsRead(
    @CurrentUser() user: User,
    @Args('notificationId') notificationId: string
  ): Promise<boolean> {
    await this.notificationService.markAsRead(notificationId, user.id);
    return true;
  }

  /**
   * Mark all notifications as read
   */
  @Mutation(() => Boolean, { description: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: User): Promise<boolean> {
    await this.notificationService.markAllAsRead(user.id);
    return true;
  }

  /**
   * Delete notification
   */
  @Mutation(() => Boolean, { description: 'Delete notification' })
  async deleteNotification(
    @CurrentUser() user: User,
    @Args('notificationId') notificationId: string
  ): Promise<boolean> {
    await this.notificationService.delete(notificationId, user.id);
    return true;
  }

  /**
   * Get notification preferences
   */
  @Query(() => NotificationPreferencesType, { description: 'Get notification preferences' })
  async getNotificationPreferences(@CurrentUser() user: User): Promise<NotificationPreferencesType> {
    // This would typically call a preference service
    return {
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: true,
      inAppNotificationsEnabled: true,
      digestFrequency: 'daily',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
  }

  /**
   * Update notification preferences
   */
  @Mutation(() => NotificationPreferencesType, { description: 'Update notification preferences' })
  async updateNotificationPreferences(
    @CurrentUser() user: User,
    @Args('preferences') preferences: UpdatePreferencesInput
  ): Promise<NotificationPreferencesType> {
    // This would typically update preferences via a service
    return {
      emailNotificationsEnabled: preferences.emailNotificationsEnabled ?? true,
      pushNotificationsEnabled: preferences.pushNotificationsEnabled ?? true,
      inAppNotificationsEnabled: preferences.inAppNotificationsEnabled ?? true,
      digestFrequency: preferences.digestFrequency ?? 'daily',
      quietHoursEnabled: preferences.quietHoursEnabled ?? false,
      quietHoursStart: preferences.quietHoursStart ?? '22:00',
      quietHoursEnd: preferences.quietHoursEnd ?? '08:00',
    };
  }

  /**
   * Subscribe to new notifications
   */
  @Subscription(() => NotificationType, {
    description: 'Subscribe to new notifications',
  })
  notificationAdded() {
    return (this.pubSub as any).asyncIterator('notificationAdded');
  }
}