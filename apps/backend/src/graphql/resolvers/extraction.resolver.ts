import { Resolver, Query, Mutation, Args, Parent, ResolveField } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Guards
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';

// Services
import { ExtractionService } from '../../modules/ai/services/extraction.service';

// Entities
import { Extraction, EmailCategory } from '../../database/entities/extraction.entity';
import { EmailMessage } from '../../database/entities/email-message.entity';
import { User } from '../../database/entities/user.entity';

// Decorators
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';

// Types
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

/**
 * @class FieldConfidenceType
 * @purpose GraphQL type for field confidence
 */
@ObjectType()
class FieldConfidenceType {
  @Field()
  field: string;

  @Field(() => Float)
  confidence: number;

  @Field()
  source: string;

  @Field({ nullable: true })
  reasoning?: string;
}

/**
 * @class ExtractionMetricsType
 * @purpose GraphQL type for extraction metrics
 */
@ObjectType()
class ExtractionMetricsType {
  @Field(() => Int)
  processingTime: number;

  @Field()
  modelVersion: string;

  @Field(() => Int)
  tokensUsed: number;

  @Field(() => Float)
  cost: number;

  @Field(() => Int)
  apiCalls: number;

  @Field(() => Int)
  retryCount: number;

  @Field()
  fallbackUsed: boolean;

  @Field(() => Int)
  fieldsExtracted: number;

  @Field(() => Int)
  fieldsValidated: number;

  @Field(() => Int)
  fieldsCorrected: number;
}

/**
 * @class ExtractionType
 * @purpose GraphQL type for Extraction entity
 */
@ObjectType()
class ExtractionType {
  @Field(() => ID)
  id: string;

  @Field()
  category: string;

  @Field(() => String) // JSON string
  extractedData: string;

  @Field(() => [FieldConfidenceType])
  fieldConfidences: FieldConfidenceType[];

  @Field(() => Float)
  overallConfidence: number;

  @Field()
  isComplete: boolean;

  @Field(() => [String])
  missingFields: string[];

  @Field()
  isValidated: boolean;

  @Field({ nullable: true })
  validatedBy?: string;

  @Field({ nullable: true })
  validatedAt?: Date;

  @Field()
  hasManualCorrections: boolean;

  @Field(() => String, { nullable: true }) // JSON string
  manualCorrections?: string;

  @Field(() => String, { nullable: true }) // JSON string
  correctionHistory?: string;

  @Field()
  modelVersion: string;

  @Field(() => ExtractionMetricsType, { nullable: true })
  metrics?: ExtractionMetricsType;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations
  @Field(() => String)
  emailId: string;
}

/**
 * @class ExtractionStatsType
 * @purpose GraphQL type for extraction statistics
 */
@ObjectType()
class ExtractionStatsType {
  @Field(() => Int)
  totalExtractions: number;

  @Field(() => Int)
  completeExtractions: number;

  @Field(() => Int)
  validatedExtractions: number;

  @Field(() => Float)
  completionRate: number;

  @Field(() => Float)
  validationRate: number;

  @Field(() => Float)
  averageConfidence: number;

  @Field(() => String) // JSON string
  categoryBreakdown: string;

  @Field(() => String) // JSON string
  fieldAccuracy: string;

  @Field(() => Int)
  manualCorrections: number;

  @Field(() => Float)
  averageProcessingTime: number;

  @Field(() => Float)
  totalCost: number;
}

/**
 * @class ExtractionResolver
 * @purpose GraphQL resolver for Extraction operations
 */
@Resolver(() => ExtractionType)
@UseGuards(JwtAuthGuard)
export class ExtractionResolver {
  constructor(
    @InjectRepository(Extraction)
    private extractionRepository: Repository<Extraction>,
    @InjectRepository(EmailMessage)
    private emailRepository: Repository<EmailMessage>,
    private extractionService: ExtractionService
  ) {}

