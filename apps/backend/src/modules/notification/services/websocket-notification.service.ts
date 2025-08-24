import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

// Entities
import { Notification, DeliveryChannel } from '../../../database/entities/notification.entity';
import { User } from '../../../database/entities/user.entity';

// Services
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface ConnectedClient
 * @purpose Connected WebSocket client information
 */
interface ConnectedClient {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * @interface NotificationDeliveryResult
 * @purpose WebSocket notification delivery result
 */
interface NotificationDeliveryResult {
  success: boolean;
  deliveredTo: number;
  error?: string;
}

/**
 * @class WebSocketNotificationService
 * @purpose WebSocket-based real-time notification delivery service
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class WebSocketNotificationService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, ConnectedClient>();
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private logger: LoggerService
  ) {}

  /**
   * @method handleConnection
   * @purpose Handle new WebSocket connection
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract and verify JWT token
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn('WebSocket connection rejected: No token provided', 'WebSocketNotificationService');
        client.disconnect();
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn('WebSocket connection rejected: Invalid token', 'WebSocketNotificationService');
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      const socketId = client.id;

      // Store client information
      const clientInfo: ConnectedClient = {
        userId,
        socketId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        userAgent: client.handshake.headers['user-agent'],
        ipAddress: client.handshake.address,
      };

      this.connectedClients.set(socketId, clientInfo);

      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(socketId);

      // Join user-specific room
      client.join(`user:${userId}`);

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to notification service',
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `WebSocket client connected: ${socketId} for user ${userId}`,
        'WebSocketNotificationService',
        { userId, socketId, userAgent: clientInfo.userAgent }
      );

      // Send any pending notifications
      await this.sendPendingNotifications(userId);
    } catch (error) {
      this.logger.error(
        'Failed to handle WebSocket connection',
        error.stack,
        'WebSocketNotificationService'
      );
      client.disconnect();
    }
  }

  /**
   * @method handleDisconnect
   * @purpose Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket): void {
    try {
      const socketId = client.id;
      const clientInfo = this.connectedClients.get(socketId);

      if (clientInfo) {
        const { userId } = clientInfo;

        // Remove from connected clients
        this.connectedClients.delete(socketId);

        // Remove from user sockets
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socketId);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }

        this.logger.log(
          `WebSocket client disconnected: ${socketId} for user ${userId}`,
          'WebSocketNotificationService',
          { userId, socketId }
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to handle WebSocket disconnection',
        error.stack,
        'WebSocketNotificationService'
      );
    }
  }

  /**
   * @method handlePing
   * @purpose Handle ping message to keep connection alive
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * @method handleMarkAsRead
   * @purpose Handle mark notification as read
   */
  @SubscribeMessage('mark-as-read')
  handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string }
  ): void {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
      
      // Emit event for notification service to handle
      // This would be handled by the main notification service
      this.logger.debug(
        `Mark as read request from WebSocket: ${data.notificationId}`,
        'WebSocketNotificationService',
        { userId: clientInfo.userId, notificationId: data.notificationId }
      );
    }
  }

  /**
   * @method deliverNotification
   * @purpose Deliver notification via WebSocket
   */
  async deliverNotification(notification: Notification): Promise<NotificationDeliveryResult> {
    try {
      const userId = notification.userId;
      const userSockets = this.userSockets.get(userId);

      if (!userSockets || userSockets.size === 0) {
        return {
          success: false,
          deliveredTo: 0,
          error: 'User not connected',
        };
      }

      // Prepare notification data
      const notificationData = {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        actionUrl: notification.actionUrl,
        actionLabel: notification.actionLabel,
        createdAt: notification.createdAt,
        expiresAt: notification.expiresAt,
      };

      // Send to all user's connected sockets
      let deliveredTo = 0;
      for (const socketId of userSockets) {
        try {
          this.server.to(socketId).emit('notification', notificationData);
          deliveredTo++;
        } catch (error) {
          this.logger.warn(
            `Failed to deliver notification to socket ${socketId}`,
            'WebSocketNotificationService',
            { error: error.message }
          );
        }
      }

      // Also send to user room (fallback)
      this.server.to(`user:${userId}`).emit('notification', notificationData);

      this.logger.log(
        `WebSocket notification delivered to ${deliveredTo} connections for user ${userId}`,
        'WebSocketNotificationService',
        { notificationId: notification.id, deliveredTo }
      );

      return {
        success: deliveredTo > 0,
        deliveredTo,
      };
    } catch (error) {
      this.logger.error(
        `Failed to deliver WebSocket notification ${notification.id}`,
        error.stack,
        'WebSocketNotificationService'
      );

      return {
        success: false,
        deliveredTo: 0,
        error: error.message,
      };
    }
  }

  /**
   * @method broadcastToUser
   * @purpose Broadcast message to all user's connections
   */
  async broadcastToUser(userId: string, event: string, data: any): Promise<void> {
    try {
      this.server.to(`user:${userId}`).emit(event, data);
      
      this.logger.debug(
        `Broadcast sent to user ${userId}: ${event}`,
        'WebSocketNotificationService',
        { userId, event }
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast to user ${userId}`,
        error.stack,
        'WebSocketNotificationService'
      );
    }
  }

  /**
   * @method broadcastToAll
   * @purpose Broadcast message to all connected clients
   */
  async broadcastToAll(event: string, data: any): Promise<void> {
    try {
      this.server.emit(event, data);
      
      this.logger.debug(
        `Broadcast sent to all clients: ${event}`,
        'WebSocketNotificationService'
      );
    } catch (error) {
      this.logger.error(
        'Failed to broadcast to all clients',
        error.stack,
        'WebSocketNotificationService'
      );
    }
  }

  /**
   * @method getConnectedUsers
   * @purpose Get list of connected user IDs
   */
  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * @method getUserConnectionCount
   * @purpose Get number of connections for a user
   */
  getUserConnectionCount(userId: string): number {
    const userSockets = this.userSockets.get(userId);
    return userSockets ? userSockets.size : 0;
  }

  /**
   * @method getConnectionStats
   * @purpose Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    averageConnectionsPerUser: number;
  } {
    const totalConnections = this.connectedClients.size;
    const uniqueUsers = this.userSockets.size;
    const averageConnectionsPerUser = uniqueUsers > 0 ? totalConnections / uniqueUsers : 0;

    return {
      totalConnections,
      uniqueUsers,
      averageConnectionsPerUser,
    };
  }

  /**
   * @method onNotificationCreated
   * @purpose Handle notification created event
   */
  @OnEvent('notification.created')
  async onNotificationCreated(payload: { notification: Notification; userId: string }): Promise<void> {
    const { notification } = payload;
    
    // Only deliver via WebSocket if it's configured as a delivery channel
    if (notification.channels.includes(DeliveryChannel.IN_APP)) {
      await this.deliverNotification(notification);
    }
  }

  /**
   * @method onNotificationRead
   * @purpose Handle notification read event
   */
  @OnEvent('notification.read')
  async onNotificationRead(payload: { notification: Notification; userId: string }): Promise<void> {
    const { notification, userId } = payload;
    
    // Broadcast read status to all user's connections
    await this.broadcastToUser(userId, 'notification-read', {
      notificationId: notification.id,
      readAt: notification.readAt,
    });
  }

  /**
   * @method onNotificationDismissed
   * @purpose Handle notification dismissed event
   */
  @OnEvent('notification.dismissed')
  async onNotificationDismissed(payload: { notification: Notification; userId: string }): Promise<void> {
    const { notification, userId } = payload;
    
    // Broadcast dismissed status to all user's connections
    await this.broadcastToUser(userId, 'notification-dismissed', {
      notificationId: notification.id,
      dismissedAt: notification.dismissedAt,
    });
  }

  /**
   * @method extractToken
   * @purpose Extract JWT token from WebSocket handshake
   */
  private extractToken(client: Socket): string | null {
    // Try to get token from query parameters
    const tokenFromQuery = client.handshake.query.token as string;
    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    // Try to get token from authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * @method verifyToken
   * @purpose Verify JWT token
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * @method sendPendingNotifications
   * @purpose Send any pending notifications to newly connected user
   */
  private async sendPendingNotifications(userId: string): Promise<void> {
    try {
      // This would typically query the database for pending notifications
      // For now, we'll just emit a "sync" event to trigger frontend to fetch
      await this.broadcastToUser(userId, 'sync-notifications', {
        message: 'Please sync notifications',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send pending notifications to user ${userId}`,
        error.stack,
        'WebSocketNotificationService'
      );
    }
  }
}