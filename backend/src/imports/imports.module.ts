import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { DistributionModule } from '../distribution/distribution.module';
import { NotificationModule } from '../notification/notification.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { LegacyImportService } from './legacy-import.service';

@Module({
  imports: [
    AuditLogModule,
    CandidatesModule,
    DistributionModule,
    NotificationModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService, LegacyImportService],
})
export class ImportsModule {}
