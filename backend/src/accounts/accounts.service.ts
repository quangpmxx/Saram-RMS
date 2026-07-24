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

    // Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
    // dùng): cho phép Admin sửa `username` — bọc try/catch để bắt trùng tên
    // đăng nhập với tài khoản khác (unique constraint, P2002) → 409 thân
    // thiện thay vì lỗi 500 (khớp cách create() đã xử lý).
    let account: Prisma.AccountGetPayload<{
      include: { team: { select: { id: true; name: true } } };
    }>;
    try {
      account = await this.prisma.account.update({
        where: { id },
        data: {
          fullName: dto.full_name,
          username: dto.username,
          teamId: dto.team_id === undefined ? undefined : dto.team_id,
          status: dto.status,
          dateOfBirth:
            dto.date_of_birth === undefined
              ? undefined
              : dto.date_of_birth === null
                ? null
                : new Date(dto.date_of_birth),
          hireDate:
            dto.hire_date === undefined
              ? undefined
              : dto.hire_date === null
                ? null
                : new Date(dto.hire_date),
          personalPhone: dto.personal_phone,
          personalEmail: dto.personal_email,
          remainingLeaveDays: dto.remaining_leave_days,
          citizenId: dto.citizen_id,
          bankAccountNumber: dto.bank_account_number,
        },
        include: { team: { select: TEAM_SELECT } },
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }

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

  /**
   * Xóa vĩnh viễn (yêu cầu trực tiếp người dùng, 2026-07-15) — KHÁC
   * deactivate() ở trên: xóa hẳn khỏi database, không phải khóa tài khoản.
   * CHỈ cho phép khi tài khoản CHƯA có bất kỳ dữ liệu liên quan nào (chấm
   * công, báo cáo, data ứng viên, nhật ký...) — dựa thẳng vào ràng buộc
   * khóa ngoại thật của DB (bắt lỗi P2003) thay vì tự liệt kê từng bảng một
   * (Account có > 20 quan hệ khác nhau trong toàn hệ thống, dễ sót nếu tự
   * kiểm — để chính DB làm nguồn xác thực). Nếu bị chặn, hướng dẫn dùng
   * "Vô hiệu hóa" thay thế (không mất lịch sử thật).
   */
  async deletePermanently(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    try {
      await this.prisma.account.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Không thể xóa vĩnh viễn — tài khoản này đã có dữ liệu liên quan trong hệ thống (chấm công, báo cáo, data ứng viên, nhật ký...). Vui lòng dùng chức năng "Vô hiệu hóa" thay thế.',
        );
      }
      throw error;
    }

    await this.auditLog.log({
      accountId: actorId,
      actionType: 'delete',
      entityType: 'account',
      entityId: id,
      oldValue: `${existing.username} (${existing.fullName}) — xóa vĩnh viễn`,
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
    before: {
      fullName: string;
      username: string;
      teamId: string | null;
      status: string;
      dateOfBirth: Date | null;
      hireDate: Date | null;
      personalPhone: string | null;
      personalEmail: string | null;
      remainingLeaveDays: number | null;
      citizenId: string | null;
      bankAccountNumber: string | null;
    },
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
    if (dto.username !== undefined && dto.username !== before.username) {
      changes.push({
        field: 'username',
        oldValue: before.username,
        newValue: dto.username,
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
    const beforeDob = before.dateOfBirth?.toISOString().slice(0, 10) ?? null;
    if (dto.date_of_birth !== undefined && dto.date_of_birth !== beforeDob) {
      changes.push({
        field: 'date_of_birth',
        oldValue: beforeDob,
        newValue: dto.date_of_birth,
      });
    }
    const beforeHireDate = before.hireDate?.toISOString().slice(0, 10) ?? null;
    if (dto.hire_date !== undefined && dto.hire_date !== beforeHireDate) {
      changes.push({
        field: 'hire_date',
        oldValue: beforeHireDate,
        newValue: dto.hire_date,
      });
    }
    if (
      dto.personal_phone !== undefined &&
      dto.personal_phone !== before.personalPhone
    ) {
      changes.push({
        field: 'personal_phone',
        oldValue: before.personalPhone,
        newValue: dto.personal_phone,
      });
    }
    if (
      dto.personal_email !== undefined &&
      dto.personal_email !== before.personalEmail
    ) {
      changes.push({
        field: 'personal_email',
        oldValue: before.personalEmail,
        newValue: dto.personal_email,
      });
    }
    if (
      dto.remaining_leave_days !== undefined &&
      dto.remaining_leave_days !== before.remainingLeaveDays
    ) {
      changes.push({
        field: 'remaining_leave_days',
        oldValue:
          before.remainingLeaveDays === null
            ? null
            : String(before.remainingLeaveDays),
        newValue:
          dto.remaining_leave_days === null
            ? null
            : String(dto.remaining_leave_days),
      });
    }
    if (dto.citizen_id !== undefined && dto.citizen_id !== before.citizenId) {
      changes.push({
        field: 'citizen_id',
        oldValue: before.citizenId,
        newValue: dto.citizen_id,
      });
    }
    if (
      dto.bank_account_number !== undefined &&
      dto.bank_account_number !== before.bankAccountNumber
    ) {
      changes.push({
        field: 'bank_account_number',
        oldValue: before.bankAccountNumber,
        newValue: dto.bank_account_number,
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
