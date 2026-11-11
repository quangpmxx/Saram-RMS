import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RecruitmentScheduleController } from './recruitment-schedule.controller';
import { RecruitmentScheduleService } from './recruitment-schedule.service';

@Module({
  imports: [AuditLogModule],
  controllers: [RecruitmentScheduleController],
  providers: [RecruitmentScheduleService],
})
export class RecruitmentScheduleModule {}
