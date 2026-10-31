import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationScannerService } from './notification-scanner.service';
import { LeadAssignmentNoticeService } from './lead-assignment-notice.service';
import { NotificationCleanupService } from './notification-cleanup.service';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationScannerService,
    LeadAssignmentNoticeService,
    NotificationCleanupService,
  ],
  exports: [NotificationScannerService, LeadAssignmentNoticeService],
})
export class NotificationModule {}
