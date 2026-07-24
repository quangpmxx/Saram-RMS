import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';

/**
 * Mục 9, docs/13-api-design.md — GET /audit-log: Admin, Quản lý.
 *
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, "Phân quyền" phiên bản đơn
 * giản): BỎ `@Roles('admin', 'manager')` cấp controller cũ — thay bằng
 * ModulePermissionGuard tra theo module "audit-log" (defaultRoles giữ
 * nguyên y hệt ['admin','manager']), cho phép Admin cấp/thu quyền riêng
 * từng tài khoản qua trang "Phân quyền".
 */
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogQueryDto) {
    return this.auditLogService.list(query);
  }
}
