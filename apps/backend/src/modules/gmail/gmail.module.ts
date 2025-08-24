import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { User } from '../../database/entities/user.entity';
import { EmailMessage } from '../../database/entities/email-message.entity';
import { Attachment } from '../../database/entities/attachment.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

// Services
import { GmailService } from './services/gmail.service';
import { GmailAuthService } from './services/gmail-auth.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailWebhookService } from './services/gmail-webhook.service';
import { GmailQuotaService } from './services/gmail-quota.service';
import { EmailParserService } from './services/email-parser.service';
import { AttachmentService } from './services/attachment.service';

// Import EmailModule for EmailAttachmentService
import { EmailModule } from '../email/email.module';

// Controllers
import { GmailController } from './controllers/gmail.controller';

// Resolvers
import { GmailResolver } from './resolvers/gmail.resolver';

// Tasks
import { GmailSyncTask } from './tasks/gmail-sync.task';

/**
 * @class GmailModule
 * @purpose Gmail API integration and email synchronization module
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([User, EmailMessage, Attachment, AuditLog]),

    // Schedule module for sync tasks
    ScheduleModule,

    // Email module for EmailAttachmentService
    EmailModule,
  ],
  providers: [
    // Core services
    GmailService,
    GmailAuthService,
    GmailSyncService,
    GmailWebhookService,
    GmailQuotaService,
    EmailParserService,
    AttachmentService,

    // GraphQL resolver
    GmailResolver,

    // Scheduled tasks
    GmailSyncTask,
  ],
  controllers: [GmailController],
  exports: [
    GmailService,
    GmailAuthService,
    GmailSyncService,
    GmailWebhookService,
    GmailQuotaService,
    EmailParserService,
    AttachmentService,
  ],
})
export class GmailModule {}
