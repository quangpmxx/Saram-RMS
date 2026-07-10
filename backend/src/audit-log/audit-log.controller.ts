import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { Roles } from '../common/decorators/roles.decorator';

/** Mục 9, docs/13-api-design.md — GET /audit-log: Admin, Quản lý. */
@Controller('audit-log')
@Roles('admin', 'manager')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogQueryDto) {
    return this.auditLogService.list(query);
  }
}
