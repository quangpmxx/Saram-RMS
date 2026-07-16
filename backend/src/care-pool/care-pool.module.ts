import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CarePoolController } from './care-pool.controller';
import { CarePoolService } from './care-pool.service';
import { CarePoolScannerService } from './care-pool-scanner.service';

@Module({
  imports: [AuditLogModule, SystemConfigModule, RealtimeModule],
  controllers: [CarePoolController],
  providers: [CarePoolService, CarePoolScannerService],
  exports: [CarePoolScannerService],
})
export class CarePoolModule {}
