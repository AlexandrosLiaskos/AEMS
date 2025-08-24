import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../../../common/services/logger.service';
import { GmailSyncService } from '../services/gmail-sync.service';
import { UserRepository } from '../../../database/repositories/user.repository';

/**
 * Gmail Sync Scheduled Task
 * Handles periodic Gmail synchronization for all users
 */
@Injectable()
export class GmailSyncTask {
  constructor(
    private readonly logger: LoggerService,
    private readonly gmailSyncService: GmailSyncService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Sync Gmail for all users every 15 minutes
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async syncAllUsers(): Promise<void> {
    this.logger.log('Starting scheduled Gmail sync for all users', 'GmailSyncTask');

    try {
      // Get all users with Gmail access
      const users = await this.userRepository.findUsersWithGmailAccess();
      
      this.logger.log(`Found ${users.length} users with Gmail access`, 'GmailSyncTask');

      // Sync emails for each user
      const syncPromises = users.map(async (user) => {
        try {
          await this.gmailSyncService.syncEmails(user.id, {
            accessToken: user.googleTokens.accessToken,
            refreshToken: user.googleTokens.refreshToken,
            expiryDate: user.googleTokens.expiryDate,
            scope: user.googleTokens.scope || [],
          });
          this.logger.debug(`Gmail sync completed for user ${user.id}`, 'GmailSyncTask');
        } catch (error) {
          this.logger.error(
            `Gmail sync failed for user ${user.id}: ${error.message}`,
            'GmailSyncTask',
            error
          );
        }
      });

      await Promise.allSettled(syncPromises);
      
      this.logger.log('Scheduled Gmail sync completed for all users', 'GmailSyncTask');

    } catch (error) {
      this.logger.error(
        `Failed to run scheduled Gmail sync: ${error.message}`,
        'GmailSyncTask',
        error
      );
    }
  }

  /**
   * Sync Gmail for high-priority users every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncHighPriorityUsers(): Promise<void> {
    this.logger.debug('Starting high-priority Gmail sync', 'GmailSyncTask');

    try {
      // Get users with high-priority sync enabled
      const users = await this.userRepository.findUsersWithHighPrioritySync();
      
      if (users.length === 0) {
        return;
      }

      this.logger.log(`Found ${users.length} high-priority users for sync`, 'GmailSyncTask');

      // Sync emails for each high-priority user
      const syncPromises = users.map(async (user) => {
        try {
          await this.gmailSyncService.syncEmails(user.id, {
            accessToken: user.googleTokens.accessToken,
            refreshToken: user.googleTokens.refreshToken,
            expiryDate: user.googleTokens.expiryDate,
            scope: user.googleTokens.scope || [],
          }, {
            maxResults: 50, // Smaller batch for frequent sync
            fullSync: false,
          });
          this.logger.debug(`High-priority Gmail sync completed for user ${user.id}`, 'GmailSyncTask');
        } catch (error) {
          this.logger.error(
            `High-priority Gmail sync failed for user ${user.id}: ${error.message}`,
            'GmailSyncTask',
            error
          );
        }
      });

      await Promise.allSettled(syncPromises);
      
      this.logger.debug('High-priority Gmail sync completed', 'GmailSyncTask');

    } catch (error) {
      this.logger.error(
        `Failed to run high-priority Gmail sync: ${error.message}`,
        'GmailSyncTask',
        error
      );
    }
  }

  /**
   * Clean up old sync data daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldSyncData(): Promise<void> {
    this.logger.log('Starting Gmail sync data cleanup', 'GmailSyncTask');

    try {
      // This would clean up old sync logs, temporary files, etc.
      // Implementation depends on what cleanup is needed
      
      this.logger.log('Gmail sync data cleanup completed', 'GmailSyncTask');

    } catch (error) {
      this.logger.error(
        `Failed to cleanup Gmail sync data: ${error.message}`,
        'GmailSyncTask',
        error
      );
    }
  }
}