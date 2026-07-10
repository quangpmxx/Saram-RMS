import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { hashPassword } from '../common/utils/password.util';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import {
  AccountResponseDto,
  toAccountResponse,
} from './dto/account-response.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UpdateAccountPermissionDto } from './dto/update-account-permission.dto';
import { AccountPermissionGrantDto } from '../permission/dto/permission-response.dto';

const TEAM_SELECT = { id: true, name: true } as const;

/** Vai trò bắt buộc phải thuộc 1 nhóm — Mục 2.2, docs/11-database-design.md. */
const ROLES_REQUIRING_TEAM = new Set(['leader', 'sale']);

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    query: ListAccountsQueryDto,
  ): Promise<PaginatedResult<AccountResponseDto>> {
    const where: Prisma.AccountWhereInput = {
      role: query.role,
      teamId: query.team_id,
      status: query.status,
    };

    const [total, accounts] = await this.prisma.$transaction([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        include: { team: { select: TEAM_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: accounts.map(toAccountResponse),
    };
  }

  async findOne(id: string): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { team: { select: TEAM_SELECT } },
    });

    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    return toAccountResponse(account);
  }

  async create(
    dto: CreateAccountDto,
    createdById: string,
  ): Promise<AccountResponseDto> {
    const requiresTeam = ROLES_REQUIRING_TEAM.has(dto.role);
    if (requiresTeam && !dto.team_id) {
      throw new UnprocessableEntityException(
        'Vai trò leader/sale bắt buộc phải thuộc 1 nhóm (team_id)',
      );
    }

    // Mục 2.2, tài liệu 11: team_id chỉ áp dụng cho leader/sale, NULL với admin/manager/mkt.
    const teamId = requiresTeam ? dto.team_id! : undefined;

    if (teamId) {
      await this.assertTeamExists(teamId);
    }

    const defaultPassword = this.configService.get<string>(
      'DEFAULT_PASSWORD',
      '123456',
    );
    const passwordHash = await hashPassword(defaultPassword);

    try {
      const account = await this.prisma.account.create({
        data: {
          fullName: dto.full_name,
          username: dto.username,
          passwordHash,
          role: dto.role,
          teamId,
          createdById,
        },
        include: { team: { select: TEAM_SELECT } },
      });

      await this.auditLog.log({
        accountId: createdById,
        actionType: 'create',
        entityType: 'account',
        entityId: account.id,
        newValue: `username=${account.username}, role=${account.role}`,
      });

      return toAccountResponse(account);
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateAccountDto,
    actorId: string,
  ): Promise<AccountResponseDto> {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (dto.team_id) {
      await this.assertTeamExists(dto.team_id);
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: {
        fullName: dto.full_name,
        teamId: dto.team_id === undefined ? undefined : dto.team_id,
        status: dto.status,
      },
      include: { team: { select: TEAM_SELECT } },
    });

    await this.logFieldChanges(actorId, id, existing, dto);

    return toAccountResponse(account);
  }

  /** Xóa mềm — chuyển status = inactive (Mục 5, docs/11-database-design.md). */
  async deactivate(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    await this.prisma.account.update({
      where: { id },
      data: { status: 'inactive' },
    });

    await this.auditLog.log({
      accountId: actorId,
      actionType: 'delete',
      entityType: 'account',
      entityId: id,
      fieldChanged: 'status',
      oldValue: existing.status,
      newValue: 'inactive',
    });
  }

  /** Reset mật khẩu về mặc định — chỉ Admin (Mục 8, docs/09-business-specification.md). */
  async resetPassword(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const defaultPassword = this.configService.get<string>(
      'DEFAULT_PASSWORD',
      '123456',
    );
    const passwordHash = await hashPassword(defaultPassword);

    await this.prisma.account.update({ where: { id }, data: { passwordHash } });

    await this.auditLog.log({
      accountId: actorId,
      actionType: 'reset_password',
      entityType: 'account',
      entityId: id,
    });
  }

  /**
   * Mục 2, docs/13-api-design.md — PUT /account/:id/permission. Chỉ áp dụng
   * cho tài khoản Quản lý/Leader (Mục 9.1, docs/12). Danh mục `permissions`
   * đã seed 5 quyền tạm ở Phase 9 (xem seedPhase9Permissions() trong
   * seed.ts) — chưa phải danh sách chính thức từ chủ doanh nghiệp thật, có
   * thể điều chỉnh sau; method này hoạt động đúng logic dù danh mục thay
   * đổi hay tạm thời rỗng.
   */
  async updatePermissions(
    id: string,
    dto: UpdateAccountPermissionDto,
    actorId: string,
  ): Promise<AccountPermissionGrantDto[]> {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (account.role !== 'manager' && account.role !== 'leader') {
      throw new UnprocessableEntityException(
        'Chỉ cấu hình được quyền chi tiết cho tài khoản vai trò Quản lý/Leader',
      );
    }

    const allPermissions = await this.prisma.permission.findMany();
    const permissionById = new Map(allPermissions.map((p) => [p.id, p]));

    for (const item of dto.permissions) {
      const permission = permissionById.get(item.permission_id);
      if (!permission) {
        throw new NotFoundException(
          `Không tìm thấy quyền có id "${item.permission_id}"`,
        );
      }
      const existing = await this.prisma.accountPermission.findUnique({
        where: {
          accountId_permissionId: {
            accountId: id,
            permissionId: item.permission_id,
          },
        },
      });

      await this.prisma.accountPermission.upsert({
        where: {
          accountId_permissionId: {
            accountId: id,
            permissionId: item.permission_id,
          },
        },
        create: {
          accountId: id,
          permissionId: item.permission_id,
          isGranted: item.is_granted,
          updatedById: actorId,
        },
        update: { isGranted: item.is_granted, updatedById: actorId },
      });

      await this.auditLog.log({
        accountId: actorId,
        actionType: 'update',
        entityType: 'account_permission',
        entityId: id,
        fieldChanged: permission.code,
        oldValue: String(existing?.isGranted ?? false),
        newValue: String(item.is_granted),
      });
    }

    return this.getPermissionGrants(id);
  }

  private async getPermissionGrants(
    accountId: string,
  ): Promise<AccountPermissionGrantDto[]> {
    const [allPermissions, grants] = await Promise.all([
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.accountPermission.findMany({ where: { accountId } }),
    ]);
    const grantedByPermissionId = new Map(
      grants.map((g) => [g.permissionId, g.isGranted]),
    );
    return allPermissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      is_granted: grantedByPermissionId.get(p.id) ?? false,
    }));
  }

  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(
        'Không tìm thấy nhóm (team_id không tồn tại)',
      );
    }
  }

  private async logFieldChanges(
    actorId: string,
    entityId: string,
    before: { fullName: string; teamId: string | null; status: string },
    dto: UpdateAccountDto,
  ): Promise<void> {
    const changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    if (dto.full_name !== undefined && dto.full_name !== before.fullName) {
      changes.push({
        field: 'full_name',
        oldValue: before.fullName,
        newValue: dto.full_name,
      });
    }
    if (dto.team_id !== undefined && dto.team_id !== before.teamId) {
      changes.push({
        field: 'team_id',
        oldValue: before.teamId,
        newValue: dto.team_id,
      });
    }
    if (dto.status !== undefined && dto.status !== before.status) {
      changes.push({
        field: 'status',
        oldValue: before.status,
        newValue: dto.status,
      });
    }

    for (const change of changes) {
      await this.auditLog.log({
        accountId: actorId,
        actionType: 'update',
        entityType: 'account',
        entityId,
        fieldChanged: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
      });
    }
  }

  private mapKnownError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Tên đăng nhập đã tồn tại');
    }
    return error as Error;
  }
}
