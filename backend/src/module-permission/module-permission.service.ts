import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountRole,
  ModulePermissionLevel,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { MODULE_REGISTRY } from './module-registry';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản (module-level: NONE/VIEW/EDIT).
 * Admin LUÔN LUÔN 'edit' cho mọi module (Mục 7: "Admin luôn có toàn quyền,
 * không cho Admin tự bỏ quyền Admin của chính mình") — KHÔNG lưu bản ghi
 * UserModulePermission nào cho Admin (đỡ tốn dữ liệu, tránh trường hợp lỡ
 * tay set 'none' cho chính Admin đang đăng nhập tự khóa mình ra khỏi hệ
 * thống — logic chặn nằm ở setPermissions() bên dưới nữa, chặn cả 2 lớp).
 */
@Injectable()
export class ModulePermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Quyền mặc định theo vai trò khi CHƯA có cấu hình riêng — khớp đúng mảng `roles` cũ ở layout.tsx, đảm bảo không ai mất quyền đang có. */
  private defaultLevel(
    role: AccountRole,
    moduleCode: string,
  ): ModulePermissionLevel {
    const entry = MODULE_REGISTRY.find((m) => m.code === moduleCode);
    if (!entry) return 'none';
    return entry.defaultRoles.includes(role) ? 'edit' : 'none';
  }

  async getEffective(
    accountId: string,
    role: AccountRole,
    moduleCode: string,
  ): Promise<ModulePermissionLevel> {
    if (role === 'admin') return 'edit';

    const override = await this.prisma.userModulePermission.findUnique({
      where: { accountId_module: { accountId, module: moduleCode } },
    });
    return override ? override.permission : this.defaultLevel(role, moduleCode);
  }

  /** Toàn bộ module + quyền hiệu lực hiện tại của 1 tài khoản — dùng cho GET /module-permission/me và trang Admin "Phân quyền". */
  async getEffectiveMap(
    accountId: string,
    role: AccountRole,
  ): Promise<Record<string, ModulePermissionLevel>> {
    if (role === 'admin') {
      return Object.fromEntries(MODULE_REGISTRY.map((m) => [m.code, 'edit']));
    }

    const overrides = await this.prisma.userModulePermission.findMany({
      where: { accountId },
    });
    const overrideByModule = new Map(
      overrides.map((o) => [o.module, o.permission]),
    );

    return Object.fromEntries(
      MODULE_REGISTRY.map((m) => [
        m.code,
        overrideByModule.get(m.code) ?? this.defaultLevel(role, m.code),
      ]),
    );
  }

  async setPermissions(
    targetAccountId: string,
    permissions: Record<string, ModulePermissionLevel>,
    currentUser: AuthenticatedUser,
  ): Promise<Record<string, ModulePermissionLevel>> {
    const targetAccount = await this.prisma.account.findUnique({
      where: { id: targetAccountId },
    });
    if (!targetAccount) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }
    // Mục 7: "Không cho Admin tự bỏ quyền Admin của chính mình" — Admin
    // không lưu bản ghi override nào (luôn 'edit' bất kể DB), nên chặn
    // thẳng ở đây để không tạo ra dữ liệu vô nghĩa/gây hiểu nhầm.
    if (targetAccount.role === 'admin') {
      throw new BadRequestException(
        'Tài khoản Admin luôn có toàn quyền, không thể chỉnh sửa phân quyền riêng',
      );
    }

    const moduleCodes = new Set(MODULE_REGISTRY.map((m) => m.code));
    const validLevels = new Set<ModulePermissionLevel>([
      'none',
      'view',
      'edit',
    ]);
    for (const [moduleCode, level] of Object.entries(permissions)) {
      if (!moduleCodes.has(moduleCode)) {
        throw new BadRequestException(`Module không hợp lệ: ${moduleCode}`);
      }
      if (!validLevels.has(level)) {
        throw new BadRequestException(
          `Mức quyền không hợp lệ: ${String(level)}`,
        );
      }
    }

    const before = await this.getEffectiveMap(
      targetAccountId,
      targetAccount.role,
    );

    await this.prisma.$transaction(
      Object.entries(permissions).map(([moduleCode, level]) =>
        this.prisma.userModulePermission.upsert({
          where: {
            accountId_module: {
              accountId: targetAccountId,
              module: moduleCode,
            },
          },
          create: {
            accountId: targetAccountId,
            module: moduleCode,
            permission: level,
            updatedById: currentUser.id,
          },
          update: { permission: level, updatedById: currentUser.id },
        }),
      ),
    );

    const after = await this.getEffectiveMap(
      targetAccountId,
      targetAccount.role,
    );

    for (const moduleCode of Object.keys(permissions)) {
      if (before[moduleCode] === after[moduleCode]) continue;
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'update',
        entityType: 'user_module_permission',
        entityId: targetAccountId,
        fieldChanged: moduleCode,
        oldValue: before[moduleCode],
        newValue: after[moduleCode],
      });
    }

    return after;
  }
}
