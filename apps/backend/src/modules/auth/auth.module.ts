import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

// Services
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { GoogleAuthService } from './services/google-auth.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalStrategy } from './strategies/local.strategy';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Controllers
import { AuthController } from './controllers/auth.controller';

// Resolvers
import { AuthResolver } from './resolvers/auth.resolver';

/**
 * @class AuthModule
 * @purpose Authentication and authorization module
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([User, AuditLog]),

    // Passport configuration
    PassportModule.register({ 
      defaultStrategy: 'jwt',
      session: true,
    }),

    // JWT configuration
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string>('auth.jwtExpiresIn'),
          issuer: 'aems-backend',
          audience: 'aems-frontend',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Services
    AuthService,
    TokenService,
    GoogleAuthService,
    PasswordService,
    SessionService,

    // Strategies
    JwtStrategy,
    GoogleStrategy,
    LocalStrategy,

    // Guards
    JwtAuthGuard,
    GoogleAuthGuard,
    LocalAuthGuard,
    RolesGuard,

    // GraphQL Resolver
    AuthResolver,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    TokenService,
    GoogleAuthService,
    PasswordService,
    SessionService,
    JwtAuthGuard,
    GoogleAuthGuard,
    LocalAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}