import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { WorkflowService } from '../services/workflow.service';

/**
 * @class WorkflowResolver
 * @purpose GraphQL resolver for workflow operations
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class WorkflowResolver {
  constructor(private workflowService: WorkflowService) {}

  @Query(() => String)
  async getWorkflowStats(@CurrentUser() user: User): Promise<string> {
    const stats = await this.workflowService.getWorkflowStats(user.id);
    return JSON.stringify(stats);
  }
}
