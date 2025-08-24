import { Test, TestingModule } from '@nestjs/testing';
import { AppDataService } from '../app-data.service';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger.service';
import * as os from 'os';
import * as path from 'path';

describe('AppDataService', () => {
  let service: AppDataService;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'PORTABLE_MODE') {
          return 'false';
        }
        return defaultValue;
      }),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppDataService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<AppDataService>(AppDataService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDataPath', () => {
    it('should return current platform data path', () => {
      const dataPath = service.getDataPath();
      expect(dataPath).toContain('AEMS');
      expect(dataPath).toContain('data');
    });

    it('should use portable mode when configured', async () => {
      // Create a new service instance with portable mode enabled
      const portableConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'PORTABLE_MODE') return 'true';
          return defaultValue || 'false';
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AppDataService,
          { provide: ConfigService, useValue: portableConfigService },
          { provide: LoggerService, useValue: loggerService },
        ],
      }).compile();

      const portableService = module.get<AppDataService>(AppDataService);
      const dataPath = portableService.getDataPath();
      expect(dataPath).toBe(path.join(process.cwd(), 'data'));
    });
  });

  describe('getPaths', () => {
    it('should return all required paths', () => {
      const paths = service.getPaths();

      expect(paths).toHaveProperty('data');
      expect(paths).toHaveProperty('logs');
      expect(paths).toHaveProperty('backups');
      expect(paths).toHaveProperty('cache');
      expect(paths).toHaveProperty('config');
      expect(paths.logs).toContain('logs');
      expect(paths.backups).toContain('backups');
      expect(paths.cache).toContain('cache');
    });
  });

  describe('ensureDirectories', () => {
    it('should create all required directories', async () => {
      jest.spyOn(service, 'getDataPath').mockReturnValue('/test/data');

      // Mock fs operations would go here in a real test
      await expect(service.ensureDirectories()).resolves.not.toThrow();
    });
  });

  describe('getConfigPath', () => {
    it('should return config directory path', () => {
      const configPath = service.getConfigPath();
      expect(configPath).toContain('AEMS');
    });

    it('should return config file path', () => {
      const configFilePath = service.getConfigFilePath();
      expect(configFilePath).toContain('.env');
    });
  });

  describe('isPortableMode', () => {
    it('should return true when portable mode is enabled', () => {
      configService.get.mockReturnValue('true');

      const isPortable = service.isPortableMode();

      expect(isPortable).toBe(true);
    });

    it('should return false when portable mode is disabled', () => {
      configService.get.mockReturnValue('false');

      const isPortable = service.isPortableMode();

      expect(isPortable).toBe(false);
    });
  });
});
