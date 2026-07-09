import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuditLogModule, CandidatesModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
