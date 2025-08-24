import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

export interface QuotaUsage {
  daily: QuotaInfo;
  hourly: QuotaInfo;
  perMinute: QuotaInfo;
}

/**
 * Gmail Quota Management Service
 * Handles Gmail API quota tracking and management
 */
@Injectable()
export class GmailQuotaService {
  private readonly quotaLimits = {
    daily: 1000000000, // 1 billion quota units per day
    hourly: 250000000, // 250 million quota units per hour
    perMinute: 250000, // 250,000 quota units per minute
  };

  private quotaUsage = new Map<string, QuotaUsage>();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Check if user has sufficient quota for operation
   */
  async checkQuota(userId: string, operation: string, cost: number = 1): Promise<boolean> {
    const usage = this.getQuotaUsage(userId);
    
    // Check all quota limits
    if (usage.daily.remaining < cost) {
      this.logger.warn(`Daily quota exceeded for user ${userId}`, 'GmailQuotaService');
      return false;
    }
    
    if (usage.hourly.remaining < cost) {
      this.logger.warn(`Hourly quota exceeded for user ${userId}`, 'GmailQuotaService');
      return false;
    }
    
    if (usage.perMinute.remaining < cost) {
      this.logger.warn(`Per-minute quota exceeded for user ${userId}`, 'GmailQuotaService');
      return false;
    }
    
    return true;
  }

  /**
   * Record quota usage for an operation
   */
  async recordUsage(userId: string, operation: string, cost: number = 1): Promise<void> {
    const usage = this.getQuotaUsage(userId);
    
    // Update usage counters
    usage.daily.used += cost;
    usage.hourly.used += cost;
    usage.perMinute.used += cost;
    
    // Recalculate remaining quotas
    usage.daily.remaining = Math.max(0, usage.daily.limit - usage.daily.used);
    usage.hourly.remaining = Math.max(0, usage.hourly.limit - usage.hourly.used);
    usage.perMinute.remaining = Math.max(0, usage.perMinute.limit - usage.perMinute.used);
    
    // Update percentage used
    usage.daily.percentUsed = (usage.daily.used / usage.daily.limit) * 100;
    usage.hourly.percentUsed = (usage.hourly.used / usage.hourly.limit) * 100;
    usage.perMinute.percentUsed = (usage.perMinute.used / usage.perMinute.limit) * 100;
    
    this.quotaUsage.set(userId, usage);
    
    this.logger.debug(
      `Recorded quota usage for user ${userId}: ${operation} (${cost} units)`,
      'GmailQuotaService'
    );
  }

  /**
   * Get current quota usage for user
   */
  getQuotaUsage(userId: string): QuotaUsage {
    if (!this.quotaUsage.has(userId)) {
      this.quotaUsage.set(userId, this.createEmptyUsage());
    }
    
    return this.quotaUsage.get(userId)!;
  }

  /**
   * Reset quota usage (called by scheduled tasks)
   */
  resetQuota(userId: string, period: 'daily' | 'hourly' | 'perMinute'): void {
    const usage = this.getQuotaUsage(userId);
    
    switch (period) {
      case 'daily':
        usage.daily.used = 0;
        usage.daily.remaining = usage.daily.limit;
        usage.daily.percentUsed = 0;
        break;
      case 'hourly':
        usage.hourly.used = 0;
        usage.hourly.remaining = usage.hourly.limit;
        usage.hourly.percentUsed = 0;
        break;
      case 'perMinute':
        usage.perMinute.used = 0;
        usage.perMinute.remaining = usage.perMinute.limit;
        usage.perMinute.percentUsed = 0;
        break;
    }
    
    this.quotaUsage.set(userId, usage);
    
    this.logger.debug(
      `Reset ${period} quota for user ${userId}`,
      'GmailQuotaService'
    );
  }

  /**
   * Get quota statistics for all users
   */
  getQuotaStatistics(): Record<string, QuotaUsage> {
    const stats: Record<string, QuotaUsage> = {};
    
    for (const [userId, usage] of this.quotaUsage.entries()) {
      stats[userId] = usage;
    }
    
    return stats;
  }

  private createEmptyUsage(): QuotaUsage {
    return {
      daily: {
        used: 0,
        limit: this.quotaLimits.daily,
        remaining: this.quotaLimits.daily,
        percentUsed: 0,
      },
      hourly: {
        used: 0,
        limit: this.quotaLimits.hourly,
        remaining: this.quotaLimits.hourly,
        percentUsed: 0,
      },
      perMinute: {
        used: 0,
        limit: this.quotaLimits.perMinute,
        remaining: this.quotaLimits.perMinute,
        percentUsed: 0,
      },
    };
  }
}