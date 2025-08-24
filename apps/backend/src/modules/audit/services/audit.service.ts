import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/services/logger.service';
import { AuditLogEntry } from '../../../common/types';

/**
 * @class AuditService
 * @purpose Audit logging service
 */
@Injectable()
export class AuditService {
  constructor(private logger: LoggerService) {}

  /**
   * @method logAction
   * @purpose Log user action
   */
  async logAction(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.logger.info('Audit log entry created', 'AuditService', auditEntry);
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}