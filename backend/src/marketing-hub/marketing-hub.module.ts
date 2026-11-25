import { Module } from '@nestjs/common';
import { MarketingHubController } from './marketing-hub.controller';
import { MarketingHubService } from './marketing-hub.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [MarketingHubController],
  providers: [MarketingHubService],
  exports: [MarketingHubService],
})
export class MarketingHubModule {}
