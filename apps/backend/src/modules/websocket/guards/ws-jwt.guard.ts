import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { LoggerService } from '../../../common/services/logger.service';
import { SessionService } from '../../auth/services/session.service';

/**
 * @class WsJwtGuard
 * @purpose WebSocket JWT authentication guard
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private logger: LoggerService,
    private sessionService: SessionService,
  ) {}

  /**
   * @method canActivate
   * @purpose Validate WebSocket connection authentication
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        throw new WsException('Authentication token required');
      }

      // Validate session token
      const sessionData = await this.sessionService.validateSession(token);
      if (!sessionData) {
        throw new WsException('Invalid or expired token');
      }

      // Attach user info to socket
      (client as any).user = {
        id: sessionData.userId,
        email: sessionData.email,
        name: sessionData.name,
        role: sessionData.role,
      };

      return true;

    } catch (error) {
      this.logger.warn(`WebSocket authentication failed: ${error.message}`, 'WsJwtGuard');
      throw new WsException('Authentication failed');
    }
  }

  /**
   * @method extractTokenFromSocket
   * @purpose Extract authentication token from socket
   */
  private extractTokenFromSocket(client: Socket): string | null {
    // Try to get token from handshake auth
    const token = client.handshake.auth?.token;
    if (token) {
      return token;
    }

    // Try to get token from query parameters
    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Try to get token from headers
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/);
      if (match) {
        return match[1];
      }
    }

    return null;
  }
}