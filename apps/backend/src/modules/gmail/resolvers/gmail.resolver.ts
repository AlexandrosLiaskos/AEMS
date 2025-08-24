import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ObjectType, Field, Int, Float, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';

// Services
import { GmailSyncService, SyncOptions, SyncResult } from '../services/gmail-sync.service';
import { GoogleAuthService } from '../../auth/services/google-auth.service';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

/**
 * @class SyncOptionsDto
 * @purpose DTO for Gmail sync options
 */
@InputType()
export class SyncOptionsDto {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  maxResults?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  query?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  labelIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeSpamTrash?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  syncAttachments?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  fullSync?: boolean;
}

/**
 * @class SyncErrorDto
 * @purpose DTO for sync error
 */
@ObjectType()
export class SyncErrorDto {
  @Field()
  messageId: string;

  @Field()
  error: string;
}

/**
 * @class SyncResultDto
 * @purpose DTO for Gmail sync result
 */
@ObjectType()
export class SyncResultDto {
  @Field()
  success: boolean;

  @Field(() => Int)
  emailsProcessed: number;

  @Field(() => Int)
  emailsAdded: number;

  @Field(() => Int)
  emailsUpdated: number;

  @Field(() => Int)
  emailsSkipped: number;

  @Field(() => [SyncErrorDto])
  errors: SyncErrorDto[];

  @Field(() => Int)
  duration: number;

  @Field({ nullable: true })
  nextPageToken?: string;
}

/**
 * @class GmailStatsDto
 * @purpose DTO for Gmail statistics
 */
@ObjectType()
export class GmailStatsDto {
  @Field(() => Int)
  totalEmails: number;

  @Field(() => Int)
  unreadEmails: number;

  @Field(() => Int)
  todayEmails: number;

  @Field(() => Int)
  thisWeekEmails: number;

  @Field(() => Int)
  thisMonthEmails: number;

  @Field()
  lastSyncTime: string;

  @Field(() => Int)
  totalAttachments: number;

  @Field(() => Float)
  totalAttachmentSize: number;

  @Field(() => String) // JSON string
  labelBreakdown: string;

  @Field(() => String) // JSON string
  senderBreakdown: string;
}

/**
 * @class GmailQuotaDto
 * @purpose DTO for Gmail API quota information
 */
@ObjectType()
export class GmailQuotaDto {
  @Field(() => Int)
  dailyQuota: number;

  @Field(() => Int)
  usedQuota: number;

  @Field(() => Int)
  remainingQuota: number;

  @Field(() => Float)
  quotaPercentage: number;

  @Field()
  resetTime: string;

  @Field()
  isNearLimit: boolean;
}

/**
 * @class GmailLabelDto
 * @purpose DTO for Gmail label
 */
@ObjectType()
export class GmailLabelDto {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;

  @Field(() => Int)
  messagesTotal: number;

  @Field(() => Int)
  messagesUnread: number;

  @Field(() => Int)
  threadsTotal: number;

  @Field(() => Int)
  threadsUnread: number;
}

/**
 * @class AutoSyncConfigDto
 * @purpose DTO for auto-sync configuration
 */
@InputType()
export class AutoSyncConfigDto {
  @Field()
  @IsBoolean()
  enabled: boolean;

  @Field(() => Int)
  @IsNumber()
  intervalMinutes: number;

  @Field(() => SyncOptionsDto, { nullable: true })
  @IsOptional()
  syncOptions?: SyncOptionsDto;
}

