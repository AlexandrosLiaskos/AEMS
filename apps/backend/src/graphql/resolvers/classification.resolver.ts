import { Resolver, Query, Mutation, Args, Parent, ResolveField } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Guards
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';

// Services
import { ClassificationService } from '../../modules/ai/services/classification.service';

// Entities
import { Classification, EmailCategory } from '../../database/entities/classification.entity';
import { EmailMessage } from '../../database/entities/email-message.entity';
import { User } from '../../database/entities/user.entity';

// Decorators
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';

// Types
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

/**
 * @class AlternativeCategoryType
 * @purpose GraphQL type for alternative categories
 */
@ObjectType()
class AlternativeCategoryType {
  @Field()
  category: string;

  @Field(() => Float)
  confidence: number;

  @Field({ nullable: true })
  reasoning?: string;
}

/**
 * @class ClassificationMetricsType
 * @purpose GraphQL type for classification metrics
 */
@ObjectType()
class ClassificationMetricsType {
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
}

/**
 * @class ClassificationType
 * @purpose GraphQL type for Classification entity
 */
@ObjectType()
class ClassificationType {
  @Field(() => ID)
  id: string;

  @Field()
  category: string;

  @Field(() => Float)
  confidence: number;

  @Field()
  reasoning: string;

  @Field(() => [AlternativeCategoryType])
  alternativeCategories: AlternativeCategoryType[];

  @Field()
  modelVersion: string;

  @Field()
  isManualOverride: boolean;

  @Field({ nullable: true })
  overrideReason?: string;

  @Field({ nullable: true })
  overriddenBy?: string;

  @Field({ nullable: true })
  overriddenAt?: Date;

  @Field()
  isValidated: boolean;

  @Field({ nullable: true })
  validatedBy?: string;

  @Field({ nullable: true })
  validatedAt?: Date;

  @Field({ nullable: true })
  validationFeedback?: string;

  @Field(() => ClassificationMetricsType, { nullable: true })
  metrics?: ClassificationMetricsType;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations
  @Field(() => String)
  emailId: string;
}

/**
 * @class ClassificationStatsType
 * @purpose GraphQL type for classification statistics
 */
@ObjectType()
class ClassificationStatsType {
  @Field(() => Int)
  totalClassifications: number;

  @Field(() => Int)
  validatedClassifications: number;

  @Field(() => Int)
  correctClassifications: number;

  @Field(() => Float)
  accuracyRate: number;

  @Field(() => String) // JSON string
  categoryBreakdown: string;

  @Field(() => String) // JSON string
  categoryAccuracy: string;

  @Field(() => Float)
  averageConfidence: number;

  @Field(() => Int)
  manualOverrides: number;
}

/**
 * @class ClassificationResolver
 * @purpose GraphQL resolver for Classification operations
 */
@Resolver(() => ClassificationType)
@UseGuards(JwtAuthGuard)
export class ClassificationResolver {
  constructor(
    @InjectRepository(Classification)
    private classificationRepository: Repository<Classification>,
    @InjectRepository(EmailMessage)
    private emailRepository: Repository<EmailMessage>,
    private classificationService: ClassificationService
  ) {}

