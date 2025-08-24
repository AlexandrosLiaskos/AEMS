import { Injectable } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * @interface LockOptions
 * @purpose Lock configuration options
 */
export interface LockOptions {
  timeout?: number; // Lock timeout in milliseconds
  retryDelay?: number; // Delay between retry attempts
  maxRetries?: number; // Maximum number of retry attempts
}

/**
 * @interface Lock
 * @purpose Lock information
 */
export interface Lock {
  id: string;
  resource: string;
  acquiredAt: Date;
  expiresAt: Date;
  owner: string;
}

/**
 * @class LockManagerService
 * @purpose Service for managing resource locks to prevent concurrent access
 */
@Injectable()
export class LockManagerService {
  private locks = new Map<string, Lock>();
  private globalLock: Lock | null = null;
  private lockCounter = 0;

  constructor(private logger: LoggerService) {}

  /**
   * @method acquireLock
   * @purpose Acquire a lock for a specific resource
   */
  async acquireLock(
    resource: string,
    owner: string = 'system',
    options: LockOptions = {}
  ): Promise<string | null> {
    const {
      timeout = 30000, // 30 seconds default
      retryDelay = 100,
      maxRetries = 10,
    } = options;

    const lockId = this.generateLockId();
    const expiresAt = new Date(Date.now() + timeout);

    // Check if resource is already locked
    const existingLock = this.locks.get(resource);
    if (existingLock && existingLock.expiresAt > new Date()) {
      // Try to wait and retry
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await this.delay(retryDelay);
        
        const currentLock = this.locks.get(resource);
        if (!currentLock || currentLock.expiresAt <= new Date()) {
          break;
        }
      }

      // Check again after retries
      const finalCheck = this.locks.get(resource);
      if (finalCheck && finalCheck.expiresAt > new Date()) {
        this.logger.warn(`Failed to acquire lock for resource: ${resource}`, 'LockManagerService');
        return null;
      }
    }

    // Acquire the lock
    const lock: Lock = {
      id: lockId,
      resource,
      acquiredAt: new Date(),
      expiresAt,
      owner,
    };

    this.locks.set(resource, lock);
    this.logger.debug(`Lock acquired: ${lockId} for resource: ${resource}`, 'LockManagerService');

