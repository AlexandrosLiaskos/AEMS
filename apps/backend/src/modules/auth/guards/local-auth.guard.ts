import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local Authentication Guard
 * Protects routes that require username/password authentication
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}