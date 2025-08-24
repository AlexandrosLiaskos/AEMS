import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Entities
import { EmailMessage } from '../../../database/entities/email-message.entity';
import { 
  Classification, 
  EmailCategory, 
  ClassificationFeatures, 
  ClassificationMetrics 
} from '../../../database/entities/classification.entity';

// Services
import { OpenAIService } from './openai.service';
import { PromptService } from './prompt.service';
import { ValidationService } from '../../../common/services/validation.service';
import { CacheService } from './cache.service';

// Repositories
import { ClassificationRepository } from '../../../database/repositories/classification.repository';
import { EmailMessageRepository } from '../../../database/repositories/email-message.repository';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface ClassificationRequest
 * @purpose Classification request interface
 */
export interface ClassificationRequest {
  subject: string;
  bodyText: string;
  from: string;
  to: string[];
  attachmentTypes: string[];
  features: ClassificationFeatures;
}

/**
 * @interface ClassificationResponse
 * @purpose OpenAI classification response interface
 */
export interface ClassificationResponse {
  category: EmailCategory;
  confidence: number;
  reasoning: string;
  alternativeCategories: Array<{
    category: EmailCategory;
    confidence: number;
    reasoning?: string;
  }>;
}

/**
 * @class ClassificationService
 * @purpose Email classification service using AI
 */
@Injectable()
export class ClassificationService {
  private readonly confidenceThreshold: number;
  private readonly modelVersion: string;

  constructor(
    private classificationRepository: ClassificationRepository,
    private emailRepository: EmailMessageRepository,
    private openaiService: OpenAIService,
    private promptService: PromptService,
    private validationService: ValidationService,
    private cacheService: CacheService,
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.confidenceThreshold = this.configService.get<number>('ai.classificationConfidenceThreshold', 0.7);
    this.modelVersion = this.configService.get<string>('ai.openaiModel', 'gpt-3.5-turbo');
  }

