import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BackupService } from '../services/backup.service';
import { BackupOptions } from '../../../common/types';

/**
 * @class BackupController
 * @purpose REST API controller for backup operations
 */
@ApiTags('Backup')
@Controller('backup')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BackupController {
  constructor(private backupService: BackupService) {}

  @Post('create')
  async createBackup(@Body() options: BackupOptions) {
    return this.backupService.createBackup(options);
  }

  @Post('restore')
  async restoreBackup(@Body() data: { backupPath: string }) {
    return this.backupService.restoreBackup(data.backupPath);
  }
}