import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnvironmentInitializerService } from '../../common/services/environment-initializer.service';
import { EnvironmentService } from '../../common/services/environment.service';
import { AppDataService } from '../../common/services/app-data.service';
import { Public } from '../auth/decorators/public.decorator';
import { AllowIncompleteSetup } from '../../common/guards/setup-complete.guard';

/**
 * @interface HealthStatus
 * @purpose Health check response interface
 */
interface HealthStatus {
  status: 'ok' | 'error' | 'initializing';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  setup: {
    initialized: boolean;
    complete: boolean;
    required: boolean;
    dataPath: string;
    configPath: string;
  };
  system: {
    platform: string;
    nodeVersion: string;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * @interface DetailedHealthStatus
 * @purpose Detailed health check response interface
 */
interface DetailedHealthStatus extends HealthStatus {
  services: {
    database: { status: 'ok' | 'error'; message?: string };
    filesystem: { status: 'ok' | 'error'; message?: string };
    environment: { status: 'ok' | 'error'; message?: string };
  };
  configuration: {
    hasApiKeys: boolean;
    hasSecrets: boolean;
    validPaths: boolean;
  };
}

/**
 * @class HealthController
 * @purpose Health check endpoints for monitoring and setup verification
 */
@ApiTags('Health')
@Controller('health')
@Public()
@AllowIncompleteSetup()
export class HealthController {
  constructor(
    private environmentInitializer: EnvironmentInitializerService,
    private environmentService: EnvironmentService,
    private appDataService: AppDataService
  ) {}

  /**
   * @method getHealth
   * @purpose Basic health check endpoint
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({
    status: 200,
    description: 'Application health status',
  })
  async getHealth(): Promise<HealthStatus> {
    const initStatus = await this.environmentInitializer.getInitializationStatus();
    const memoryUsage = process.memoryUsage();
    
    let setupStatus;
    try {
      setupStatus = await this.environmentService.checkSetupStatus();
    } catch (error) {
      setupStatus = {
        isComplete: false,
        missingRequiredFields: [],
        hasValidConfig: false,
        configPath: 'unknown',
      };
    }

    const status: HealthStatus = {
      status: initStatus.complete ? 'ok' : 'initializing',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      setup: {
        initialized: initStatus.complete,
        complete: setupStatus.isComplete,
        required: initStatus.setupRequired,
        dataPath: initStatus.dataPath,
        configPath: initStatus.configPath,
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
      },
    };

    return status;
  }

  /**
   * @method getDetailedHealth
   * @purpose Detailed health check with service status
   */
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with service status' })
  @ApiResponse({
    status: 200,
    description: 'Detailed application health status',
  })
  async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const basicHealth = await this.getHealth();
    
    // Check services
    const services = {
      database: await this.checkDatabaseHealth(),
      filesystem: await this.checkFilesystemHealth(),
      environment: await this.checkEnvironmentHealth(),
    };

    // Check configuration
    const configuration = await this.checkConfigurationHealth();

    const detailedStatus: DetailedHealthStatus = {
      ...basicHealth,
      services,
      configuration,
    };

    // Update overall status based on service health
    if (Object.values(services).some(service => service.status === 'error')) {
      detailedStatus.status = 'error';
    }

    return detailedStatus;
  }

  /**
   * @method getReadiness
   * @purpose Kubernetes-style readiness probe
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for container orchestration' })
  @ApiResponse({
    status: 200,
    description: 'Application is ready to serve requests',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  async getReadiness(): Promise<{ ready: boolean; message: string }> {
    const initStatus = await this.environmentInitializer.getInitializationStatus();
    
    if (!initStatus.complete) {
      return {
        ready: false,
        message: 'Application is still initializing',
      };
    }

    // Check critical services
    const dbHealth = await this.checkDatabaseHealth();
    const fsHealth = await this.checkFilesystemHealth();

    if (dbHealth.status === 'error' || fsHealth.status === 'error') {
      return {
        ready: false,
        message: 'Critical services are not healthy',
      };
    }

    return {
      ready: true,
      message: 'Application is ready',
    };
  }

  /**
   * @method getLiveness
   * @purpose Kubernetes-style liveness probe
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for container orchestration' })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  async getLiveness(): Promise<{ alive: boolean; uptime: number }> {
    return {
      alive: true,
      uptime: process.uptime(),
    };
  }

  /**
   * @method checkDatabaseHealth
   * @purpose Check database/storage health
   */
  private async checkDatabaseHealth(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      // Check if data directory is accessible
      const dataPath = this.appDataService.getDataPath();
      await import('fs/promises').then(fs => fs.access(dataPath));
      
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: `Database/storage not accessible: ${error.message}`,
      };
    }
  }

  /**
   * @method checkFilesystemHealth
   * @purpose Check filesystem health
   */
  private async checkFilesystemHealth(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      const paths = this.appDataService.getPaths();
      const fs = await import('fs/promises');
      
      // Check all required directories
      for (const [name, path] of Object.entries(paths)) {
        await fs.access(path);
      }
      
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: `Filesystem not accessible: ${error.message}`,
      };
    }
  }

  /**
   * @method checkEnvironmentHealth
   * @purpose Check environment configuration health
   */
  private async checkEnvironmentHealth(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      const validation = await this.environmentInitializer.validateConfiguration();
      
      if (!validation.isValid && validation.missingRequired.length > 0) {
        return {
          status: 'error',
          message: `Missing required configuration: ${validation.missingRequired.join(', ')}`,
        };
      }
      
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: `Environment validation failed: ${error.message}`,
      };
    }
  }

  /**
   * @method checkConfigurationHealth
   * @purpose Check configuration completeness
   */
  private async checkConfigurationHealth(): Promise<{
    hasApiKeys: boolean;
    hasSecrets: boolean;
    validPaths: boolean;
  }> {
    try {
      const config = await this.environmentService.loadEnvironmentConfig();
      
      return {
        hasApiKeys: !!(config.OPENAI_API_KEY && config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
        hasSecrets: !!(config.JWT_SECRET && config.SESSION_SECRET),
        validPaths: !!(config.DATABASE_PATH && config.LOG_FILE),
      };
    } catch (error) {
      return {
        hasApiKeys: false,
        hasSecrets: false,
        validPaths: false,
      };
    }
  }
}