  /**
   * @method classification
   * @purpose Get classification by ID
   */
  @Query(() => ClassificationType, { description: 'Get classification by ID' })
  async classification(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<ClassificationType> {
    const classification = await this.classificationRepository.findOne({
      where: { id },
      relations: ['email'],
    });

    if (!classification || classification.email.userId !== user.id) {
      throw new BadRequestException('Classification not found');
    }

    return this.transformClassificationToType(classification);
  }

  /**
   * @method classificationsByEmail
   * @purpose Get classifications for specific email
   */
  @Query(() => [ClassificationType], { description: 'Get classifications for specific email' })
  async classificationsByEmail(
    @CurrentUser() user: User,
    @Args('emailId') emailId: string
  ): Promise<ClassificationType[]> {
    // Verify email belongs to user
    const email = await this.emailRepository.findOne({
      where: { id: emailId, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    const classifications = await this.classificationRepository.find({
      where: { emailId },
      order: { createdAt: 'DESC' },
    });

    return classifications.map(c => this.transformClassificationToType(c));
  }

  /**
   * @method classificationStats
   * @purpose Get classification statistics
   */
  @Query(() => ClassificationStatsType, { description: 'Get classification statistics' })
  async classificationStats(@CurrentUser() user: User): Promise<ClassificationStatsType> {
    const accuracyStats = await this.classificationService.getAccuracyStats(user.id);
    const categoryBreakdown = await this.classificationService.getCategoryBreakdown(user.id);

    // Calculate additional stats
    const classifications = await this.classificationRepository
      .createQueryBuilder('classification')
      .innerJoin('classification.email', 'email')
      .where('email.userId = :userId', { userId: user.id })
      .getMany();

    const averageConfidence = classifications.length > 0
      ? classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length
      : 0;

    const manualOverrides = classifications.filter(c => c.isManualOverride).length;

    return {
      totalClassifications: accuracyStats.totalClassifications,
      validatedClassifications: accuracyStats.validatedClassifications,
      correctClassifications: accuracyStats.correctClassifications,
      accuracyRate: accuracyStats.accuracyRate,
      categoryBreakdown: JSON.stringify(categoryBreakdown),
      categoryAccuracy: JSON.stringify(accuracyStats.categoryAccuracy),
      averageConfidence,
      manualOverrides,
    };
  }

  /**
   * @method overrideClassification
   * @purpose Override classification with manual input
   */
  @Mutation(() => ClassificationType, { description: 'Override classification with manual input' })
  async overrideClassification(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('category') category: EmailCategory,
    @Args('reason') reason: string
  ): Promise<ClassificationType> {
    const classification = await this.classificationService.overrideClassification(
      id,
      category,
      reason,
      user.id
    );

    return this.transformClassificationToType(classification);
  }

  /**
   * @method validateClassification
   * @purpose Validate classification accuracy
   */
  @Mutation(() => ClassificationType, { description: 'Validate classification accuracy' })
  async validateClassification(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('isCorrect') isCorrect: boolean,
    @Args('feedback', { nullable: true }) feedback?: string,
    @Args('correctCategory', { nullable: true }) correctCategory?: EmailCategory
  ): Promise<ClassificationType> {
    const classification = await this.classificationService.validateClassification(
      id,
      isCorrect,
      user.id,
      feedback,
      correctCategory
    );

    return this.transformClassificationToType(classification);
  }

  /**
   * @method email
   * @purpose Resolve email field
   */
  @ResolveField('email', () => String)
  async email(@Parent() classification: ClassificationType): Promise<string> {
    return classification.emailId;
  }

  /**
   * @method transformClassificationToType
   * @purpose Transform Classification entity to GraphQL type
   */
  private transformClassificationToType(classification: Classification): ClassificationType {
    return {
      id: classification.id,
      category: classification.category,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      alternativeCategories: classification.alternativeCategories || [],
      modelVersion: classification.modelVersion,
      isManualOverride: classification.isManualOverride,
      overrideReason: classification.overrideReason,
      overriddenBy: classification.overriddenBy,
      overriddenAt: classification.overriddenAt,
      isValidated: classification.isValidated,
      validatedBy: classification.validatedBy,
      validatedAt: classification.validatedAt,
      validationFeedback: classification.validationFeedback ? JSON.stringify(classification.validationFeedback) : undefined,
      metrics: classification.metrics ? {
        ...classification.metrics,
        apiCalls: classification.metrics.apiCalls || 1,
        retryCount: classification.metrics.retryCount || 0,
        fallbackUsed: classification.metrics.fallbackUsed || false,
      } as ClassificationMetricsType : undefined,
      createdAt: classification.createdAt,
      updatedAt: classification.updatedAt,
      emailId: classification.emailId,
    };
  }
}