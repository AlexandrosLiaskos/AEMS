import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../services/token.service';
import { User } from '../../../database/entities/user.entity';

/**
 * @class JwtStrategy
 * @purpose JWT authentication strategy for Passport
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
      issuer: 'aems-backend',
      audience: 'aems-frontend',
    });
  }

  /**
   * @method validate
   * @purpose Validate JWT payload and return user
   */
  async validate(payload: JwtPayload): Promise<User> {
    // Verify token type
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Get user from database
    const user = await this.authService.getCurrentUser(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}