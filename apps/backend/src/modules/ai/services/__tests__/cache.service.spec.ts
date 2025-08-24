import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService, CacheOptions } from '../cache.service';
import { LoggerService } from '../../../../common/services/logger.service';

describe('CacheService', () => {
  let service: CacheService;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(3600), // Default TTL
    };

    const mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
  });

  afterEach(async () => {
    // Clear cache after each test
    await service.clear();
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set and get', () => {
    it('should set and get value', async () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const options: CacheOptions = { ttl: 0.1 }; // 100ms

      await service.set(key, value, options);
      
      // Should exist immediately
      let result = await service.get(key);
      expect(result).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      result = await service.get(key);
      expect(result).toBeNull();
    });

    it('should use namespace in key', async () => {
      const key = 'test-key';
      const value1 = 'value1';
      const value2 = 'value2';

      await service.set(key, value1, { namespace: 'ns1' });
      await service.set(key, value2, { namespace: 'ns2' });

      const result1 = await service.get(key, { namespace: 'ns1' });
      const result2 = await service.get(key, { namespace: 'ns2' });

      expect(result1).toBe(value1);
      expect(result2).toBe(value2);
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      const key = 'test-key';
      await service.set(key, 'test-value');

      const exists = await service.has(key);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await service.has('non-existent-key');
      expect(exists).toBe(false);
    });

    it('should return false for expired key', async () => {
      const key = 'test-key';
      await service.set(key, 'test-value', { ttl: 0.1 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const exists = await service.has(key);
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      const key = 'test-key';
      await service.set(key, 'test-value');

      const deleted = await service.delete(key);
      expect(deleted).toBe(true);

      const result = await service.get(key);
      expect(result).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await service.delete('non-existent-key');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      await service.clear();

      const result1 = await service.get('key1');
      const result2 = await service.get('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should clear only specific namespace', async () => {
      await service.set('key1', 'value1', { namespace: 'ns1' });
      await service.set('key2', 'value2', { namespace: 'ns2' });

      await service.clear('ns1');

      const result1 = await service.get('key1', { namespace: 'ns1' });
      const result2 = await service.get('key2', { namespace: 'ns2' });

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'test-key';
      const cachedValue = 'cached-value';
      const factory = jest.fn().mockResolvedValue('factory-value');

      await service.set(key, cachedValue);

      const result = await service.getOrSet(key, factory);

      expect(result).toBe(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const key = 'test-key';
      const factoryValue = 'factory-value';
      const factory = jest.fn().mockResolvedValue(factoryValue);

      const result = await service.getOrSet(key, factory);

      expect(result).toBe(factoryValue);
      expect(factory).toHaveBeenCalled();

      // Should be cached now
      const cachedResult = await service.get(key);
      expect(cachedResult).toBe(factoryValue);
    });

    it('should handle factory errors', async () => {
      const key = 'test-key';
      const error = new Error('Factory error');
      const factory = jest.fn().mockRejectedValue(error);

      await expect(service.getOrSet(key, factory)).rejects.toThrow(error);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.memoryUsage).toBe('number');
    });
  });

  describe('cleanup', () => {
    it('should automatically clean up expired entries', async () => {
      // Set entry with very short TTL
      await service.set('test-key', 'test-value', { ttl: 0.05 }); // 50ms

      // Wait for cleanup interval (this is a simplified test)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Entry should be cleaned up
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values', async () => {
      await service.set('null-key', null);
      await service.set('undefined-key', undefined);

      const nullResult = await service.get('null-key');
      const undefinedResult = await service.get('undefined-key');

      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });

    it('should handle complex objects', async () => {
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          date: new Date(),
          regex: /test/g,
        },
        func: () => 'test',
      };

      await service.set('complex-key', complexObject);
      const result = await service.get('complex-key');

      expect(result).toEqual(complexObject);
    });

    it('should handle concurrent access', async () => {
      const key = 'concurrent-key';
      const promises = [];

      // Simulate concurrent set operations
      for (let i = 0; i < 10; i++) {
        promises.push(service.set(`${key}-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      // Verify all values were set
      for (let i = 0; i < 10; i++) {
        const result = await service.get(`${key}-${i}`);
        expect(result).toBe(`value-${i}`);
      }
    });
  });
});