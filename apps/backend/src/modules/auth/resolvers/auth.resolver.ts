import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';

// Services
import { GoogleAuthService } from '../services/google-auth.service';
import { SessionService } from '../services/session.service';

// Guards
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

// Decorators
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

// DTOs
import { InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsUrl } from 'class-validator';

/**
 * @class LoginDto
 * @purpose DTO for login request
 */
@InputType()
export class LoginDto {
  @Field()
  @IsString()
  authorizationCode: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * @class AuthUrlDto
 * @purpose DTO for auth URL request
 */
@InputType()
export class AuthUrlDto {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  scopes?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * @class AuthResponseDto
 * @purpose DTO for authentication response
 */
@ObjectType()
export class AuthResponseDto {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  accessToken?: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field({ nullable: true })
  expiresIn?: number;

  @Field(() => UserInfoDto, { nullable: true })
  user?: UserInfoDto;

  @Field({ nullable: true })
  error?: string;
}

/**
 * @class UserInfoDto
 * @purpose DTO for user information
 */
@ObjectType()
export class UserInfoDto {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field()
  role: string;

  @Field()
  status: string;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: string;

  @Field()
  lastLoginAt: string;
}

/**
 * @class AuthUrlResponseDto
 * @purpose DTO for auth URL response
 */
@ObjectType()
export class AuthUrlResponseDto {
  @Field()
  authUrl: string;

  @Field({ nullable: true })
  state?: string;
}

/**
 * @class SessionInfoDto
 * @purpose DTO for session information
 */
@ObjectType()
export class SessionInfoDto {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field()
  role: string;

  @Field()
  loginTime: string;

  @Field()
  lastActivity: string;

  @Field()
  expiresAt: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;
}

/**
 * @class AuthResolver
 * @purpose GraphQL resolver for authentication operations
 */
@Resolver()
export class AuthResolver {
  constructor(
    private googleAuthService: GoogleAuthService,
    private sessionService: SessionService,
  ) {}

  /**
   * @method getAuthUrl
   * @purpose Get Google OAuth authorization URL
   */
  @Query(() => AuthUrlResponseDto, { description: 'Get Google OAuth authorization URL' })
  @Public()
  async getAuthUrl(
    @Args('options', { nullable: true }) options?: AuthUrlDto
  ): Promise<AuthUrlResponseDto> {
    const scopes = options?.scopes || [
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly'
    ];

    const authUrl = this.googleAuthService.getAuthUrl(scopes);

    return {
      authUrl,
      state: options?.state,
    };
  }

