import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerService } from '../../common/services/logger.service';

/**
 * @interface LockInfo
 * @purpose Lock information interface
 */
export interface LockInfo {
  lockId: string;
  resource: string;
  acquiredAt: Date;
  expiresAt: Date;
  processId: number;
  threadId: string;
}

/**
 * @class LockManagerService
 * @purpose Service for managing file locks to prevent race conditions
 */
@Injectable()
export class LockManagerService {
  private readonly lockDir: string;
  private readonly defaultTimeout: number;
  private readonly activeLocks = new Map<string, LockInfo>();
  private readonly lockRetryInterval: number;
  private readonly maxRetries: number;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    const basePath = this.configService.get<string>('DATABASE_PATH', 'data');
    this.lockDir = path.join(basePath, '.locks');
    this.defaultTimeout = this.configService.get<number>('LOCK_TIMEOUT_MS', 30000); // 30 seconds
    this.lockRetryInterval = this.configService.get<number>('LOCK_RETRY_INTERVAL_MS', 100); // 100ms
    this.maxRetries = this.configService.get<number>('LOCK_MAX_RETRIES', 300); // 30 seconds total
    
    // Ensure lock directory exists
    this.ensureLockDirectory();
    
    // Cleanup expired locks on startup
    this.cleanupExpiredLocks();
    
