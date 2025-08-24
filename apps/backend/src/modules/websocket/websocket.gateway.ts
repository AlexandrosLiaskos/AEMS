import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { LoggerService } from '../../common/services/logger.service';
import { EventService } from '../../common/services/event.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';

/**
 * @interface ClientInfo
 * @purpose Information about connected client
 */
interface ClientInfo {
  userId: string;
  email: string;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * @interface RoomInfo
 * @purpose Information about WebSocket rooms
 */
interface RoomInfo {
  name: string;
  clients: string[];
  createdAt: Date;
}

/**
 * @class WebSocketGateway
 * @purpose WebSocket gateway for real-time communication
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/ws',
})
export class AEMSWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private clients = new Map<string, ClientInfo>();
  private rooms = new Map<string, RoomInfo>();

  constructor(
    private logger: LoggerService,
    private eventService: EventService,
  ) {
    // Subscribe to application events
    this.subscribeToEvents();
  }

  /**
   * @method afterInit
   * @purpose Called after WebSocket server initialization
   */
  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized', 'WebSocketGateway');
    this.server = server;
  }

  /**
   * @method handleConnection
   * @purpose Handle new client connection
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      this.logger.debug(`Client connecting: ${client.id}`, 'WebSocketGateway');

      // Extract user info from token (would be set by WsJwtGuard)
      const user = (client as any).user;
      if (!user) {
        this.logger.warn(`Unauthorized connection attempt: ${client.id}`, 'WebSocketGateway');
        client.disconnect();
        return;
      }

      // Store client info
      this.clients.set(client.id, {
        userId: user.id,
        email: user.email,
        connectedAt: new Date(),
        lastActivity: new Date(),
      });

      // Join user-specific room
      const userRoom = `user:${user.id}`;
      await client.join(userRoom);

      // Join general notifications room
      await client.join('notifications');

      this.logger.log(`Client connected: ${user.email} (${client.id})`, 'WebSocketGateway');

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to AEMS WebSocket',
        timestamp: new Date().toISOString(),
        clientId: client.id,
      });

      // Notify about connection
      this.server.to(userRoom).emit('user:connected', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, 'WebSocketGateway');
      client.disconnect();
    }
  }

  /**
   * @method handleDisconnect
   * @purpose Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    const clientInfo = this.clients.get(client.id);
    
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${clientInfo.email} (${client.id})`, 'WebSocketGateway');

      // Notify about disconnection
      const userRoom = `user:${clientInfo.userId}`;
      this.server.to(userRoom).emit('user:disconnected', {
        userId: clientInfo.userId,
        email: clientInfo.email,
        timestamp: new Date().toISOString(),
      });

      // Remove client info
      this.clients.delete(client.id);
    } else {
      this.logger.debug(`Unknown client disconnected: ${client.id}`, 'WebSocketGateway');
    }
  }

  /**
   * @method handleJoinRoom
   * @purpose Handle client joining a room
   */
  @SubscribeMessage('join:room')
  @UseGuards(WsJwtGuard)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ): Promise<void> {
    try {
      const clientInfo = this.clients.get(client.id);
      if (!clientInfo) return;

      await client.join(data.room);
      
      // Update room info
      if (!this.rooms.has(data.room)) {
        this.rooms.set(data.room, {
          name: data.room,
          clients: [],
          createdAt: new Date(),
        });
      }

      const room = this.rooms.get(data.room)!;
      if (!room.clients.includes(client.id)) {
        room.clients.push(client.id);
      }

      this.logger.debug(`Client ${clientInfo.email} joined room: ${data.room}`, 'WebSocketGateway');

      client.emit('room:joined', {
        room: data.room,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`, 'WebSocketGateway');
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * @method handleLeaveRoom
   * @purpose Handle client leaving a room
   */
  @SubscribeMessage('leave:room')
  @UseGuards(WsJwtGuard)
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ): Promise<void> {
    try {
      const clientInfo = this.clients.get(client.id);
      if (!clientInfo) return;

      await client.leave(data.room);

      // Update room info
      const room = this.rooms.get(data.room);
      if (room) {
        room.clients = room.clients.filter(id => id !== client.id);
        if (room.clients.length === 0) {
          this.rooms.delete(data.room);
        }
      }

      this.logger.debug(`Client ${clientInfo.email} left room: ${data.room}`, 'WebSocketGateway');

      client.emit('room:left', {
        room: data.room,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`, 'WebSocketGateway');
      client.emit('error', { message: 'Failed to leave room' });
    }
  }

  /**
   * @method handlePing
   * @purpose Handle ping from client
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }

    client.emit('pong', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * @method subscribeToEvents
   * @purpose Subscribe to application events for broadcasting
   */
  private subscribeToEvents(): void {
    // Pipeline events
    this.eventService.on('pipeline.started', (event) => {
      this.broadcastToUser(event.userId, 'pipeline:started', event.payload);
    });

    this.eventService.on('pipeline.progress', (event) => {
      this.broadcastToUser(event.userId, 'pipeline:progress', event.payload);
    });

    this.eventService.on('pipeline.completed', (event) => {
      this.broadcastToUser(event.userId, 'pipeline:completed', event.payload);
    });

    this.eventService.on('pipeline.error', (event) => {
      this.broadcastToUser(event.userId, 'pipeline:error', event.payload);
    });

    // Gmail sync events
    this.eventService.on('gmail.sync.started', (event) => {
      this.broadcastToUser(event.userId, 'gmail:sync:started', event.payload);
    });

    this.eventService.on('gmail.sync.progress', (event) => {
      this.broadcastToUser(event.userId, 'gmail:sync:progress', event.payload);
    });

    this.eventService.on('gmail.sync.completed', (event) => {
      this.broadcastToUser(event.userId, 'gmail:sync:completed', event.payload);
    });

    // Email processing events
    this.eventService.on('email.classified', (event) => {
      this.broadcastToUser(event.userId, 'email:classified', event.payload);
    });

    this.eventService.on('email.extracted', (event) => {
      this.broadcastToUser(event.userId, 'email:extracted', event.payload);
    });

    // Workflow events
    this.eventService.on('workflow.state.changed', (event) => {
      this.broadcastToUser(event.userId, 'workflow:state:changed', event.payload);
    });

    // System events
    this.eventService.on('system.notification', (event) => {
      if (event.userId) {
        this.broadcastToUser(event.userId, 'system:notification', event.payload);
      } else {
        this.broadcastToAll('system:notification', event.payload);
      }
    });
  }

  /**
   * @method broadcastToUser
   * @purpose Broadcast message to specific user
   */
  public broadcastToUser(userId: string, event: string, data: any): void {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Broadcasted ${event} to user ${userId}`, 'WebSocketGateway');
  }

  /**
   * @method broadcastToAll
   * @purpose Broadcast message to all connected clients
   */
  public broadcastToAll(event: string, data: any): void {
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Broadcasted ${event} to all clients`, 'WebSocketGateway');
  }

  /**
   * @method broadcastToRoom
   * @purpose Broadcast message to specific room
   */
  broadcastToRoom(room: string, event: string, data: any): void {
    this.server.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Broadcasted ${event} to room ${room}`, 'WebSocketGateway');
  }

  /**
   * @method getConnectedClients
   * @purpose Get information about connected clients
   */
  getConnectedClients(): Array<ClientInfo & { clientId: string }> {
    return Array.from(this.clients.entries()).map(([clientId, info]) => ({
      clientId,
      ...info,
    }));
  }

  /**
   * @method getRooms
   * @purpose Get information about active rooms
   */
  getRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  /**
   * @method getStats
   * @purpose Get WebSocket statistics
   */
  getStats(): {
    connectedClients: number;
    activeRooms: number;
    totalConnections: number;
    uptime: number;
  } {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
      totalConnections: this.server.engine.clientsCount,
      uptime: process.uptime(),
    };
  }
}