    return lockId;
  }

  /**
   * @method releaseLock
   * @purpose Release a specific lock
   */
  async releaseLock(lockId: string): Promise<boolean> {
    for (const [resource, lock] of this.locks.entries()) {
      if (lock.id === lockId) {
        this.locks.delete(resource);
        this.logger.debug(`Lock released: ${lockId} for resource: ${resource}`, 'LockManagerService');
        return true;
      }
    }

    this.logger.warn(`Lock not found for release: ${lockId}`, 'LockManagerService');
    return false;
  }

  /**
   * @method acquireGlobalLock
   * @purpose Acquire a global lock that blocks all other operations
   */
  async acquireGlobalLock(
    owner: string = 'system',
    options: LockOptions = {}
  ): Promise<string | null> {
    const {
      timeout = 60000, // 60 seconds default for global lock
      retryDelay = 500,
      maxRetries = 20,
    } = options;

    // Check if global lock already exists
    if (this.globalLock && this.globalLock.expiresAt > new Date()) {
      // Try to wait and retry
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await this.delay(retryDelay);
        
        if (!this.globalLock || this.globalLock.expiresAt <= new Date()) {
          break;
        }
      }

      // Check again after retries
      if (this.globalLock && this.globalLock.expiresAt > new Date()) {
        this.logger.warn('Failed to acquire global lock', 'LockManagerService');
        return null;
      }
    }

    const lockId = this.generateLockId();
    const expiresAt = new Date(Date.now() + timeout);

    this.globalLock = {
      id: lockId,
      resource: 'GLOBAL',
      acquiredAt: new Date(),
      expiresAt,
      owner,
    };

    this.logger.log(`Global lock acquired: ${lockId}`, 'LockManagerService');
    return lockId;
  }

  /**
   * @method releaseGlobalLock
   * @purpose Release the global lock
   */
  async releaseGlobalLock(lockId: string): Promise<boolean> {
    if (this.globalLock && this.globalLock.id === lockId) {
      this.globalLock = null;
      this.logger.log(`Global lock released: ${lockId}`, 'LockManagerService');
      return true;
    }

    this.logger.warn(`Global lock not found for release: ${lockId}`, 'LockManagerService');
    return false;
  }

  /**
   * @method isLocked
   * @purpose Check if a resource is currently locked
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);
    return lock ? lock.expiresAt > new Date() : false;
  }

  /**
   * @method isGloballyLocked
   * @purpose Check if global lock is active
   */
  isGloballyLocked(): boolean {
    return this.globalLock ? this.globalLock.expiresAt > new Date() : false;
  }

  /**
   * @method withLock
   * @purpose Execute operation with automatic lock management
   */
  async withLock<T>(
    resource: string,
    operation: () => Promise<T>,
    owner: string = 'system',
    options: LockOptions = {}
  ): Promise<T> {
    const lockId = await this.acquireLock(resource, owner, options);
    
    if (!lockId) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      return await operation();
    } finally {
      await this.releaseLock(lockId);
    }
  }

  /**
   * @method withGlobalLock
   * @purpose Execute operation with global lock
   */
  async withGlobalLock<T>(
    operation: () => Promise<T>,
    owner: string = 'system',
    options: LockOptions = {}
  ): Promise<T> {
    const lockId = await this.acquireGlobalLock(owner, options);
    
    if (!lockId) {
      throw new Error('Failed to acquire global lock');
    }

    try {
      return await operation();
    } finally {
      await this.releaseGlobalLock(lockId);
    }
  }

  /**
   * @method cleanupExpiredLocks
   * @purpose Remove expired locks
   */
  cleanupExpiredLocks(): number {
    const now = new Date();
    let cleanedCount = 0;

    // Clean up resource locks
    for (const [resource, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(resource);
        cleanedCount++;
        this.logger.debug(`Expired lock cleaned up: ${lock.id} for resource: ${resource}`, 'LockManagerService');
      }
    }

    // Clean up global lock
    if (this.globalLock && this.globalLock.expiresAt <= now) {
      this.logger.debug(`Expired global lock cleaned up: ${this.globalLock.id}`, 'LockManagerService');
      this.globalLock = null;
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired locks`, 'LockManagerService');
    }

    return cleanedCount;
  }

  /**
   * @method getLockInfo
   * @purpose Get information about a specific lock
   */
  getLockInfo(resource: string): Lock | null {
    const lock = this.locks.get(resource);
    return lock && lock.expiresAt > new Date() ? { ...lock } : null;
  }

  /**
   * @method getAllLocks
   * @purpose Get information about all active locks
   */
  getAllLocks(): Lock[] {
    const now = new Date();
    const activeLocks: Lock[] = [];

    // Add resource locks
    for (const lock of this.locks.values()) {
      if (lock.expiresAt > now) {
        activeLocks.push({ ...lock });
      }
    }

    // Add global lock
    if (this.globalLock && this.globalLock.expiresAt > now) {
      activeLocks.push({ ...this.globalLock });
    }

    return activeLocks;
  }

  /**
   * @method getLockStats
   * @purpose Get lock statistics
   */
  getLockStats(): {
    totalLocks: number;
    expiredLocks: number;
    globalLockActive: boolean;
    oldestLockAge: number;
  } {
    const now = new Date();
    let totalLocks = 0;
    let expiredLocks = 0;
    let oldestLockAge = 0;

    // Count resource locks
    for (const lock of this.locks.values()) {
      totalLocks++;
      if (lock.expiresAt <= now) {
        expiredLocks++;
      } else {
        const age = now.getTime() - lock.acquiredAt.getTime();
        oldestLockAge = Math.max(oldestLockAge, age);
      }
    }

    // Check global lock
    const globalLockActive = this.globalLock && this.globalLock.expiresAt > now;
    if (this.globalLock) {
      totalLocks++;
      if (this.globalLock.expiresAt <= now) {
        expiredLocks++;
      } else {
        const age = now.getTime() - this.globalLock.acquiredAt.getTime();
        oldestLockAge = Math.max(oldestLockAge, age);
      }
    }

    return {
      totalLocks,
      expiredLocks,
      globalLockActive: !!globalLockActive,
      oldestLockAge,
    };
  }

  /**
   * @method generateLockId
   * @purpose Generate unique lock ID
   */
  private generateLockId(): string {
    return `lock_${Date.now()}_${++this.lockCounter}`;
  }

  /**
   * @method delay
   * @purpose Create delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}