import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { LeadDuplicateService } from './lead-duplicate.service';

@Module({
  imports: [AuditLogModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, LeadDuplicateService],
  exports: [CandidatesService, LeadDuplicateService],
})
export class CandidatesModule {}
