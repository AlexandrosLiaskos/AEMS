import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

// Services
import { AIService } from '../services/ai.service';
import { CostTrackingService } from '../services/cost-tracking.service';

// DTOs
import {
  ProcessEmailDto,
  BatchProcessDto,
  AIProcessingResultDto,
  BatchProcessingResultDto,
  ClassificationOverrideDto,
  ClassificationValidationDto,
  ExtractionCorrectionDto,
} from '../dto/ai.dto';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

// GraphQL Types
import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

/**
 * @class AIStatsType
 * @purpose GraphQL type for AI statistics
 */
@ObjectType()
class AIStatsType {
  @Field(() => Int)
  totalProcessed: number;

  @Field(() => Int)
  totalClassifications: number;

  @Field(() => Int)
  totalExtractions: number;

  @Field(() => Float)
  averageConfidence: number;

  @Field(() => Float)
  totalCost: number;

  @Field(() => Float)
  averageProcessingTime: number;

  @Field(() => Float)
  dailyCost: number;

  @Field(() => Float)
  monthlyCost: number;

  @Field(() => Int)
  successRate: number;

  @Field(() => String) // JSON string
  categoryBreakdown: string;

  @Field(() => String) // JSON string
  monthlyTrends: string;
}

/**
 * @class ProcessingStatusType
 * @purpose GraphQL type for processing status
 */
@ObjectType()
class ProcessingStatusType {
  @Field()
  isProcessing: boolean;

  @Field(() => Int)
  queueSize: number;

  @Field(() => Int)
  activeJobs: number;

  @Field(() => String, { nullable: true })
  currentOperation?: string;

  @Field(() => Float, { nullable: true })
  progress?: number;
}

