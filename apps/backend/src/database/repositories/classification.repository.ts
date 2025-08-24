import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { Classification } from '../entities/classification.entity';
import { LoggerService } from '../../common/services/logger.service';
import { AppDataService } from '../../common/services/app-data.service';
import { FileService } from '../../common/services/file.service';

/**
 * @class ClassificationRepository
 * @purpose Repository for Classification entity operations
 */
@Injectable()
export class ClassificationRepository extends BaseRepository<Classification> {
  protected readonly fileName = 'classifications.json';

  constructor(
    logger: LoggerService,
    appDataService: AppDataService,
    fileService: FileService,
  ) {
    super(logger, appDataService, fileService);
    this.initializeFilePath();
  }

  /**
   * @method findByEmailId
   * @purpose Find classification by email ID
   */
  async findByEmailId(emailId: string): Promise<Classification | null> {
    return this.findOne({ emailId });
  }

  /**
   * @method findByCategory
   * @purpose Find classifications by category
   */
  async findByCategory(category: string): Promise<Classification[]> {
    return this.findAll({ 
      where: { category },
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
  }

  /**
   * @method findLowConfidenceClassifications
   * @purpose Find classifications with low confidence scores
   */
  async findLowConfidenceClassifications(threshold: number = 0.7): Promise<Classification[]> {
    const allClassifications = await this.findAll();
    return allClassifications.filter(c => c.confidence < threshold);
  }

  /**
   * @method findUnvalidatedClassifications
   * @purpose Find classifications that haven't been validated
   */
  async findUnvalidatedClassifications(): Promise<Classification[]> {
    return this.findAll({ 
      where: { isValidated: false },
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
  }

  /**
   * @method findManualOverrides
   * @purpose Find classifications that were manually overridden
   */
  async findManualOverrides(): Promise<Classification[]> {
    return this.findAll({ 
      where: { isManualOverride: true },
      orderBy: { field: 'updatedAt', direction: 'DESC' },
    });
  }

  /**
   * @method validateClassification
   * @purpose Mark classification as validated
   */
  async validateClassification(
    classificationId: string,
    isCorrect: boolean,
    correctCategory?: string,
    feedback?: string,
    validatedBy?: string
  ): Promise<Classification | null> {
    const validationFeedback = {
      isCorrect,
      correctCategory,
      feedback,
      validatedBy: validatedBy || 'system',
      validatedAt: new Date(),
    };

    return this.update(classificationId, {
      isValidated: true,
      validationFeedback,
    });
  }

  /**
   * @method overrideClassification
   * @purpose Override classification with manual input
   */
  async overrideClassification(
    classificationId: string,
    category: string,
    reasoning: string,
    userId: string
  ): Promise<Classification | null> {
    return this.update(classificationId, {
      category,
      reasoning,
      isManualOverride: true,
      confidence: 1.0, // Manual overrides have full confidence
    });
  }

  /**
   * @method getClassificationStats
   * @purpose Get classification statistics
   */
  async getClassificationStats(): Promise<{
    total: number;
    validated: number;
    manualOverrides: number;
    averageConfidence: number;
    categoryBreakdown: Record<string, number>;
    confidenceDistribution: {
      high: number; // > 0.8
      medium: number; // 0.5 - 0.8
      low: number; // < 0.5
    };
    modelVersions: Record<string, number>;
  }> {
    const allClassifications = await this.findAll();
    
    const validated = allClassifications.filter(c => c.isValidated).length;
    const manualOverrides = allClassifications.filter(c => c.isManualOverride).length;
    
    // Calculate average confidence
    const totalConfidence = allClassifications.reduce((sum, c) => sum + c.confidence, 0);
    const averageConfidence = allClassifications.length > 0 ? totalConfidence / allClassifications.length : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    allClassifications.forEach(c => {
      categoryBreakdown[c.category] = (categoryBreakdown[c.category] || 0) + 1;
    });

    // Confidence distribution
    const confidenceDistribution = {
      high: allClassifications.filter(c => c.confidence > 0.8).length,
      medium: allClassifications.filter(c => c.confidence >= 0.5 && c.confidence <= 0.8).length,
      low: allClassifications.filter(c => c.confidence < 0.5).length,
    };

    // Model versions
    const modelVersions: Record<string, number> = {};
    allClassifications.forEach(c => {
      if (c.modelVersion) {
        modelVersions[c.modelVersion] = (modelVersions[c.modelVersion] || 0) + 1;
      }
    });

    return {
      total: allClassifications.length,
      validated,
      manualOverrides,
      averageConfidence,
      categoryBreakdown,
      confidenceDistribution,
      modelVersions,
    };
  }

  /**
   * @method getAccuracyMetrics
   * @purpose Get classification accuracy metrics
   */
  async getAccuracyMetrics(): Promise<{
    totalValidated: number;
    correctClassifications: number;
    accuracy: number;
    accuracyByCategory: Record<string, { correct: number; total: number; accuracy: number }>;
  }> {
    const validatedClassifications = await this.findAll({ where: { isValidated: true } });
    
    const correctClassifications = validatedClassifications.filter(c => 
      c.validationFeedback?.isCorrect === true
    ).length;

    const accuracy = validatedClassifications.length > 0 ? 
      correctClassifications / validatedClassifications.length : 0;

    // Accuracy by category
    const accuracyByCategory: Record<string, { correct: number; total: number; accuracy: number }> = {};
    
    validatedClassifications.forEach(c => {
      if (!accuracyByCategory[c.category]) {
        accuracyByCategory[c.category] = { correct: 0, total: 0, accuracy: 0 };
      }
      
      accuracyByCategory[c.category].total++;
      if (c.validationFeedback?.isCorrect === true) {
        accuracyByCategory[c.category].correct++;
      }
    });

    // Calculate accuracy for each category
    Object.keys(accuracyByCategory).forEach(category => {
      const stats = accuracyByCategory[category];
      stats.accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
    });

    return {
      totalValidated: validatedClassifications.length,
      correctClassifications,
      accuracy,
      accuracyByCategory,
    };
  }

  /**
   * @method findSimilarClassifications
   * @purpose Find classifications similar to a given one
   */
  async findSimilarClassifications(
    category: string,
    confidenceThreshold: number = 0.8,
    limit: number = 10
  ): Promise<Classification[]> {
    return this.findAll({
      where: { category },
      orderBy: { field: 'confidence', direction: 'DESC' },
      limit,
    });
  }

  /**
   * @method getRecentClassifications
   * @purpose Get recent classifications
   */
  async getRecentClassifications(days: number = 7, limit: number = 50): Promise<Classification[]> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const allClassifications = await this.findAll({
      orderBy: { field: 'createdAt', direction: 'DESC' },
      limit,
    });

    return allClassifications.filter(c => c.createdAt >= cutoffDate);
  }
}