  /**
   * @method extraction
   * @purpose Get extraction by ID
   */
  @Query(() => ExtractionType, { description: 'Get extraction by ID' })
  async extraction(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<ExtractionType> {
    const extraction = await this.extractionRepository.findOne({
      where: { id },
      relations: ['email'],
    });

    if (!extraction || extraction.email.userId !== user.id) {
      throw new BadRequestException('Extraction not found');
    }

    return this.transformExtractionToType(extraction);
  }

  /**
   * @method extractionsByEmail
   * @purpose Get extractions for specific email
   */
  @Query(() => [ExtractionType], { description: 'Get extractions for specific email' })
  async extractionsByEmail(
    @CurrentUser() user: User,
    @Args('emailId') emailId: string
  ): Promise<ExtractionType[]> {
    // Verify email belongs to user
    const email = await this.emailRepository.findOne({
      where: { id: emailId, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    const extractions = await this.extractionRepository.find({
      where: { emailId },
      order: { createdAt: 'DESC' },
    });

    return extractions.map(e => this.transformExtractionToType(e));
  }

  /**
   * @method extractionsByCategory
   * @purpose Get extractions by category
   */
  @Query(() => [ExtractionType], { description: 'Get extractions by category' })
  async extractionsByCategory(
    @CurrentUser() user: User,
    @Args('category') category: EmailCategory,
    @Args('limit', { defaultValue: 50 }) limit: number
  ): Promise<ExtractionType[]> {
    const extractions = await this.extractionRepository
      .createQueryBuilder('extraction')
      .innerJoin('extraction.email', 'email')
      .where('email.userId = :userId', { userId: user.id })
      .andWhere('extraction.category = :category', { category })
      .orderBy('extraction.createdAt', 'DESC')
      .limit(Math.min(limit, 100))
      .getMany();

    return extractions.map(e => this.transformExtractionToType(e));
  }

  /**
   * @method extractionStats
   * @purpose Get extraction statistics
   */
  @Query(() => ExtractionStatsType, { description: 'Get extraction statistics' })
  async extractionStats(@CurrentUser() user: User): Promise<ExtractionStatsType> {
    const extractions = await this.extractionRepository
      .createQueryBuilder('extraction')
      .innerJoin('extraction.email', 'email')
      .where('email.userId = :userId', { userId: user.id })
      .getMany();

    const totalExtractions = extractions.length;
    const completeExtractions = extractions.filter(e => e.isComplete).length;
    const validatedExtractions = extractions.filter(e => e.isValidated).length;
    const manualCorrections = extractions.filter(e => e.hasManualCorrections).length;

    const completionRate = totalExtractions > 0 ? completeExtractions / totalExtractions : 0;
    const validationRate = totalExtractions > 0 ? validatedExtractions / totalExtractions : 0;

    const averageConfidence = extractions.length > 0
      ? extractions.reduce((sum, e) => sum + e.overallConfidence, 0) / extractions.length
      : 0;

    // Category breakdown
    const categoryBreakdown = {};
    extractions.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
    });

    // Calculate average processing time and total cost
    const metricsExtractions = extractions.filter(e => e.metrics);
    const averageProcessingTime = metricsExtractions.length > 0
      ? metricsExtractions.reduce((sum, e) => sum + e.metrics.processingTime, 0) / metricsExtractions.length
      : 0;

    const totalCost = metricsExtractions.reduce((sum, e) => sum + e.metrics.cost, 0);

    return {
      totalExtractions,
      completeExtractions,
      validatedExtractions,
      completionRate,
      validationRate,
      averageConfidence,
      categoryBreakdown: JSON.stringify(categoryBreakdown),
      fieldAccuracy: JSON.stringify({}), // TODO: Implement field accuracy calculation
      manualCorrections,
      averageProcessingTime,
      totalCost,
    };
  }

  /**
   * @method correctField
   * @purpose Correct extracted field value
   */
  @Mutation(() => ExtractionType, { description: 'Correct extracted field value' })
  async correctField(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('fieldName') fieldName: string,
    @Args('correctedValue') correctedValue: string,
    @Args('reason') reason: string
  ): Promise<ExtractionType> {
    const extraction = await this.extractionService.correctField(
      id,
      fieldName,
      correctedValue,
      user.id,
      reason
    );

    return this.transformExtractionToType(extraction);
  }

  /**
   * @method validateExtraction
   * @purpose Validate extraction accuracy
   */
  @Mutation(() => ExtractionType, { description: 'Validate extraction accuracy' })
  async validateExtraction(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('isCorrect') isCorrect: boolean,
    @Args('feedback', { nullable: true }) feedback?: string
  ): Promise<ExtractionType> {
    const extraction = await this.extractionService.validateExtraction(
      id,
      isCorrect,
      user.id,
      feedback
    );

    return this.transformExtractionToType(extraction);
  }

  /**
   * @method markAsComplete
   * @purpose Mark extraction as complete
   */
  @Mutation(() => ExtractionType, { description: 'Mark extraction as complete' })
  async markAsComplete(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<ExtractionType> {
    const extraction = await this.extractionRepository.findOne({
      where: { id },
      relations: ['email'],
    });

    if (!extraction || extraction.email.userId !== user.id) {
      throw new BadRequestException('Extraction not found');
    }

    extraction.markAsComplete();
    await this.extractionRepository.save(extraction);

    return this.transformExtractionToType(extraction);
  }

  /**
   * @method email
   * @purpose Resolve email field
   */
  @ResolveField('email', () => String)
  async email(@Parent() extraction: ExtractionType): Promise<string> {
    return extraction.emailId;
  }

  /**
   * @method transformFieldConfidences
   * @purpose Transform field confidences object to array
   */
  private transformFieldConfidences(fieldConfidences: any): FieldConfidenceType[] {
    if (!fieldConfidences) return [];
    
    if (Array.isArray(fieldConfidences)) {
      return fieldConfidences;
    }
    
    // Convert object to array
    return Object.entries(fieldConfidences).map(([field, data]: [string, any]) => ({
      field,
      confidence: data.confidence || 0,
      source: data.source || 'ai',
      reasoning: data.reasoning || '',
    }));
  }

  /**
   * @method transformExtractionToType
   * @purpose Transform Extraction entity to GraphQL type
   */
  private transformExtractionToType(extraction: Extraction): ExtractionType {
    return {
      id: extraction.id,
      category: extraction.category,
      extractedData: JSON.stringify(extraction.extractedData),
      fieldConfidences: this.transformFieldConfidences(extraction.fieldConfidences),
      overallConfidence: extraction.overallConfidence,
      isComplete: extraction.isComplete,
      missingFields: extraction.missingFields || [],
      isValidated: extraction.isValidated,
      validatedBy: extraction.validatedBy,
      validatedAt: extraction.validatedAt,
      hasManualCorrections: extraction.hasManualCorrections,
      manualCorrections: extraction.manualCorrections ? JSON.stringify(extraction.manualCorrections) : undefined,
      correctionHistory: extraction.correctionHistory ? JSON.stringify(extraction.correctionHistory) : undefined,
      modelVersion: extraction.modelVersion,
      metrics: extraction.metrics as ExtractionMetricsType,
      createdAt: extraction.createdAt,
      updatedAt: extraction.updatedAt,
      emailId: extraction.emailId,
    };
  }
}