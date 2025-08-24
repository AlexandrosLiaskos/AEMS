import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Guards
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../modules/auth/guards/roles.guard';

// Entities
import { AuditLog, AuditAction } from '../../database/entities/audit-log.entity';
import { User, UserRole } from '../../database/entities/user.entity';

// Decorators
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';

// Types
import { ObjectType, Field, ID, Int, Float, InputType } from '@nestjs/graphql';

/**
 * @class AuditLogType
 * @purpose GraphQL type for AuditLog entity
 */
@ObjectType()
class AuditLogType {
  @Field(() => ID)
  id: string;

  @Field()
  action: string;

  @Field()
  resourceType: string;

  @Field()
  resourceId: string;

  @Field()
  description: string;

  @Field(() => String, { nullable: true }) // JSON string
  context?: string;

  @Field()
  userId: string;

  @Field()
  performedBy: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;

  @Field()
  isSuccessful: boolean;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field()
  createdAt: Date;
}

/**
 * @class AuditLogFiltersInput
 * @purpose GraphQL input for audit log filtering
 */
@InputType()
class AuditLogFiltersInput {
  @Field({ nullable: true })
  action?: string;

  @Field({ nullable: true })
  resourceType?: string;

  @Field({ nullable: true })
  resourceId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  performedBy?: string;

  @Field({ nullable: true })
  isSuccessful?: boolean;

  @Field({ nullable: true })
  dateFrom?: Date;

  @Field({ nullable: true })
  dateTo?: Date;
}

/**
 * @class AuditLogListResponse
 * @purpose GraphQL response for audit log list
 */
@ObjectType()
class AuditLogListResponse {
  @Field(() => [AuditLogType])
  logs: AuditLogType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  offset: number;

  @Field(() => Int)
  limit: number;

  @Field()
  hasMore: boolean;
}

/**
 * @class AuditLogStatsType
 * @purpose GraphQL type for audit log statistics
 */
@ObjectType()
class AuditLogStatsType {
  @Field(() => Int)
  totalLogs: number;

  @Field(() => Int)
  successfulActions: number;

  @Field(() => Int)
  failedActions: number;

  @Field(() => Float)
  successRate: number;

  @Field(() => String) // JSON string
  actionBreakdown: string;

  @Field(() => String) // JSON string
  resourceTypeBreakdown: string;

  @Field(() => String) // JSON string
  dailyActivity: string;
}

/**
 * @class AuditLogResolver
 * @purpose GraphQL resolver for AuditLog operations
 */
