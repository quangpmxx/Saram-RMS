import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationScannerService } from './notification-scanner.service';
import { ZaloClientService } from './zalo-client.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationScannerService,
    ZaloClientService,
  ],
  exports: [NotificationScannerService],
})
export class NotificationModule {}