/**
 * @class GmailResolver
 * @purpose GraphQL resolver for Gmail operations
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class GmailResolver {
  private pubSub: PubSub = new PubSub();

  constructor(
    private gmailSyncService: GmailSyncService,
    private googleAuthService: GoogleAuthService,
  ) {}

  /**
   * @method syncEmails
   * @purpose Synchronize emails from Gmail
   */
  @Mutation(() => SyncResultDto, { description: 'Synchronize emails from Gmail' })
  async syncEmails(
    @CurrentUser() user: User,
    @Args('options', { nullable: true }) options?: SyncOptionsDto
  ): Promise<SyncResultDto> {
    try {
      if (!user.googleTokens) {
        throw new BadRequestException('User not connected to Gmail');
      }

      const tokens = {
        accessToken: user.googleTokens.accessToken,
        refreshToken: user.googleTokens.refreshToken,
        expiryDate: user.googleTokens.expiryDate,
        scope: [],
      };

      const syncOptions: SyncOptions = {
        maxResults: options?.maxResults,
        query: options?.query,
        labelIds: options?.labelIds,
        includeSpamTrash: options?.includeSpamTrash,
        syncAttachments: options?.syncAttachments,
        fullSync: options?.fullSync,
      };

      const result = await this.gmailSyncService.syncEmails(user.id, tokens, syncOptions);

      // Publish sync update
      this.pubSub.publish('GMAIL_SYNC_UPDATE', {
        userId: user.id,
        result,
      });

      return {
        success: result.success,
        emailsProcessed: result.emailsProcessed,
        emailsAdded: result.emailsAdded,
        emailsUpdated: result.emailsUpdated,
        emailsSkipped: result.emailsSkipped,
        errors: result.errors.map(error => ({
          messageId: error.messageId,
          error: error.error,
        })),
        duration: result.duration,
        nextPageToken: result.nextPageToken,
      };

    } catch (error) {
      throw new BadRequestException(`Gmail sync failed: ${error.message}`);
    }
  }

  /**
   * @method startAutoSync
   * @purpose Start automatic Gmail synchronization
   */
  @Mutation(() => Boolean, { description: 'Start automatic Gmail synchronization' })
  async startAutoSync(
    @CurrentUser() user: User,
    @Args('config') config: AutoSyncConfigDto
  ): Promise<boolean> {
    try {
      if (!user.googleTokens) {
        throw new BadRequestException('User not connected to Gmail');
      }

      const tokens = {
        accessToken: user.googleTokens.accessToken,
        refreshToken: user.googleTokens.refreshToken,
        expiryDate: user.googleTokens.expiryDate,
        scope: [],
      };

      const syncOptions: SyncOptions = {
        maxResults: config.syncOptions?.maxResults,
        query: config.syncOptions?.query,
        labelIds: config.syncOptions?.labelIds,
        includeSpamTrash: config.syncOptions?.includeSpamTrash,
        syncAttachments: config.syncOptions?.syncAttachments,
        fullSync: config.syncOptions?.fullSync,
      };

      this.gmailSyncService.startAutoSync(user.id, tokens, syncOptions);

      return true;

    } catch (error) {
      throw new BadRequestException(`Failed to start auto sync: ${error.message}`);
    }
  }

  /**
   * @method stopAutoSync
   * @purpose Stop automatic Gmail synchronization
   */
  @Mutation(() => Boolean, { description: 'Stop automatic Gmail synchronization' })
  async stopAutoSync(@CurrentUser() user: User): Promise<boolean> {
    try {
      this.gmailSyncService.stopAutoSync();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * @method getGmailStats
   * @purpose Get Gmail statistics
   */
  @Query(() => GmailStatsDto, { description: 'Get Gmail statistics' })
  async getGmailStats(@CurrentUser() user: User): Promise<GmailStatsDto> {
    try {
      // This would typically query the database for email statistics
      // For now, return mock data
      return {
        totalEmails: 0,
        unreadEmails: 0,
        todayEmails: 0,
        thisWeekEmails: 0,
        thisMonthEmails: 0,
        lastSyncTime: new Date().toISOString(),
        totalAttachments: 0,
        totalAttachmentSize: 0,
        labelBreakdown: JSON.stringify({}),
        senderBreakdown: JSON.stringify({}),
      };

    } catch (error) {
      throw new BadRequestException(`Failed to get Gmail stats: ${error.message}`);
    }
  }

  /**
   * @method getGmailQuota
   * @purpose Get Gmail API quota information
   */
  @Query(() => GmailQuotaDto, { description: 'Get Gmail API quota information' })
  async getGmailQuota(@CurrentUser() user: User): Promise<GmailQuotaDto> {
    try {
      // This would typically check actual Gmail API quota
      // For now, return mock data
      return {
        dailyQuota: 1000000000, // 1 billion units per day
        usedQuota: 0,
        remainingQuota: 1000000000,
        quotaPercentage: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isNearLimit: false,
      };

    } catch (error) {
      throw new BadRequestException(`Failed to get Gmail quota: ${error.message}`);
    }
  }

  /**
   * @method getGmailLabels
   * @purpose Get Gmail labels
   */
  @Query(() => [GmailLabelDto], { description: 'Get Gmail labels' })
  async getGmailLabels(@CurrentUser() user: User): Promise<GmailLabelDto[]> {
    try {
      if (!user.googleTokens) {
        throw new BadRequestException('User not connected to Gmail');
      }

      // This would typically fetch labels from Gmail API
      // For now, return mock data
      return [
        {
          id: 'INBOX',
          name: 'INBOX',
          type: 'system',
          messagesTotal: 0,
          messagesUnread: 0,
          threadsTotal: 0,
          threadsUnread: 0,
        },
        {
          id: 'SENT',
          name: 'SENT',
          type: 'system',
          messagesTotal: 0,
          messagesUnread: 0,
          threadsTotal: 0,
          threadsUnread: 0,
        },
      ];

    } catch (error) {
      throw new BadRequestException(`Failed to get Gmail labels: ${error.message}`);
    }
  }

  /**
   * @method testGmailConnection
   * @purpose Test Gmail API connection
   */
  @Query(() => Boolean, { description: 'Test Gmail API connection' })
  async testGmailConnection(@CurrentUser() user: User): Promise<boolean> {
    try {
      if (!user.googleTokens) {
        return false;
      }

      const tokens = {
        accessToken: user.googleTokens.accessToken,
        refreshToken: user.googleTokens.refreshToken,
        expiryDate: user.googleTokens.expiryDate,
        scope: [],
      };

      return await this.googleAuthService.validateTokens(tokens);

    } catch (error) {
      return false;
    }
  }

  /**
   * @method refreshGmailTokens
   * @purpose Refresh Gmail API tokens
   */
  @Mutation(() => Boolean, { description: 'Refresh Gmail API tokens' })
  async refreshGmailTokens(@CurrentUser() user: User): Promise<boolean> {
    try {
      if (!user.googleTokens?.refreshToken) {
        throw new BadRequestException('No refresh token available');
      }

      const newTokens = await this.googleAuthService.refreshTokens(user.googleTokens.refreshToken);

      // Update user tokens (would typically use UserService)
      user.googleTokens = {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiryDate: newTokens.expiryDate,
      };

      return true;

    } catch (error) {
      throw new BadRequestException(`Failed to refresh tokens: ${error.message}`);
    }
  }

  /**
   * @method gmailSyncUpdates
   * @purpose Subscribe to Gmail sync updates
   */
  @Subscription(() => String, {
    description: 'Subscribe to Gmail sync updates',
    filter: (payload, variables, context) => {
      return payload.userId === context.req.user.id;
    },
  })
  gmailSyncUpdates(@CurrentUser() user: User) {
    return (this.pubSub as any).asyncIterator('GMAIL_SYNC_UPDATE');
  }
}