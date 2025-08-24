import { Module, Global } from '@nestjs/common';

// Repositories
import { UserRepository } from './user.repository';
import { EmailMessageRepository } from './email-message.repository';
import { ClassificationRepository } from './classification.repository';
import { ExtractionRepository } from './extraction.repository';

// Common module for shared services
import { CommonModule } from '../../common/common.module';

/**
 * @class RepositoryModule
 * @purpose Global module for all repository classes
 */
@Global()
@Module({
  imports: [CommonModule],
  providers: [
    UserRepository,
    EmailMessageRepository,
    ClassificationRepository,
    ExtractionRepository,
  ],
  exports: [
    UserRepository,
    EmailMessageRepository,
    ClassificationRepository,
    ExtractionRepository,
  ],
})
export class RepositoryModule {}