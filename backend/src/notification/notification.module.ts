import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationScannerService } from './notification-scanner.service';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationScannerService],
  exports: [NotificationScannerService],
})
export class NotificationModule {}
