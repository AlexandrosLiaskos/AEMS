import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, Auth } from 'googleapis';

// Entities
import { User } from '../../../database/entities/user.entity';
import { AuditLog, AuditAction } from '../../../database/entities/audit-log.entity';

// Services
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface GmailAuthResult
 * @purpose Gmail authentication result
 */
export interface GmailAuthResult {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  scope: string[];
  tokenType: string;
}

/**
 * @interface GmailTokenInfo
 * @purpose Gmail token information
 */
export interface GmailTokenInfo {
  isValid: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  remainingSeconds: number;
  scopes: string[];
}

/**
 * @class GmailAuthService
 * @purpose Gmail OAuth2 authentication and token management service
 */
@Injectable()
export class GmailAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.clientId = this.configService.get<string>('gmail.clientId');
    this.clientSecret = this.configService.get<string>('gmail.clientSecret');
    this.redirectUri = this.configService.get<string>('gmail.redirectUri');
    this.scopes = this.configService.get<string[]>('gmail.scopes', [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ]);
  }

  /**
   * @method getAuthUrl
   * @purpose Generate Gmail OAuth2 authorization URL
   */
  getAuthUrl(userId: string, state?: string): string {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.scopes,
        state: state || userId,
        prompt: 'consent', // Force consent screen to get refresh token
        include_granted_scopes: true,
      });

      this.logger.log(
        `Generated Gmail auth URL for user ${userId}`,
        'GmailAuthService',
        { userId, scopes: this.scopes }
      );

      return authUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate Gmail auth URL for user ${userId}`,
        error.stack,
        'GmailAuthService'
      );
      throw new BadRequestException('Failed to generate authorization URL');
    }
  }

  /**
   * @method handleAuthCallback
   * @purpose Handle Gmail OAuth2 callback and exchange code for tokens
   */
  async handleAuthCallback(
    code: string,
    state: string
  ): Promise<{ userId: string; tokens: GmailAuthResult }> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new BadRequestException('Failed to obtain access tokens');
      }

      // Get user ID from state parameter
      const userId = state;

      // Get user
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Store tokens
      user.gmailAccessToken = tokens.access_token;
      user.gmailRefreshToken = tokens.refresh_token;
      user.gmailTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

      await this.userRepository.save(user);

      // Log successful authorization
      await this.logAuthEvent(
        userId,
        AuditAction.USER_UPDATED,
        true,
        'Gmail authorization completed'
      );

      this.logger.log(
        `Gmail authorization completed for user ${userId}`,
        'GmailAuthService',
        { userId, scopes: tokens.scope ? [tokens.scope] : [] }
      );

      return {
        userId,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date || 0,
          scope: tokens.scope?.split(' ') || this.scopes,
          tokenType: tokens.token_type || 'Bearer',
        },
      };
    } catch (error) {
      this.logger.error(
        'Gmail OAuth callback failed',
        error.stack,
        'GmailAuthService',
        { code: code.substring(0, 10) + '...', state }
      );

      if (error.code === 'invalid_grant') {
        throw new BadRequestException('Authorization code expired or invalid');
      }

      throw new BadRequestException('Gmail authorization failed');
    }
  }

  /**
   * @method getAuthClient
   * @purpose Get authenticated OAuth2 client for user
   */
  async getAuthClient(user: User): Promise<Auth.OAuth2Client> {
    try {
      if (!user.gmailAccessToken || !user.gmailRefreshToken) {
        throw new UnauthorizedException('Gmail access not configured');
      }

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      // Set credentials
      oauth2Client.setCredentials({
        access_token: user.gmailAccessToken,
        refresh_token: user.gmailRefreshToken,
        expiry_date: user.gmailTokenExpiry?.getTime(),
      });

      // Check if token needs refresh
      if (this.isTokenExpired(user.gmailTokenExpiry)) {
        await this.refreshUserTokens(user, oauth2Client);
      }

      return oauth2Client;
    } catch (error) {
      this.logger.error(
        `Failed to get auth client for user ${user.id}`,
        error.stack,
        'GmailAuthService'
      );
      throw new UnauthorizedException('Gmail authentication failed');
    }
  }

  /**
   * @method refreshUserTokens
   * @purpose Refresh user's Gmail tokens
   */
  async refreshUserTokens(user: User, oauth2Client?: Auth.OAuth2Client): Promise<void> {
    try {
      if (!oauth2Client) {
        oauth2Client = new google.auth.OAuth2(
          this.clientId,
          this.clientSecret,
          this.redirectUri
        );

        oauth2Client.setCredentials({
          refresh_token: user.gmailRefreshToken,
        });
      }

      // Refresh tokens
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new UnauthorizedException('Failed to refresh access token');
      }

      // Update user tokens
      user.gmailAccessToken = credentials.access_token;
      if (credentials.refresh_token) {
        user.gmailRefreshToken = credentials.refresh_token;
      }
      user.gmailTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;

      await this.userRepository.save(user);

      // Log token refresh
      await this.logAuthEvent(
        user.id,
        AuditAction.TOKEN_REFRESHED,
        true,
        'Gmail tokens refreshed'
      );

      this.logger.log(
        `Gmail tokens refreshed for user ${user.id}`,
        'GmailAuthService',
        { userId: user.id }
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh Gmail tokens for user ${user.id}`,
        error.stack,
        'GmailAuthService'
      );

      // If refresh fails, clear tokens to force re-authorization
      user.gmailAccessToken = null;
      user.gmailRefreshToken = null;
      user.gmailTokenExpiry = null;
      await this.userRepository.save(user);

      throw new UnauthorizedException('Gmail token refresh failed. Re-authorization required.');
    }
  }

  /**
   * @method revokeAccess
   * @purpose Revoke Gmail access for user
   */
  async revokeAccess(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.gmailAccessToken) {
        // Revoke token with Google
        try {
          const oauth2Client = new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
          );

          oauth2Client.setCredentials({
            access_token: user.gmailAccessToken,
          });

          await oauth2Client.revokeCredentials();
        } catch (error) {
          // Log but don't fail if revocation fails
          this.logger.warn(
            `Failed to revoke token with Google for user ${userId}`,
            'GmailAuthService',
            { error: error.message }
          );
        }
      }

      // Clear tokens from database
      user.gmailAccessToken = null;
      user.gmailRefreshToken = null;
      user.gmailTokenExpiry = null;
      await this.userRepository.save(user);

      // Log access revocation
      await this.logAuthEvent(
        userId,
        AuditAction.USER_UPDATED,
        true,
        'Gmail access revoked'
      );

      this.logger.log(
        `Gmail access revoked for user ${userId}`,
        'GmailAuthService',
        { userId }
      );
    } catch (error) {
      this.logger.error(
        `Failed to revoke Gmail access for user ${userId}`,
        error.stack,
        'GmailAuthService'
      );
      throw error;
    }
  }

  /**
   * @method getTokenInfo
   * @purpose Get token information for user
   */
  async getTokenInfo(userId: string): Promise<GmailTokenInfo> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const isValid = !!(user.gmailAccessToken && user.gmailRefreshToken);
      const isExpired = this.isTokenExpired(user.gmailTokenExpiry);
      const expiresAt = user.gmailTokenExpiry;
      const remainingSeconds = expiresAt
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : 0;

      return {
        isValid,
        isExpired,
        expiresAt,
        remainingSeconds,
        scopes: this.scopes,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get token info for user ${userId}`,
        error.stack,
        'GmailAuthService'
      );
      throw error;
    }
  }

  /**
   * @method validateAccess
   * @purpose Validate user has Gmail access
   */
  async validateAccess(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.gmailAccessToken || !user.gmailRefreshToken) {
        return false;
      }

      // Try to get auth client (will refresh if needed)
      await this.getAuthClient(user);
      return true;
    } catch (error) {
      this.logger.debug(
        `Gmail access validation failed for user ${userId}`,
        'GmailAuthService',
        { error: error.message }
      );
      return false;
    }
  }

  /**
   * @method isTokenExpired
   * @purpose Check if token is expired
   */
  private isTokenExpired(expiryDate: Date | null): boolean {
    if (!expiryDate) return true;

    // Consider token expired if it expires within 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= (expiryDate.getTime() - bufferTime);
  }

  /**
   * @method logAuthEvent
   * @purpose Log authentication event
   */
  private async logAuthEvent(
    userId: string,
    action: AuditAction,
    isSuccessful: boolean,
    description: string
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        resourceType: 'gmail_auth',
        resourceId: userId,
        description,
        userId,
        performedBy: userId,
        isSuccessful,
      });

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to log auth event', error.stack, 'GmailAuthService');
    }
  }
}
