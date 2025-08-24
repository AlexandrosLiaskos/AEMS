import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { GmailService } from '../services/gmail.service';
import { GmailAuthService } from '../services/gmail-auth.service';
import { GmailSyncService } from '../services/gmail-sync.service';
import { GmailQuotaService } from '../services/gmail-quota.service';

// DTOs
import {
  GmailSyncOptionsDto,
  EmailFiltersDto,
  GmailAuthUrlDto,
  GmailTokenInfoDto,
  GmailSyncResultDto,
  GmailProfileDto,
  GmailLabelDto,
  GmailQuotaDto,
} from '../dto/gmail.dto';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

/**
 * @class GmailController
 * @purpose REST API controller for Gmail integration endpoints
 */
@ApiTags('Gmail Integration')
@Controller('gmail')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GmailController {
  constructor(
    private gmailService: GmailService,
    private gmailAuthService: GmailAuthService,
    private gmailSyncService: GmailSyncService,
    private gmailQuotaService: GmailQuotaService
  ) {}

  /**
   * @method getAuthUrl
   * @purpose Get Gmail OAuth2 authorization URL
   */
  @Get('auth/url')
  @ApiOperation({ summary: 'Get Gmail OAuth2 authorization URL' })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
    type: GmailAuthUrlDto,
  })
  async getAuthUrl(@CurrentUser() user: User): Promise<GmailAuthUrlDto> {
    const authUrl = this.gmailAuthService.getAuthUrl(user.id);

    return {
      authUrl,
      state: user.id,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    };
  }

  /**
   * @method handleAuthCallback
   * @purpose Handle Gmail OAuth2 callback
   */
  @Post('auth/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Gmail OAuth2 callback' })
  @ApiResponse({
    status: 200,
    description: 'Gmail authorization completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid authorization code or state',
  })
  async handleAuthCallback(
    @Body('code') code: string,
    @Body('state') state: string
  ): Promise<{ success: boolean; message: string }> {
    await this.gmailAuthService.handleAuthCallback(code, state);

    return {
      success: true,
      message: 'Gmail authorization completed successfully',
    };
  }

  /**
   * @method getTokenInfo
   * @purpose Get Gmail token information
   */
  @Get('auth/token-info')
  @ApiOperation({ summary: 'Get Gmail token information' })
  @ApiResponse({
    status: 200,
    description: 'Token information retrieved successfully',
    type: GmailTokenInfoDto,
  })
  async getTokenInfo(@CurrentUser() user: User): Promise<GmailTokenInfoDto> {
    const tokenInfo = await this.gmailAuthService.getTokenInfo(user.id);

    return {
      isValid: tokenInfo.isValid,
      isExpired: tokenInfo.isExpired,
      expiresAt: tokenInfo.expiresAt,
      remainingSeconds: tokenInfo.remainingSeconds,
      scopes: tokenInfo.scopes,
    };
  }

  /**
   * @method revokeAccess
   * @purpose Revoke Gmail access
   */
  @Delete('auth/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke Gmail access' })
  @ApiResponse({
    status: 204,
    description: 'Gmail access revoked successfully',
  })
  async revokeAccess(@CurrentUser() user: User): Promise<void> {
    await this.gmailAuthService.revokeAccess(user.id);
  }

  /**
   * @method syncEmails
   * @purpose Synchronize emails from Gmail
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes
  @ApiOperation({ summary: 'Synchronize emails from Gmail' })
  @ApiResponse({
    status: 200,
    description: 'Email synchronization completed',
    type: GmailSyncResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Gmail access not configured',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many sync requests',
  })
  async syncEmails(
    @CurrentUser() user: User,
    @Body() options: GmailSyncOptionsDto
  ): Promise<GmailSyncResultDto> {
    const result = await this.gmailService.syncUserEmails(user.id, options);

    return {
      success: result.success,
      totalProcessed: result.totalProcessed,
      totalAdded: result.totalAdded,
      totalUpdated: result.totalUpdated,
      totalSkipped: result.totalSkipped,
      totalFailed: result.totalFailed,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      duration: result.duration,
      errors: result.errors.map(error => ({
        messageId: error.messageId,
        error: error.error,
        details: error.details,
      })),
    };
  }

  /**
   * @method getProfile
   * @purpose Get Gmail user profile
   */
  @Get('profile')
  @ApiOperation({ summary: 'Get Gmail user profile' })
  @ApiResponse({
    status: 200,
    description: 'Gmail profile retrieved successfully',
    type: GmailProfileDto,
  })
  async getProfile(@CurrentUser() user: User): Promise<GmailProfileDto> {
    const profile = await this.gmailService.getUserProfile(user.id);

    return {
      emailAddress: profile.emailAddress || '',
      messagesTotal: profile.messagesTotal || 0,
      threadsTotal: profile.threadsTotal || 0,
      historyId: profile.historyId || '',
    };
  }

  /**
   * @method getLabels
   * @purpose Get Gmail labels
   */
  @Get('labels')
  @ApiOperation({ summary: 'Get Gmail labels' })
  @ApiResponse({
    status: 200,
    description: 'Gmail labels retrieved successfully',
    type: [GmailLabelDto],
  })
  async getLabels(@CurrentUser() user: User): Promise<GmailLabelDto[]> {
    const labels = await this.gmailService.getLabels(user.id);

    return labels.map(label => ({
      id: label.id || '',
      name: label.name || '',
      type: label.type || 'user',
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
      threadsTotal: label.threadsTotal,
      threadsUnread: label.threadsUnread,
    }));
  }

  /**
   * @method searchEmails
   * @purpose Search emails using Gmail query syntax
   */
  @Get('search')
  @ApiOperation({ summary: 'Search emails using Gmail query syntax' })
  @ApiResponse({
    status: 200,
    description: 'Email search completed successfully',
  })
  async searchEmails(
    @CurrentUser() user: User,
    @Query('q') query: string,
    @Query('maxResults') maxResults = 50
  ): Promise<any[]> {
    const messages = await this.gmailService.searchEmails(user.id, query, maxResults);

    return messages.map(message => ({
      id: message.id,
      threadId: message.threadId,
      snippet: message.snippet,
      labelIds: message.labelIds,
    }));
  }

  /**
   * @method getEmail
   * @purpose Get specific email by Gmail ID
   */
  @Get('emails/:gmailId')
  @ApiOperation({ summary: 'Get specific email by Gmail ID' })
  @ApiResponse({
    status: 200,
    description: 'Email retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found',
  })
  async getEmail(
    @CurrentUser() user: User,
    @Param('gmailId') gmailId: string
  ): Promise<any> {
    const email = await this.gmailService.getEmailById(user.id, gmailId);

    return {
      id: email.id,
      threadId: email.threadId,
      snippet: email.snippet,
      labelIds: email.labelIds,
      internalDate: email.internalDate,
      payload: email.payload,
    };
  }

  /**
   * @method getQuotaInfo
   * @purpose Get Gmail API quota information
   */
  @Get('quota')
  @ApiOperation({ summary: 'Get Gmail API quota information' })
  @ApiResponse({
    status: 200,
    description: 'Quota information retrieved successfully',
    type: GmailQuotaDto,
  })
  async getQuotaInfo(@CurrentUser() user: User): Promise<GmailQuotaDto> {
    const quota = await this.gmailQuotaService.getQuotaUsage(user.id);

    return {
      dailyLimit: quota.daily.limit,
      dailyUsed: quota.daily.used,
      dailyRemaining: quota.daily.remaining,
      rateLimit: quota.perMinute.limit,
      currentRate: quota.perMinute.used,
      isAvailable: quota.daily.remaining > 0 && quota.hourly.remaining > 0 && quota.perMinute.remaining > 0,
      resetInSeconds: 0, // TODO: Calculate reset time
    };
  }

  /**
   * @method getSyncStatus
   * @purpose Get current sync status
   */
  @Get('sync/status')
  @ApiOperation({ summary: 'Get current sync status' })
  @ApiResponse({
    status: 200,
    description: 'Sync status retrieved successfully',
  })
  async getSyncStatus(@CurrentUser() user: User): Promise<{
    isRunning: boolean;
    lastSyncAt: Date | null;
    nextSyncAt: Date | null;
    totalEmailsProcessed: number;
  }> {
    // TODO: Implement sync status tracking
    return {
      isRunning: false,
      lastSyncAt: user.lastSyncAt,
      nextSyncAt: null,
      totalEmailsProcessed: user.totalEmailsProcessed,
    };
  }

  /**
   * @method validateAccess
   * @purpose Validate Gmail access
   */
  @Get('validate-access')
  @ApiOperation({ summary: 'Validate Gmail access' })
  @ApiResponse({
    status: 200,
    description: 'Access validation completed',
  })
  async validateAccess(@CurrentUser() user: User): Promise<{
    hasAccess: boolean;
    isValid: boolean;
    message: string;
  }> {
    const hasAccess = await this.gmailAuthService.validateAccess(user.id);

    return {
      hasAccess,
      isValid: hasAccess,
      message: hasAccess
        ? 'Gmail access is valid and working'
        : 'Gmail access is not configured or has expired',
    };
  }
}
