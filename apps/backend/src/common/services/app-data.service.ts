import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * @interface AppDataPaths
 * @purpose Application data directory paths
 */
export interface AppDataPaths {
  data: string;
  logs: string;
  backups: string;
  cache: string;
  config: string;
}

/**
 * @class AppDataService
 * @purpose Manage OS-specific application data directories
 */
@Injectable()
export class AppDataService {
  private readonly appName = 'AEMS';
  private readonly paths: AppDataPaths;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.paths = this.initializePaths();
  }

  /**
   * @method getPaths
   * @purpose Get all application data paths
   */
  getPaths(): AppDataPaths {
    return { ...this.paths };
  }

  /**
   * @method getDataPath
   * @purpose Get data directory path
   */
  getDataPath(): string {
    return this.paths.data;
  }

  /**
   * @method getLogsPath
   * @purpose Get logs directory path
   */
  getLogsPath(): string {
    return this.paths.logs;
  }

  /**
   * @method getBackupsPath
   * @purpose Get backups directory path
   */
  getBackupsPath(): string {
    return this.paths.backups;
  }

  /**
   * @method getCachePath
   * @purpose Get cache directory path
   */
  getCachePath(): string {
    return this.paths.cache;
  }

  /**
   * @method getConfigPath
   * @purpose Get config directory path
   */
  getConfigPath(): string {
    return this.paths.config;
  }

  /**
   * @method ensureDirectories
   * @purpose Ensure all application directories exist
   */
  async ensureDirectories(): Promise<void> {
    const directories = Object.values(this.paths);

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Ensured directory exists: ${dir}`, 'AppDataService');
      } catch (error) {
        this.logger.error(
          `Failed to create directory ${dir}: ${error.message}`,
          error.stack,
          'AppDataService'
        );
        throw error;
      }
    }

    this.logger.log('All application directories ensured', 'AppDataService');
  }

  /**
   * @method getConfigFilePath
   * @purpose Get path for configuration file
   */
  getConfigFilePath(filename: string = '.env'): string {
    return path.join(this.paths.config, filename);
  }

  /**
   * @method getDataFilePath
   * @purpose Get path for data file
   */
  getDataFilePath(filename: string): string {
    return path.join(this.paths.data, filename);
  }

  /**
   * @method getLogFilePath
   * @purpose Get path for log file
   */
  getLogFilePath(filename: string): string {
    return path.join(this.paths.logs, filename);
  }

  /**
   * @method getBackupFilePath
   * @purpose Get path for backup file
   */
  getBackupFilePath(filename: string): string {
    return path.join(this.paths.backups, filename);
  }

  /**
   * @method getCacheFilePath
   * @purpose Get path for cache file
   */
  getCacheFilePath(filename: string): string {
    return path.join(this.paths.cache, filename);
  }

  /**
   * @method isPortableMode
   * @purpose Check if running in portable mode (data in current directory)
   */
  isPortableMode(): boolean {
    const portableMode = this.configService.get<string>('PORTABLE_MODE', 'false');
    return portableMode.toLowerCase() === 'true';
  }

  /**
   * @method getAppVersion
   * @purpose Get application version for data migration
   */
  getAppVersion(): string {
    return this.configService.get<string>('APP_VERSION', '2.0.0');
  }

  /**
   * @method migrateFromPortableMode
   * @purpose Migrate data from portable mode to OS-specific directories
   */
  async migrateFromPortableMode(portableDataPath: string): Promise<void> {
    if (!await this.directoryExists(portableDataPath)) {
      this.logger.log('No portable data to migrate', 'AppDataService');
      return;
    }

    this.logger.log(`Migrating data from portable mode: ${portableDataPath}`, 'AppDataService');

    try {
      // Ensure target directories exist
      await this.ensureDirectories();

      // Copy data files
      await this.copyDirectory(portableDataPath, this.paths.data);

      // Copy logs if they exist
      const portableLogsPath = path.join(path.dirname(portableDataPath), 'logs');
      if (await this.directoryExists(portableLogsPath)) {
        await this.copyDirectory(portableLogsPath, this.paths.logs);
      }

      // Copy backups if they exist
      const portableBackupsPath = path.join(path.dirname(portableDataPath), 'backups');
      if (await this.directoryExists(portableBackupsPath)) {
        await this.copyDirectory(portableBackupsPath, this.paths.backups);
      }

      this.logger.log('Data migration from portable mode completed', 'AppDataService');

    } catch (error) {
      this.logger.error(
        'Failed to migrate data from portable mode',
        error.stack,
        'AppDataService'
      );
      throw error;
    }
  }

  /**
   * @method initializePaths
   * @purpose Initialize OS-specific paths
   */
  private initializePaths(): AppDataPaths {
    // Check if running in portable mode
    if (this.isPortableMode()) {
      const currentDir = process.cwd();
      return {
        data: path.join(currentDir, 'data'),
        logs: path.join(currentDir, 'logs'),
        backups: path.join(currentDir, 'backups'),
        cache: path.join(currentDir, 'cache'),
        config: currentDir,
      };
    }

    // Use OS-specific directories
    const platform = os.platform();
    const homeDir = os.homedir();

    let baseDir: string;

    switch (platform) {
      case 'win32':
        // Windows: %APPDATA%\AEMS
        baseDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), this.appName);
        break;

      case 'darwin':
        // macOS: ~/Library/Application Support/AEMS
        baseDir = path.join(homeDir, 'Library', 'Application Support', this.appName);
        break;

      case 'linux':
      default:
        // Linux: ~/.local/share/AEMS
        const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
        baseDir = path.join(xdgDataHome, this.appName);
        break;
    }

    return {
      data: path.join(baseDir, 'data'),
      logs: path.join(baseDir, 'logs'),
      backups: path.join(baseDir, 'backups'),
      cache: path.join(baseDir, 'cache'),
      config: baseDir,
    };
  }

  /**
   * @method directoryExists
   * @purpose Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * @method copyDirectory
   * @purpose Recursively copy directory
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }
}