    // Setup periodic cleanup
    setInterval(() => {
      this.cleanupExpiredLocks();
    }, 60000); // Every minute
  }

  /**
   * @method acquireLock
   * @purpose Acquire a lock for a resource
   */
  async acquireLock(
    resource: string, 
    timeoutMs: number = this.defaultTimeout
  ): Promise<string> {
    const lockId = this.generateLockId();
    const lockFile = this.getLockFilePath(resource);
    const expiresAt = new Date(Date.now() + timeoutMs);
    
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        // Try to create lock file exclusively
        const lockInfo: LockInfo = {
          lockId,
          resource,
          acquiredAt: new Date(),
          expiresAt,
          processId: process.pid,
          threadId: this.getThreadId(),
        };
        
        await fs.writeFile(
          lockFile, 
          JSON.stringify(lockInfo, null, 2), 
          { flag: 'wx' } // Exclusive write
        );
        
        // Store in memory for tracking
        this.activeLocks.set(lockId, lockInfo);
        
        this.logger.debug(
          `Lock acquired: ${resource} (${lockId})`,
          'LockManagerService',
          { resource, lockId, expiresAt }
        );
        
        return lockId;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock file exists, check if it's expired
          try {
            const existingLockContent = await fs.readFile(lockFile, 'utf-8');
            const existingLock: LockInfo = JSON.parse(existingLockContent);
            
            if (new Date() > new Date(existingLock.expiresAt)) {
              // Lock is expired, try to remove it
              await this.forceReleaseLock(resource);
              // Continue to next retry
            } else {
              // Lock is still valid, wait and retry
              await this.delay(this.lockRetryInterval);
              retries++;
            }
          } catch (parseError) {
            // Corrupted lock file, try to remove it
            await this.forceReleaseLock(resource);
          }
        } else {
          this.logger.error(
            `Failed to acquire lock for resource: ${resource}`,
            error.stack,
            'LockManagerService'
          );
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to acquire lock for resource: ${resource} after ${retries} retries`);
  }

  /**
   * @method releaseLock
   * @purpose Release a lock
   */
  async releaseLock(lockId: string): Promise<void> {
    try {
      const lockInfo = this.activeLocks.get(lockId);
      if (!lockInfo) {
        this.logger.warn(
          `Attempted to release unknown lock: ${lockId}`,
          'LockManagerService'
        );
        return;
      }
      
      const lockFile = this.getLockFilePath(lockInfo.resource);
      
      // Verify the lock file still belongs to us
      try {
        const currentLockContent = await fs.readFile(lockFile, 'utf-8');
        const currentLock: LockInfo = JSON.parse(currentLockContent);
        
        if (currentLock.lockId !== lockId) {
          this.logger.warn(
            `Lock file has been taken over by another process: ${lockInfo.resource}`,
            'LockManagerService'
          );
          this.activeLocks.delete(lockId);
          return;
        }
      } catch (error) {
        // Lock file doesn't exist or is corrupted, consider it released
        this.activeLocks.delete(lockId);
        return;
      }
      
      // Remove lock file
      await fs.unlink(lockFile);
      
      // Remove from memory
      this.activeLocks.delete(lockId);
      
      this.logger.debug(
        `Lock released: ${lockInfo.resource} (${lockId})`,
        'LockManagerService',
        { resource: lockInfo.resource, lockId }
      );
    } catch (error) {
      this.logger.error(
        `Failed to release lock: ${lockId}`,
        error.stack,
        'LockManagerService'
      );
      throw error;
    }
  }

  /**
   * @method withLock
   * @purpose Execute function with lock protection
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    timeoutMs: number = this.defaultTimeout
  ): Promise<T> {
    const lockId = await this.acquireLock(resource, timeoutMs);
    
    try {
      return await fn();
    } finally {
      await this.releaseLock(lockId);
    }
  }

  /**
   * @method isLocked
   * @purpose Check if resource is currently locked
   */
  async isLocked(resource: string): Promise<boolean> {
    try {
      const lockFile = this.getLockFilePath(resource);
      const lockContent = await fs.readFile(lockFile, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(lockContent);
      
      // Check if lock is expired
      if (new Date() > new Date(lockInfo.expiresAt)) {
        // Lock is expired, clean it up
        await this.forceReleaseLock(resource);
        return false;
      }
      
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // Lock file doesn't exist
      }
      
      // Corrupted lock file, clean it up
      await this.forceReleaseLock(resource);
      return false;
    }
  }

  /**
   * @method getLockInfo
   * @purpose Get information about a lock
   */
  async getLockInfo(resource: string): Promise<LockInfo | null> {
    try {
      const lockFile = this.getLockFilePath(resource);
      const lockContent = await fs.readFile(lockFile, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(lockContent);
      
      // Check if lock is expired
      if (new Date() > new Date(lockInfo.expiresAt)) {
        await this.forceReleaseLock(resource);
        return null;
      }
      
      return lockInfo;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Lock file doesn't exist
      }
      
      // Corrupted lock file, clean it up
      await this.forceReleaseLock(resource);
      return null;
    }
  }

  /**
   * @method extendLock
   * @purpose Extend lock expiration time
   */
  async extendLock(lockId: string, additionalTimeMs: number): Promise<void> {
    try {
      const lockInfo = this.activeLocks.get(lockId);
      if (!lockInfo) {
        throw new Error(`Lock not found: ${lockId}`);
      }
      
      const lockFile = this.getLockFilePath(lockInfo.resource);
      
      // Update expiration time
      lockInfo.expiresAt = new Date(lockInfo.expiresAt.getTime() + additionalTimeMs);
      
      // Update lock file
      await fs.writeFile(lockFile, JSON.stringify(lockInfo, null, 2));
      
      // Update memory
      this.activeLocks.set(lockId, lockInfo);
      
      this.logger.debug(
        `Lock extended: ${lockInfo.resource} (${lockId}) until ${lockInfo.expiresAt}`,
        'LockManagerService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to extend lock: ${lockId}`,
        error.stack,
        'LockManagerService'
      );
      throw error;
    }
  }

  /**
   * @method forceReleaseLock
   * @purpose Force release a lock (cleanup)
   */
  async forceReleaseLock(resource: string): Promise<void> {
    try {
      const lockFile = this.getLockFilePath(resource);
      await fs.unlink(lockFile);
      
      // Remove from memory if it exists
      for (const [lockId, lockInfo] of this.activeLocks.entries()) {
        if (lockInfo.resource === resource) {
          this.activeLocks.delete(lockId);
          break;
        }
      }
      
      this.logger.debug(
        `Lock force released: ${resource}`,
        'LockManagerService'
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(
          `Failed to force release lock: ${resource}`,
          error.stack,
          'LockManagerService'
        );
      }
    }
  }

  /**
   * @method getActiveLocks
   * @purpose Get all active locks
   */
  getActiveLocks(): LockInfo[] {
    return Array.from(this.activeLocks.values());
  }

  /**
   * @method cleanupExpiredLocks
   * @purpose Clean up expired lock files
   */
  private async cleanupExpiredLocks(): Promise<void> {
    try {
      const lockFiles = await fs.readdir(this.lockDir);
      let cleanedCount = 0;
      
      for (const lockFile of lockFiles) {
        if (!lockFile.endsWith('.lock')) continue;
        
        const lockFilePath = path.join(this.lockDir, lockFile);
        
        try {
          const lockContent = await fs.readFile(lockFilePath, 'utf-8');
          const lockInfo: LockInfo = JSON.parse(lockContent);
          
          if (new Date() > new Date(lockInfo.expiresAt)) {
            await fs.unlink(lockFilePath);
            
            // Remove from memory if it exists
            this.activeLocks.delete(lockInfo.lockId);
            
            cleanedCount++;
          }
        } catch (error) {
          // Corrupted lock file, remove it
          await fs.unlink(lockFilePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        this.logger.debug(
          `Cleaned up ${cleanedCount} expired locks`,
          'LockManagerService'
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to cleanup expired locks',
        error.stack,
        'LockManagerService'
      );
    }
  }

  /**
   * @method ensureLockDirectory
   * @purpose Ensure lock directory exists
   */
  private async ensureLockDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.lockDir, { recursive: true });
    } catch (error) {
      this.logger.error(
        'Failed to create lock directory',
        error.stack,
        'LockManagerService'
      );
    }
  }

  /**
   * @method getLockFilePath
   * @purpose Get lock file path for resource
   */
  private getLockFilePath(resource: string): string {
    const sanitizedResource = resource.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.lockDir, `${sanitizedResource}.lock`);
  }

  /**
   * @method generateLockId
   * @purpose Generate unique lock ID
   */
  private generateLockId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * @method getThreadId
   * @purpose Get current thread identifier
   */
  private getThreadId(): string {
    // In Node.js, we don't have real threads, so use process ID + timestamp
    return `${process.pid}-${Date.now()}`;
  }

  /**
   * @method delay
   * @purpose Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}