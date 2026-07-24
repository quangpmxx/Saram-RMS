import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ModulePermissionController } from './module-permission.controller';
import { ModulePermissionService } from './module-permission.service';
import { ModulePermissionGuard } from './module-permission.guard';

/** Dự án phụ — nâng cấp toàn diện (2026-07-24): "Phân quyền" phiên bản đơn giản (module-level NONE/VIEW/EDIT). */
@Module({
  imports: [AuditLogModule],
  controllers: [ModulePermissionController],
  providers: [ModulePermissionService, ModulePermissionGuard],
  exports: [ModulePermissionService, ModulePermissionGuard],
})
export class ModulePermissionModule {}
