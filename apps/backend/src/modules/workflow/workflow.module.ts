import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { EmailMessage } from '../../database/entities/email-message.entity';
import { Classification } from '../../database/entities/classification.entity';
import { Extraction } from '../../database/entities/extraction.entity';

// Services
import { WorkflowService } from './services/workflow.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowRuleService } from './services/workflow-rule.service';

// Controllers
import { WorkflowController } from './controllers/workflow.controller';

// Resolvers
import { WorkflowResolver } from './resolvers/workflow.resolver';

// Common modules
import { CommonModule } from '../../common/common.module';

/**
 * @class WorkflowModule
 * @purpose Email workflow management module
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailMessage,
      Classification,
      Extraction,
    ]),
    CommonModule,
  ],
  controllers: [
    WorkflowController,
  ],
  providers: [
    WorkflowService,
    WorkflowEngineService,
    WorkflowRuleService,
    WorkflowResolver,
  ],
  exports: [
    WorkflowService,
    WorkflowEngineService,
    WorkflowRuleService,
  ],
})
export class WorkflowModule {}