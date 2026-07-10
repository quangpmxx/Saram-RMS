import { Controller, Get } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { Roles } from '../common/decorators/roles.decorator';

/** Mục 2, docs/13-api-design.md — GET /permission: Admin. */
@Controller('permission')
@Roles('admin')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  list() {
    return this.permissionService.list();
  }
}
