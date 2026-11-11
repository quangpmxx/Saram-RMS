import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  CreateRecruitmentPostingDto,
  UpdateRecruitmentPostingDto,
} from './dto/recruitment-posting.dto';
import {
  RECRUITMENT_POSTING_INCLUDE,
  RecruitmentPostingResponseDto,
  toRecruitmentPostingResponse,
} from './dto/recruitment-posting-response.dto';

/** Tên trường (API) → cột Prisma + nhãn hiện trong Nhật ký. */
const FIELDS = [
  ['company_name', 'companyName', 'Tên công ty'],
  ['kind', 'kind', 'Loại tuyển'],
  ['status', 'status', 'Trạng thái tuyển'],
  ['area', 'area', 'Khu vực'],
  ['accept_male', 'acceptMale', 'Nhận nam'],
  ['accept_female', 'acceptFemale', 'Nhận nữ'],
  ['age_min', 'ageMin', 'Tuổi từ'],
  ['age_max', 'ageMax', 'Tuổi đến'],
  ['requirement', 'requirement', 'Yêu cầu'],
  ['base_salary', 'baseSalary', 'Lương cơ bản'],
  ['allowance', 'allowance', 'Phụ cấp'],
  ['salary_note', 'salaryNote', 'Chi tiết lương'],
  ['bonus_summary', 'bonusSummary', 'Tổng thưởng'],
  ['bonus', 'bonus', 'Mốc thưởng'],
  ['tags', 'tags', 'Nhãn nhanh'],
  ['interview_slot', 'interviewSlot', 'Lịch phỏng vấn'],
  ['work', 'work', 'Công việc'],
  ['documents', 'documents', 'Hồ sơ'],
  ['housing', 'housing', 'Trọ gần, đi lại'],
  ['pros', 'pros', 'Ưu điểm'],
  ['cons', 'cons', 'Nhược điểm'],
  ['notes', 'notes', 'Lưu ý'],
  ['zalo_message', 'zaloMessage', 'Tin Zalo'],
] as const;

/** Cột không cho null — client gửi null/chuỗi rỗng thì bỏ qua. */
const NOT_NULL_COLUMNS = [
  'companyName',
  'kind',
  'status',
  'acceptMale',
  'acceptFemale',
  'tags',
];

interface Scope {
  /** Thấy/sửa lịch mọi nhóm (kể cả thẻ chưa gán nhóm). */
  all: boolean;
  /** Khi không `all`: nhóm được thấy; null = không thấy thẻ nào. */
  teamId: string | null;
}

/**
 * Lịch tuyển dụng (2026-11-11, yêu cầu người dùng): thay sheet "Lịch tuyển
 * dụng". Quyền vào trang/sửa do ModulePermissionGuard chặn theo module
 * "recruitment-schedule" (sửa: Admin/Quản lý/Leader/Sup Leader; Sale chỉ xem).
 *
 * MỖI NHÓM MỘT LỊCH RIÊNG (duyệt 2026-11-11) — xem `resolveScope`:
 * - Admin: mọi nhóm.
 * - Tài khoản được Admin chọn "Lịch tuyển của nhóm" ở Quản lý tài khoản
 *   (accounts.recruitment_team_id): đúng nhóm đó.
 * - Còn lại: nhóm mình (accounts.team_id); riêng Quản lý chưa được chọn nhóm
 *   thì thấy mọi nhóm; tài khoản không có nhóm nào thì không thấy thẻ nào.
 */
