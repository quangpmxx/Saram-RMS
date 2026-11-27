import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CandidatesModule } from '../candidates/candidates.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CallbackMissedReportService } from './callback-missed-report.service';

@Module({
  imports: [CandidatesModule, RealtimeModule],
  controllers: [CalendarController],
  providers: [CalendarService, CallbackMissedReportService],
})
export class CalendarModule {}
