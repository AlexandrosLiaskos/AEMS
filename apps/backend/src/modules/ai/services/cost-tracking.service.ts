import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * @interface CostEntry
 * @purpose Individual cost tracking entry
 */
export interface CostEntry {
  id: string;
  userId: string;
  service: 'openai' | 'gmail' | 'other';
  operation: string;
  tokensUsed?: number;
  requestCount: number;
  cost: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * @interface CostSummary
 * @purpose Cost summary for a period
 */
export interface CostSummary {
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  costByService: Record<string, number>;
  costByOperation: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * @interface CostLimit
 * @purpose Cost limit configuration
 */
export interface CostLimit {
  userId: string;
  dailyLimit: number;
  monthlyLimit: number;
  alertThreshold: number; // Percentage (0-100)
  enabled: boolean;
}

/**
 * @class CostTrackingService
 * @purpose Track and manage AI API costs
 */
@Injectable()
export class CostTrackingService {
  private readonly dataPath: string;
  private readonly costEntriesFile: string;
  private readonly costLimitsFile: string;
  private costCache: Map<string, CostEntry[]> = new Map();
  private limitsCache: Map<string, CostLimit> = new Map();

  // Pricing configuration (per 1K tokens)
  private readonly pricing = {
    'gpt-3.5-turbo': 0.002,
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.01,
    'text-embedding-ada-002': 0.0001,
  };

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.dataPath = this.configService.get<string>('DATABASE_PATH', 'data');
    this.costEntriesFile = path.join(this.dataPath, 'cost-entries.json');
    this.costLimitsFile = path.join(this.dataPath, 'cost-limits.json');
  }

  /**
   * @method trackCost
   * @purpose Track a cost entry
   */
  async trackCost(entry: Omit<CostEntry, 'id' | 'timestamp'>): Promise<CostEntry> {
    const costEntry: CostEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Add to cache
    const userEntries = this.costCache.get(entry.userId) || [];
    userEntries.push(costEntry);
    this.costCache.set(entry.userId, userEntries);

    // Persist to file
    await this.saveCostEntries();

    // Check limits
    await this.checkCostLimits(entry.userId);

    this.logger.log(
      `Cost tracked: ${entry.service}/${entry.operation} - $${entry.cost.toFixed(4)} for user ${entry.userId}`,
      'CostTrackingService'
    );

    return costEntry;
  }

  /**
   * @method trackOpenAICost
   * @purpose Track OpenAI API cost
   */
  async trackOpenAICost(
    userId: string,
    operation: string,
    model: string,
    tokensUsed: number,
    metadata?: Record<string, any>
  ): Promise<CostEntry> {
    const cost = this.calculateOpenAICost(model, tokensUsed);

    return this.trackCost({
      userId,
      service: 'openai',
      operation,
      tokensUsed,
      requestCount: 1,
      cost,
      metadata: {
        model,
        ...metadata,
      },
    });
  }

  /**
   * @method trackGmailCost
   * @purpose Track Gmail API cost (quota-based)
   */
  async trackGmailCost(
    userId: string,
    operation: string,
    requestCount: number = 1,
    metadata?: Record<string, any>
  ): Promise<CostEntry> {
    // Gmail API is free but has quotas, we track for monitoring
    const cost = 0;

    return this.trackCost({
      userId,
      service: 'gmail',
      operation,
      requestCount,
      cost,
      metadata,
    });
  }

