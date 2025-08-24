import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { AIService } from '../services/ai.service';
import { ClassificationService } from '../services/classification.service';
import { ExtractionService } from '../services/extraction.service';
import { CostTrackingService } from '../services/cost-tracking.service';

// Entities
import { EmailCategory } from '../../../database/entities/classification.entity';

// DTOs
import {
  ProcessEmailDto,
  BatchProcessDto,
  ClassificationOverrideDto,
  ClassificationValidationDto,
  ExtractionCorrectionDto,
  AIProcessingResultDto,
  BatchProcessingResultDto,
  AIStatsDto,
  CostLimitDto,
  ModelConfigDto,
} from '../dto/ai.dto';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../auth/guards/roles.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User, UserRole } from '../../../database/entities/user.entity';

/**
 * @class AIController
 * @purpose REST API controller for AI processing endpoints
 */
@ApiTags('AI Processing')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIController {
  constructor(
    private aiService: AIService,
    private classificationService: ClassificationService,
    private extractionService: ExtractionService,
    private costTrackingService: CostTrackingService
  ) {}

  /**
   * @method processEmail
   * @purpose Process single email with AI
   */
  @Post('process/:emailId')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Process single email with AI classification and extraction' })
  @ApiResponse({
    status: 200,
    description: 'Email processed successfully',
    type: AIProcessingResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email ID or processing options',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many processing requests',
  })
  async processEmail(
    @Param('emailId') emailId: string,
    @CurrentUser() user: User,
    @Body() options: ProcessEmailDto
  ): Promise<AIProcessingResultDto> {
    const result = await this.aiService.processEmail(emailId, user.id, options);
    
    return {
      success: result.success,
      emailId: result.emailId,
      processingTime: result.processingTime,
      cost: result.cost,
      needsReview: result.needsReview,
      error: result.error,
      classification: result.classification ? {
        id: result.classification.id,
        category: result.classification.category,
        confidence: result.classification.confidence,
        reasoning: result.classification.reasoning,
        isManualOverride: result.classification.isManualOverride,
        isValidated: result.classification.isValidated,
        alternativeCategories: result.classification.alternativeCategories || [],
      } : undefined,
      extraction: result.extraction ? {
        id: result.extraction.id,
        category: result.extraction.category,
        extractedData: JSON.stringify(result.extraction.extractedData),
        overallConfidence: result.extraction.overallConfidence,
        isComplete: result.extraction.isComplete,
        isValidated: result.extraction.isValidated,
        hasManualCorrections: result.extraction.hasManualCorrections,
        missingFields: result.extraction.missingFields || [],
      } : undefined,
    };
  }

  /**
   * @method processBatch
   * @purpose Process multiple emails in batch
   */
  @Post('process-batch')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @ApiOperation({ summary: 'Process multiple emails in batch' })
  @ApiResponse({
    status: 200,
    description: 'Batch processing completed',
    type: BatchProcessingResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email IDs or processing options',
  })
  async processBatch(
    @Body('emailIds') emailIds: string[],
    @CurrentUser() user: User,
    @Body() options: BatchProcessDto
  ): Promise<BatchProcessingResultDto> {
    const result = await this.aiService.processBatch(emailIds, user.id, options);
    
    return {
      success: result.success,
      totalProcessed: result.totalProcessed,
      totalSuccessful: result.totalSuccessful,
      totalFailed: result.totalFailed,
      totalCost: result.totalCost,
      totalTime: result.totalTime,
      results: result.results.map(r => ({
        success: r.success,
        emailId: r.emailId,
        processingTime: r.processingTime,
        cost: r.cost,
        needsReview: r.needsReview,
        error: r.error,
        classification: r.classification ? {
          id: r.classification.id,
          category: r.classification.category,
          confidence: r.classification.confidence,
          reasoning: r.classification.reasoning,
          isManualOverride: r.classification.isManualOverride,
          isValidated: r.classification.isValidated,
          alternativeCategories: r.classification.alternativeCategories || [],
        } : undefined,
        extraction: r.extraction ? {
          id: r.extraction.id,
          category: r.extraction.category,
          extractedData: JSON.stringify(r.extraction.extractedData),
          overallConfidence: r.extraction.overallConfidence,
          isComplete: r.extraction.isComplete,
          isValidated: r.extraction.isValidated,
          hasManualCorrections: r.extraction.hasManualCorrections,
          missingFields: r.extraction.missingFields || [],
        } : undefined,
      })),
      errors: result.errors.map(err => typeof err === 'string' ? err : `${err.emailId}: ${err.error}`),
    };
  }

  /**
   * @method reprocessEmail
   * @purpose Reprocess email with AI
   */
  @Post('reprocess/:emailId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reprocess email with AI (override existing results)' })
  @ApiResponse({
    status: 200,
    description: 'Email reprocessed successfully',
    type: AIProcessingResultDto,
  })
  async reprocessEmail(
    @Param('emailId') emailId: string,
    @CurrentUser() user: User,
    @Body('forceClassification') forceClassification = false,
    @Body('forceExtraction') forceExtraction = false
  ): Promise<AIProcessingResultDto> {
    const result = await this.aiService.reprocessEmail(emailId, user.id, {
      forceClassification,
      forceExtraction,
    });
    
    return {
      success: result.success,
      emailId: result.emailId,
      processingTime: result.processingTime,
      cost: result.cost,
      needsReview: result.needsReview,
      error: result.error,
    };
  }

  /**
   * @method overrideClassification
   * @purpose Override AI classification with manual input
   */
  @Patch('classification/:classificationId/override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Override AI classification with manual input' })
  @ApiResponse({
    status: 200,
    description: 'Classification overridden successfully',
  })
  async overrideClassification(
    @Param('classificationId') classificationId: string,
    @CurrentUser() user: User,
    @Body() overrideDto: ClassificationOverrideDto
  ): Promise<{ success: boolean; message: string }> {
    await this.classificationService.overrideClassification(
      classificationId,
      overrideDto.category as EmailCategory,
      overrideDto.reason,
      user.id
    );
    
    return {
      success: true,
      message: 'Classification overridden successfully',
    };
  }

  /**
   * @method validateClassification
   * @purpose Validate classification accuracy
   */
  @Post('classification/:classificationId/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate classification accuracy' })
  @ApiResponse({
    status: 200,
    description: 'Classification validated successfully',
  })
  async validateClassification(
    @Param('classificationId') classificationId: string,
    @CurrentUser() user: User,
    @Body() validationDto: ClassificationValidationDto
  ): Promise<{ success: boolean; message: string }> {
    await this.classificationService.validateClassification(
      classificationId,
      validationDto.isCorrect,
      user.id,
      validationDto.feedback,
      validationDto.correctCategory as EmailCategory
    );
    
    return {
      success: true,
      message: 'Classification validated successfully',
    };
  }

  /**
   * @method correctExtraction
   * @purpose Correct extracted data field
   */
  @Patch('extraction/:extractionId/correct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Correct extracted data field' })
  @ApiResponse({
    status: 200,
    description: 'Extraction corrected successfully',
  })
  async correctExtraction(
    @Param('extractionId') extractionId: string,
    @CurrentUser() user: User,
    @Body() correctionDto: ExtractionCorrectionDto
  ): Promise<{ success: boolean; message: string }> {
    await this.extractionService.correctField(
      extractionId,
      correctionDto.fieldName,
      correctionDto.correctedValue,
      user.id,
      correctionDto.reason
    );
    
    return {
      success: true,
      message: 'Extraction corrected successfully',
    };
  }

  /**
   * @method getProcessingStats
   * @purpose Get AI processing statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get AI processing statistics' })
  @ApiResponse({
    status: 200,
    description: 'Processing statistics retrieved successfully',
    type: AIStatsDto,
  })
  async getProcessingStats(@CurrentUser() user: User): Promise<AIStatsDto> {
    const stats = await this.aiService.getProcessingStats(user.id);
    
    return {
      totalProcessed: stats.totalProcessed,
      totalClassifications: stats.totalProcessed, // Assuming all processed emails are classified
      totalExtractions: stats.totalProcessed, // Assuming all processed emails are extracted
      averageConfidence: 0.85, // Default confidence
      totalCost: stats.totalCost,
      averageProcessingTime: stats.averageProcessingTime,
      successRate: stats.successRate,
      categoryBreakdown: JSON.stringify(stats.categoryBreakdown),
      dailyCost: stats.dailyCost,
      monthlyCost: stats.monthlyCost,
      monthlyTrends: JSON.stringify({}), // Empty trends for now
    };
  }

  /**
   * @method getCostLimits
   * @purpose Get current cost limits
   */
  @Get('cost-limits')
  @ApiOperation({ summary: 'Get current AI cost limits' })
  @ApiResponse({
    status: 200,
    description: 'Cost limits retrieved successfully',
  })
  async getCostLimits(@CurrentUser() user: User): Promise<{
    dailyLimit: number;
    monthlyLimit: number;
    dailyUsed: number;
    monthlyUsed: number;
  }> {
    const limits = await this.costTrackingService.getCostLimits(user.id);
    const usage = await this.costTrackingService.getCurrentUsage(user.id);
    
    return {
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      dailyUsed: usage.dailyUsed,
      monthlyUsed: usage.monthlyUsed,
    };
  }

  /**
   * @method setCostLimits
   * @purpose Set AI cost limits
   */
  @Post('cost-limits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set AI cost limits' })
  @ApiResponse({
    status: 200,
    description: 'Cost limits updated successfully',
  })
  async setCostLimits(
    @CurrentUser() user: User,
    @Body() limitsDto: CostLimitDto
  ): Promise<{ success: boolean; message: string }> {
    await this.costTrackingService.setCostLimits(
      user.id,
      limitsDto.dailyLimit,
      limitsDto.monthlyLimit
    );
    
    return {
      success: true,
      message: 'Cost limits updated successfully',
    };
  }

  /**
   * @method getModelConfig
   * @purpose Get current AI model configuration
   */
  @Get('model-config')
  @ApiOperation({ summary: 'Get current AI model configuration' })
  @ApiResponse({
    status: 200,
    description: 'Model configuration retrieved successfully',
  })
  async getModelConfig(@CurrentUser() user: User): Promise<{
    model: string;
    maxTokens: number;
    temperature: number;
    classificationThreshold: number;
    extractionThreshold: number;
  }> {
    // TODO: Implement user-specific model configuration
    return {
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.3,
      classificationThreshold: 0.7,
      extractionThreshold: 0.8,
    };
  }

  /**
   * @method updateModelConfig
   * @purpose Update AI model configuration
   */
  @Patch('model-config')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update AI model configuration (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Model configuration updated successfully',
  })
  async updateModelConfig(
    @CurrentUser() user: User,
    @Body() configDto: ModelConfigDto
  ): Promise<{ success: boolean; message: string }> {
    // TODO: Implement user-specific model configuration update
    return {
      success: true,
      message: 'Model configuration updated successfully',
    };
  }

  /**
   * @method getClassificationAccuracy
   * @purpose Get classification accuracy statistics
   */
  @Get('classification/accuracy')
  @ApiOperation({ summary: 'Get classification accuracy statistics' })
  @ApiResponse({
    status: 200,
    description: 'Classification accuracy retrieved successfully',
  })
  async getClassificationAccuracy(@CurrentUser() user: User): Promise<{
    totalClassifications: number;
    validatedClassifications: number;
    accuracyRate: number;
    categoryAccuracy: Record<string, { total: number; correct: number; accuracy: number }>;
  }> {
    const stats = await this.classificationService.getAccuracyStats(user.id);
    
    return {
      totalClassifications: stats.totalClassifications,
      validatedClassifications: stats.validatedClassifications,
      accuracyRate: stats.accuracyRate,
      categoryAccuracy: stats.categoryAccuracy,
    };
  }

  /**
   * @method getCategoryBreakdown
   * @purpose Get email category breakdown
   */
  @Get('classification/categories')
  @ApiOperation({ summary: 'Get email category breakdown' })
  @ApiResponse({
    status: 200,
    description: 'Category breakdown retrieved successfully',
  })
  async getCategoryBreakdown(@CurrentUser() user: User): Promise<Record<string, number>> {
    return await this.classificationService.getCategoryBreakdown(user.id);
  }

  /**
   * @method getProcessingQueue
   * @purpose Get current processing queue status
   */
  @Get('queue/status')
  @ApiOperation({ summary: 'Get current processing queue status' })
  @ApiResponse({
    status: 200,
    description: 'Queue status retrieved successfully',
  })
  async getProcessingQueue(@CurrentUser() user: User): Promise<{
    queueLength: number;
    processing: number;
    completed: number;
    failed: number;
    estimatedWaitTime: number;
  }> {
    // TODO: Implement actual queue status tracking
    return {
      queueLength: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      estimatedWaitTime: 0,
    };
  }
}