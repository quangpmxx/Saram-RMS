import { Module } from '@nestjs/common';
import { BirthdayController } from './birthday.controller';
import { BirthdayService } from './birthday.service';

@Module({
  controllers: [BirthdayController],
  providers: [BirthdayService],
})
export class BirthdayModule {}
