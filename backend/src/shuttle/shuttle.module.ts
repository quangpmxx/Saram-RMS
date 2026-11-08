import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ModulePermissionModule } from '../module-permission/module-permission.module';
import { ShuttleController } from './shuttle.controller';
import { ShuttleService } from './shuttle.service';
import { ShuttleImportService } from './shuttle-import.service';

@Module({
  imports: [AuditLogModule, RealtimeModule, ModulePermissionModule],
  controllers: [ShuttleController],
  providers: [ShuttleService, ShuttleImportService],
})
export class ShuttleModule {}
