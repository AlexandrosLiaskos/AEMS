import { Module } from '@nestjs/common';

// Gateway
import { AEMSWebSocketGateway } from './websocket.gateway';

// Services
import { WebSocketService } from './websocket.service';

// Guards
import { WsJwtGuard } from './guards/ws-jwt.guard';

// Other modules
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

/**
 * @class WebSocketModule
 * @purpose WebSocket module for real-time communication
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
  ],
  providers: [
    AEMSWebSocketGateway,
    WebSocketService,
    WsJwtGuard,
  ],
  exports: [
    WebSocketService,
    AEMSWebSocketGateway,
  ],
})
export class WebSocketModule {}