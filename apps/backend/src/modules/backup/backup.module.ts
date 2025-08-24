import { Module } from '@nestjs/common';
import { BackupService } from './services/backup.service';
import { BackupController } from './controllers/backup.controller';
import { CommonModule } from '../../common/common.module';

/**
 * @class BackupModule
 * @purpose Data backup module
 */
@Module({
  imports: [CommonModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}