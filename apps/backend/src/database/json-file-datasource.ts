import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, EntityTarget, ObjectLiteral } from 'typeorm';
import { FileManagerService } from './services/file-manager.service';
import { LockManagerService } from '../common/services/lock-manager.service';
import { LoggerService } from '../common/services/logger.service';
import { AppDataService } from '../common/services/app-data.service';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * @interface JsonFileRepository
 * @purpose Custom repository interface for JSON file operations
 */
export interface JsonFileRepository<T extends ObjectLiteral> {
  find(options?: any): Promise<T[]>;
  findOne(options: any): Promise<T | null>;
  findOneBy(where: any): Promise<T | null>;
  save(entity: T | T[]): Promise<T | T[]>;
  remove(entity: T | T[]): Promise<T | T[]>;
  delete(criteria: any): Promise<any>;
  count(options?: any): Promise<number>;
  create(entityLike?: any): T;
  merge(mergeIntoEntity: T, ...entityLikes: any[]): T;
}

/**
 * @class JsonFileDataSource
 * @purpose Custom TypeORM-compatible data source for JSON file storage
 */
@Injectable()
export class JsonFileDataSource {
  private readonly dataPath: string;
  private readonly repositories = new Map<string, JsonFileRepository<any>>();
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private fileManager: FileManagerService,
    private lockManager: LockManagerService,
    private logger: LoggerService,
    private appDataService: AppDataService
  ) {
    this.dataPath = this.appDataService.getDataPath();
  }

  /**
   * @method initialize
   * @purpose Initialize the JSON file data source
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure data directory exists
      await this.fileManager.ensureDirectory(this.dataPath);

      // Initialize entity directories
      const entityDirs = [
        'users',
        'emails',
        'classifications',
        'extractions',
        'notifications',
        'audit-logs',
        'settings',
      ];

      for (const dir of entityDirs) {
        await this.fileManager.ensureDirectory(path.join(this.dataPath, dir));
      }

      this.initialized = true;
      this.logger.log('JSON File DataSource initialized', 'JsonFileDataSource');
    } catch (error) {
      this.logger.error('Failed to initialize JSON File DataSource', error.stack, 'JsonFileDataSource');
      throw error;
    }
  }

  /**
   * @method getRepository
   * @purpose Get repository for entity
   */
  getRepository<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>
  ): JsonFileRepository<T> {
    const entityName = typeof entityClass === 'string' 
      ? entityClass 
      : (entityClass as any).name || 'unknown';

    if (!this.repositories.has(entityName)) {
      this.repositories.set(entityName, new JsonFileRepositoryImpl<T>(
        entityName,
        this.dataPath,
        this.fileManager,
        this.lockManager,
        this.logger
      ));
    }

    return this.repositories.get(entityName);
  }

  /**
   * @method query
   * @purpose Execute raw query (limited implementation)
   */
  async query(sql: string, parameters?: any[]): Promise<any> {
    // Basic query implementation for compatibility
    // This would need to be expanded for complex queries
    throw new Error('Raw queries not supported in JSON file data source');
  }

  /**
   * @method transaction
   * @purpose Execute operations in transaction
   */
  async transaction<T>(runInTransaction: () => Promise<T>): Promise<T> {
    // Simple transaction implementation using global lock
    const lockId = await this.lockManager.acquireGlobalLock();

    try {
      return await runInTransaction();
    } finally {
      await this.lockManager.releaseGlobalLock(lockId);
    }
  }

  /**
   * @method destroy
   * @purpose Clean up resources
   */
  async destroy(): Promise<void> {
    this.repositories.clear();
    this.initialized = false;
  }
}

/**
 * @class JsonFileRepositoryImpl
 * @purpose Implementation of JSON file repository
 */
class JsonFileRepositoryImpl<T extends ObjectLiteral> implements JsonFileRepository<T> {
  private readonly filePath: string;
  private cache: T[] | null = null;
  private cacheExpiry: number = 0;
  private readonly cacheTtl = 30000; // 30 seconds

  constructor(
    private entityName: string,
    private dataPath: string,
    private fileManager: FileManagerService,
    private lockManager: LockManagerService,
    private logger: LoggerService
  ) {
    this.filePath = path.join(dataPath, `${entityName.toLowerCase()}.json`);
  }

  /**
   * @method find
   * @purpose Find entities with optional filtering
   */
  async find(options?: any): Promise<T[]> {
    const data = await this.loadData();

    if (!options) {
      return data;
    }

    let result = data;

    // Apply where conditions
    if (options.where) {
      result = result.filter(item => this.matchesWhere(item, options.where));
    }

    // Apply ordering
    if (options.order) {
      result = this.applyOrdering(result, options.order);
    }

    // Apply pagination
    if (options.skip || options.take) {
      const skip = options.skip || 0;
      const take = options.take || result.length;
      result = result.slice(skip, skip + take);
    }

    return result;
  }

