import { InputType, ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @class ProcessEmailDto
 * @purpose DTO for processing single email
 */
@InputType()
export class ProcessEmailDto {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  forceReprocess?: boolean;

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
  @IsString()
  priority?: string;
}

/**
 * @class BatchProcessDto
 * @purpose DTO for batch processing emails
 */
@InputType()
export class BatchProcessDto {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  forceReprocess?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipClassification?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipExtraction?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  batchSize?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  concurrency?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  continueOnError?: boolean;
}

/**
 * @class ClassificationOverrideDto
 * @purpose DTO for classification override
 */
@InputType()
export class ClassificationOverrideDto {
  @Field()
  @IsString()
  category: string;

  @Field()
  @IsString()
  reason: string;

  @Field()
  @IsString()
  reasoning: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * @class ClassificationValidationDto
 * @purpose DTO for classification validation
 */
@InputType()
export class ClassificationValidationDto {
  @Field()
  @IsBoolean()
  isCorrect: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  correctCategory?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  feedback?: string;
}

/**
 * @class ExtractionCorrectionDto
 * @purpose DTO for extraction correction
 */
@InputType()
export class ExtractionCorrectionDto {
  @Field()
  @IsString()
  fieldName: string;

  @Field()
  @IsString()
  correctedValue: string;

  @Field()
  @IsString()
  reason: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * @class AlternativeCategoryDto
 * @purpose DTO for alternative classification category
 */
@ObjectType()
export class AlternativeCategoryDto {
  @Field()
  category: string;

  @Field(() => Float)
  confidence: number;

  @Field()
  reasoning: string;
}

/**
 * @class ClassificationResultDto
 * @purpose DTO for classification result
 */
@ObjectType()
export class ClassificationResultDto {
  @Field()
  id: string;

  @Field()
  category: string;

  @Field(() => Float)
  confidence: number;

  @Field()
  reasoning: string;

  @Field()
  isManualOverride: boolean;

  @Field()
  isValidated: boolean;

  @Field(() => [AlternativeCategoryDto])
  alternativeCategories: AlternativeCategoryDto[];
}

/**
 * @class ExtractionResultDto
 * @purpose DTO for extraction result
 */
@ObjectType()
export class ExtractionResultDto {
  @Field()
  id: string;

  @Field()
  category: string;

  @Field()
  extractedData: string; // JSON string

  @Field(() => Float)
  overallConfidence: number;

  @Field()
  isComplete: boolean;

  @Field()
  isValidated: boolean;

  @Field()
  hasManualCorrections: boolean;

  @Field(() => [String])
  missingFields: string[];
}

/**
 * @class AIProcessingResultDto
 * @purpose DTO for AI processing result
 */
@ObjectType()
export class AIProcessingResultDto {
  @Field()
  success: boolean;

  @Field()
  emailId: string;

  @Field(() => Int)
  processingTime: number;

  @Field(() => Float)
  cost: number;

  @Field()
  needsReview: boolean;

  @Field({ nullable: true })
  error?: string;

  @Field(() => ClassificationResultDto, { nullable: true })
  classification?: ClassificationResultDto;

  @Field(() => ExtractionResultDto, { nullable: true })
  extraction?: ExtractionResultDto;
}

/**
 * @class BatchProcessingResultDto
 * @purpose DTO for batch processing result
 */
@ObjectType()
export class BatchProcessingResultDto {
  @Field()
  success: boolean;

  @Field(() => Int)
  totalProcessed: number;

  @Field(() => Int)
  totalSuccessful: number;

  @Field(() => Int)
  totalFailed: number;

  @Field(() => Float)
  totalCost: number;

  @Field(() => Int)
  totalTime: number;

  @Field(() => [AIProcessingResultDto])
  results: AIProcessingResultDto[];

  @Field(() => [String])
  errors: string[];
}

/**
 * @class AIStatsDto
 * @purpose DTO for AI statistics
 */
@ObjectType()
export class AIStatsDto {
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
  successRate: number;

  @Field()
  categoryBreakdown: string; // JSON string

  @Field(() => Float)
  dailyCost: number;

  @Field(() => Float)
  monthlyCost: number;

  @Field()
  monthlyTrends: string; // JSON string
}

/**
 * @class CostLimitDto
 * @purpose DTO for cost limits
 */
@InputType()
export class CostLimitDto {
  @Field(() => Float)
  @IsNumber()
  dailyLimit: number;

  @Field(() => Float)
  @IsNumber()
  monthlyLimit: number;
}

/**
 * @class ModelConfigDto
 * @purpose DTO for model configuration
 */
@InputType()
export class ModelConfigDto {
  @Field()
  @IsString()
  model: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  topP?: number;
}