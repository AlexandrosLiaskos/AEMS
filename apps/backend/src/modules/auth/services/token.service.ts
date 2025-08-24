import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../../database/entities/user.entity';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface JwtPayload
 * @purpose JWT token payload interface
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  type: 'access' | 'refresh';
}

/**
 * @interface TokenPair
 * @purpose Access and refresh token pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * @class TokenService
 * @purpose JWT token generation and validation service
 */
@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.jwtSecret = this.configService.get<string>('auth.jwtSecret');
    this.jwtRefreshSecret = this.configService.get<string>('auth.jwtRefreshSecret');
    this.jwtExpiresIn = this.configService.get<string>('auth.jwtExpiresIn', '15m');
    this.jwtRefreshExpiresIn = this.configService.get<string>('auth.jwtRefreshExpiresIn', '7d');
  }

  /**
   * @method generateAccessToken
   * @purpose Generate JWT access token
   */
  async generateAccessToken(user: User): Promise<string> {
    try {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role,
        iss: 'aems-backend',
        aud: 'aems-frontend',
        type: 'access',
      };

      const token = this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiresIn,
      });

      this.logger.debug(`Access token generated for user ${user.id}`, 'TokenService');
      return token;
    } catch (error) {
      this.logger.error('Failed to generate access token', error.stack, 'TokenService');
      throw new Error('Token generation failed');
    }
  }

  /**
   * @method generateRefreshToken
   * @purpose Generate JWT refresh token
   */
  async generateRefreshToken(user: User): Promise<string> {
    try {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role,
        iss: 'aems-backend',
        aud: 'aems-frontend',
        type: 'refresh',
      };

      const token = this.jwtService.sign(payload, {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn,
      });

      this.logger.debug(`Refresh token generated for user ${user.id}`, 'TokenService');
      return token;
    } catch (error) {
      this.logger.error('Failed to generate refresh token', error.stack, 'TokenService');
      throw new Error('Token generation failed');
    }
  }

  /**
   * @method generateTokenPair
   * @purpose Generate both access and refresh tokens
   */
  async generateTokenPair(user: User): Promise<TokenPair> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(user),
        this.generateRefreshToken(user),
      ]);

      const expiresIn = this.parseExpirationTime(this.jwtExpiresIn);

      return {
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Failed to generate token pair', error.stack, 'TokenService');
      throw error;
    }
  }

  /**
   * @method verifyAccessToken
   * @purpose Verify and decode access token
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      this.logger.debug(`Access token verification failed: ${error.message}`, 'TokenService');
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * @method verifyRefreshToken
   * @purpose Verify and decode refresh token
   */
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.jwtRefreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      this.logger.debug(`Refresh token verification failed: ${error.message}`, 'TokenService');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * @method decodeToken
   * @purpose Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch (error) {
      this.logger.debug(`Token decode failed: ${error.message}`, 'TokenService');
      return null;
    }
  }

  /**
   * @method isTokenExpired
   * @purpose Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * @method getTokenExpirationTime
   * @purpose Get token expiration time
   */
  getTokenExpirationTime(token: string): Date | null {
    try {
      const payload = this.decodeToken(token);
      if (!payload) return null;

      return new Date(payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * @method getTokenRemainingTime
   * @purpose Get remaining time until token expires (in seconds)
   */
  getTokenRemainingTime(token: string): number {
    try {
      const payload = this.decodeToken(token);
      if (!payload) return 0;

      const currentTime = Math.floor(Date.now() / 1000);
      const remainingTime = payload.exp - currentTime;
      
      return Math.max(0, remainingTime);
    } catch (error) {
      return 0;
    }
  }

  /**
   * @method shouldRefreshToken
   * @purpose Check if token should be refreshed (expires within threshold)
   */
  shouldRefreshToken(token: string, thresholdMinutes = 5): boolean {
    try {
      const remainingSeconds = this.getTokenRemainingTime(token);
      const thresholdSeconds = thresholdMinutes * 60;
      
      return remainingSeconds <= thresholdSeconds && remainingSeconds > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * @method extractTokenFromHeader
   * @purpose Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  /**
   * @method validateTokenFormat
   * @purpose Validate JWT token format
   */
  validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * @method getTokenInfo
   * @purpose Get comprehensive token information
   */
  getTokenInfo(token: string): {
    isValid: boolean;
    isExpired: boolean;
    payload: JwtPayload | null;
    expiresAt: Date | null;
    remainingSeconds: number;
    shouldRefresh: boolean;
  } {
    const payload = this.decodeToken(token);
    const isValid = this.validateTokenFormat(token) && payload !== null;
    const isExpired = this.isTokenExpired(token);
    const expiresAt = this.getTokenExpirationTime(token);
    const remainingSeconds = this.getTokenRemainingTime(token);
    const shouldRefresh = this.shouldRefreshToken(token);

    return {
      isValid,
      isExpired,
      payload,
      expiresAt,
      remainingSeconds,
      shouldRefresh,
    };
  }

  /**
   * @method parseExpirationTime
   * @purpose Parse expiration time string to seconds
   */
  private parseExpirationTime(expiresIn: string): number {
    const timeUnit = expiresIn.slice(-1);
    const timeValue = parseInt(expiresIn.slice(0, -1), 10);

    switch (timeUnit) {
      case 's':
        return timeValue;
      case 'm':
        return timeValue * 60;
      case 'h':
        return timeValue * 60 * 60;
      case 'd':
        return timeValue * 60 * 60 * 24;
      default:
        return 900; // Default 15 minutes
    }
  }

  /**
   * @method createTokenBlacklist
   * @purpose Create token blacklist entry (for logout/revocation)
   */
  async blacklistToken(token: string, reason = 'logout'): Promise<void> {
    try {
      const payload = this.decodeToken(token);
      if (!payload) return;

      // In a production environment, you would store this in Redis or database
      // For now, we'll just log it
      this.logger.log(
        `Token blacklisted for user ${payload.sub}, reason: ${reason}`,
        'TokenService'
      );

      // TODO: Implement actual blacklist storage
      // await this.redisService.set(`blacklist:${token}`, reason, payload.exp - Math.floor(Date.now() / 1000));
    } catch (error) {
      this.logger.error('Failed to blacklist token', error.stack, 'TokenService');
    }
  }

  /**
   * @method isTokenBlacklisted
   * @purpose Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      // TODO: Implement actual blacklist check
      // return await this.redisService.exists(`blacklist:${token}`);
      return false;
    } catch (error) {
      this.logger.error('Failed to check token blacklist', error.stack, 'TokenService');
      return false;
    }
  }
}