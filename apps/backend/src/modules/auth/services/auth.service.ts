import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { User, UserRole, UserStatus } from '../../../database/entities/user.entity';
import { AuditLog, AuditAction } from '../../../database/entities/audit-log.entity';

// Services
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { GoogleAuthService } from './google-auth.service';
import { LoggerService } from '../../../common/services/logger.service';
import { ValidationService } from '../../../common/services/validation.service';

// DTOs
import { LoginDto, RegisterDto, RefreshTokenDto, ChangePasswordDto } from '../dto/auth.dto';

// Interfaces
export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GoogleAuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

/**
 * @class AuthService
 * @purpose Core authentication service handling login, registration, and token management
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private googleAuthService: GoogleAuthService,
    private logger: LoggerService,
    private validationService: ValidationService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * @method validateUser
   * @purpose Validate user credentials for local authentication
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return null;
      }

      // Check if user can login
      if (!user.canLogin()) {
        throw new UnauthorizedException(
          user.isLocked() 
            ? 'Account is temporarily locked due to multiple failed login attempts'
            : 'Account is not active'
        );
      }

      // Verify password
      const isPasswordValid = await this.passwordService.verifyPassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        user.incrementLoginAttempts();
        await this.userRepository.save(user);
        
        // Log failed attempt
        await this.logAuthEvent(user.id, AuditAction.LOGIN_FAILED, false, 'Invalid password');
        
        return null;
      }

      // Reset login attempts on successful validation
      user.resetLoginAttempts();
      await this.userRepository.save(user);

      return user;
    } catch (error) {
      this.logger.error('User validation failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method validateGoogleUser
   * @purpose Validate or create user from Google OAuth
   */
  async validateGoogleUser(googleProfile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<User> {
    try {
      // Try to find existing user by email
      let user = await this.userRepository.findOne({
        where: { email: googleProfile.email.toLowerCase() },
      });

      if (user) {
        // Update existing user with Google info
        user.googleId = googleProfile.googleId;
        user.avatar = googleProfile.picture;
        user.googleTokens = {
          accessToken: googleProfile.accessToken,
          refreshToken: googleProfile.refreshToken,
          expiryDate: Date.now() + 3600000, // 1 hour
          scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
        };
        user.lastLoginAt = new Date();
        
        await this.userRepository.save(user);
      } else {
        // Create new user
        user = this.userRepository.create({
          email: googleProfile.email.toLowerCase(),
          name: `${googleProfile.firstName} ${googleProfile.lastName}`,
          googleId: googleProfile.googleId,
          avatar: googleProfile.picture,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          isActive: true,

          googleTokens: {
            accessToken: googleProfile.accessToken,
            refreshToken: googleProfile.refreshToken,
            expiryDate: Date.now() + 3600000, // 1 hour
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
          },
          lastLoginAt: new Date(),
        });

        await this.userRepository.save(user);
      }

      // Log successful authentication
      await this.logAuthEvent(user.id, AuditAction.LOGIN, true, 'Google OAuth');

      return user;
    } catch (error) {
      this.logger.error('Google user validation failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method login
   * @purpose Authenticate user and return tokens
   */
  async login(loginDto: LoginDto, ipAddress: string, userAgent: string): Promise<AuthResult> {
    try {
      const { email, password } = loginDto;

      // Validate user
      const user = await this.validateUser(email, password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate tokens
      const accessToken = await this.tokenService.generateAccessToken(user);
      const refreshToken = await this.tokenService.generateRefreshToken(user);

      // Update user login info
      user.updateLastLogin(ipAddress);
      user.refreshToken = refreshToken;
      await this.userRepository.save(user);

      // Log successful login
      await this.logAuthEvent(user.id, AuditAction.LOGIN, true, 'User logged in successfully', {
        ipAddress,
        userAgent,
      });

      // Emit login event
      this.eventEmitter.emit('user.login', {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
      });

      const expiresIn = this.configService.get<number>('auth.jwtExpiresIn', 900); // 15 minutes

      return {
        user: user.toSafeObject() as User,
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Login failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method register
   * @purpose Register new user account
   */
  async register(registerDto: RegisterDto): Promise<AuthResult> {
    try {
      const { email, password, name } = registerDto;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Validate password strength
      const passwordValidation = this.validationService.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new BadRequestException({
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        });
      }

      // Hash password
      const passwordHash = await this.passwordService.hashPassword(password);

      // Create user
      const user = this.userRepository.create({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        preferences: User.getDefaultPreferences(),
        settings: User.getDefaultSettings(),
      });

      const savedUser = await this.userRepository.save(user);

      // Generate tokens
      const accessToken = await this.tokenService.generateAccessToken(savedUser);
      const refreshToken = await this.tokenService.generateRefreshToken(savedUser);

      // Update refresh token
      savedUser.refreshToken = refreshToken;
      await this.userRepository.save(savedUser);

      // Log user creation
      await this.logAuthEvent(savedUser.id, AuditAction.USER_CREATED, true, 'User account created');

      // Emit registration event
      this.eventEmitter.emit('user.register', {
        userId: savedUser.id,
        email: savedUser.email,
      });

      const expiresIn = this.configService.get<number>('auth.jwtExpiresIn', 900);

      return {
        user: savedUser.toSafeObject() as User,
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Registration failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method googleAuth
   * @purpose Authenticate user with Google OAuth
   */
  async googleAuth(googleUser: any): Promise<GoogleAuthResult> {
    try {
      const { email, name, picture, googleId } = googleUser;

      // Find existing user
      let user = await this.userRepository.findOne({
        where: [
          { email: email.toLowerCase() },
          { googleId },
        ],
      });

      let isNewUser = false;

      if (!user) {
        // Create new user
        user = this.userRepository.create({
          email: email.toLowerCase(),
          name,
          picture,
          googleId,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          preferences: User.getDefaultPreferences(),
          settings: User.getDefaultSettings(),
        });

        user = await this.userRepository.save(user);
        isNewUser = true;

        // Log user creation
        await this.logAuthEvent(user.id, AuditAction.USER_CREATED, true, 'User created via Google OAuth');
      } else {
        // Update existing user info
        user.name = name;
        user.picture = picture;
        if (!user.googleId) {
          user.googleId = googleId;
        }
        user = await this.userRepository.save(user);
      }

      // Check if user can login
      if (!user.canLogin()) {
        throw new UnauthorizedException('Account is not active or is locked');
      }

      // Generate tokens
      const accessToken = await this.tokenService.generateAccessToken(user);
      const refreshToken = await this.tokenService.generateRefreshToken(user);

      // Update refresh token
      user.refreshToken = refreshToken;
      await this.userRepository.save(user);

      // Log successful login
      await this.logAuthEvent(user.id, AuditAction.LOGIN, true, 'User logged in via Google OAuth');

      // Emit login event
      this.eventEmitter.emit('user.login', {
        userId: user.id,
        email: user.email,
        provider: 'google',
        isNewUser,
      });

      return {
        user: user.toSafeObject() as User,
        accessToken,
        refreshToken,
        isNewUser,
      };
    } catch (error) {
      this.logger.error('Google authentication failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method refreshToken
   * @purpose Refresh access token using refresh token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResult> {
    try {
      const { refreshToken } = refreshTokenDto;

      // Verify refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      
      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub, refreshToken },
      });

      if (!user || !user.canLogin()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const newAccessToken = await this.tokenService.generateAccessToken(user);
      const newRefreshToken = await this.tokenService.generateRefreshToken(user);

      // Update refresh token
      user.refreshToken = newRefreshToken;
      await this.userRepository.save(user);

      // Log token refresh
      await this.logAuthEvent(user.id, AuditAction.TOKEN_REFRESHED, true, 'Access token refreshed');

      const expiresIn = this.configService.get<number>('auth.jwtExpiresIn', 900);

      return {
        user: user.toSafeObject() as User,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error.stack, 'AuthService');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * @method logout
   * @purpose Logout user and invalidate tokens
   */
  async logout(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (user) {
        // Clear refresh token
        user.refreshToken = null;
        await this.userRepository.save(user);

        // Log logout
        await this.logAuthEvent(userId, AuditAction.LOGOUT, true, 'User logged out');

        // Emit logout event
        this.eventEmitter.emit('user.logout', {
          userId,
          email: user.email,
        });
      }
    } catch (error) {
      this.logger.error('Logout failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method changePassword
   * @purpose Change user password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    try {
      const { currentPassword, newPassword } = changePasswordDto;

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify current password
      if (user.passwordHash) {
        const isCurrentPasswordValid = await this.passwordService.verifyPassword(
          currentPassword,
          user.passwordHash
        );

        if (!isCurrentPasswordValid) {
          throw new UnauthorizedException('Current password is incorrect');
        }
      }

      // Validate new password
      const passwordValidation = this.validationService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new BadRequestException({
          message: 'New password does not meet requirements',
          errors: passwordValidation.errors,
        });
      }

      // Hash new password
      const newPasswordHash = await this.passwordService.hashPassword(newPassword);

      // Update password
      user.passwordHash = newPasswordHash;
      user.refreshToken = null; // Invalidate all sessions
      await this.userRepository.save(user);

      // Log password change
      await this.logAuthEvent(userId, AuditAction.PASSWORD_CHANGED, true, 'Password changed successfully');

      // Emit password change event
      this.eventEmitter.emit('user.passwordChanged', {
        userId,
        email: user.email,
      });
    } catch (error) {
      this.logger.error('Password change failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method getCurrentUser
   * @purpose Get current authenticated user
   */
  async getCurrentUser(userId: string): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user.toSafeObject() as User;
    } catch (error) {
      this.logger.error('Get current user failed', error.stack, 'AuthService');
      throw error;
    }
  }

  /**
   * @method validateToken
   * @purpose Validate JWT token and return user
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = await this.tokenService.verifyAccessToken(token);
      
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.canLogin()) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.debug('Token validation failed', 'AuthService', { error: error.message });
      return null;
    }
  }

  /**
   * @method logAuthEvent
   * @purpose Log authentication event to audit log
   */
  private async logAuthEvent(
    userId: string,
    action: AuditAction,
    isSuccessful: boolean,
    description: string,
    context?: any
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        resourceType: 'user',
        resourceId: userId,
        description,
        context,
        userId,
        performedBy: userId,
        isSuccessful,
      });

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to log auth event', error.stack, 'AuthService');
      // Don't throw error to avoid breaking auth flow
    }
  }
}