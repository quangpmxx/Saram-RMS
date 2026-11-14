import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceSheetController } from './attendance-sheet.controller';
import { AttendanceSheetService } from './attendance-sheet.service';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [AttendanceController, AttendanceSheetController],
  providers: [AttendanceService, AttendanceSheetService],
})
export class AttendanceModule {}