  /**
   * @method getCostSummary
   * @purpose Get cost summary for a period
   */
  async getCostSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostSummary> {
    await this.loadCostEntries();

    const userEntries = this.costCache.get(userId) || [];
    const periodEntries = userEntries.filter(entry =>
      entry.timestamp >= startDate && entry.timestamp <= endDate
    );

    const totalCost = periodEntries.reduce((sum, entry) => sum + entry.cost, 0);
    const totalRequests = periodEntries.reduce((sum, entry) => sum + entry.requestCount, 0);
    const totalTokens = periodEntries.reduce((sum, entry) => sum + (entry.tokensUsed || 0), 0);

    // Group by service
    const costByService: Record<string, number> = {};
    periodEntries.forEach(entry => {
      costByService[entry.service] = (costByService[entry.service] || 0) + entry.cost;
    });

    // Group by operation
    const costByOperation: Record<string, number> = {};
    periodEntries.forEach(entry => {
      costByOperation[entry.operation] = (costByOperation[entry.operation] || 0) + entry.cost;
    });

    return {
      totalCost,
      totalRequests,
      totalTokens,
      costByService,
      costByOperation,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * @method getDailyCost
   * @purpose Get daily cost for user
   */
  async getDailyCost(userId: string, date: Date = new Date()): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const summary = await this.getCostSummary(userId, startOfDay, endOfDay);
    return summary.totalCost;
  }

  /**
   * @method getMonthlyCost
   * @purpose Get monthly cost for user
   */
  async getMonthlyCost(userId: string, date: Date = new Date()): Promise<number> {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    const summary = await this.getCostSummary(userId, startOfMonth, endOfMonth);
    return summary.totalCost;
  }

  /**
   * @method setCostLimit
   * @purpose Set cost limits for user
   */
  async setCostLimit(limit: CostLimit): Promise<void> {
    this.limitsCache.set(limit.userId, limit);
    await this.saveCostLimits();

    this.logger.log(
      `Cost limits set for user ${limit.userId}: Daily $${limit.dailyLimit}, Monthly $${limit.monthlyLimit}`,
      'CostTrackingService'
    );
  }

  /**
   * @method getCostLimit
   * @purpose Get cost limits for user
   */
  async getCostLimit(userId: string): Promise<CostLimit | null> {
    await this.loadCostLimits();
    return this.limitsCache.get(userId) || null;
  }

  /**
   * @method checkCostLimits
   * @purpose Check if user is approaching or exceeding cost limits
   */
  async checkCostLimits(userId: string): Promise<{
    dailyStatus: 'ok' | 'warning' | 'exceeded';
    monthlyStatus: 'ok' | 'warning' | 'exceeded';
    dailyCost: number;
    monthlyCost: number;
    limits?: CostLimit;
  }> {
    const limits = await this.getCostLimit(userId);
    
    if (!limits || !limits.enabled) {
      return {
        dailyStatus: 'ok',
        monthlyStatus: 'ok',
        dailyCost: 0,
        monthlyCost: 0,
      };
    }

    const dailyCost = await this.getDailyCost(userId);
    const monthlyCost = await this.getMonthlyCost(userId);

    const dailyPercentage = (dailyCost / limits.dailyLimit) * 100;
    const monthlyPercentage = (monthlyCost / limits.monthlyLimit) * 100;

    const dailyStatus = dailyPercentage >= 100 ? 'exceeded' : 
                      dailyPercentage >= limits.alertThreshold ? 'warning' : 'ok';
    
    const monthlyStatus = monthlyPercentage >= 100 ? 'exceeded' : 
                         monthlyPercentage >= limits.alertThreshold ? 'warning' : 'ok';

    // Log warnings/exceeded limits
    if (dailyStatus !== 'ok') {
      this.logger.warn(
        `User ${userId} daily cost ${dailyStatus}: $${dailyCost.toFixed(4)} / $${limits.dailyLimit}`,
        'CostTrackingService'
      );
    }

    if (monthlyStatus !== 'ok') {
      this.logger.warn(
        `User ${userId} monthly cost ${monthlyStatus}: $${monthlyCost.toFixed(4)} / $${limits.monthlyLimit}`,
        'CostTrackingService'
      );
    }

    return {
      dailyStatus,
      monthlyStatus,
      dailyCost,
      monthlyCost,
      limits,
    };
  }

  /**
   * @method canMakeRequest
   * @purpose Check if user can make a request based on cost limits
   */
  async canMakeRequest(userId: string, estimatedCost: number = 0): Promise<boolean> {
    const status = await this.checkCostLimits(userId);
    
    if (status.dailyStatus === 'exceeded' || status.monthlyStatus === 'exceeded') {
      return false;
    }

    if (status.limits) {
      const projectedDailyCost = status.dailyCost + estimatedCost;
      const projectedMonthlyCost = status.monthlyCost + estimatedCost;

      if (projectedDailyCost > status.limits.dailyLimit || 
          projectedMonthlyCost > status.limits.monthlyLimit) {
        return false;
      }
    }

    return true;
  }

  /**
   * @method calculateOpenAICost
   * @purpose Calculate OpenAI API cost
   */
  private calculateOpenAICost(model: string, tokens: number): number {
    const pricePerK = this.pricing[model] || this.pricing['gpt-3.5-turbo'];
    return (tokens / 1000) * pricePerK;
  }

  /**
   * @method loadCostEntries
   * @purpose Load cost entries from file
   */
  private async loadCostEntries(): Promise<void> {
    try {
      const content = await fs.readFile(this.costEntriesFile, 'utf-8');
      const entries: CostEntry[] = JSON.parse(content);

      // Group by user
      this.costCache.clear();
      entries.forEach(entry => {
        const userEntries = this.costCache.get(entry.userId) || [];
        userEntries.push({
          ...entry,
          timestamp: new Date(entry.timestamp),
        });
        this.costCache.set(entry.userId, userEntries);
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load cost entries', error.stack, 'CostTrackingService');
      }
    }
  }

  /**
   * @method saveCostEntries
   * @purpose Save cost entries to file
   */
  private async saveCostEntries(): Promise<void> {
    try {
      const allEntries: CostEntry[] = [];
      this.costCache.forEach(userEntries => {
        allEntries.push(...userEntries);
      });

      // Sort by timestamp
      allEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      await fs.writeFile(this.costEntriesFile, JSON.stringify(allEntries, null, 2));
    } catch (error) {
      this.logger.error('Failed to save cost entries', error.stack, 'CostTrackingService');
    }
  }

  /**
   * @method loadCostLimits
   * @purpose Load cost limits from file
   */
  private async loadCostLimits(): Promise<void> {
    try {
      const content = await fs.readFile(this.costLimitsFile, 'utf-8');
      const limits: CostLimit[] = JSON.parse(content);

      this.limitsCache.clear();
      limits.forEach(limit => {
        this.limitsCache.set(limit.userId, limit);
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load cost limits', error.stack, 'CostTrackingService');
      }
    }
  }

  /**
   * @method saveCostLimits
   * @purpose Save cost limits to file
   */
  private async saveCostLimits(): Promise<void> {
    try {
      const limits = Array.from(this.limitsCache.values());
      await fs.writeFile(this.costLimitsFile, JSON.stringify(limits, null, 2));
    } catch (error) {
      this.logger.error('Failed to save cost limits', error.stack, 'CostTrackingService');
    }
  }

  /**
   * @method getCostLimits
   * @purpose Get cost limits for user (alias for getCostLimit)
   */
  async getCostLimits(userId: string): Promise<CostLimit | null> {
    return this.getCostLimit(userId);
  }

  /**
   * @method setCostLimits
   * @purpose Set cost limits for user (alias for setCostLimit)
   */
  async setCostLimits(userId: string, dailyLimit: number, monthlyLimit: number): Promise<void> {
    const limit: CostLimit = {
      userId,
      dailyLimit,
      monthlyLimit,
      alertThreshold: 80, // Default 80% threshold
      enabled: true,
    };
    return this.setCostLimit(limit);
  }

  /**
   * @method getCurrentUsage
   * @purpose Get current usage for user
   */
  async getCurrentUsage(userId: string): Promise<{
    dailyUsed: number;
    monthlyUsed: number;
  }> {
    const dailyUsed = await this.getDailyCost(userId);
    const monthlyUsed = await this.getMonthlyCost(userId);

    return {
      dailyUsed,
      monthlyUsed,
    };
  }

  /**
   * @method recordUsage
   * @purpose Record usage for user
   */
  async recordUsage(userId: string, cost: number, processingTime: number): Promise<void> {
    await this.trackCost({
      userId,
      service: 'openai',
      operation: 'ai_processing',
      requestCount: 1,
      cost,
      metadata: {
        processingTime,
      },
    });
  }

  /**
   * @method getUsageStats
   * @purpose Get usage statistics for user
   */
  async getUsageStats(userId: string): Promise<{
    totalProcessed: number;
    totalCost: number;
    averageProcessingTime: number;
    successRate: number;
    categoryBreakdown: Record<string, number>;
    dailyCost: number;
    monthlyCost: number;
  }> {
    await this.loadCostEntries();

    const userEntries = this.costCache.get(userId) || [];
    const totalProcessed = userEntries.length;
    const totalCost = userEntries.reduce((sum, entry) => sum + entry.cost, 0);
    
    const processingTimes = userEntries
      .filter(entry => entry.metadata?.processingTime)
      .map(entry => entry.metadata.processingTime);
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    const successRate = 100; // Assume all tracked entries are successful
    const categoryBreakdown = {}; // Would need to be populated from classification data
    
    const dailyCost = await this.getDailyCost(userId);
    const monthlyCost = await this.getMonthlyCost(userId);

    return {
      totalProcessed,
      totalCost,
      averageProcessingTime,
      successRate,
      categoryBreakdown,
      dailyCost,
      monthlyCost,
    };
  }

  /**
   * @method generateId
   * @purpose Generate unique ID
   */
  private generateId(): string {
    return `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}