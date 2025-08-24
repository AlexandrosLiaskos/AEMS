import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerService } from '../../common/services/logger.service';
import { AppDataService } from '../../common/services/app-data.service';
import { FileService } from '../../common/services/file.service';

/**
 * @interface BaseEntity
 * @purpose Base entity interface
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @interface QueryOptions
 * @purpose Query options for repository operations
 */
export interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
}

/**
 * @interface PaginatedResult
 * @purpose Paginated query result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * @class BaseRepository
 * @purpose Base repository for JSON file-based data storage
 */
@Injectable()
export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract readonly fileName: string;
  protected data: T[] = [];
  private isLoaded = false;
  private filePath: string;

  constructor(
    protected logger: LoggerService,
    protected appDataService: AppDataService,
    protected fileService: FileService,
  ) {
    // filePath will be set by derived classes in their constructor
  }

  /**
   * @method initializeFilePath
   * @purpose Initialize file path - must be called by derived classes
   */
  protected initializeFilePath(): void {
    this.filePath = path.join(this.appDataService.getDataPath(), this.fileName);
  }

  /**
   * @method ensureLoaded
   * @purpose Ensure data is loaded from file
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadData();
      this.isLoaded = true;
    }
  }

  /**
   * @method loadData
   * @purpose Load data from JSON file
   */
  private async loadData(): Promise<void> {
    try {
      if (await this.fileService.exists(this.filePath)) {
        const fileContent = await this.fileService.readFile(this.filePath);
        const jsonData = JSON.parse(fileContent);
        
        // Convert date strings back to Date objects
        this.data = jsonData.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }));

        this.logger.debug(`Loaded ${this.data.length} records from ${this.fileName}`, 'BaseRepository');
      } else {
        this.data = [];
        await this.saveData(); // Create empty file
        this.logger.debug(`Created new data file: ${this.fileName}`, 'BaseRepository');
      }
    } catch (error) {
      this.logger.error(`Failed to load data from ${this.fileName}: ${error.message}`, 'BaseRepository');
      this.data = [];
    }
  }

  /**
   * @method saveData
   * @purpose Save data to JSON file
   */
  private async saveData(): Promise<void> {
    try {
      // Ensure directory exists
      await this.fileService.ensureDirectory(path.dirname(this.filePath));

      // Save data to file
      const jsonData = JSON.stringify(this.data, null, 2);
      await this.fileService.writeFile(this.filePath, jsonData);

      this.logger.debug(`Saved ${this.data.length} records to ${this.fileName}`, 'BaseRepository');
    } catch (error) {
      this.logger.error(`Failed to save data to ${this.fileName}: ${error.message}`, 'BaseRepository');
      throw error;
    }
  }

  /**
   * @method generateId
   * @purpose Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * @method findAll
   * @purpose Find all records
   */
  async findAll(options?: QueryOptions): Promise<T[]> {
    await this.ensureLoaded();
    
    let result = [...this.data];

    // Apply where conditions
    if (options?.where) {
      result = result.filter(item => this.matchesWhere(item, options.where!));
    }

    // Apply ordering
    if (options?.orderBy) {
      result.sort((a, b) => {
        const aValue = (a as any)[options.orderBy!.field];
        const bValue = (b as any)[options.orderBy!.field];
        
        if (aValue < bValue) return options.orderBy!.direction === 'ASC' ? -1 : 1;
        if (aValue > bValue) return options.orderBy!.direction === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    if (options?.offset !== undefined) {
      result = result.slice(options.offset);
    }
    if (options?.limit !== undefined) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * @method findPaginated
   * @purpose Find records with pagination
   */
  async findPaginated(page: number = 1, limit: number = 10, options?: Omit<QueryOptions, 'limit' | 'offset'>): Promise<PaginatedResult<T>> {
    await this.ensureLoaded();
    
    const offset = (page - 1) * limit;
    const queryOptions: QueryOptions = {
      ...options,
      limit,
      offset,
    };

    const data = await this.findAll(queryOptions);
    
    // Get total count without pagination
    const totalData = await this.findAll(options);
    const total = totalData.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * @method findById
   * @purpose Find record by ID
   */
  async findById(id: string): Promise<T | null> {
    await this.ensureLoaded();
    return this.data.find(item => item.id === id) || null;
  }

  /**
   * @method findOne
   * @purpose Find single record by conditions
   */
  async findOne(where: Record<string, any>): Promise<T | null> {
    await this.ensureLoaded();
    return this.data.find(item => this.matchesWhere(item, where)) || null;
  }

  /**
   * @method create
   * @purpose Create new record
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    await this.ensureLoaded();

    const now = new Date();
    const newRecord: T = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    } as T;

    this.data.push(newRecord);
    await this.saveData();

    this.logger.debug(`Created new record with ID: ${newRecord.id}`, 'BaseRepository');
    return newRecord;
  }

  /**
   * @method update
   * @purpose Update existing record
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T | null> {
    await this.ensureLoaded();

    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) {
      return null;
    }

    const updatedRecord: T = {
      ...this.data[index],
      ...data,
      updatedAt: new Date(),
    };

    this.data[index] = updatedRecord;
    await this.saveData();

    this.logger.debug(`Updated record with ID: ${id}`, 'BaseRepository');
    return updatedRecord;
  }

  /**
   * @method delete
   * @purpose Delete record by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }

    this.data.splice(index, 1);
    await this.saveData();

    this.logger.debug(`Deleted record with ID: ${id}`, 'BaseRepository');
    return true;
  }

  /**
   * @method count
   * @purpose Count records
   */
  async count(where?: Record<string, any>): Promise<number> {
    await this.ensureLoaded();
    
    if (!where) {
      return this.data.length;
    }

    return this.data.filter(item => this.matchesWhere(item, where)).length;
  }

  /**
   * @method exists
   * @purpose Check if record exists
   */
  async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * @method clear
   * @purpose Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.data = [];
    await this.saveData();
    this.logger.debug(`Cleared all data from ${this.fileName}`, 'BaseRepository');
  }

  /**
   * @method matchesWhere
   * @purpose Check if item matches where conditions
   */
  private matchesWhere(item: any, where: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key.includes('.')) {
        // Handle nested properties
        const keys = key.split('.');
        let itemValue = item;
        for (const k of keys) {
          itemValue = itemValue?.[k];
        }
        if (itemValue !== value) {
          return false;
        }
      } else {
        if (item[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * @method backup
   * @purpose Create backup of data
   */
  async backup(backupPath: string): Promise<void> {
    await this.ensureLoaded();
    
    const backupData = {
      fileName: this.fileName,
      timestamp: new Date().toISOString(),
      data: this.data,
    };

    await this.fileService.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    this.logger.info(`Created backup of ${this.fileName} at ${backupPath}`, 'BaseRepository');
  }

  /**
   * @method restore
   * @purpose Restore data from backup
   */
  async restore(backupPath: string): Promise<void> {
    try {
      const backupContent = await this.fileService.readFile(backupPath);
      const backupData = JSON.parse(backupContent);

      if (backupData.fileName !== this.fileName) {
        throw new Error(`Backup file is for ${backupData.fileName}, not ${this.fileName}`);
      }

      // Convert date strings back to Date objects
      this.data = backupData.data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }));

      await this.saveData();
      this.logger.info(`Restored ${this.data.length} records from backup`, 'BaseRepository');

    } catch (error) {
      this.logger.error(`Failed to restore from backup: ${error.message}`, 'BaseRepository');
      throw error;
    }
  }
}