import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DistributionRuleController } from './distribution-rule.controller';
import { DistributionRuleService } from './distribution-rule.service';

@Module({
  imports: [AuditLogModule],
  controllers: [DistributionRuleController],
  providers: [DistributionRuleService],
  exports: [DistributionRuleService],
})
export class DistributionModule {}
