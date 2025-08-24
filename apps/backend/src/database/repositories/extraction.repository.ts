import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { Extraction } from '../entities/extraction.entity';
import { LoggerService } from '../../common/services/logger.service';
import { AppDataService } from '../../common/services/app-data.service';
import { FileService } from '../../common/services/file.service';

/**
 * @class ExtractionRepository
 * @purpose Repository for Extraction entity operations
 */
@Injectable()
export class ExtractionRepository extends BaseRepository<Extraction> {
  protected readonly fileName = 'extractions.json';

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
   * @purpose Find extraction by email ID
   */
  async findByEmailId(emailId: string): Promise<Extraction | null> {
    return this.findOne({ emailId });
  }

  /**
   * @method findByCategory
   * @purpose Find extractions by category
   */
  async findByCategory(category: string): Promise<Extraction[]> {
    return this.findAll({ 
      where: { category },
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
  }

  /**
   * @method findIncompleteExtractions
   * @purpose Find extractions that are not complete
   */
  async findIncompleteExtractions(): Promise<Extraction[]> {
    return this.findAll({ 
      where: { isComplete: false },
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
  }

  /**
   * @method findLowConfidenceExtractions
   * @purpose Find extractions with low confidence scores
   */
  async findLowConfidenceExtractions(threshold: number = 0.7): Promise<Extraction[]> {
    const allExtractions = await this.findAll();
    return allExtractions.filter(e => e.overallConfidence < threshold);
  }

  /**
   * @method findExtractionsNeedingReview
   * @purpose Find extractions that need human review
   */
  async findExtractionsNeedingReview(confidenceThreshold: number = 0.8): Promise<Extraction[]> {
    const allExtractions = await this.findAll();
    return allExtractions.filter(e => 
      !e.isComplete || 
      e.overallConfidence < confidenceThreshold ||
      (e.missingFields && e.missingFields.length > 0) ||
      (e.extractionErrors && e.extractionErrors.some(err => err.severity === 'high'))
    );
  }

  /**
   * @method findUnvalidatedExtractions
   * @purpose Find extractions that haven't been validated
   */
  async findUnvalidatedExtractions(): Promise<Extraction[]> {
    return this.findAll({ 
      where: { isValidated: false },
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
  }

  /**
   * @method findExtractionsWithCorrections
   * @purpose Find extractions that have manual corrections
   */
  async findExtractionsWithCorrections(): Promise<Extraction[]> {
    return this.findAll({ 
      where: { hasManualCorrections: true },
      orderBy: { field: 'updatedAt', direction: 'DESC' },
    });
  }

  /**
   * @method correctField
   * @purpose Correct a specific field in extraction
   */
  async correctField(
    extractionId: string,
    fieldName: string,
    correctedValue: any,
    userId: string,
    reason: string
  ): Promise<Extraction | null> {
    const extraction = await this.findById(extractionId);
    if (!extraction) return null;

    const corrections = extraction.corrections || [];
    const correction = {
      field: fieldName,
      originalValue: extraction.extractedData[fieldName],
      correctedValue,
      correctedBy: userId,
      correctedAt: new Date(),
      reason,
    };

    corrections.push(correction);

    // Update the extracted data
    const updatedData = { ...extraction.extractedData };
    updatedData[fieldName] = correctedValue;

    return this.update(extractionId, {
      extractedData: updatedData,
      corrections,
      hasManualCorrections: true,
    });
  }

  /**
   * @method validateExtraction
   * @purpose Mark extraction as validated
   */
  async validateExtraction(
    extractionId: string,
    feedback: any,
    userId: string
  ): Promise<Extraction | null> {
    return this.update(extractionId, {
      isValidated: true,
    });
  }

  /**
   * @method markAsComplete
   * @purpose Mark extraction as complete
   */
  async markAsComplete(extractionId: string): Promise<Extraction | null> {
    return this.update(extractionId, {
      isComplete: true,
      missingFields: [],
    });
  }

  /**
   * @method addExtractionError
   * @purpose Add extraction error
   */
  async addExtractionError(
    extractionId: string,
    field: string,
    error: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<Extraction | null> {
    const extraction = await this.findById(extractionId);
    if (!extraction) return null;

    const errors = extraction.extractionErrors || [];
    errors.push({ field, error, severity });

    return this.update(extractionId, {
      extractionErrors: errors,
    });
  }

  /**
   * @method incrementProcessingAttempts
   * @purpose Increment processing attempts counter
   */
  async incrementProcessingAttempts(
    extractionId: string,
    error?: string
  ): Promise<Extraction | null> {
    const extraction = await this.findById(extractionId);
    if (!extraction) return null;

    const updateData: any = {
      processingAttempts: extraction.processingAttempts + 1,
    };

    if (error) {
      updateData.lastProcessingError = error;
    }

    return this.update(extractionId, updateData);
  }

  /**
   * @method getExtractionStats
   * @purpose Get extraction statistics
   */
  async getExtractionStats(): Promise<{
    total: number;
    complete: number;
    incomplete: number;
    validated: number;
    withCorrections: number;
    averageConfidence: number;
    categoryBreakdown: Record<string, number>;
    confidenceDistribution: {
      high: number; // > 0.8
      medium: number; // 0.5 - 0.8
      low: number; // < 0.5
    };
    errorStats: {
      totalWithErrors: number;
      highSeverityErrors: number;
      commonErrors: Record<string, number>;
    };
  }> {
    const allExtractions = await this.findAll();
    
    const complete = allExtractions.filter(e => e.isComplete).length;
    const incomplete = allExtractions.filter(e => !e.isComplete).length;
    const validated = allExtractions.filter(e => e.isValidated).length;
    const withCorrections = allExtractions.filter(e => e.hasManualCorrections).length;
    
    // Calculate average confidence
    const totalConfidence = allExtractions.reduce((sum, e) => sum + e.overallConfidence, 0);
    const averageConfidence = allExtractions.length > 0 ? totalConfidence / allExtractions.length : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    allExtractions.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
    });

    // Confidence distribution
    const confidenceDistribution = {
      high: allExtractions.filter(e => e.overallConfidence > 0.8).length,
      medium: allExtractions.filter(e => e.overallConfidence >= 0.5 && e.overallConfidence <= 0.8).length,
      low: allExtractions.filter(e => e.overallConfidence < 0.5).length,
    };

    // Error statistics
    const extractionsWithErrors = allExtractions.filter(e => 
      e.extractionErrors && e.extractionErrors.length > 0
    );
    
    const highSeverityErrors = allExtractions.filter(e => 
      e.extractionErrors && e.extractionErrors.some(err => err.severity === 'high')
    ).length;

    const commonErrors: Record<string, number> = {};
    allExtractions.forEach(e => {
      if (e.extractionErrors) {
        e.extractionErrors.forEach(err => {
          commonErrors[err.error] = (commonErrors[err.error] || 0) + 1;
        });
      }
    });

    return {
      total: allExtractions.length,
      complete,
      incomplete,
      validated,
      withCorrections,
      averageConfidence,
      categoryBreakdown,
      confidenceDistribution,
      errorStats: {
        totalWithErrors: extractionsWithErrors.length,
        highSeverityErrors,
        commonErrors,
      },
    };
  }

  /**
   * @method getFieldAccuracy
   * @purpose Get accuracy metrics for specific fields
   */
  async getFieldAccuracy(category: string): Promise<Record<string, {
    totalExtractions: number;
    successfulExtractions: number;
    accuracy: number;
    averageConfidence: number;
  }>> {
    const categoryExtractions = await this.findByCategory(category);
    const fieldStats: Record<string, {
      totalExtractions: number;
      successfulExtractions: number;
      accuracy: number;
      averageConfidence: number;
      totalConfidence: number;
    }> = {};

    categoryExtractions.forEach(extraction => {
      Object.keys(extraction.extractedData).forEach(fieldName => {
        if (!fieldStats[fieldName]) {
          fieldStats[fieldName] = {
            totalExtractions: 0,
            successfulExtractions: 0,
            accuracy: 0,
            averageConfidence: 0,
            totalConfidence: 0,
          };
        }

        fieldStats[fieldName].totalExtractions++;

        // Check if field was successfully extracted (has value and good confidence)
        const fieldConfidence = extraction.fieldConfidences?.[fieldName]?.confidence || 0;
        const hasValue = extraction.extractedData[fieldName] !== null && 
                        extraction.extractedData[fieldName] !== undefined && 
                        extraction.extractedData[fieldName] !== '';

        if (hasValue && fieldConfidence > 0.5) {
          fieldStats[fieldName].successfulExtractions++;
        }

        fieldStats[fieldName].totalConfidence += fieldConfidence;
      });
    });

    // Calculate final metrics
    const result: Record<string, {
      totalExtractions: number;
      successfulExtractions: number;
      accuracy: number;
      averageConfidence: number;
    }> = {};

    Object.keys(fieldStats).forEach(fieldName => {
      const stats = fieldStats[fieldName];
      result[fieldName] = {
        totalExtractions: stats.totalExtractions,
        successfulExtractions: stats.successfulExtractions,
        accuracy: stats.totalExtractions > 0 ? stats.successfulExtractions / stats.totalExtractions : 0,
        averageConfidence: stats.totalExtractions > 0 ? stats.totalConfidence / stats.totalExtractions : 0,
      };
    });

    return result;
  }

  /**
   * @method getRecentExtractions
   * @purpose Get recent extractions
   */
  async getRecentExtractions(days: number = 7, limit: number = 50): Promise<Extraction[]> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const allExtractions = await this.findAll({
      orderBy: { field: 'createdAt', direction: 'DESC' },
      limit,
    });

    return allExtractions.filter(e => e.createdAt >= cutoffDate);
  }
}