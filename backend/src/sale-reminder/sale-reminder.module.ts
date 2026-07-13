import { Module } from '@nestjs/common';
import { SaleReminderController } from './sale-reminder.controller';
import { SaleReminderService } from './sale-reminder.service';

@Module({
  controllers: [SaleReminderController],
  providers: [SaleReminderService],
  exports: [SaleReminderService],
})
export class SaleReminderModule {}
