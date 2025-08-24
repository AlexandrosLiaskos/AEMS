import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../database/entities/notification.entity';
import { EmailMessage } from '../../database/entities/email-message.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

// Services
import { NotificationService } from './services/notification.service';
import { EmailNotificationService } from './services/email-notification.service';
import { PushNotificationService } from './services/push-notification.service';
import { WebSocketNotificationService } from './services/websocket-notification.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';

// Controllers
import { NotificationController } from './controllers/notification.controller';

// Resolvers
import { NotificationResolver } from './resolvers/notification.resolver';

// Event Listeners and Tasks will be added when implemented

/**
 * @class NotificationModule
 * @purpose Comprehensive notification system module
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([User, Notification, EmailMessage, AuditLog]),

    // Schedule module for cleanup and digest tasks
    ScheduleModule,

    // Event emitter for listening to system events
    EventEmitterModule,
  ],
  providers: [
    // Core services
    NotificationService,
    EmailNotificationService,
    PushNotificationService,
    WebSocketNotificationService,
    NotificationTemplateService,
    NotificationPreferenceService,
    NotificationDeliveryService,

    // GraphQL resolver
    NotificationResolver,

    // Event listeners and scheduled tasks will be added when implemented
  ],
  controllers: [NotificationController],
  exports: [
    NotificationService,
    EmailNotificationService,
    PushNotificationService,
    WebSocketNotificationService,
    NotificationTemplateService,
    NotificationPreferenceService,
    NotificationDeliveryService,
  ],
})
export class NotificationModule {}