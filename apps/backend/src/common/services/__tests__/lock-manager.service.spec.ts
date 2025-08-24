import { Test, TestingModule } from '@nestjs/testing';
import { LockManagerService, LockOptions } from '../lock-manager.service';
import { LoggerService } from '../logger.service';

describe('LockManagerService', () => {
  let service: LockManagerService;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LockManagerService,
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<LockManagerService>(LockManagerService);
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    // Clean up any locks after each test
    service.cleanupExpiredLocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('acquireLock', () => {
    it('should acquire lock for resource', async () => {
      const lockId = await service.acquireLock('test-resource');

      expect(lockId).toBeTruthy();
      expect(typeof lockId).toBe('string');
      expect(service.isLocked('test-resource')).toBe(true);
    });

    it('should fail to acquire lock when resource is already locked', async () => {
      const firstLockId = await service.acquireLock('test-resource');
      expect(firstLockId).toBeTruthy();

      const secondLockId = await service.acquireLock('test-resource', 'system', {
        timeout: 1000,
        maxRetries: 1,
        retryDelay: 50,
      });

      expect(secondLockId).toBeNull();
    });

    it('should acquire lock after previous lock expires', async () => {
      const firstLockId = await service.acquireLock('test-resource', 'system', {
        timeout: 100, // Very short timeout
      });
      expect(firstLockId).toBeTruthy();

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const secondLockId = await service.acquireLock('test-resource');
      expect(secondLockId).toBeTruthy();
      expect(secondLockId).not.toBe(firstLockId);
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', async () => {
      const lockId = await service.acquireLock('test-resource');
      expect(service.isLocked('test-resource')).toBe(true);

      const released = await service.releaseLock(lockId!);
      expect(released).toBe(true);
      expect(service.isLocked('test-resource')).toBe(false);
    });

    it('should return false for non-existent lock', async () => {
      const released = await service.releaseLock('non-existent-lock');
      expect(released).toBe(false);
    });
  });

  describe('acquireGlobalLock', () => {
    it('should acquire global lock', async () => {
      const lockId = await service.acquireGlobalLock();

      expect(lockId).toBeTruthy();
      expect(service.isGloballyLocked()).toBe(true);
    });

    it('should fail to acquire global lock when already locked', async () => {
      const firstLockId = await service.acquireGlobalLock();
      expect(firstLockId).toBeTruthy();

      const secondLockId = await service.acquireGlobalLock('system', {
        timeout: 1000,
        maxRetries: 1,
        retryDelay: 50,
      });

      expect(secondLockId).toBeNull();
    });
  });

  describe('releaseGlobalLock', () => {
    it('should release global lock successfully', async () => {
      const lockId = await service.acquireGlobalLock();
      expect(service.isGloballyLocked()).toBe(true);

      const released = await service.releaseGlobalLock(lockId!);
      expect(released).toBe(true);
      expect(service.isGloballyLocked()).toBe(false);
    });

    it('should return false for invalid global lock ID', async () => {
      const released = await service.releaseGlobalLock('invalid-lock-id');
      expect(released).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute operation with lock', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.withLock('test-resource', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(service.isLocked('test-resource')).toBe(false); // Lock should be released
    });

    it('should release lock even if operation throws', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(service.withLock('test-resource', operation)).rejects.toThrow('Operation failed');
      expect(service.isLocked('test-resource')).toBe(false); // Lock should be released
    });

    it('should throw error if lock cannot be acquired', async () => {
      // Acquire lock first
      await service.acquireLock('test-resource');

      const operation = jest.fn();

      await expect(
        service.withLock('test-resource', operation, 'system', {
          timeout: 100,
          maxRetries: 1,
          retryDelay: 10,
        })
      ).rejects.toThrow('Failed to acquire lock for resource: test-resource');

      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('withGlobalLock', () => {
    it('should execute operation with global lock', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.withGlobalLock(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(service.isGloballyLocked()).toBe(false); // Lock should be released
    });

    it('should release global lock even if operation throws', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(service.withGlobalLock(operation)).rejects.toThrow('Operation failed');
      expect(service.isGloballyLocked()).toBe(false); // Lock should be released
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should clean up expired locks', async () => {
      // Acquire lock with short timeout
      await service.acquireLock('test-resource', 'system', { timeout: 50 });
      expect(service.isLocked('test-resource')).toBe(true);

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const cleanedCount = service.cleanupExpiredLocks();
      expect(cleanedCount).toBe(1);
      expect(service.isLocked('test-resource')).toBe(false);
    });

    it('should not clean up active locks', async () => {
      await service.acquireLock('test-resource', 'system', { timeout: 5000 });
      expect(service.isLocked('test-resource')).toBe(true);

      const cleanedCount = service.cleanupExpiredLocks();
      expect(cleanedCount).toBe(0);
      expect(service.isLocked('test-resource')).toBe(true);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock information', async () => {
      const lockId = await service.acquireLock('test-resource', 'test-owner');
      
      const lockInfo = service.getLockInfo('test-resource');
      
      expect(lockInfo).toBeTruthy();
      expect(lockInfo!.id).toBe(lockId);
      expect(lockInfo!.resource).toBe('test-resource');
      expect(lockInfo!.owner).toBe('test-owner');
    });

    it('should return null for non-existent lock', () => {
      const lockInfo = service.getLockInfo('non-existent-resource');
      expect(lockInfo).toBeNull();
    });
  });

  describe('getAllLocks', () => {
    it('should return all active locks', async () => {
      await service.acquireLock('resource-1');
      await service.acquireLock('resource-2');
      await service.acquireGlobalLock();

      const locks = service.getAllLocks();
      expect(locks).toHaveLength(3);
      expect(locks.some(lock => lock.resource === 'resource-1')).toBe(true);
      expect(locks.some(lock => lock.resource === 'resource-2')).toBe(true);
      expect(locks.some(lock => lock.resource === 'GLOBAL')).toBe(true);
    });

    it('should not return expired locks', async () => {
      await service.acquireLock('resource-1', 'system', { timeout: 50 });
      
      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const locks = service.getAllLocks();
      expect(locks).toHaveLength(0);
    });
  });

  describe('getLockStats', () => {
    it('should return lock statistics', async () => {
      await service.acquireLock('resource-1');
      await service.acquireLock('resource-2');

      const stats = service.getLockStats();

      expect(stats.totalLocks).toBe(2);
      expect(stats.expiredLocks).toBe(0);
      expect(stats.globalLockActive).toBe(false);
      expect(typeof stats.oldestLockAge).toBe('number');
    });

    it('should include global lock in statistics', async () => {
      await service.acquireGlobalLock();

      const stats = service.getLockStats();

      expect(stats.totalLocks).toBe(1);
      expect(stats.globalLockActive).toBe(true);
    });
  });
});