@Resolver(() => AuditLogType)
@UseGuards(JwtAuthGuard)
export class AuditLogResolver {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>
  ) {}

  /**
   * @method auditLogs
   * @purpose Get audit logs (Admin only or user's own logs)
   */
  @Query(() => AuditLogListResponse, { description: 'Get audit logs' })
  async auditLogs(
    @CurrentUser() user: User,
    @Args('filters', { nullable: true }) filters?: AuditLogFiltersInput,
    @Args('offset', { defaultValue: 0 }) offset = 0,
    @Args('limit', { defaultValue: 50 }) limit = 50
  ): Promise<AuditLogListResponse> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('auditLog');

    // Non-admin users can only see their own logs
    if (user.role !== UserRole.ADMIN) {
      queryBuilder.where('auditLog.userId = :userId', { userId: user.id });
    }

    // Apply filters
    if (filters) {
      if (filters.action) {
        queryBuilder.andWhere('auditLog.action = :action', { action: filters.action });
      }

      if (filters.resourceType) {
        queryBuilder.andWhere('auditLog.resourceType = :resourceType', { 
          resourceType: filters.resourceType 
        });
      }

      if (filters.resourceId) {
        queryBuilder.andWhere('auditLog.resourceId = :resourceId', { 
          resourceId: filters.resourceId 
        });
      }

      if (filters.userId && user.role === UserRole.ADMIN) {
        queryBuilder.andWhere('auditLog.userId = :userId', { userId: filters.userId });
      }

      if (filters.performedBy) {
        queryBuilder.andWhere('auditLog.performedBy = :performedBy', { 
          performedBy: filters.performedBy 
        });
      }

      if (filters.isSuccessful !== undefined) {
        queryBuilder.andWhere('auditLog.isSuccessful = :isSuccessful', { 
          isSuccessful: filters.isSuccessful 
        });
      }

      if (filters.dateFrom) {
        queryBuilder.andWhere('auditLog.createdAt >= :dateFrom', { 
          dateFrom: filters.dateFrom 
        });
      }

      if (filters.dateTo) {
        queryBuilder.andWhere('auditLog.createdAt <= :dateTo', { 
          dateTo: filters.dateTo 
        });
      }
    }

    // Apply pagination and ordering
    queryBuilder
      .orderBy('auditLog.createdAt', 'DESC')
      .skip(offset)
      .take(Math.min(limit, 100)); // Max 100 items per page

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs: logs.map(log => this.transformAuditLogToType(log)),
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * @method auditLog
   * @purpose Get single audit log by ID
   */
  @Query(() => AuditLogType, { description: 'Get single audit log by ID' })
  async auditLog(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<AuditLogType> {
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .where('auditLog.id = :id', { id });

    // Non-admin users can only see their own logs
    if (user.role !== UserRole.ADMIN) {
      queryBuilder.andWhere('auditLog.userId = :userId', { userId: user.id });
    }

    const log = await queryBuilder.getOne();

    if (!log) {
      throw new Error('Audit log not found');
    }

    return this.transformAuditLogToType(log);
  }

  /**
   * @method auditLogStats
   * @purpose Get audit log statistics (Admin only)
   */
  @Query(() => AuditLogStatsType, { description: 'Get audit log statistics (Admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async auditLogStats(
    @Args('userId', { nullable: true }) userId?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date
  ): Promise<AuditLogStatsType> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('auditLog');

    if (userId) {
      queryBuilder.where('auditLog.userId = :userId', { userId });
    }

    if (dateFrom) {
      queryBuilder.andWhere('auditLog.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('auditLog.createdAt <= :dateTo', { dateTo });
    }

    const logs = await queryBuilder.getMany();

    const totalLogs = logs.length;
    const successfulActions = logs.filter(log => log.isSuccessful).length;
    const failedActions = totalLogs - successfulActions;
    const successRate = totalLogs > 0 ? successfulActions / totalLogs : 0;

    // Action breakdown
    const actionBreakdown = {};
    logs.forEach(log => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    });

    // Resource type breakdown
    const resourceTypeBreakdown = {};
    logs.forEach(log => {
      resourceTypeBreakdown[log.resourceType] = (resourceTypeBreakdown[log.resourceType] || 0) + 1;
    });

    // Daily activity (last 30 days)
    const dailyActivity = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    logs
      .filter(log => log.createdAt >= thirtyDaysAgo)
      .forEach(log => {
        const date = log.createdAt.toISOString().split('T')[0];
        dailyActivity[date] = (dailyActivity[date] || 0) + 1;
      });

    return {
      totalLogs,
      successfulActions,
      failedActions,
      successRate,
      actionBreakdown: JSON.stringify(actionBreakdown),
      resourceTypeBreakdown: JSON.stringify(resourceTypeBreakdown),
      dailyActivity: JSON.stringify(dailyActivity),
    };
  }

  /**
   * @method transformAuditLogToType
   * @purpose Transform AuditLog entity to GraphQL type
   */
  private transformAuditLogToType(log: AuditLog): AuditLogType {
    return {
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      description: log.description,
      context: log.context ? JSON.stringify(log.context) : undefined,
      userId: log.userId,
      performedBy: log.performedBy,
      ipAddress: log.context?.ipAddress,
      userAgent: log.context?.userAgent,
      isSuccessful: log.isSuccessful,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
    };
  }
}