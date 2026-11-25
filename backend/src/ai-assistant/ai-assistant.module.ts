import { BirthdayModule } from '../birthday/birthday.module';
import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { CareWarehouseModule } from '../care-warehouse/care-warehouse.module';
import { MarketingHubModule } from '../marketing-hub/marketing-hub.module';
import { ModulePermissionModule } from '../module-permission/module-permission.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { RecruitmentScheduleModule } from '../recruitment-schedule/recruitment-schedule.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [
    BirthdayModule,
    AuditLogModule,
    DashboardModule,
    CareWarehouseModule,
    MarketingHubModule,
    ModulePermissionModule,
    CandidatesModule,
    RecruitmentScheduleModule,
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
