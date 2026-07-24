import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ModulePermissionService } from './module-permission.service';
import { SetModulePermissionsDto } from './dto/set-module-permissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { MODULE_REGISTRY } from './module-registry';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản. Danh sách tài khoản cho panel
 * bên trái trang Admin TÁI SỬ DỤNG thẳng GET /account đã có (đã
 * @Roles('admin'), đủ tìm kiếm/lọc) — không tạo endpoint trùng lặp.
 */
@Controller('module-permission')
export class ModulePermissionController {
  constructor(
    private readonly modulePermissionService: ModulePermissionService,
    private readonly prisma: PrismaService,
  ) {}

  /** Danh sách module + nhãn hiển thị — dùng để dựng danh sách checkbox/radio ở trang Admin và lọc menu phía frontend. */
  @Get('modules')
  listModules() {
    return MODULE_REGISTRY.map((m) => ({ code: m.code, label: m.label }));
  }

  /** Quyền hiệu lực của CHÍNH người đang đăng nhập — mọi vai trò gọi được (dùng để lọc menu/route phía frontend). */
  @Get('me')
  async getMyPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.modulePermissionService.getEffectiveMap(user.id, user.role);
  }

  @Get(':accountId')
  @Roles('admin')
  async getAccountPermissions(
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    return {
      account_id: accountId,
      role: account.role,
      is_admin: account.role === 'admin',
      permissions: await this.modulePermissionService.getEffectiveMap(
        accountId,
        account.role,
      ),
    };
  }

  @Put(':accountId')
  @Roles('admin')
  async setAccountPermissions(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: SetModulePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const permissions = await this.modulePermissionService.setPermissions(
      accountId,
      dto.permissions,
      user,
    );
    return { account_id: accountId, permissions };
  }
}
