import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { User } from '../../database/entities/user.entity';
import { EmailMessage } from '../../database/entities/email-message.entity';
import { Classification } from '../../database/entities/classification.entity';
import { Extraction } from '../../database/entities/extraction.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

// Services
import { AIService } from './services/ai.service';
import { ClassificationService } from './services/classification.service';
import { ExtractionService } from './services/extraction.service';
import { OpenAIService } from './services/openai.service';
import { CostTrackingService } from './services/cost-tracking.service';
import { PromptService } from './services/prompt.service';
import { ValidationService } from './services/validation.service';
import { CacheService } from './services/cache.service';

// Controllers
import { AIController } from './controllers/ai.controller';

// Resolvers
import { AIResolver } from './resolvers/ai.resolver';

// Tasks
import { AIProcessingTask } from './tasks/ai-processing.task';

/**
 * @class AIModule
 * @purpose AI processing module for email classification and data extraction
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([User, EmailMessage, Classification, Extraction, AuditLog]),

    // Schedule module for processing tasks
    ScheduleModule,
  ],
  providers: [
    // Core services
    AIService,
    ClassificationService,
    ExtractionService,
    OpenAIService,
    CostTrackingService,
    PromptService,
    ValidationService,
    CacheService,

    // GraphQL resolver
    AIResolver,

    // Scheduled tasks
    AIProcessingTask,
  ],
  controllers: [AIController],
  exports: [
    AIService,
    ClassificationService,
    ExtractionService,
    OpenAIService,
    CostTrackingService,
    PromptService,
    ValidationService,
    CacheService,
  ],
})
export class AIModule {}