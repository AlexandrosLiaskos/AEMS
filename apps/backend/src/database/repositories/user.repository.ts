import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { User } from '../entities/user.entity';
import { LoggerService } from '../../common/services/logger.service';
import { AppDataService } from '../../common/services/app-data.service';
import { FileService } from '../../common/services/file.service';

/**
 * @class UserRepository
 * @purpose Repository for User entity operations
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  protected readonly fileName = 'users.json';

  constructor(
    logger: LoggerService,
    appDataService: AppDataService,
    fileService: FileService,
  ) {
    super(logger, appDataService, fileService);
    this.initializeFilePath();
  }

  /**
   * @method findByEmail
   * @purpose Find user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  /**
   * @method findByGoogleId
   * @purpose Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.findOne({ googleId });
  }

  /**
   * @method findActiveUsers
   * @purpose Find all active users
   */
  async findActiveUsers(): Promise<User[]> {
    return this.findAll({ where: { isActive: true } });
  }

  /**
   * @method findByRole
   * @purpose Find users by role
   */
  async findByRole(role: string): Promise<User[]> {
    return this.findAll({ where: { role } });
  }

  /**
   * @method updateLastLogin
   * @purpose Update user's last login time
   */
  async updateLastLogin(userId: string): Promise<User | null> {
    return this.update(userId, { lastLoginAt: new Date() });
  }

  /**
   * @method updateGoogleTokens
   * @purpose Update user's Google OAuth tokens
   */
  async updateGoogleTokens(userId: string, tokens: {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
  }): Promise<User | null> {
    return this.update(userId, { googleTokens: tokens });
  }

  /**
   * @method deactivateUser
   * @purpose Deactivate user account
   */
  async deactivateUser(userId: string): Promise<User | null> {
    return this.update(userId, { 
      isActive: false,
      status: 'INACTIVE' as any,
    });
  }

  /**
   * @method activateUser
   * @purpose Activate user account
   */
  async activateUser(userId: string): Promise<User | null> {
    return this.update(userId, { 
      isActive: true,
      status: 'ACTIVE' as any,
    });
  }

  /**
   * @method findUsersWithGmailAccess
   * @purpose Find users with Gmail access tokens
   */
  async findUsersWithGmailAccess(): Promise<User[]> {
    const allUsers = await this.findAll();
    return allUsers.filter(user => 
      (user.googleTokens?.accessToken && user.googleTokens?.refreshToken) ||
      (user.gmailAccessToken && user.gmailRefreshToken)
    );
  }

  /**
   * @method findUsersWithHighPrioritySync
   * @purpose Find users with high-priority sync enabled
   */
  async findUsersWithHighPrioritySync(): Promise<User[]> {
    const allUsers = await this.findAll();
    return allUsers.filter(user => 
      user.settings?.highPrioritySync === true &&
      ((user.googleTokens?.accessToken && user.googleTokens?.refreshToken) ||
       (user.gmailAccessToken && user.gmailRefreshToken))
    );
  }

  /**
   * @method getUserStats
   * @purpose Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
    recentLogins: number;
  }> {
    const allUsers = await this.findAll();
    const activeUsers = allUsers.filter(user => user.isActive);
    const inactiveUsers = allUsers.filter(user => !user.isActive);
    
    // Count by role
    const byRole: Record<string, number> = {};
    allUsers.forEach(user => {
      byRole[user.role] = (byRole[user.role] || 0) + 1;
    });

    // Count recent logins (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentLogins = allUsers.filter(user => 
      user.lastLoginAt && user.lastLoginAt > sevenDaysAgo
    ).length;

    return {
      total: allUsers.length,
      active: activeUsers.length,
      inactive: inactiveUsers.length,
      byRole,
      recentLogins,
    };
  }
}