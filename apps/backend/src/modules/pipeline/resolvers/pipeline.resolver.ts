import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ObjectType, Field, Int, InputType } from '@nestjs/graphql';
import { IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';

// Guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Entities
import { User } from '../../database/entities/user.entity';

// Services
import { EmailProcessingPipelineService, PipelineOptions } from './pipeline.service';

/**
 * @class PipelineOptionsDto
 * @purpose DTO for pipeline options
 */
@InputType()
export class PipelineOptionsDto {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  batchSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipSync?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipClassification?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipExtraction?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  forceReprocess?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  categories?: string[];
}

/**
 * @class PipelineResultDto
 * @purpose DTO for pipeline result
 */
@ObjectType()
export class PipelineResultDto {
  @Field()
  success: boolean;

  @Field(() => Int)
  totalEmails: number;

  @Field(() => Int)
  processed: number;

  @Field(() => Int)
  classified: number;

  @Field(() => Int)
  extracted: number;

  @Field(() => Int)
  errors: number;

  @Field(() => Int)
  duration: number;

  @Field(() => [PipelineErrorDto])
  errorDetails: PipelineErrorDto[];
}

/**
 * @class PipelineErrorDto
 * @purpose DTO for pipeline error
 */
@ObjectType()
export class PipelineErrorDto {
  @Field()
  emailId: string;

  @Field()
  stage: string;

  @Field()
  error: string;
}

/**
 * @class PipelineStatusDto
 * @purpose DTO for pipeline status
 */
@ObjectType()
export class PipelineStatusDto {
  @Field()
  isRunning: boolean;

  @Field({ nullable: true })
  currentRun?: string;
}

/**
 * @class PipelineStatsDto
 * @purpose DTO for pipeline statistics
 */
@ObjectType()
export class PipelineStatsDto {
  @Field(() => Int)
  totalRuns: number;

  @Field(() => Int)
  successfulRuns: number;

  @Field(() => Int)
  failedRuns: number;

  @Field(() => Int)
  averageDuration: number;

  @Field({ nullable: true })
  lastRun?: string;

  @Field(() => Int)
  emailsProcessed: number;

  @Field(() => Int)
  classificationsCreated: number;

  @Field(() => Int)
  extractionsCreated: number;
}

/**
 * @class PipelineResolver
 * @purpose GraphQL resolver for email processing pipeline
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class PipelineResolver {
  private pubSub: PubSub = new PubSub();

  constructor(
    private pipelineService: EmailProcessingPipelineService,
  ) {}

  /**
   * @method runPipeline
   * @purpose Run the email processing pipeline
   */
  @Mutation(() => PipelineResultDto, { description: 'Run the email processing pipeline' })
  async runPipeline(
    @CurrentUser() user: User,
    @Args('options', { nullable: true }) options?: PipelineOptionsDto
  ): Promise<PipelineResultDto> {
    const pipelineOptions: PipelineOptions = {
      userId: user.id,
      batchSize: options?.batchSize || 10,
      skipSync: options?.skipSync || false,
      skipClassification: options?.skipClassification || false,
      skipExtraction: options?.skipExtraction || false,
      forceReprocess: options?.forceReprocess || false,
      categories: options?.categories,
    };

    const result = await this.pipelineService.runPipeline(pipelineOptions);

    return {
      success: result.success,
      totalEmails: result.totalEmails,
      processed: result.processed,
      classified: result.classified,
      extracted: result.extracted,
      errors: result.errors,
      duration: result.duration,
      errorDetails: result.errorDetails.map(error => ({
        emailId: error.emailId,
        stage: error.stage,
        error: error.error,
      })),
    };
  }

  /**
   * @method getPipelineStatus
   * @purpose Get current pipeline status
   */
  @Query(() => PipelineStatusDto, { description: 'Get current pipeline status' })
  async getPipelineStatus(): Promise<PipelineStatusDto> {
    const status = this.pipelineService.getPipelineStatus();
    
    return {
      isRunning: status.isRunning,
      currentRun: status.currentRun || undefined,
    };
  }

  /**
   * @method stopPipeline
   * @purpose Stop the current pipeline execution
   */
  @Mutation(() => Boolean, { description: 'Stop the current pipeline execution' })
  async stopPipeline(): Promise<boolean> {
    return this.pipelineService.stopPipeline();
  }

  /**
   * @method getPipelineStats
   * @purpose Get pipeline execution statistics
   */
  @Query(() => PipelineStatsDto, { description: 'Get pipeline execution statistics' })
  async getPipelineStats(@CurrentUser() user: User): Promise<PipelineStatsDto> {
    const stats = await this.pipelineService.getPipelineStats(user.id);
    
    return {
      totalRuns: stats.totalRuns,
      successfulRuns: stats.successfulRuns,
      failedRuns: stats.failedRuns,
      averageDuration: stats.averageDuration,
      lastRun: stats.lastRun?.toISOString(),
      emailsProcessed: stats.emailsProcessed,
      classificationsCreated: stats.classificationsCreated,
      extractionsCreated: stats.extractionsCreated,
    };
  }

  /**
   * @method runQuickSync
   * @purpose Run a quick sync and classification
   */
  @Mutation(() => PipelineResultDto, { description: 'Run a quick sync and classification' })
  async runQuickSync(@CurrentUser() user: User): Promise<PipelineResultDto> {
    const pipelineOptions: PipelineOptions = {
      userId: user.id,
      batchSize: 5,
      skipExtraction: true, // Only sync and classify
      forceReprocess: false,
    };

    const result = await this.pipelineService.runPipeline(pipelineOptions);

    return {
      success: result.success,
      totalEmails: result.totalEmails,
      processed: result.processed,
      classified: result.classified,
      extracted: result.extracted,
      errors: result.errors,
      duration: result.duration,
      errorDetails: result.errorDetails.map(error => ({
        emailId: error.emailId,
        stage: error.stage,
        error: error.error,
      })),
    };
  }

  /**
   * @method runFullProcessing
   * @purpose Run full processing including extraction
   */
  @Mutation(() => PipelineResultDto, { description: 'Run full processing including extraction' })
  async runFullProcessing(
    @CurrentUser() user: User,
    @Args('batchSize', { type: () => Int, nullable: true }) batchSize?: number,
    @Args('forceReprocess', { nullable: true }) forceReprocess?: boolean
  ): Promise<PipelineResultDto> {
    const pipelineOptions: PipelineOptions = {
      userId: user.id,
      batchSize: batchSize || 10,
      skipSync: false,
      skipClassification: false,
      skipExtraction: false,
      forceReprocess: forceReprocess || false,
    };

    const result = await this.pipelineService.runPipeline(pipelineOptions);

    return {
      success: result.success,
      totalEmails: result.totalEmails,
      processed: result.processed,
      classified: result.classified,
      extracted: result.extracted,
      errors: result.errors,
      duration: result.duration,
      errorDetails: result.errorDetails.map(error => ({
        emailId: error.emailId,
        stage: error.stage,
        error: error.error,
      })),
    };
  }

  /**
   * @method pipelineUpdates
   * @purpose Subscribe to pipeline updates
   */
  @Subscription(() => String, {
    description: 'Subscribe to pipeline updates',
    filter: (payload, variables, context) => {
      return payload.userId === context.req.user.id;
    },
  })
  pipelineUpdates(@CurrentUser() user: User) {
    return (this.pubSub as any).asyncIterator(['pipeline.started', 'pipeline.progress', 'pipeline.completed', 'pipeline.error']);
  }
}