import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field, ObjectType } from '@nestjs/graphql';

/**
 * @class LoginDto
 * @purpose Login request DTO
 */
@InputType()
export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Field()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @Field()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

/**
 * @class RegisterDto
 * @purpose Registration request DTO
 */
@InputType()
export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Field()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @Field()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 128,
  })
  @Field()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    }
  )
  password: string;
}

/**
 * @class RefreshTokenDto
 * @purpose Refresh token request DTO
 */
@InputType()
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Field()
  @IsString()
  refreshToken: string;
}

/**
 * @class ChangePasswordDto
 * @purpose Change password request DTO
 */
@InputType()
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @Field()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewSecurePassword123!',
    minLength: 8,
    maxLength: 128,
  })
  @Field()
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(128, { message: 'New password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    {
      message: 'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    }
  )
  newPassword: string;
}

/**
 * @class ForgotPasswordDto
 * @purpose Forgot password request DTO
 */
@InputType()
export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Field()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

/**
 * @class ResetPasswordDto
 * @purpose Reset password request DTO
 */
@InputType()
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Field()
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewSecurePassword123!',
    minLength: 8,
    maxLength: 128,
  })
  @Field()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    }
  )
  newPassword: string;
}

/**
 * @class UpdateProfileDto
 * @purpose Update user profile DTO
 */
@InputType()
export class UpdateProfileDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiProperty({
    description: 'User profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  picture?: string;
}

/**
 * @class UserDto
 * @purpose User information DTO
 */
@ObjectType()
export class UserDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  @Field()
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Field()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @Field()
  name: string;

  @ApiProperty({
    description: 'User profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @Field({ nullable: true })
  picture?: string;

  @ApiProperty({
    description: 'User role',
    example: 'USER',
    enum: ['ADMIN', 'USER'],
  })
  @Field()
  role: string;

  @ApiProperty({
    description: 'User status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
  })
  @Field()
  status: string;

  @ApiProperty({
    description: 'Account creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  @Field()
  createdAt: Date;

  @ApiProperty({
    description: 'Last login date',
    example: '2023-01-01T00:00:00.000Z',
    required: false,
  })
  @Field({ nullable: true })
  lastLoginAt?: Date;
}

/**
 * @class AuthResponseDto
 * @purpose Authentication response DTO
 */
@ObjectType()
export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Field()
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Field()
  refreshToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
  })
  @Field()
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  @Field(() => UserDto)
  user: UserDto;
}

/**
 * @class GoogleAuthResponseDto
 * @purpose Google authentication response DTO
 */
@ObjectType()
export class GoogleAuthResponseDto extends AuthResponseDto {
  @ApiProperty({
    description: 'Whether this is a new user registration',
    example: false,
  })
  @Field()
  isNewUser: boolean;
}

/**
 * @class TokenInfoDto
 * @purpose Token information DTO
 */
@ObjectType()
export class TokenInfoDto {
  @ApiProperty({
    description: 'Whether the token is valid',
    example: true,
  })
  @Field()
  isValid: boolean;

  @ApiProperty({
    description: 'Whether the token is expired',
    example: false,
  })
  @Field()
  isExpired: boolean;

  @ApiProperty({
    description: 'Token expiration date',
    example: '2023-01-01T00:00:00.000Z',
    required: false,
  })
  @Field({ nullable: true })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Remaining time in seconds',
    example: 600,
  })
  @Field()
  remainingSeconds: number;

  @ApiProperty({
    description: 'Whether the token should be refreshed',
    example: false,
  })
  @Field()
  shouldRefresh: boolean;
}

/**
 * @class PasswordStrengthDto
 * @purpose Password strength analysis DTO
 */
@ObjectType()
export class PasswordStrengthDto {
  @ApiProperty({
    description: 'Password strength score (0-4)',
    example: 3,
    minimum: 0,
    maximum: 4,
  })
  @Field()
  score: number;

  @ApiProperty({
    description: 'Password strength feedback',
    example: ['Add special characters', 'Avoid common patterns'],
    type: [String],
  })
  @Field(() => [String])
  feedback: string[];

  @ApiProperty({
    description: 'Whether the password is considered strong',
    example: true,
  })
  @Field()
  isStrong: boolean;

  @ApiProperty({
    description: 'Estimated time to crack the password',
    example: '> 1 year',
  })
  @Field()
  estimatedCrackTime: string;
}