  /**
   * @method findOne
   * @purpose Find single entity
   */
  async findOne(options: any): Promise<T | null> {
    const results = await this.find({ ...options, take: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * @method findOneBy
   * @purpose Find single entity by criteria
   */
  async findOneBy(where: any): Promise<T | null> {
    return this.findOne({ where });
  }

  /**
   * @method save
   * @purpose Save entity or entities
   */
  async save(entity: T | T[]): Promise<T | T[]> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const lockId = await this.lockManager.acquireLock(this.filePath);

    try {
      const data = await this.loadData();

      for (const ent of entities) {
        const existingIndex = data.findIndex(item =>
          (ent as any).id && (item as any).id === (ent as any).id
        );

        if (existingIndex >= 0) {
          // Update existing
          data[existingIndex] = { ...data[existingIndex], ...ent };
        } else {
          // Add new
          if (!(ent as any).id) {
            (ent as any).id = this.generateId();
          }
          (ent as any).createdAt = (ent as any).createdAt || new Date().toISOString();
          (ent as any).updatedAt = new Date().toISOString();
          data.push(ent);
        }
      }

      await this.saveData(data);
      this.invalidateCache();

      return entity;
    } finally {
      await this.lockManager.releaseLock(lockId);
    }
  }

  /**
   * @method remove
   * @purpose Remove entity or entities
   */
  async remove(entity: T | T[]): Promise<T | T[]> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const lockId = await this.lockManager.acquireLock(this.filePath);

    try {
      const data = await this.loadData();

      for (const ent of entities) {
        const index = data.findIndex(item =>
          (ent as any).id && (item as any).id === (ent as any).id
        );

        if (index >= 0) {
          data.splice(index, 1);
        }
      }

      await this.saveData(data);
      this.invalidateCache();

      return entity;
    } finally {
      await this.lockManager.releaseLock(lockId);
    }
  }

  /**
   * @method delete
   * @purpose Delete entities by criteria
   */
  async delete(criteria: any): Promise<any> {
    const lockId = await this.lockManager.acquireLock(this.filePath);

    try {
      const data = await this.loadData();
      const initialCount = data.length;

      const filteredData = data.filter(item => !this.matchesWhere(item, criteria));

      await this.saveData(filteredData);
      this.invalidateCache();

      return {
        affected: initialCount - filteredData.length,
      };
    } finally {
      await this.lockManager.releaseLock(lockId);
    }
  }

  /**
   * @method count
   * @purpose Count entities
   */
  async count(options?: any): Promise<number> {
    const results = await this.find(options);
    return results.length;
  }

  /**
   * @method create
   * @purpose Create new entity instance
   */
  create(entityLike?: any): T {
    return {
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...entityLike,
    } as T;
  }

  /**
   * @method merge
   * @purpose Merge entities
   */
  merge(mergeIntoEntity: T, ...entityLikes: any[]): T {
    return Object.assign(mergeIntoEntity, ...entityLikes);
  }

  /**
   * @method loadData
   * @purpose Load data from file with caching
   */
  private async loadData(): Promise<T[]> {
    const now = Date.now();

    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      const exists = await this.fileManager.fileExists(this.filePath);
      if (!exists) {
        this.cache = [];
        this.cacheExpiry = now + this.cacheTtl;
        return this.cache;
      }

      const content = await this.fileManager.readFile(this.filePath);
      this.cache = JSON.parse(content);
      this.cacheExpiry = now + this.cacheTtl;

      return this.cache;
    } catch (error) {
      this.logger.error(`Failed to load data from ${this.filePath}`, error.stack, 'JsonFileRepository');
      return [];
    }
  }

  /**
   * @method saveData
   * @purpose Save data to file
   */
  private async saveData(data: T[]): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await this.fileManager.writeFile(this.filePath, content);
    } catch (error) {
      this.logger.error(`Failed to save data to ${this.filePath}`, error.stack, 'JsonFileRepository');
      throw error;
    }
  }

  /**
   * @method invalidateCache
   * @purpose Invalidate cached data
   */
  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * @method matchesWhere
   * @purpose Check if entity matches where conditions
   */
  private matchesWhere(entity: T, where: any): boolean {
    for (const [key, value] of Object.entries(where)) {
      if ((entity as any)[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * @method applyOrdering
   * @purpose Apply ordering to results
   */
  private applyOrdering(data: T[], order: any): T[] {
    return data.sort((a, b) => {
      for (const [key, direction] of Object.entries(order)) {
        const aVal = (a as any)[key];
        const bVal = (b as any)[key];

        if (aVal < bVal) return direction === 'ASC' ? -1 : 1;
        if (aVal > bVal) return direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * @method generateId
   * @purpose Generate unique ID
   */
  private generateId(): string {
    return `${this.entityName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