@Injectable()
export class RecruitmentScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    user: AuthenticatedUser,
  ): Promise<RecruitmentPostingResponseDto[]> {
    const scope = await this.resolveScope(user);
    if (!scope.all && !scope.teamId) return [];
    const rows = await this.prisma.recruitmentPosting.findMany({
      where: scope.all ? {} : { teamId: scope.teamId },
      include: RECRUITMENT_POSTING_INCLUDE,
      orderBy: [{ area: 'asc' }, { companyName: 'asc' }],
    });
    return rows.map(toRecruitmentPostingResponse);
  }

  /** Phạm vi của người dùng + các nhóm họ được xem (để trang hiện ô chọn nhóm). */
  async teams(
    user: AuthenticatedUser,
  ): Promise<{ can_see_all: boolean; teams: { id: string; name: string }[] }> {
    const scope = await this.resolveScope(user);
    if (!scope.all && !scope.teamId) return { can_see_all: false, teams: [] };
    const teams = await this.prisma.team.findMany({
      where: scope.all ? {} : { id: scope.teamId ?? undefined },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { can_see_all: scope.all, teams };
  }

  async create(
    dto: CreateRecruitmentPostingDto,
    user: AuthenticatedUser,
  ): Promise<RecruitmentPostingResponseDto> {
    const scope = await this.resolveScope(user);
    let teamId: string | null;
    if (scope.all) {
      teamId = dto.team_id ?? null;
      if (teamId) await this.assertTeamExists(teamId);
    } else {
      if (!scope.teamId) {
        throw new ForbiddenException(
          'Tài khoản chưa thuộc nhóm nào nên chưa thêm được lịch tuyển',
        );
      }
      teamId = scope.teamId;
    }

    this.assertAgeRange(dto.age_min, dto.age_max);
    const data = this.toData(dto);
    const companyName = dto.company_name.trim();
    await this.assertNameFree(companyName, dto.kind, teamId);

    const row = await this.prisma.recruitmentPosting.create({
      data: {
        ...(data as object),
        companyName,
        kind: dto.kind,
        teamId,
        orderRecordId: await this.findOrderRecordId(companyName),
        updatedById: user.id,
      },
      include: RECRUITMENT_POSTING_INCLUDE,
    });

    await this.auditLog.log({
      accountId: user.id,
      actionType: 'create',
      entityType: 'recruitment_posting',
      entityId: row.id,
      newValue: this.logName(row.companyName, row.team?.name),
    });
    return toRecruitmentPostingResponse(row);
  }

  async update(
    id: string,
    dto: UpdateRecruitmentPostingDto,
    user: AuthenticatedUser,
  ): Promise<RecruitmentPostingResponseDto> {
    const scope = await this.resolveScope(user);
    const existing = await this.findInScope(id, scope);
    this.assertAgeRange(
      dto.age_min === undefined ? existing.ageMin : dto.age_min,
      dto.age_max === undefined ? existing.ageMax : dto.age_max,
    );

    const data = this.toData(dto);
    const changed: string[] = FIELDS.filter(
      ([, col]) =>
        col in data &&
        JSON.stringify(data[col] ?? null) !==
          JSON.stringify(existing[col] ?? null),
    ).map(([, , label]) => label);
    const statusChanged = changed.includes('Trạng thái tuyển');

    // Chỉ người thấy mọi nhóm mới chuyển được thẻ sang nhóm khác; còn lại gửi team_id thì bỏ qua.
    let teamId = existing.teamId;
    if (
      scope.all &&
      dto.team_id !== undefined &&
      dto.team_id !== existing.teamId
    ) {
      if (dto.team_id) await this.assertTeamExists(dto.team_id);
      teamId = dto.team_id;
      data.teamId = teamId;
      changed.push('Nhóm');
    }

    const name = (data.companyName as string) ?? existing.companyName;
    const kind = (data.kind as typeof existing.kind) ?? existing.kind;
    if (
      name !== existing.companyName ||
      kind !== existing.kind ||
      teamId !== existing.teamId
    ) {
      await this.assertNameFree(name, kind, teamId, id);
      data.orderRecordId = await this.findOrderRecordId(name);
    }

    const row = await this.prisma.recruitmentPosting.update({
      where: { id },
      data: { ...(data as object), updatedById: user.id },
      include: RECRUITMENT_POSTING_INCLUDE,
    });

    if (changed.length > 0) {
      const oldName = this.logName(existing.companyName, existing.team?.name);
      const newName = this.logName(row.companyName, row.team?.name);
      await this.auditLog.log({
        accountId: user.id,
        actionType: 'update',
        entityType: 'recruitment_posting',
        entityId: id,
        fieldChanged: changed.join(', ').slice(0, 100),
        oldValue: statusChanged ? `${oldName}: ${existing.status}` : oldName,
        newValue: statusChanged ? `${newName}: ${row.status}` : newName,
      });
    }
    return toRecruitmentPostingResponse(row);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const scope = await this.resolveScope(user);
    const existing = await this.findInScope(id, scope);
    await this.prisma.recruitmentPosting.delete({ where: { id } });
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'delete',
      entityType: 'recruitment_posting',
      entityId: id,
      oldValue: this.logName(existing.companyName, existing.team?.name),
    });
  }

  /** Gán mọi thẻ CHƯA có nhóm (dữ liệu nhập sẵn từ sheet) cho 1 nhóm — chỉ người thấy mọi nhóm. */
  async assignUnassigned(
    teamId: string,
    user: AuthenticatedUser,
  ): Promise<{ moved: number }> {
    const scope = await this.resolveScope(user);
    if (!scope.all) {
      throw new ForbiddenException(
        'Bạn không có quyền gán nhóm hàng loạt cho Lịch tuyển',
      );
    }
    const team = await this.assertTeamExists(teamId);

    const [unassigned, taken] = await Promise.all([
      this.prisma.recruitmentPosting.findMany({
        where: { teamId: null },
        select: { companyName: true, kind: true },
      }),
      this.prisma.recruitmentPosting.findMany({
        where: { teamId },
        select: { companyName: true, kind: true },
      }),
    ]);
    const key = (p: { companyName: string; kind: string }) =>
      `${p.kind}|${p.companyName.toLowerCase()}`;
    const takenKeys = new Set(taken.map(key));
    const clash = unassigned.find((p) => takenKeys.has(key(p)));
    if (clash) {
      throw new ConflictException(
        `Nhóm ${team.name} đã có sẵn "${clash.companyName}" — xoá hoặc đổi tên thẻ trùng rồi gán lại`,
      );
    }

    const result = await this.prisma.recruitmentPosting.updateMany({
      where: { teamId: null },
      data: { teamId },
    });
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'recruitment_posting',
      fieldChanged: 'Nhóm',
      oldValue: `${result.count} thẻ chưa gán nhóm`,
      newValue: team.name,
    });
    return { moved: result.count };
  }

  private async resolveScope(user: AuthenticatedUser): Promise<Scope> {
    if (user.role === 'admin') return { all: true, teamId: null };
    const account = await this.prisma.account.findUnique({
      where: { id: user.id },
      select: { teamId: true, recruitmentTeamId: true },
    });
    if (account?.recruitmentTeamId) {
      return { all: false, teamId: account.recruitmentTeamId };
    }
    if (user.role === 'manager') return { all: true, teamId: null };
    return { all: false, teamId: account?.teamId ?? null };
  }

  /** Thẻ ngoài phạm vi báo "không tìm thấy" (không lộ thẻ nhóm khác có tồn tại). */
  private async findInScope(id: string, scope: Scope) {
    const existing = await this.prisma.recruitmentPosting.findUnique({
      where: { id },
      include: { team: { select: { name: true } } },
    });
    if (
      !existing ||
      (!scope.all && (!scope.teamId || existing.teamId !== scope.teamId))
    ) {
      throw new NotFoundException(
        'Không tìm thấy công ty này trong Lịch tuyển',
      );
    }
    return existing;
  }

  private async assertTeamExists(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });
    if (!team) throw new NotFoundException('Không tìm thấy nhóm này');
    return team;
  }

  private logName(companyName: string, teamName?: string | null): string {
    return teamName ? `${companyName} (${teamName})` : companyName;
  }

  private assertAgeRange(min?: number | null, max?: number | null): void {
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'Tuổi "từ" phải nhỏ hơn hoặc bằng tuổi "đến"',
      );
    }
  }

  /** Trong 1 nhóm, cùng loại (chính thức/thời vụ) không được có 2 thẻ trùng tên. */
  private async assertNameFree(
    companyName: string,
    kind: 'official' | 'seasonal',
    teamId: string | null,
    exceptId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.recruitmentPosting.findFirst({
      where: {
        companyName: { equals: companyName, mode: 'insensitive' },
        kind,
        teamId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `"${companyName}" đã có trong Lịch tuyển ${kind === 'official' ? 'chính thức' : 'thời vụ'} của nhóm này`,
      );
    }
  }

  /** Trùng tên với 1 Đơn hàng thì liên kết; không tự tạo Đơn hàng mới. */
  private async findOrderRecordId(companyName: string): Promise<string | null> {
    const order = await this.prisma.orderRecord.findFirst({
      where: { name: { equals: companyName, mode: 'insensitive' } },
      select: { id: true },
    });
    return order?.id ?? null;
  }

  /** DTO (snake_case) → dữ liệu Prisma; chuỗi rỗng thành null, bỏ trường không gửi. */
  private toData(dto: UpdateRecruitmentPostingDto): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [api, col] of FIELDS) {
      const value: unknown = dto[api];
      if (value === undefined) continue;
      data[col] =
        typeof value === 'string' ? value.trim() || null : (value ?? null);
    }
    if (Array.isArray(data.tags)) {
      data.tags = [
        ...new Set(
          (data.tags as string[]).map((t) => t.trim()).filter(Boolean),
        ),
      ];
    }
    for (const col of NOT_NULL_COLUMNS) {
      if (data[col] === null) delete data[col];
    }
    return data;
  }
}
