import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountRole,
  ModulePermissionLevel,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { MODULE_REGISTRY } from './module-registry';
import { CAPABILITY_CODES } from '../common/permissions/capability-catalog';

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
    if (entry.defaultRoles.includes(role)) return 'edit';
    return entry.viewRoles?.includes(role) ? 'view' : 'none';
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

  /** Phân quyền chi tiết (2026-11-07): quyền nhỏ chỉnh riêng của 1 tài khoản (không có = theo vai trò). */
  async getCapabilityOverrides(
    accountId: string,
  ): Promise<Record<string, boolean>> {
    const rows = await this.prisma.userCapability.findMany({
      where: { accountId },
      select: { code: true, granted: true },
    });
    return Object.fromEntries(rows.map((r) => [r.code, r.granted]));
  }

  /**
   * Lưu quyền nhỏ: true cho phép, false không cho phép, null về theo vai trò
   * (xoá dòng). Có hiệu lực ngay ở request kế tiếp (JwtStrategy nạp lại mỗi
   * request). Ghi Nhật ký từng quyền đổi.
   */
  async setCapabilities(
    targetAccountId: string,
    changes: Record<string, boolean | null>,
    currentUser: AuthenticatedUser,
  ): Promise<Record<string, boolean>> {
    const targetAccount = await this.prisma.account.findUnique({
      where: { id: targetAccountId },
    });
    if (!targetAccount) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }
    if (targetAccount.role === 'admin') {
      throw new BadRequestException(
        'Tài khoản Admin luôn có toàn quyền, không thể chỉnh sửa phân quyền riêng',
      );
    }
    for (const [code, value] of Object.entries(changes)) {
      if (!CAPABILITY_CODES.has(code)) {
        throw new BadRequestException(`Quyền không hợp lệ: ${code}`);
      }
      if (value !== null && typeof value !== 'boolean') {
        throw new BadRequestException(`Giá trị quyền không hợp lệ: ${code}`);
      }
    }

    const before = await this.getCapabilityOverrides(targetAccountId);
    await this.prisma.$transaction(
      Object.entries(changes).map(([code, value]) =>
        value === null
          ? this.prisma.userCapability.deleteMany({
              where: { accountId: targetAccountId, code },
            })
          : this.prisma.userCapability.upsert({
              where: { accountId_code: { accountId: targetAccountId, code } },
              create: {
                accountId: targetAccountId,
                code,
                granted: value,
                updatedById: currentUser.id,
              },
              update: { granted: value, updatedById: currentUser.id },
            }),
      ),
    );
    const after = await this.getCapabilityOverrides(targetAccountId);

    const label = (v: boolean | undefined) =>
      v === undefined ? 'theo vai trò' : v ? 'cho phép' : 'không cho phép';
    for (const code of Object.keys(changes)) {
      if (before[code] === after[code]) continue;
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'update',
        entityType: 'user_capability',
        entityId: targetAccountId,
        fieldChanged: code,
        oldValue: label(before[code]),
        newValue: label(after[code]),
      });
    }
    return after;
  }
}
