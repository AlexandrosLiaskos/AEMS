import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';

export interface NotificationPreferences {
  userId: string;
  emailNotifications: {
    enabled: boolean;
    emailProcessed: boolean;
    processingErrors: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
    costWarnings: boolean;
  };
  pushNotifications: {
    enabled: boolean;
    emailProcessed: boolean;
    processingErrors: boolean;
    batchComplete: boolean;
    costWarnings: boolean;
  };
  inAppNotifications: {
    enabled: boolean;
    emailProcessed: boolean;
    processingErrors: boolean;
    batchComplete: boolean;
    costWarnings: boolean;
    systemUpdates: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };
  frequency: {
    digestFrequency: 'daily' | 'weekly' | 'monthly';
    maxNotificationsPerHour: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification Preference Service
 * Manages user notification preferences and settings
 */
@Injectable()
export class NotificationPreferenceService {
  private preferences: Map<string, NotificationPreferences> = new Map();

  constructor(private readonly logger: LoggerService) {}

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    let prefs = this.preferences.get(userId);
    
    if (!prefs) {
      prefs = this.createDefaultPreferences(userId);
      this.preferences.set(userId, prefs);
    }

    return prefs;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<NotificationPreferences> {
    const currentPrefs = await this.getPreferences(userId);
    
    const updatedPrefs: NotificationPreferences = {
      ...currentPrefs,
      ...updates,
      userId,
      updatedAt: new Date(),
    };

    this.preferences.set(userId, updatedPrefs);

    this.logger.log(
      `Notification preferences updated for user ${userId}`,
      'NotificationPreferenceService'
    );

    return updatedPrefs;
  }

  /**
   * Check if notification type is enabled for user
   */
  async isNotificationEnabled(
    userId: string,
    type: 'email' | 'push' | 'in-app',
    category: string
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    // Check if the notification type is globally enabled
    switch (type) {
      case 'email':
        if (!prefs.emailNotifications.enabled) return false;
        return prefs.emailNotifications[category] !== false;
      
      case 'push':
        if (!prefs.pushNotifications.enabled) return false;
        return prefs.pushNotifications[category] !== false;
      
      case 'in-app':
        if (!prefs.inAppNotifications.enabled) return false;
        return prefs.inAppNotifications[category] !== false;
      
      default:
        return false;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  async isInQuietHours(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    
    if (!prefs.quietHours.enabled) {
      return false;
    }

    try {
      const now = new Date();
      const userTimezone = prefs.quietHours.timezone || 'UTC';
      
      // Convert current time to user's timezone
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);

      const [currentHour, currentMinute] = userTime.split(':').map(Number);
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = prefs.quietHours.startTime.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;

      const [endHour, endMinute] = prefs.quietHours.endTime.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;

      // Handle quiet hours that span midnight
      if (startTimeMinutes > endTimeMinutes) {
        return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
      } else {
        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
      }
    } catch (error) {
      this.logger.error(
        `Failed to check quiet hours for user ${userId}: ${error.message}`,
        'NotificationPreferenceService',
        error
      );
      return false;
    }
  }

  /**
   * Check if user has exceeded notification rate limit
   */
  async hasExceededRateLimit(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    
    // This would typically check against a rate limiting store
    // For now, we'll just return false
    return false;
  }

  /**
   * Get digest frequency for user
   */
  async getDigestFrequency(userId: string): Promise<'daily' | 'weekly' | 'monthly'> {
    const prefs = await this.getPreferences(userId);
    return prefs.frequency.digestFrequency;
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    const defaultPrefs = this.createDefaultPreferences(userId);
    this.preferences.set(userId, defaultPrefs);

    this.logger.log(
      `Notification preferences reset to defaults for user ${userId}`,
      'NotificationPreferenceService'
    );

    return defaultPrefs;
  }

  /**
   * Create default preferences for a user
   */
  private createDefaultPreferences(userId: string): NotificationPreferences {
    const now = new Date();

    return {
      userId,
      emailNotifications: {
        enabled: true,
        emailProcessed: false, // Don't spam for every email
        processingErrors: true,
        dailyDigest: true,
        weeklyReport: true,
        costWarnings: true,
      },
      pushNotifications: {
        enabled: true,
        emailProcessed: false, // Don't spam for every email
        processingErrors: true,
        batchComplete: true,
        costWarnings: true,
      },
      inAppNotifications: {
        enabled: true,
        emailProcessed: true,
        processingErrors: true,
        batchComplete: true,
        costWarnings: true,
        systemUpdates: true,
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      },
      frequency: {
        digestFrequency: 'daily',
        maxNotificationsPerHour: 10,
      },
      createdAt: now,
      updatedAt: now,
    };
  }
}