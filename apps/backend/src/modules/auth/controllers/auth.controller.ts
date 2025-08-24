import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { PasswordService } from '../services/password.service';

// DTOs
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  UpdateProfileDto,
  AuthResponseDto,
  UserDto,
  TokenInfoDto,
  PasswordStrengthDto,
} from '../dto/auth.dto';

// Guards
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { GoogleAuthGuard } from '../guards/google-auth.guard';

// Decorators
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

// Entities
import { User } from '../../../database/entities/user.entity';

/**
 * @class AuthController
 * @purpose REST API controller for authentication endpoints
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private passwordService: PasswordService
  ) {}

  /**
   * @method register
   * @purpose Register new user account
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Register new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists',
  })
  async register(@Body() registerDto: RegisterDto, @Request() req): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user as UserDto,
    };
  }

  /**
   * @method login
   * @purpose Authenticate user with email and password
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many login attempts',
  })
  async login(@Body() loginDto: LoginDto, @Request() req): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const result = await this.authService.login(loginDto, ipAddress, userAgent);
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user as UserDto,
    };
  }

  /**
   * @method refreshToken
   * @purpose Refresh access token using refresh token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    const result = await this.authService.refreshToken(refreshTokenDto);
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user as UserDto,
    };
  }

  /**
   * @method logout
   * @purpose Logout user and invalidate tokens
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  async logout(@CurrentUser() user: User): Promise<void> {
    await this.authService.logout(user.id);
  }

  /**
   * @method getCurrentUser
   * @purpose Get current authenticated user information
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    type: UserDto,
  })
  async getCurrentUser(@CurrentUser() user: User): Promise<UserDto> {
    return user as UserDto;
  }

  /**
   * @method updateProfile
   * @purpose Update user profile information
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserDto,
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<UserDto> {
    // TODO: Implement profile update logic
    return user as UserDto;
  }

  /**
   * @method changePassword
   * @purpose Change user password
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 204,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect',
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<void> {
    await this.authService.changePassword(user.id, changePasswordDto);
  }

  /**
   * @method validateToken
   * @purpose Validate JWT token
   */
  @Public()
  @Get('validate-token')
  @ApiOperation({ summary: 'Validate JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Token information',
    type: TokenInfoDto,
  })
  async validateToken(@Query('token') token: string): Promise<TokenInfoDto> {
    const tokenInfo = this.tokenService.getTokenInfo(token);
    
    return {
      isValid: tokenInfo.isValid,
      isExpired: tokenInfo.isExpired,
      expiresAt: tokenInfo.expiresAt,
      remainingSeconds: tokenInfo.remainingSeconds,
      shouldRefresh: tokenInfo.shouldRefresh,
    };
  }

  /**
   * @method checkPasswordStrength
   * @purpose Analyze password strength
   */
  @Public()
  @Post('check-password-strength')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze password strength' })
  @ApiResponse({
    status: 200,
    description: 'Password strength analysis',
    type: PasswordStrengthDto,
  })
  async checkPasswordStrength(@Body('password') password: string): Promise<PasswordStrengthDto> {
    const analysis = this.passwordService.analyzePasswordStrength(password);
    
    return {
      score: analysis.score,
      feedback: analysis.feedback,
      isStrong: analysis.isStrong,
      estimatedCrackTime: analysis.estimatedCrackTime,
    };
  }

  /**
   * @method googleAuth
   * @purpose Initiate Google OAuth authentication
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth authentication' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Google OAuth',
  })
  async googleAuth(): Promise<void> {
    // This method initiates the Google OAuth flow
    // The actual logic is handled by the GoogleAuthGuard
  }

  /**
   * @method googleAuthCallback
   * @purpose Handle Google OAuth callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'Google authentication successful',
    type: AuthResponseDto,
  })
  async googleAuthCallback(@Request() req): Promise<AuthResponseDto> {
    const result = await this.authService.googleAuth(req.user);
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 900, // 15 minutes
      user: result.user as UserDto,
    };
  }
}