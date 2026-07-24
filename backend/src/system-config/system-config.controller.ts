import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 9, docs/13-api-design.md — "Quyền sử dụng: Admin" cho cả 2 endpoint.
 *
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, "Phân quyền" phiên bản đơn
 * giản): BỎ `@Roles('admin')` cấp controller cũ — thay bằng
 * ModulePermissionGuard tra theo module "settings" (defaultRoles giữ
 * nguyên y hệt ['admin']).
 */
@Controller('config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  list() {
    return this.systemConfigService.list();
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.systemConfigService.update(key, dto, user);
  }
}
