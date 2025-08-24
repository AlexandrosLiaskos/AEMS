import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SessionService, SessionData, TokenPayload } from '../session.service';
import { LoggerService } from '../../../../common/services/logger.service';
import { UserRepository } from '../../../../database/repositories/user.repository';
import { User, UserRole, UserStatus } from '../../../../database/entities/user.entity';

describe('SessionService', () => {
  let service: SessionService;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: jest.Mocked<JwtService>;
  let loggerService: jest.Mocked<LoggerService>;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isActive: true,
    totalEmailsProcessed: 0,
    totalAiCost: 0,
    loginAttempts: 0,
    emails: [],
    auditLogs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    canLogin: jest.fn().mockReturnValue(true),
    isLocked: jest.fn().mockReturnValue(false),
    incrementLoginAttempts: jest.fn(),
    resetLoginAttempts: jest.fn(),
    updateLastLogin: jest.fn(),
    addAiCost: jest.fn(),
    toSafeObject: jest.fn(),
  } as User;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          'auth.jwt.expiresIn': '24h',
          'auth.jwt.refreshExpiresIn': '7d',
        };
        return config[key] || defaultValue;
      }),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    configService = module.get(ConfigService);
    jwtService = module.get(JwtService);
    loggerService = module.get(LoggerService);
    userRepository = module.get(UserRepository);
  });

  afterEach(() => {
    // Clear any active sessions
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.createSession(mockUser);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('sessionData');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      
      expect(result.sessionData.userId).toBe(mockUser.id);
      expect(result.sessionData.email).toBe(mockUser.email);
      expect(result.sessionData.name).toBe(mockUser.name);
      expect(result.sessionData.role).toBe(mockUser.role);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(userRepository.update).toHaveBeenCalledWith(mockUser.id, {
        lastLoginAt: expect.any(Date),
        refreshToken: 'mock-jwt-token',
      });
      expect(loggerService.log).toHaveBeenCalledWith(
        `Session created for user: ${mockUser.email}`,
        'SessionService'
      );
    });

    it('should generate unique session IDs', async () => {
      userRepository.update.mockResolvedValue(undefined);

      const result1 = await service.createSession(mockUser);
      const result2 = await service.createSession(mockUser);

      expect(result1.sessionData.sessionId).not.toBe(result2.sessionData.sessionId);
    });
  });

  describe('validateSession', () => {
    it('should validate valid session token', async () => {
      const mockPayload: TokenPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userRepository.findById.mockResolvedValue(mockUser);

      // Create session first to have it in memory
      await service.createSession(mockUser);
      
      // Mock the session data in the service
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Access private property for testing
      (service as any).activeSessions.set('session-123', sessionData);

      const result = await service.validateSession('valid-token');

      expect(result).toEqual(sessionData);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return null for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateSession('invalid-token');

      expect(result).toBeNull();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Invalid session token: Invalid token',
        'SessionService'
      );
    });

    it('should return null for non-existent session', async () => {
      const mockPayload: TokenPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'non-existent-session',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const result = await service.validateSession('valid-token');

      expect(result).toBeNull();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Session not found: non-existent-session',
        'SessionService'
      );
    });

    it('should return null for expired session', async () => {
      const mockPayload: TokenPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'expired-session',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      // Create expired session
      const expiredSessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'expired-session',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      (service as any).activeSessions.set('expired-session', expiredSessionData);

      const result = await service.validateSession('valid-token');

      expect(result).toBeNull();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Session expired: expired-session',
        'SessionService'
      );
    });

    it('should return null for inactive user', async () => {
      const mockPayload: TokenPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const inactiveUser = { 
        ...mockUser, 
        isActive: false,
        canLogin: jest.fn().mockReturnValue(false),
        isLocked: jest.fn().mockReturnValue(false),
        incrementLoginAttempts: jest.fn(),
        resetLoginAttempts: jest.fn(),
        updateLastLogin: jest.fn(),
        addAiCost: jest.fn(),
        toSafeObject: jest.fn(),
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userRepository.findById.mockResolvedValue(inactiveUser);

      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      (service as any).activeSessions.set('session-123', sessionData);

      const result = await service.validateSession('valid-token');

      expect(result).toBeNull();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'User inactive or not found: user-123',
        'SessionService'
      );
    });
  });

  describe('refreshSession', () => {
    it('should refresh session with valid refresh token', async () => {
      const mockPayload = {
        sessionId: 'session-123',
        userId: 'user-123',
      };

      const userWithRefreshToken = {
        ...mockUser,
        refreshToken: 'valid-refresh-token',
        canLogin: jest.fn().mockReturnValue(true),
        isLocked: jest.fn().mockReturnValue(false),
        incrementLoginAttempts: jest.fn(),
        resetLoginAttempts: jest.fn(),
        updateLastLogin: jest.fn(),
        addAiCost: jest.fn(),
        toSafeObject: jest.fn(),
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userRepository.findById.mockResolvedValue(userWithRefreshToken);
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.refreshSession('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('sessionData');
      expect(result!.sessionData.userId).toBe(mockUser.id);
    });

    it('should return null for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.refreshSession('invalid-refresh-token');

      expect(result).toBeNull();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Refresh token validation failed: Invalid token',
        'SessionService'
      );
    });

    it('should return null for mismatched refresh token', async () => {
      const mockPayload = {
        sessionId: 'session-123',
        userId: 'user-123',
      };

      const userWithDifferentToken = {
        ...mockUser,
        refreshToken: 'different-refresh-token',
        canLogin: jest.fn().mockReturnValue(true),
        isLocked: jest.fn().mockReturnValue(false),
        incrementLoginAttempts: jest.fn(),
        resetLoginAttempts: jest.fn(),
        updateLastLogin: jest.fn(),
        addAiCost: jest.fn(),
        toSafeObject: jest.fn(),
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userRepository.findById.mockResolvedValue(userWithDifferentToken);

      const result = await service.refreshSession('provided-refresh-token');

      expect(result).toBeNull();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Invalid refresh token for user: user-123',
        'SessionService'
      );
    });
  });

  describe('destroySession', () => {
    it('should destroy session successfully', async () => {
      const sessionData: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      (service as any).activeSessions.set('session-123', sessionData);
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.destroySession('session-123');

      expect(result).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        refreshToken: null,
      });
      expect(loggerService.log).toHaveBeenCalledWith(
        'Session destroyed: session-123',
        'SessionService'
      );
    });

    it('should return false for non-existent session', async () => {
      const result = await service.destroySession('non-existent-session');

      expect(result).toBe(false);
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('destroyAllUserSessions', () => {
    it('should destroy all sessions for user', async () => {
      const sessionData1: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const sessionData2: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-2',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      (service as any).activeSessions.set('session-1', sessionData1);
      (service as any).activeSessions.set('session-2', sessionData2);
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.destroyAllUserSessions('user-123');

      expect(result).toBe(2);
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        refreshToken: null,
      });
      expect(loggerService.log).toHaveBeenCalledWith(
        'Destroyed 2 sessions for user: user-123',
        'SessionService'
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions', () => {
      const sessionData1: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const sessionData2: SessionData = {
        userId: 'user-456',
        email: 'other@example.com',
        name: 'Other User',
        role: 'USER',
        sessionId: 'session-2',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      (service as any).activeSessions.set('session-1', sessionData1);
      (service as any).activeSessions.set('session-2', sessionData2);

      const result = service.getUserSessions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sessionData1);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', () => {
      const activeSession: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'active-session',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const expiredSession: SessionData = {
        userId: 'user-456',
        email: 'other@example.com',
        name: 'Other User',
        role: 'USER',
        sessionId: 'expired-session',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
      };

      (service as any).activeSessions.set('active-session', activeSession);
      (service as any).activeSessions.set('expired-session', expiredSession);

      const result = service.cleanupExpiredSessions();

      expect(result).toBe(1);
      expect((service as any).activeSessions.has('active-session')).toBe(true);
      expect((service as any).activeSessions.has('expired-session')).toBe(false);
      expect(loggerService.log).toHaveBeenCalledWith(
        'Cleaned up 1 expired sessions',
        'SessionService'
      );
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', () => {
      const sessionData1: SessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        sessionId: 'session-1',
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const sessionData2: SessionData = {
        userId: 'user-456',
        email: 'other@example.com',
        name: 'Other User',
        role: 'USER',
        sessionId: 'session-2',
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      (service as any).activeSessions.set('session-1', sessionData1);
      (service as any).activeSessions.set('session-2', sessionData2);

      const stats = service.getSessionStats();

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeUsers).toBe(2);
      expect(stats.averageSessionDuration).toBeGreaterThan(0);
    });
  });
});