import { Module } from '@nestjs/common';

// Services
import { EmailProcessingPipelineService } from './services/pipeline.service';
import { PipelineSchedulerService } from './services/pipeline-scheduler.service';

// Controllers
import { PipelineController } from './controllers/pipeline.controller';

// Resolvers
import { PipelineResolver } from './resolvers/pipeline.resolver';

// Other modules
import { CommonModule } from '../../common/common.module';
import { GmailModule } from '../gmail/gmail.module';
import { AIModule } from '../ai/ai.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { AuditModule } from '../audit/audit.module';

/**
 * @class PipelineModule
 * @purpose Email processing pipeline module
 */
@Module({
  imports: [
    CommonModule,
    GmailModule,
    AIModule,
    WorkflowModule,
    AuditModule,
  ],
  controllers: [
    PipelineController,
  ],
  providers: [
    EmailProcessingPipelineService,
    PipelineSchedulerService,
    PipelineResolver,
  ],
  exports: [
    EmailProcessingPipelineService,
    PipelineSchedulerService,
  ],
})
export class PipelineModule {}
