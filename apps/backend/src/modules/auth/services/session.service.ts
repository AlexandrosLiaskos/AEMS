import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoggerService } from '../../../common/services/logger.service';
import { UserRepository } from '../../../database/repositories/user.repository';
import { User } from '../../../database/entities/user.entity';

/**
 * @interface SessionData
 * @purpose Session data structure
 */
export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * @interface TokenPayload
 * @purpose JWT token payload
 */
export interface TokenPayload {
  sub: string; // user ID
  email: string;
  name: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
}

/**
 * @class SessionService
 * @purpose Service for managing user sessions
 */
@Injectable()
export class SessionService {
  private activeSessions = new Map<string, SessionData>();

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private logger: LoggerService,
    private userRepository: UserRepository,
  ) {}

  /**
   * @method createSession
   * @purpose Create new user session
   */
  async createSession(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionData: SessionData;
  }> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
      createdAt: now,
      expiresAt,
    };

    // Store session
    this.activeSessions.set(sessionId, sessionData);

    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(tokenPayload, {
      expiresIn: this.configService.get('auth.jwt.expiresIn', '24h'),
    });

    const refreshToken = this.jwtService.sign(
      { sessionId, userId: user.id },
      {
        expiresIn: this.configService.get('auth.jwt.refreshExpiresIn', '7d'),
      }
    );

    // Update user's last login
    await this.userRepository.update(user.id, {
      lastLoginAt: now,
      refreshToken,
    });

    this.logger.log(`Session created for user: ${user.email}`, 'SessionService');

    return {
      accessToken,
      refreshToken,
      sessionData,
    };
  }

  /**
   * @method validateSession
   * @purpose Validate session token
   */
  async validateSession(token: string): Promise<SessionData | null> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token);
      const sessionData = this.activeSessions.get(payload.sessionId);

      if (!sessionData) {
        this.logger.warn(`Session not found: ${payload.sessionId}`, 'SessionService');
        return null;
      }

      // Check if session expired
      if (new Date() > sessionData.expiresAt) {
        this.activeSessions.delete(payload.sessionId);
        this.logger.warn(`Session expired: ${payload.sessionId}`, 'SessionService');
        return null;
      }

      // Verify user still exists and is active
      const user = await this.userRepository.findById(sessionData.userId);
      if (!user || !user.isActive) {
        this.activeSessions.delete(payload.sessionId);
        this.logger.warn(`User inactive or not found: ${sessionData.userId}`, 'SessionService');
        return null;
      }

      return sessionData;
    } catch (error) {
      this.logger.warn(`Invalid session token: ${error.message}`, 'SessionService');
      return null;
    }
  }

  /**
   * @method refreshSession
   * @purpose Refresh session with refresh token
   */
  async refreshSession(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionData: SessionData;
  } | null> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userRepository.findById(payload.userId);

      if (!user || !user.isActive || user.refreshToken !== refreshToken) {
        this.logger.warn(`Invalid refresh token for user: ${payload.userId}`, 'SessionService');
        return null;
      }

      // Create new session
      return this.createSession(user);
    } catch (error) {
      this.logger.warn(`Refresh token validation failed: ${error.message}`, 'SessionService');
      return null;
    }
  }

  /**
   * @method destroySession
   * @purpose Destroy user session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    const sessionData = this.activeSessions.get(sessionId);
    
    if (sessionData) {
      this.activeSessions.delete(sessionId);
      
      // Clear refresh token from user
      await this.userRepository.update(sessionData.userId, {
        refreshToken: null,
      });

      this.logger.log(`Session destroyed: ${sessionId}`, 'SessionService');
      return true;
    }

    return false;
  }

  /**
   * @method destroyAllUserSessions
   * @purpose Destroy all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<number> {
    let destroyedCount = 0;

    for (const [sessionId, sessionData] of this.activeSessions.entries()) {
      if (sessionData.userId === userId) {
        this.activeSessions.delete(sessionId);
        destroyedCount++;
      }
    }

    // Clear refresh token from user
    await this.userRepository.update(userId, {
      refreshToken: null,
    });

    this.logger.log(`Destroyed ${destroyedCount} sessions for user: ${userId}`, 'SessionService');
    return destroyedCount;
  }

  /**
   * @method getUserSessions
   * @purpose Get active sessions for user
   */
  getUserSessions(userId: string): SessionData[] {
    const sessions: SessionData[] = [];

    for (const sessionData of this.activeSessions.values()) {
      if (sessionData.userId === userId) {
        sessions.push(sessionData);
      }
    }

    return sessions;
  }

  /**
   * @method getSession
   * @purpose Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * @method extendSession
   * @purpose Extend session expiry time
   */
  async extendSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Extend session by 24 hours
    const newExpiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    session.expiresAt = newExpiryTime;
    
    this.activeSessions.set(sessionId, session);
    
    this.logger.log(`Session extended: ${sessionId}`, 'SessionService');
    return true;
  }

  /**
   * @method cleanupExpiredSessions
   * @purpose Remove expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, sessionData] of this.activeSessions.entries()) {
      if (now > sessionData.expiresAt) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired sessions`, 'SessionService');
    }

    return cleanedCount;
  }

  /**
   * @method getSessionStats
   * @purpose Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeUsers: number;
    averageSessionDuration: number;
  } {
    const totalSessions = this.activeSessions.size;
    const uniqueUsers = new Set(
      Array.from(this.activeSessions.values()).map(s => s.userId)
    ).size;

    // Calculate average session duration (simplified)
    const now = new Date();
    let totalDuration = 0;
    let validSessions = 0;

    for (const sessionData of this.activeSessions.values()) {
      if (now <= sessionData.expiresAt) {
        totalDuration += now.getTime() - sessionData.createdAt.getTime();
        validSessions++;
      }
    }

    const averageSessionDuration = validSessions > 0 ? totalDuration / validSessions : 0;

    return {
      totalSessions,
      activeUsers: uniqueUsers,
      averageSessionDuration,
    };
  }

  /**
   * @method generateSessionId
   * @purpose Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}