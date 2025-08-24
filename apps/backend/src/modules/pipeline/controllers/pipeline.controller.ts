import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

// Services
import { EmailProcessingPipelineService, PipelineOptions } from '../services/pipeline.service';

/**
 * @class PipelineController
 * @purpose REST API controller for email processing pipeline
 */
@ApiTags('Pipeline')
@Controller('pipeline')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PipelineController {
  constructor(
    private pipelineService: EmailProcessingPipelineService,
  ) {}

  /**
   * @method runPipeline
   * @purpose Run the email processing pipeline
   */
  @Post('run')
  @ApiOperation({ summary: 'Run the email processing pipeline' })
  @ApiResponse({
    status: 200,
    description: 'Pipeline executed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Pipeline is already running or invalid options',
  })
  async runPipeline(
    @CurrentUser() user: User,
    @Body() options: Partial<PipelineOptions>
  ) {
    const pipelineOptions: PipelineOptions = {
      userId: user.id,
      batchSize: options.batchSize || 10,
      skipSync: options.skipSync || false,
      skipClassification: options.skipClassification || false,
      skipExtraction: options.skipExtraction || false,
      forceReprocess: options.forceReprocess || false,
      categories: options.categories,
    };

    return this.pipelineService.runPipeline(pipelineOptions);
  }

  /**
   * @method getPipelineStatus
   * @purpose Get current pipeline status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get current pipeline status' })
  @ApiResponse({
    status: 200,
    description: 'Pipeline status retrieved successfully',
  })
  async getPipelineStatus() {
    return this.pipelineService.getPipelineStatus();
  }

  /**
   * @method stopPipeline
   * @purpose Stop the current pipeline execution
   */
  @Post('stop')
  @ApiOperation({ summary: 'Stop the current pipeline execution' })
  @ApiResponse({
    status: 200,
    description: 'Pipeline stopped successfully',
  })
  async stopPipeline() {
    const stopped = await this.pipelineService.stopPipeline();
    return { success: stopped };
  }

  /**
   * @method getPipelineStats
   * @purpose Get pipeline execution statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get pipeline execution statistics' })
  @ApiResponse({
    status: 200,
    description: 'Pipeline statistics retrieved successfully',
  })
  async getPipelineStats(@CurrentUser() user: User) {
    return this.pipelineService.getPipelineStats(user.id);
  }

  /**
   * @method runQuickSync
   * @purpose Run a quick sync and classification
   */
  @Post('quick-sync')
  @ApiOperation({ summary: 'Run a quick sync and classification' })
  @ApiResponse({
    status: 200,
    description: 'Quick sync completed successfully',
  })
  async runQuickSync(@CurrentUser() user: User) {
    const pipelineOptions: PipelineOptions = {
      userId: user.id,
      batchSize: 5,
      skipExtraction: true, // Only sync and classify
      forceReprocess: false,
    };

    return this.pipelineService.runPipeline(pipelineOptions);
  }

  /**
   * @method runFullProcessing
   * @purpose Run full processing including extraction
   */
  @Post('full-processing')
  @ApiOperation({ summary: 'Run full processing including extraction' })
  @ApiResponse({
    status: 200,
    description: 'Full processing completed successfully',
  })
  async runFullProcessing(
    @CurrentUser() user: User,
    @Body() options: { batchSize?: number; forceReprocess?: boolean }
  ) {
    const pipelineOptions: PipelineOptions = {
      userId: user.id,
      batchSize: options.batchSize || 10,
      skipSync: false,
      skipClassification: false,
      skipExtraction: false,
      forceReprocess: options.forceReprocess || false,
    };

    return this.pipelineService.runPipeline(pipelineOptions);
  }
}