/**
 * @class AIResolver
 * @purpose GraphQL resolver for AI operations
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class AIResolver {
  private pubSub: PubSub = new PubSub();

  constructor(
    private aiService: AIService,
    private costTrackingService: CostTrackingService
  ) {}

  /**
   * @method processEmail
   * @purpose Process single email with AI
   */
  @Mutation(() => AIProcessingResultDto, { description: 'Process single email with AI' })
  async processEmail(
    @CurrentUser() user: User,
    @Args('emailId') emailId: string,
    @Args('options', { nullable: true }) options?: ProcessEmailDto
  ): Promise<AIProcessingResultDto> {
    const result = await this.aiService.processEmail(emailId, user.id, options || {});

    // Publish processing update
    this.pubSub.publish('AI_PROCESSING_UPDATE', {
      userId: user.id,
      emailId,
      result,
    });

    return this.transformProcessingResult(result);
  }

  /**
   * @method processBatch
   * @purpose Process multiple emails in batch
   */
  @Mutation(() => BatchProcessingResultDto, { description: 'Process multiple emails in batch' })
  async processBatch(
    @CurrentUser() user: User,
    @Args('emailIds', { type: () => [String] }) emailIds: string[],
    @Args('options', { nullable: true }) options?: BatchProcessDto
  ): Promise<BatchProcessingResultDto> {
    if (emailIds.length === 0) {
      throw new BadRequestException('Email IDs array cannot be empty');
    }

    if (emailIds.length > 50) {
      throw new BadRequestException('Cannot process more than 50 emails at once');
    }

    const result = await this.aiService.processBatch(emailIds, user.id, options || {});

    // Publish batch processing update
    this.pubSub.publish('AI_BATCH_UPDATE', {
      userId: user.id,
      result,
    });

    return this.transformBatchResult(result);
  }

  /**
   * @method overrideClassification
   * @purpose Override AI classification
   */
  @Mutation(() => Boolean, { description: 'Override AI classification' })
  async overrideClassification(
    @CurrentUser() user: User,
    @Args('classificationId') classificationId: string,
    @Args('override') override: ClassificationOverrideDto
  ): Promise<boolean> {
    await this.aiService.overrideClassification(classificationId, user.id, override);
    return true;
  }

  /**
   * @method validateClassification
   * @purpose Validate AI classification
   */
  @Mutation(() => Boolean, { description: 'Validate AI classification' })
  async validateClassification(
    @CurrentUser() user: User,
    @Args('classificationId') classificationId: string,
    @Args('validation') validation: ClassificationValidationDto
  ): Promise<boolean> {
    await this.aiService.validateClassification(classificationId, user.id, validation);
    return true;
  }

  /**
   * @method correctExtraction
   * @purpose Correct extraction data
   */
  @Mutation(() => Boolean, { description: 'Correct extraction data' })
  async correctExtraction(
    @CurrentUser() user: User,
    @Args('extractionId') extractionId: string,
    @Args('correction') correction: ExtractionCorrectionDto
  ): Promise<boolean> {
    await this.aiService.correctExtraction(extractionId, user.id, correction);
    return true;
  }

  /**
   * @method getAIStats
   * @purpose Get AI processing statistics
   */
  @Query(() => AIStatsType, { description: 'Get AI processing statistics' })
  async getAIStats(@CurrentUser() user: User): Promise<AIStatsType> {
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
   * @method getProcessingStatus
   * @purpose Get current processing status
   */
  @Query(() => ProcessingStatusType, { description: 'Get current processing status' })
  async getProcessingStatus(@CurrentUser() user: User): Promise<ProcessingStatusType> {
    const status = await this.aiService.getProcessingStatus(user.id);

    return {
      isProcessing: status.isProcessing,
      queueSize: status.queuedEmails,
      activeJobs: 0, // Default to 0 active jobs
      currentOperation: status.currentBatch ? 'Processing batch' : null,
      progress: status.currentBatch ? status.currentBatch.progress : null,
    };
  }

  /**
   * @method getCostSummary
   * @purpose Get cost summary
   */
  @Query(() => String, { description: 'Get cost summary as JSON string' })
  async getCostSummary(
    @CurrentUser() user: User,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string
  ): Promise<string> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const summary = await this.costTrackingService.getCostSummary(user.id, start, end);
    return JSON.stringify(summary);
  }

  /**
   * @method getDailyCost
   * @purpose Get daily cost
   */
  @Query(() => Float, { description: 'Get daily cost' })
  async getDailyCost(
    @CurrentUser() user: User,
    @Args('date', { nullable: true }) date?: string
  ): Promise<number> {
    const targetDate = date ? new Date(date) : new Date();
    
    if (date && isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.costTrackingService.getDailyCost(user.id, targetDate);
  }

  /**
   * @method getMonthlyCost
   * @purpose Get monthly cost
   */
  @Query(() => Float, { description: 'Get monthly cost' })
  async getMonthlyCost(
    @CurrentUser() user: User,
    @Args('date', { nullable: true }) date?: string
  ): Promise<number> {
    const targetDate = date ? new Date(date) : new Date();
    
    if (date && isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.costTrackingService.getMonthlyCost(user.id, targetDate);
  }

  /**
   * @method aiProcessingUpdates
   * @purpose Subscribe to AI processing updates
   */
  @Subscription(() => String, {
    description: 'Subscribe to AI processing updates',
    filter: (payload, variables, context) => {
      return payload.userId === context.req.user.id;
    },
  })
  aiProcessingUpdates(@CurrentUser() user: User) {
    return (this.pubSub as any).asyncIterator('AI_PROCESSING_UPDATE');
  }

  /**
   * @method aiBatchUpdates
   * @purpose Subscribe to AI batch processing updates
   */
  @Subscription(() => String, {
    description: 'Subscribe to AI batch processing updates',
    filter: (payload, variables, context) => {
      return payload.userId === context.req.user.id;
    },
  })
  aiBatchUpdates(@CurrentUser() user: User) {
    return (this.pubSub as any).asyncIterator('AI_BATCH_UPDATE');
  }

  /**
   * @method transformProcessingResult
   * @purpose Transform processing result for GraphQL
   */
  private transformProcessingResult(result: any): AIProcessingResultDto {
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
   * @method transformBatchResult
   * @purpose Transform batch result for GraphQL
   */
  private transformBatchResult(result: any): BatchProcessingResultDto {
    return {
      success: result.success,
      totalProcessed: result.totalProcessed,
      totalSuccessful: result.totalSuccessful,
      totalFailed: result.totalFailed,
      totalCost: result.totalCost,
      totalTime: result.totalTime,
      results: result.results.map(r => this.transformProcessingResult(r)),
      errors: result.errors || [],
    };
  }
}