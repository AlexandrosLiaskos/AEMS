import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface CacheEntry
 * @purpose Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * @interface CacheOptions
 * @purpose Cache operation options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
}

/**
 * @class CacheService
 * @purpose In-memory cache service for AI operations
 */
@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtl: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.defaultTtl = this.configService.get('ai.classification.cacheTtl', 3600); // 1 hour default
    
    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * @method get
   * @purpose Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return null;
    }

    this.logger.debug(`Cache hit: ${fullKey}`, 'CacheService');
    return entry.value;
  }

  /**
   * @method set
   * @purpose Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    const ttl = options.ttl || this.defaultTtl;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (ttl * 1000),
      createdAt: now,
    };

    this.cache.set(fullKey, entry);
    this.logger.debug(`Cache set: ${fullKey} (TTL: ${ttl}s)`, 'CacheService');
  }

  /**
   * @method delete
   * @purpose Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);
    const deleted = this.cache.delete(fullKey);
    
    if (deleted) {
      this.logger.debug(`Cache delete: ${fullKey}`, 'CacheService');
    }
    
    return deleted;
  }

  /**
   * @method has
   * @purpose Check if key exists in cache
   */
  async has(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  /**
   * @method clear
   * @purpose Clear all cache entries
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      // Clear specific namespace
      const prefix = `${namespace}:`;
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(prefix));
      keysToDelete.forEach(key => this.cache.delete(key));
      this.logger.log(`Cleared cache namespace: ${namespace}`, 'CacheService');
    } else {
      // Clear all
      this.cache.clear();
      this.logger.log('Cleared all cache entries', 'CacheService');
    }
  }

  /**
   * @method getOrSet
   * @purpose Get value from cache or set if not exists
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * @method buildKey
   * @purpose Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * @method cleanup
   * @purpose Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(`Cache cleanup: removed ${removedCount} expired entries`, 'CacheService');
    }
  }

  /**
   * @method getStats
   * @purpose Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    // This is a simplified implementation
    // In production, you'd want to track hits/misses
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      memoryUsage: 0, // Would need to calculate actual memory usage
    };
  }

  /**
   * @method onModuleDestroy
   * @purpose Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}