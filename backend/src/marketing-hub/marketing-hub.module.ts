import { Module } from '@nestjs/common';
import { MarketingHubController } from './marketing-hub.controller';
import { MarketingHubService } from './marketing-hub.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [MarketingHubController],
  providers: [MarketingHubService],
})
export class MarketingHubModule {}
