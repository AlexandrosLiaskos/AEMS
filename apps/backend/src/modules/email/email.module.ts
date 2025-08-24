import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { EmailMessage } from '../../database/entities/email-message.entity';
import { Classification } from '../../database/entities/classification.entity';
import { Extraction } from '../../database/entities/extraction.entity';

// Services
import { AttachmentService } from './services/attachment.service';

// Controllers
import { EmailController } from './controllers/email.controller';

// Resolvers
import { EmailResolver } from '../../graphql/resolvers/email.resolver';

// Common modules
import { CommonModule } from '../../common/common.module';

/**
 * @class EmailModule
 * @purpose Email management module
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailMessage,
      Classification,
      Extraction,
    ]),
    CommonModule,
  ],
  controllers: [
    EmailController,
  ],
  providers: [
    AttachmentService,
    EmailResolver,
  ],
  exports: [
    AttachmentService,
  ],
})
export class EmailModule {}