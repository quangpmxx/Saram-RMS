import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CarePoolController } from './care-pool.controller';
import { CarePoolService } from './care-pool.service';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [CarePoolController],
  providers: [CarePoolService],
})
export class CarePoolModule {}
