import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';
import { LoggerService } from '../../../common/services/logger.service';
import { CryptoService } from '../../../common/services/crypto.service';

/**
 * @interface GoogleTokens
 * @purpose Google OAuth token structure
 */
export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  scope?: string[];
}

/**
 * @interface GoogleUserInfo
 * @purpose Google user information
 */
export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

/**
 * @class GoogleAuthService
 * @purpose Google OAuth 2.0 authentication service
 */
@Injectable()
export class GoogleAuthService {
  private oauth2Client: Auth.OAuth2Client;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private cryptoService: CryptoService,
  ) {
    this.initializeOAuth2Client();
  }

  /**
   * @method initializeOAuth2Client
   * @purpose Initialize Google OAuth2 client
   */
  private initializeOAuth2Client(): void {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error('Google OAuth credentials not configured', 'GoogleAuthService');
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    this.logger.debug('Google OAuth2 client initialized', 'GoogleAuthService');
  }

  /**
   * @method getAuthUrl
   * @purpose Generate Google OAuth authorization URL
   */
  getAuthUrl(scopes: string[] = ['email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly']): string {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    this.logger.debug('Generated Google auth URL', 'GoogleAuthService', { scopes });
    return authUrl;
  }

  /**
   * @method exchangeCodeForTokens
   * @purpose Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Invalid tokens received from Google');
      }

      const googleTokens: GoogleTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date || Date.now() + 3600000, // 1 hour default
        scope: tokens.scope?.split(' ') || [],
      };

      this.logger.info('Successfully exchanged code for tokens', 'GoogleAuthService');
      return googleTokens;

    } catch (error) {
      this.logger.error(`Failed to exchange code for tokens: ${error.message}`, 'GoogleAuthService');
      throw new Error(`Google OAuth token exchange failed: ${error.message}`);
    }
  }

  /**
   * @method refreshTokens
   * @purpose Refresh expired access tokens
   */
  async refreshTokens(refreshToken: string): Promise<GoogleTokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      const googleTokens: GoogleTokens = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken, // Keep existing if not provided
        expiryDate: credentials.expiry_date || Date.now() + 3600000,
        scope: credentials.scope?.split(' ') || [],
      };

      this.logger.info('Successfully refreshed tokens', 'GoogleAuthService');
      return googleTokens;

    } catch (error) {
      this.logger.error(`Failed to refresh tokens: ${error.message}`, 'GoogleAuthService');
      throw new Error(`Google token refresh failed: ${error.message}`);
    }
  }

  /**
   * @method getUserInfo
   * @purpose Get user information from Google
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      if (!data.email || !data.id) {
        throw new Error('Invalid user info received from Google');
      }

      const userInfo: GoogleUserInfo = {
        id: data.id,
        email: data.email,
        name: data.name || data.email,
        picture: data.picture,
        verified_email: data.verified_email || false,
      };

      this.logger.debug('Retrieved user info from Google', 'GoogleAuthService', {
        userId: userInfo.id,
        email: userInfo.email,
      });

      return userInfo;

    } catch (error) {
      this.logger.error(`Failed to get user info: ${error.message}`, 'GoogleAuthService');
      throw new Error(`Failed to get Google user info: ${error.message}`);
    }
  }

  /**
   * @method validateTokens
   * @purpose Validate Google tokens
   */
  async validateTokens(tokens: GoogleTokens): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      // Try to get token info to validate
      const tokenInfo = await this.oauth2Client.getTokenInfo(tokens.accessToken);
      
      if (!tokenInfo.email) {
        return false;
      }

      this.logger.debug('Tokens validated successfully', 'GoogleAuthService');
      return true;

    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`, 'GoogleAuthService');
      return false;
    }
  }

  /**
   * @method revokeTokens
   * @purpose Revoke Google tokens
   */
  async revokeTokens(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
      this.logger.info('Successfully revoked Google tokens', 'GoogleAuthService');
    } catch (error) {
      this.logger.error(`Failed to revoke tokens: ${error.message}`, 'GoogleAuthService');
      throw new Error(`Failed to revoke Google tokens: ${error.message}`);
    }
  }

  /**
   * @method encryptTokens
   * @purpose Encrypt tokens for secure storage
   */
  encryptTokens(tokens: GoogleTokens, encryptionKey: string): string {
    try {
      const tokenString = JSON.stringify(tokens);
      const encrypted = this.cryptoService.encrypt(tokenString, encryptionKey);
      return JSON.stringify(encrypted);
    } catch (error) {
      this.logger.error(`Failed to encrypt tokens: ${error.message}`, 'GoogleAuthService');
      throw new Error('Failed to encrypt tokens');
    }
  }

  /**
   * @method decryptTokens
   * @purpose Decrypt tokens from storage
   */
  decryptTokens(encryptedTokens: string, encryptionKey: string): GoogleTokens {
    try {
      const encryptedData = JSON.parse(encryptedTokens);
      const decryptedString = this.cryptoService.decrypt(encryptedData, encryptionKey);
      return JSON.parse(decryptedString);
    } catch (error) {
      this.logger.error(`Failed to decrypt tokens: ${error.message}`, 'GoogleAuthService');
      throw new Error('Failed to decrypt tokens');
    }
  }

  /**
   * @method isTokenExpired
   * @purpose Check if token is expired
   */
  isTokenExpired(tokens: GoogleTokens): boolean {
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minutes buffer
    return tokens.expiryDate < (now + buffer);
  }

  /**
   * @method getAuthenticatedClient
   * @purpose Get authenticated OAuth2 client
   */
  getAuthenticatedClient(tokens: GoogleTokens): Auth.OAuth2Client {
    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );

    client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
    });

    return client;
  }
}