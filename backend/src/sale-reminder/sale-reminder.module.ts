import { Module } from '@nestjs/common';
import { SaleReminderController } from './sale-reminder.controller';
import { SaleReminderService } from './sale-reminder.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [SaleReminderController],
  providers: [SaleReminderService],
  exports: [SaleReminderService],
})
export class SaleReminderModule {}
