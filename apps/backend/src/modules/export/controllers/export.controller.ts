import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { ExportService } from '../services/export.service';
import { ExportOptions } from '../../../common/types';

/**
 * @class ExportController
 * @purpose REST API controller for export operations
 */
@ApiTags('Export')
@Controller('export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post('data')
  async exportData(@CurrentUser() user: User, @Body() options: ExportOptions) {
    return this.exportService.exportData(user.id, options);
  }
}