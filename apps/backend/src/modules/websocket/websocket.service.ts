import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/services/logger.service';
import { AEMSWebSocketGateway } from './websocket.gateway';

/**
 * @interface NotificationOptions
 * @purpose Options for sending notifications
 */
export interface NotificationOptions {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number; // milliseconds
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'default' | 'destructive';
  }>;
}

/**
 * @interface ProgressUpdate
 * @purpose Progress update information
 */
export interface ProgressUpdate {
  id: string;
  title: string;
  progress: number; // 0-100
  status: 'running' | 'completed' | 'error' | 'cancelled';
  message?: string;
  details?: any;
}

/**
 * @class WebSocketService
 * @purpose Service for managing WebSocket communications
 */
@Injectable()
export class WebSocketService {
  constructor(
    private logger: LoggerService,
    private gateway: AEMSWebSocketGateway,
  ) {}

  /**
   * @method sendNotificationToUser
   * @purpose Send notification to specific user
   */
  sendNotificationToUser(userId: string, notification: NotificationOptions): void {
    this.gateway.broadcastToUser(userId, 'notification', notification);
    
    this.logger.debug(`Sent notification to user ${userId}: ${notification.title}`, 'WebSocketService');
  }

  /**
   * @method sendNotificationToAll
   * @purpose Send notification to all connected users
   */
  sendNotificationToAll(notification: NotificationOptions): void {
    this.gateway.broadcastToAll('notification', notification);
    
    this.logger.debug(`Sent notification to all users: ${notification.title}`, 'WebSocketService');
  }

  /**
   * @method sendProgressUpdate
   * @purpose Send progress update to user
   */
  sendProgressUpdate(userId: string, update: ProgressUpdate): void {
    this.gateway.broadcastToUser(userId, 'progress:update', update);
    
    this.logger.debug(`Sent progress update to user ${userId}: ${update.title} (${update.progress}%)`, 'WebSocketService');
  }

  /**
   * @method sendPipelineUpdate
   * @purpose Send pipeline-specific update
   */
  sendPipelineUpdate(userId: string, event: string, data: any): void {
    this.gateway.broadcastToUser(userId, `pipeline:${event}`, data);
    
    this.logger.debug(`Sent pipeline update to user ${userId}: ${event}`, 'WebSocketService');
  }

  /**
   * @method sendGmailUpdate
   * @purpose Send Gmail-specific update
   */
  sendGmailUpdate(userId: string, event: string, data: any): void {
    this.gateway.broadcastToUser(userId, `gmail:${event}`, data);
    
    this.logger.debug(`Sent Gmail update to user ${userId}: ${event}`, 'WebSocketService');
  }

  /**
   * @method sendEmailUpdate
   * @purpose Send email-specific update
   */
  sendEmailUpdate(userId: string, event: string, data: any): void {
    this.gateway.broadcastToUser(userId, `email:${event}`, data);
    
    this.logger.debug(`Sent email update to user ${userId}: ${event}`, 'WebSocketService');
  }

  /**
   * @method sendSystemAlert
   * @purpose Send system-wide alert
   */
  sendSystemAlert(alert: {
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    affectedUsers?: string[];
  }): void {
    if (alert.affectedUsers && alert.affectedUsers.length > 0) {
      // Send to specific users
      alert.affectedUsers.forEach(userId => {
        this.gateway.broadcastToUser(userId, 'system:alert', alert);
      });
    } else {
      // Send to all users
      this.gateway.broadcastToAll('system:alert', alert);
    }
    
    this.logger.log(`Sent system alert: ${alert.title} (${alert.level})`, 'WebSocketService');
  }

  /**
   * @method sendDataUpdate
   * @purpose Send data update notification
   */
  sendDataUpdate(userId: string, update: {
    type: 'email' | 'classification' | 'extraction' | 'user';
    action: 'created' | 'updated' | 'deleted';
    id: string;
    data?: any;
  }): void {
    this.gateway.broadcastToUser(userId, 'data:update', update);
    
    this.logger.debug(`Sent data update to user ${userId}: ${update.type} ${update.action}`, 'WebSocketService');
  }

  /**
   * @method sendRealtimeStats
   * @purpose Send real-time statistics update
   */
  sendRealtimeStats(userId: string, stats: {
    emails: {
      total: number;
      unread: number;
      processed: number;
      errors: number;
    };
    pipeline: {
      isRunning: boolean;
      progress?: number;
      currentStage?: string;
    };
    system: {
      uptime: number;
      memoryUsage: number;
      cpuUsage: number;
    };
  }): void {
    this.gateway.broadcastToUser(userId, 'stats:update', stats);
    
    this.logger.debug(`Sent stats update to user ${userId}`, 'WebSocketService');
  }

  /**
   * @method isUserConnected
   * @purpose Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    const clients = this.gateway.getConnectedClients();
    return clients.some(client => client.userId === userId);
  }

  /**
   * @method getUserConnections
   * @purpose Get user's active connections
   */
  getUserConnections(userId: string): Array<{
    clientId: string;
    connectedAt: Date;
    lastActivity: Date;
  }> {
    const clients = this.gateway.getConnectedClients();
    return clients
      .filter(client => client.userId === userId)
      .map(client => ({
        clientId: client.clientId,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
      }));
  }

  /**
   * @method getConnectionStats
   * @purpose Get WebSocket connection statistics
   */
  getConnectionStats(): {
    connectedClients: number;
    activeRooms: number;
    totalConnections: number;
    uptime: number;
    clientsByUser: Record<string, number>;
  } {
    const stats = this.gateway.getStats();
    const clients = this.gateway.getConnectedClients();
    
    // Count clients by user
    const clientsByUser: Record<string, number> = {};
    clients.forEach(client => {
      clientsByUser[client.userId] = (clientsByUser[client.userId] || 0) + 1;
    });

    return {
      ...stats,
      clientsByUser,
    };
  }

  /**
   * @method broadcastMaintenanceNotice
   * @purpose Broadcast maintenance notice to all users
   */
  broadcastMaintenanceNotice(notice: {
    title: string;
    message: string;
    scheduledTime: Date;
    estimatedDuration: number; // minutes
    affectsFeatures: string[];
  }): void {
    this.gateway.broadcastToAll('maintenance:notice', notice);
    
    this.logger.log(`Broadcasted maintenance notice: ${notice.title}`, 'WebSocketService');
  }

  /**
   * @method sendHealthCheck
   * @purpose Send health check ping to user
   */
  sendHealthCheck(userId: string): void {
    this.gateway.broadcastToUser(userId, 'health:check', {
      timestamp: new Date().toISOString(),
      server: 'healthy',
    });
  }

  /**
   * @method sendCustomEvent
   * @purpose Send custom event to user or room
   */
  sendCustomEvent(
    target: { type: 'user'; userId: string } | { type: 'room'; room: string } | { type: 'all' },
    event: string,
    data: any
  ): void {
    switch (target.type) {
      case 'user':
        this.gateway.broadcastToUser(target.userId, event, data);
        break;
      case 'room':
        this.gateway.broadcastToRoom(target.room, event, data);
        break;
      case 'all':
        this.gateway.broadcastToAll(event, data);
        break;
    }

    this.logger.debug(`Sent custom event ${event} to ${target.type}`, 'WebSocketService');
  }
}