  /**
   * @method login
   * @purpose Authenticate user with Google OAuth code
   */
  @Mutation(() => AuthResponseDto, { description: 'Authenticate user with Google OAuth code' })
  @Public()
  async login(@Args('loginData') loginData: LoginDto): Promise<AuthResponseDto> {
    try {
      // Exchange code for tokens
      const tokens = await this.googleAuthService.exchangeCodeForTokens(loginData.authorizationCode);

      // Get user info from Google
      const googleUser = await this.googleAuthService.getUserInfo(tokens.accessToken);

      // Find or create user
      const user = await this.findOrCreateUser(googleUser, tokens);

      // Create session
      const sessionResult = await this.sessionService.createSession(user);

      return {
        success: true,
        accessToken: sessionResult.accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * @method logout
   * @purpose Logout user and destroy session
   */
  @Mutation(() => Boolean, { description: 'Logout user and destroy session' })
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: User): Promise<boolean> {
    try {
      // Get current session from context (would need to be implemented)
      const sessionId = this.getCurrentSessionId();

      if (sessionId) {
        await this.sessionService.destroySession(sessionId);
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * @method logoutAll
   * @purpose Logout user from all sessions
   */
  @Mutation(() => Boolean, { description: 'Logout user from all sessions' })
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: User): Promise<boolean> {
    try {
      await this.sessionService.destroyAllUserSessions(user.id);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * @method refreshSession
   * @purpose Refresh user session
   */
  @Mutation(() => AuthResponseDto, { description: 'Refresh user session' })
  @UseGuards(JwtAuthGuard)
  async refreshSession(@CurrentUser() user: User): Promise<AuthResponseDto> {
    try {
      const sessionId = this.getCurrentSessionId();

      if (!sessionId) {
        throw new UnauthorizedException('No active session');
      }

      // Extend session
      const extended = await this.sessionService.extendSession(sessionId);

      if (!extended) {
        throw new UnauthorizedException('Failed to refresh session');
      }

      return {
        success: true,
        accessToken: sessionId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * @method getCurrentUser
   * @purpose Get current authenticated user
   */
  @Query(() => UserInfoDto, { description: 'Get current authenticated user' })
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: User): Promise<UserInfoDto> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
    };
  }

  /**
   * @method getSessionInfo
   * @purpose Get current session information
   */
  async getSessionInfo(@CurrentUser() user: User): Promise<SessionInfoDto | null> {
    try {
      const sessionId = this.getCurrentSessionId();

      if (!sessionId) {
        return null;
      }

      const session = await this.sessionService.getSession(sessionId);

      if (!session) {
        return null;
      }

      return {
        id: session.sessionId,
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        loginTime: session.createdAt.toISOString(),
        lastActivity: session.createdAt.toISOString(), // Using createdAt as lastActivity since it's not tracked separately
        expiresAt: session.expiresAt.toISOString(),
        isActive: session.expiresAt > new Date(),
        ipAddress: 'unknown', // Not stored in SessionData
        userAgent: 'unknown', // Not stored in SessionData
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * @method getUserSessions
   * @purpose Get all user sessions
   */
  @Query(() => [SessionInfoDto], { description: 'Get all user sessions' })
  @UseGuards(JwtAuthGuard)
  async getUserSessions(@CurrentUser() user: User): Promise<SessionInfoDto[]> {
    try {
      const sessions = await this.sessionService.getUserSessions(user.id);

      return sessions.map(session => ({
        id: session.sessionId,
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        loginTime: session.createdAt.toISOString(),
        lastActivity: session.createdAt.toISOString(), // Using createdAt as lastActivity for now
        expiresAt: session.expiresAt.toISOString(),
        isActive: session.expiresAt > new Date(),
        ipAddress: 'unknown', // Not stored in SessionData
        userAgent: 'unknown', // Not stored in SessionData
      }));

    } catch (error) {
      return [];
    }
  }

  /**
   * @method validateSession
   * @purpose Validate session token
   */
  @Query(() => Boolean, { description: 'Validate session token' })
  @Public()
  async validateSession(@Args('sessionId') sessionId: string): Promise<boolean> {
    try {
      const sessionData = await this.sessionService.validateSession(sessionId);
      return !!sessionData;
    } catch (error) {
      return false;
    }
  }

  /**
   * @method findOrCreateUser
   * @purpose Find existing user or create new one
   */
  private async findOrCreateUser(googleUser: any, tokens: any): Promise<User> {
    // This would typically use a UserService to find or create user
    // For now, create a mock user object
    const user = new User();
    user.id = googleUser.id;
    user.email = googleUser.email;
    user.name = googleUser.name;
    user.avatar = googleUser.picture;
    user.role = 'USER' as any;
    user.status = 'ACTIVE' as any;
    user.isActive = true;
    user.createdAt = new Date();
    user.lastLoginAt = new Date();
    user.googleTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiryDate: tokens.expiryDate,
    };

    return user;
  }

  /**
   * @method getUserPermissions
   * @purpose Get user permissions based on role
   */
  private getUserPermissions(role: string): string[] {
    const permissions = {
      'USER': ['read:emails', 'write:emails', 'read:profile', 'write:profile'],
      'ADMIN': ['read:*', 'write:*', 'delete:*', 'admin:*'],
      'MODERATOR': ['read:*', 'write:emails', 'moderate:content'],
    };

    return permissions[role] || permissions['USER'];
  }

  /**
   * @method getCurrentSessionId
   * @purpose Get current session ID from context
   */
  private getCurrentSessionId(): string | null {
    // This would typically extract session ID from request context
    // For now, return null as placeholder
    return null;
  }
}
