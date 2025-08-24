import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * @class HealthModule
 * @purpose Health check and monitoring module
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}