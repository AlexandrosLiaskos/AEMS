import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SetupService, SetupProgress, SetupWizardStep } from '../services/setup.service';
import { Public } from '../../auth/decorators/public.decorator';

/**
 * @interface SetupStepDataDto
 * @purpose DTO for setup step data
 */
interface SetupStepDataDto {
  [key: string]: any;
}

/**
 * @interface SetupValidationResponseDto
 * @purpose DTO for setup validation response
 */
interface SetupValidationResponseDto {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * @interface SetupCompletionResponseDto
 * @purpose DTO for setup completion response
 */
interface SetupCompletionResponseDto {
  success: boolean;
  message: string;
  configPath: string;
}

/**
 * @class SetupController
 * @purpose REST API controller for initial setup wizard
 */
@ApiTags('Setup')
@Controller('setup')
@Public() // Setup endpoints should be accessible without authentication
export class SetupController {
  constructor(private setupService: SetupService) {}

  /**
   * @method getSetupProgress
   * @purpose Get current setup progress and steps
   */
  @Get('progress')
  @ApiOperation({ summary: 'Get setup progress and wizard steps' })
  @ApiResponse({
    status: 200,
    description: 'Setup progress retrieved successfully',
  })
  async getSetupProgress(): Promise<SetupProgress> {
    return this.setupService.getSetupProgress();
  }

  /**
   * @method getSetupStep
   * @purpose Get specific setup step details
   */
  @Get('steps/:stepId')
  @ApiOperation({ summary: 'Get specific setup step details' })
  @ApiResponse({
    status: 200,
    description: 'Setup step retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Setup step not found',
  })
  async getSetupStep(@Param('stepId') stepId: string): Promise<SetupWizardStep> {
    const progress = await this.setupService.getSetupProgress();
    const step = progress.steps.find(s => s.id === stepId);

    if (!step) {
      throw new BadRequestException(`Setup step not found: ${stepId}`);
    }

    return step;
  }

  /**
   * @method validateStepData
   * @purpose Validate setup step data without saving
   */
  @Post('steps/:stepId/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate setup step data' })
  @ApiResponse({
    status: 200,
    description: 'Step data validated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid step ID or data',
  })
  async validateStepData(
    @Param('stepId') stepId: string,
    @Body() data: SetupStepDataDto
  ): Promise<SetupValidationResponseDto> {
    return this.setupService.validateStep(stepId, data);
  }

  /**
   * @method saveStepData
   * @purpose Save setup step data
   */
  @Post('steps/:stepId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save setup step data' })
  @ApiResponse({
    status: 200,
    description: 'Step data saved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid step data',
  })
  async saveStepData(
    @Param('stepId') stepId: string,
    @Body() data: SetupStepDataDto
  ): Promise<{ success: boolean; message: string }> {
    await this.setupService.saveStepData(stepId, data);

    return {
      success: true,
      message: 'Step data saved successfully',
    };
  }

  /**
   * @method completeSetup
   * @purpose Complete the setup process
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete the setup process' })
  @ApiResponse({
    status: 200,
    description: 'Setup completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Setup is not complete or validation failed',
  })
  async completeSetup(): Promise<SetupCompletionResponseDto> {
    return this.setupService.completeSetup();
  }

  /**
   * @method checkSetupStatus
   * @purpose Check if setup is required
   */
  @Get('status')
  @ApiOperation({ summary: 'Check if initial setup is required' })
  @ApiResponse({
    status: 200,
    description: 'Setup status retrieved successfully',
  })
  async checkSetupStatus(): Promise<{
    setupRequired: boolean;
    isComplete: boolean;
    currentStep: number;
    totalSteps: number;
  }> {
    const progress = await this.setupService.getSetupProgress();

    return {
      setupRequired: !progress.isComplete,
      isComplete: progress.isComplete,
      currentStep: progress.currentStep,
      totalSteps: progress.totalSteps,
    };
  }

  /**
   * @method resetSetup
   * @purpose Reset setup process (for development/testing)
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Reset setup process (development only)',
    description: 'This endpoint is only available in development mode'
  })
  @ApiResponse({
    status: 200,
    description: 'Setup reset successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Not available in production mode',
  })
  async resetSetup(): Promise<{ success: boolean; message: string }> {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Setup reset is not available in production mode');
    }

    // This would involve deleting the .env file and clearing any setup state
    // Implementation would depend on specific requirements

    return {
      success: true,
      message: 'Setup reset successfully (development mode only)',
    };
  }

  /**
   * @method getSystemInfo
   * @purpose Get system information for setup
   */
  @Get('system-info')
  @ApiOperation({ summary: 'Get system information for setup' })
  @ApiResponse({
    status: 200,
    description: 'System information retrieved successfully',
  })
  async getSystemInfo(): Promise<{
    platform: string;
    nodeVersion: string;
    appVersion: string;
    dataPath: string;
    configPath: string;
  }> {
    const progress = await this.setupService.getSetupProgress();

    return {
      platform: process.platform,
      nodeVersion: process.version,
      appVersion: process.env.npm_package_version || '2.0.0',
      dataPath: progress.steps[0]?.description || 'Unknown', // This would need to be properly implemented
      configPath: 'Configuration will be saved to OS-specific app data directory',
    };
  }
}