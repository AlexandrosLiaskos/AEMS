import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Google OAuth2 Authentication Guard
 * Protects routes that require Google authentication
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * Handle authentication request
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    
    // Perform any additional logic here if needed
    await super.logIn(request);
    
    return result;
  }
}