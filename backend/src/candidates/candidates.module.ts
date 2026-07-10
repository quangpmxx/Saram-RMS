import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DistributionModule } from '../distribution/distribution.module';
import { CandidatesController } from './candidates.controller';
import { InterviewCallbackController } from './interview-callback.controller';
import { CandidatesService } from './candidates.service';
import { LeadDuplicateService } from './lead-duplicate.service';
import { LeadPipelineService } from './lead-pipeline.service';

@Module({
  imports: [AuditLogModule, DistributionModule],
  controllers: [CandidatesController, InterviewCallbackController],
  providers: [CandidatesService, LeadDuplicateService, LeadPipelineService],
  exports: [CandidatesService, LeadDuplicateService, LeadPipelineService],
})
export class CandidatesModule {}