  /**
   * @method classifyEmail
   * @purpose Classify email using AI
   */
  async classifyEmail(email: EmailMessage): Promise<Classification> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting classification for email ${email.id}`,
        'ClassificationService',
        { emailId: email.id, subject: email.subject }
      );

      // Check cache first
      const cacheKey = this.generateCacheKey(email);
      const cachedResult = await this.cacheService.get<ClassificationResponse>(cacheKey);
      
      if (cachedResult) {
        this.logger.debug(
          `Using cached classification for email ${email.id}`,
          'ClassificationService'
        );
        
        return this.createClassificationFromResponse(email, cachedResult, 0, 0);
      }

      // Extract features
      const features = this.extractFeatures(email);
      
      // Build classification request
      const request: ClassificationRequest = {
        subject: email.subject,
        bodyText: email.bodyText || email.snippet,
        from: email.getFromEmail(),
        to: email.getToEmails(),
        attachmentTypes: email.metadata?.attachmentCount > 0 ? ['unknown'] : [],
        features,
      };

      // Generate prompt
      const prompt = this.promptService.getClassificationPrompt(request);

      // Call OpenAI
      const response = await this.openaiService.complete({
        prompt,
        maxTokens: 500,
        temperature: 0.3,
        model: this.modelVersion,
      });

      // Parse response
      const classificationResponse = this.parseClassificationResponse(response.content);

      // Cache result
      await this.cacheService.set(cacheKey, classificationResponse, { ttl: 3600 }); // 1 hour

      // Create classification entity
      const classification = this.createClassificationFromResponse(
        email,
        classificationResponse,
        response.tokensUsed,
        response.cost
      );

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      classification.metrics = {
        ...classification.metrics,
        processingTime,
      };

      // Save classification
      const savedClassification = await this.classificationRepository.create(classification);

      this.logger.log(
        `Classification completed for email ${email.id}: ${savedClassification.category} (${savedClassification.confidence})`,
        'ClassificationService',
        {
          emailId: email.id,
          category: savedClassification.category,
          confidence: savedClassification.confidence,
          processingTime,
        }
      );

      return savedClassification;
    } catch (error) {
      this.logger.error(
        `Classification failed for email ${email.id}`,
        error.stack,
        'ClassificationService'
      );
      throw error;
    }
  }

  /**
   * @method overrideClassification
   * @purpose Override AI classification with manual input
   */
  async overrideClassification(
    classificationId: string,
    newCategory: EmailCategory,
    reason: string,
    userId: string
  ): Promise<Classification> {
    try {
      const classification = await this.classificationRepository.findOne({
        where: { id: classificationId },
      });

      if (!classification) {
        throw new BadRequestException('Classification not found');
      }

      classification.override(newCategory, reason, userId);
      const savedClassification = await this.classificationRepository.create(classification);

      this.logger.log(
        `Classification overridden: ${classificationId} -> ${newCategory}`,
        'ClassificationService',
        { classificationId, newCategory, reason, userId }
      );

      return savedClassification;
    } catch (error) {
      this.logger.error(
        `Failed to override classification ${classificationId}`,
        error.stack,
        'ClassificationService'
      );
      throw error;
    }
  }

  /**
   * @method validateClassification
   * @purpose Validate classification accuracy
   */
  async validateClassification(
    classificationId: string,
    isCorrect: boolean,
    userId: string,
    feedback?: string,
    correctCategory?: EmailCategory
  ): Promise<Classification> {
    try {
      const classification = await this.classificationRepository.findOne({
        where: { id: classificationId },
      });

      if (!classification) {
        throw new BadRequestException('Classification not found');
      }

      classification.validate({
        isCorrect,
        correctCategory,
        feedback,
        validatedBy: userId,
      });
      const savedClassification = await this.classificationRepository.create(classification);

      this.logger.log(
        `Classification validated: ${classificationId} - ${isCorrect ? 'correct' : 'incorrect'}`,
        'ClassificationService',
        { classificationId, isCorrect, feedback, userId }
      );

      return savedClassification;
    } catch (error) {
      this.logger.error(
        `Failed to validate classification ${classificationId}`,
        error.stack,
        'ClassificationService'
      );
      throw error;
    }
  }

  /**
   * @method getCategoryBreakdown
   * @purpose Get category breakdown for user
   */
  async getCategoryBreakdown(userId: string): Promise<Record<EmailCategory, number>> {
    try {
      // Get all classifications for the user
      const allClassifications = await this.classificationRepository.findAll();
      const userClassifications = allClassifications.filter(c => {
        // We need to check if the classification belongs to the user's email
        // Since we don't have direct access to email data, we'll need to get it
        return true; // TODO: Implement proper filtering by userId
      });

      const breakdown: Record<EmailCategory, number> = {} as Record<EmailCategory, number>;
      
      // Initialize all categories with 0
      Object.values(EmailCategory).forEach(category => {
        breakdown[category] = 0;
      });

      // Count classifications by category
      userClassifications.forEach(classification => {
        if (classification.category in breakdown) {
          breakdown[classification.category as EmailCategory]++;
        }
      });

      return breakdown;
    } catch (error) {
      this.logger.error(
        `Failed to get category breakdown for user ${userId}`,
        error.stack,
        'ClassificationService'
      );
      throw error;
    }
  }

  /**
   * @method getAccuracyStats
   * @purpose Get classification accuracy statistics
   */
  async getAccuracyStats(userId: string): Promise<{
    totalClassifications: number;
    validatedClassifications: number;
    correctClassifications: number;
    accuracyRate: number;
    categoryAccuracy: Record<EmailCategory, { total: number; correct: number; accuracy: number }>;
  }> {
    try {
      // Get all classifications - we'll need to filter by userId through email relationship
      const allClassifications = await this.classificationRepository.findAll();
      // TODO: Implement proper filtering by userId through email relationship
      const classifications = allClassifications;

      const stats = {
        totalClassifications: classifications.length,
        validatedClassifications: classifications.filter(c => c.isValidated).length,
        correctClassifications: 0,
        accuracyRate: 0,
        categoryAccuracy: {} as Record<EmailCategory, { total: number; correct: number; accuracy: number }>,
      };

      // Initialize category stats
      Object.values(EmailCategory).forEach(category => {
        stats.categoryAccuracy[category] = { total: 0, correct: 0, accuracy: 0 };
      });

      // Calculate accuracy
      classifications.forEach(classification => {
        if (classification.category in stats.categoryAccuracy) {
          stats.categoryAccuracy[classification.category as EmailCategory].total++;

          if (classification.isValidated && classification.validationFeedback?.isCorrect) {
            stats.correctClassifications++;
            stats.categoryAccuracy[classification.category as EmailCategory].correct++;
          }
        }
      });

      // Calculate rates
      stats.accuracyRate = stats.validatedClassifications > 0 
        ? stats.correctClassifications / stats.validatedClassifications 
        : 0;

      Object.values(EmailCategory).forEach(category => {
        const categoryStats = stats.categoryAccuracy[category];
        categoryStats.accuracy = categoryStats.total > 0 
          ? categoryStats.correct / categoryStats.total 
          : 0;
      });

      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get accuracy stats for user ${userId}`,
        error.stack,
        'ClassificationService'
      );
      throw error;
    }
  }

  /**
   * @method deleteClassification
   * @purpose Delete classification
   */
  async deleteClassification(classificationId: string): Promise<void> {
    try {
      await this.classificationRepository.delete(classificationId);
      
      this.logger.log(
        `Classification deleted: ${classificationId}`,
        'ClassificationService'
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete classification ${classificationId}`,
        error.stack,
        'ClassificationService'
      );
      throw error;
    }
  }

  /**
   * @method extractFeatures
   * @purpose Extract features from email for classification
   */
  private extractFeatures(email: EmailMessage): ClassificationFeatures {
    const now = new Date();
    const receivedAt = email.receivedAt || now;

    return {
      subjectKeywords: this.extractKeywords(email.subject),
      bodyKeywords: this.extractKeywords(email.bodyText || email.snippet || ''),
      senderDomain: email.getFromEmail().split('@')[1] || '',
      senderName: email.getFromName(),
      hasAttachments: email.metadata?.hasAttachments || false,
      hasLinks: this.hasLinks(email.bodyText || email.snippet || ''),
      attachmentTypes: [], // TODO: Extract from actual attachments
      emailLength: (email.bodyText || email.snippet || '').length,
      timeOfDay: receivedAt.getHours(),
      dayOfWeek: receivedAt.getDay(),
      isReply: email.subject.toLowerCase().startsWith('re:'),
      isForward: email.subject.toLowerCase().startsWith('fwd:') || email.subject.toLowerCase().startsWith('fw:'),
      urgencyIndicators: this.extractUrgencyIndicators(email.subject, email.bodyText || email.snippet || ''),
      businessHours: this.isBusinessHours(receivedAt),
      knownSender: false, // TODO: Implement sender reputation
      senderReputation: 0.5, // TODO: Implement sender reputation scoring
    };
  }

  /**
   * @method hasLinks
   * @purpose Check if email content contains links
   */
  private hasLinks(content: string): boolean {
    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
    return linkRegex.test(content);
  }

  /**
   * @method extractKeywords
   * @purpose Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    if (!text) return [];

    const keywords = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
      .slice(0, 20); // Limit to top 20 keywords

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * @method extractUrgencyIndicators
   * @purpose Extract urgency indicators from text
   */
  private extractUrgencyIndicators(subject: string, body: string): string[] {
    const urgencyKeywords = [
      'urgent', 'asap', 'emergency', 'critical', 'immediate',
      'rush', 'priority', 'important', 'action required', 'deadline'
    ];

    const text = `${subject} ${body}`.toLowerCase();
    return urgencyKeywords.filter(keyword => text.includes(keyword));
  }

  /**
   * @method isBusinessHours
   * @purpose Check if time is during business hours
   */
  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    
    // Monday to Friday, 9 AM to 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  /**
   * @method isStopWord
   * @purpose Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ];

    return stopWords.includes(word);
  }

  /**
   * @method generateCacheKey
   * @purpose Generate cache key for email classification
   */
  private generateCacheKey(email: EmailMessage): string {
    const content = `${email.subject}${email.bodyText || email.snippet}${email.getFromEmail()}`;
    const hash = require('crypto').createHash('md5').update(content).digest('hex');
    return `classification:${hash}`;
  }

  /**
   * @method parseClassificationResponse
   * @purpose Parse OpenAI classification response
   */
  private parseClassificationResponse(content: string): ClassificationResponse {
    try {
      const parsed = JSON.parse(content);
      
      // Validate required fields
      if (!parsed.category || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Invalid classification response format');
      }

      // Validate category
      if (!Object.values(EmailCategory).includes(parsed.category)) {
        throw new Error(`Invalid category: ${parsed.category}`);
      }

      // Validate confidence
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error(`Invalid confidence: ${parsed.confidence}`);
      }

      return {
        category: parsed.category,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        alternativeCategories: parsed.alternativeCategories || [],
      };
    } catch (error) {
      this.logger.error(
        'Failed to parse classification response',
        error.stack,
        'ClassificationService',
        { content }
      );
      
      // Fallback to OTHER category with low confidence
      return {
        category: EmailCategory.OTHER,
        confidence: 0.1,
        reasoning: 'Failed to parse AI response',
        alternativeCategories: [],
      };
    }
  }

  /**
   * @method createClassificationFromResponse
   * @purpose Create Classification entity from AI response
   */
  private createClassificationFromResponse(
    email: EmailMessage,
    response: ClassificationResponse,
    tokensUsed: number,
    cost: number
  ): Classification {
    const classification = new Classification();
    const features = this.extractFeatures(email);
    
    classification.emailId = email.id;
    classification.category = response.category;
    classification.confidence = response.confidence;
    classification.reasoning = response.reasoning;
    
    // Ensure alternativeCategories have required reasoning property
    classification.alternativeCategories = response.alternativeCategories?.map(alt => ({
      category: alt.category,
      confidence: alt.confidence,
      reasoning: alt.reasoning || 'No reasoning provided',
    })) || [];
    
    classification.modelVersion = this.modelVersion;
    classification.features = features;
    
    classification.metrics = {
      processingTime: 0, // Will be set by caller
      modelVersion: this.modelVersion,
      tokensUsed,
      cost,
      features,
      apiCalls: 1,
      retryCount: 0,
      fallbackUsed: false,
    };

    return classification;
  }
}