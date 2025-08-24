import { Module } from '@nestjs/common';
import { ExportService } from './services/export.service';
import { ExportController } from './controllers/export.controller';
import { CommonModule } from '../../common/common.module';

/**
 * @class ExportModule
 * @purpose Data export module
 */
@Module({
  imports: [CommonModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}