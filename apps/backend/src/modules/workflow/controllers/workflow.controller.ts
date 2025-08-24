import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { WorkflowService } from '../services/workflow.service';

/**
 * @class WorkflowController
 * @purpose REST API controller for workflow operations
 */
@ApiTags('Workflow')
@Controller('workflow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  @Get('stats')
  async getStats(@CurrentUser() user: User) {
    return this.workflowService.getWorkflowStats(user.id);
  }
}