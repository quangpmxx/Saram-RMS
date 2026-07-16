import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ShuttleController } from './shuttle.controller';
import { ShuttleService } from './shuttle.service';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [ShuttleController],
  providers: [ShuttleService],
})
export class ShuttleModule {}
