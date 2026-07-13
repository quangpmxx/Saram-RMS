import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Lead } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { UpdateDistributionRuleDto } from './dto/update-distribution-rule.dto';
import {
  DISTRIBUTION_RULE_INCLUDE,
  DistributionRuleResponseDto,
  toDistributionRuleResponse,
} from './dto/distribution-rule-response.dto';

/**
 * Mục 3, docs/09-business-specification.md + Mục 5, docs/13-api-design.md —
 * Phase 6: Tự động phân chia lead (Round-robin). Chỉ Leader (nhóm mình)
 * được cấu hình/kích hoạt/tạm dừng; GET thêm Quản lý/Admin (xem toàn bộ,
 * không giới hạn nhóm) — đúng theo bảng quyền đã chốt tại Mục 5, docs/13.
 */
@Injectable()
export class DistributionRuleService {
  private readonly logger = new Logger(DistributionRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getRule(
    teamId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DistributionRuleResponseDto> {
    await this.assertTeamExists(teamId);
    await this.assertCanView(teamId, currentUser);
    const rule = await this.loadRule(teamId);
    return toDistributionRuleResponse(teamId, rule);
  }

  /**
   * Mục 5, docs/13: "Cập nhật danh sách sale tham gia và thứ tự vòng quay" —
   * đóng vai trò tạo mới lẫn cập nhật (upsert), vì tài liệu không có API
   * tạo cấu hình riêng. Luôn reset con trỏ vòng quay về 0 sau khi đổi danh
   * sách/thứ tự — vị trí cũ có thể trỏ sai người sau khi danh sách đổi.
   */
  async updateRule(
    teamId: string,
    dto: UpdateDistributionRuleDto,
    currentUser: AuthenticatedUser,
  ): Promise<DistributionRuleResponseDto> {
    await this.assertTeamExists(teamId);
    await this.assertIsOwnTeamLeader(teamId, currentUser);

    if (dto.account_ids.length > 0) {
      const validAccounts = await this.prisma.account.findMany({
        where: { id: { in: dto.account_ids }, role: 'sale', teamId },
        select: { id: true },
      });
      if (validAccounts.length !== dto.account_ids.length) {
        throw new UnprocessableEntityException(
          'Danh sách chỉ được chứa tài khoản Sale thuộc đúng nhóm này',
        );
      }
    }

    const rule = await this.prisma.distributionRule.upsert({
      where: { teamId },
      create: {
        teamId,
        createdById: currentUser.id,
        isActive: false,
        lastAssignedPosition: 0,
      },
      update: { lastAssignedPosition: 0 },
    });

    await this.prisma.distributionMember.deleteMany({
      where: { ruleId: rule.id },
    });
    if (dto.account_ids.length > 0) {
      await this.prisma.distributionMember.createMany({
        data: dto.account_ids.map((accountId, index) => ({
          ruleId: rule.id,
          accountId,
          orderIndex: index,
        })),
      });
    }

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'distribution_rule',
      entityId: rule.id,
      fieldChanged: 'members',
      newValue: dto.account_ids.join(','),
    });

    return toDistributionRuleResponse(teamId, await this.loadRule(teamId));
  }

  /** Mục 5, docs/13: POST /distribution-rule/:teamId/activate — Leader (nhóm mình). */
  async activate(
    teamId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DistributionRuleResponseDto> {
    await this.assertTeamExists(teamId);
    await this.assertIsOwnTeamLeader(teamId, currentUser);

    const rule = await this.loadRule(teamId);
    if (!rule || rule.members.length === 0) {
      throw new UnprocessableEntityException(
        'Cần cấu hình ít nhất 1 Sale tham gia vòng quay trước khi kích hoạt',
      );
    }

    await this.prisma.distributionRule.update({
      where: { teamId },
      data: { isActive: true },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'distribution_rule',
      entityId: rule.id,
      fieldChanged: 'is_active',
      oldValue: 'false',
      newValue: 'true',
    });

    return toDistributionRuleResponse(teamId, await this.loadRule(teamId));
  }

  /** Mục 5, docs/13: POST /distribution-rule/:teamId/pause — Leader (nhóm mình). */
  async pause(
    teamId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DistributionRuleResponseDto> {
    await this.assertTeamExists(teamId);
    await this.assertIsOwnTeamLeader(teamId, currentUser);

    const rule = await this.loadRule(teamId);
    if (!rule) {
      throw new NotFoundException('Nhóm chưa có cấu hình tự động phân chia');
    }

    await this.prisma.distributionRule.update({
      where: { teamId },
      data: { isActive: false },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'distribution_rule',
      entityId: rule.id,
      fieldChanged: 'is_active',
      oldValue: 'true',
      newValue: 'false',
    });

    return toDistributionRuleResponse(teamId, await this.loadRule(teamId));
  }

  /**
   * Mục 3, docs/09 + Mục 9.2, docs/10 — gọi ngay khi 1 lead mới xuất hiện ở
   * trạng thái "Chờ phân chia" (từ POST /candidate hoặc import Excel). Nếu
   * có nhóm đang bật tự động phân chia với ít nhất 1 thành viên hợp lệ
   * (đang hoạt động, còn thuộc đúng nhóm — tự động bỏ qua Sale đã nghỉ
   * việc/vô hiệu hóa hoặc đã rời nhóm, xem Mục 11.9, docs/09 "chưa đề cập
   * trong nghiệp vụ" — quyết định bảo thủ, không gán việc cho tài khoản
   * không thể xử lý được), gán ngay theo đúng thứ tự vòng quay đã cấu hình.
   *
   * Nhiều nhóm cùng bật đồng thời KHÔNG được đặc tả trong tài liệu 09 (chỉ
   * mô tả đúng 1 nhóm). Xử lý theo thứ tự nhóm kích hoạt SỚM NHẤT trước
   * (updated_at tăng dần) để có hành vi xác định, không tùy tiện/ngẫu
   * nhiên — nếu công ty thực tế cần chạy song song nhiều nhóm tự động và
   * chia đều lead giữa các nhóm đó, đây là nghiệp vụ cần xác nhận thêm.
   *
   * Lead không nhóm nào xử lý được (không nhóm nào bật, hoặc bật nhưng
   * không còn thành viên hợp lệ) vẫn giữ nguyên "Chờ phân chia" như cũ.
   *
   * Đây là tác vụ PHỤ TRỢ trên đường tạo lead chính (POST /candidate, import
   * Excel) — tương tự AuditLogService, lỗi ở đây (kể cả lỗi hạ tầng CSDL
   * thoáng qua) KHÔNG được làm hỏng nghiệp vụ chính "tạo lead mới". Nuốt lỗi
   * và ghi cảnh báo thay vì ném ra ngoài; lead vẫn được tạo bình thường, chỉ
   * là không tự gán được lần này — vẫn còn "Chờ phân chia" để Leader chia
   * tay thủ công như cũ.
   */
  async tryAutoAssign(lead: Lead): Promise<Lead> {
    try {
      return await this.performAutoAssign(lead);
    } catch (error) {
      this.logger.error(
        `Tự động phân chia thất bại cho lead ${lead.id}, giữ nguyên "Chờ phân chia"`,
        error as Error,
      );
      return lead;
    }
  }

  private async performAutoAssign(lead: Lead): Promise<Lead> {
    if (lead.assignedToId) {
      return lead;
    }

    // Dự án phụ — nâng cấp toàn diện: SỬA LỖI nghiệp vụ — trước đây quét
    // TẤT CẢ quy tắc đang bật bất kể nhóm nào, có thể tự gán nhầm data của
    // nhóm A cho Sale nhóm B (quy tắc nhóm B chỉ tình cờ "cũ" hơn). Từ khi
    // up data (POST /candidate) bắt buộc chọn nhóm, CHỈ áp dụng đúng quy
    // tắc của nhóm data đó. Lead chưa có nhóm (vd nhập Excel — chưa sửa đợt
    // này) vẫn giữ hành vi cũ: quét mọi quy tắc đang bật.
    const activeRules = await this.prisma.distributionRule.findMany({
      where: lead.assignedTeamId
        ? { isActive: true, teamId: lead.assignedTeamId }
        : { isActive: true },
      include: DISTRIBUTION_RULE_INCLUDE,
      orderBy: { updatedAt: 'asc' },
    });

    for (const rule of activeRules) {
      const members = [...rule.members].sort(
        (a, b) => a.orderIndex - b.orderIndex,
      );
      if (members.length === 0) {
        continue;
      }

      const accounts = await this.prisma.account.findMany({
        where: { id: { in: members.map((member) => member.accountId) } },
        select: { id: true, status: true, teamId: true },
      });
      const accountById = new Map(
        accounts.map((account) => [account.id, account]),
      );

      let picked: { accountId: string; nextPosition: number } | null = null;
      for (let attempt = 0; attempt < members.length; attempt++) {
        const idx = (rule.lastAssignedPosition + attempt) % members.length;
        const candidate = members[idx];
        const account = accountById.get(candidate.accountId);
        if (
          account &&
          account.status === 'active' &&
          account.teamId === rule.teamId
        ) {
          picked = {
            accountId: candidate.accountId,
            nextPosition: (idx + 1) % members.length,
          };
          break;
        }
      }
      if (!picked) {
        continue;
      }

      const [updated] = await this.prisma.$transaction([
        this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            assignedToId: picked.accountId,
            assignedTeamId: rule.teamId,
            assignedAt: new Date(),
            assignmentMethod: 'auto',
          },
        }),
        this.prisma.distributionRule.update({
          where: { id: rule.id },
          data: { lastAssignedPosition: picked.nextPosition },
        }),
      ]);

      await this.auditLog.log({
        accountId: rule.createdById,
        actionType: 'assign',
        entityType: 'lead',
        entityId: lead.id,
        newValue: picked.accountId,
      });

      return updated;
    }

    return lead;
  }

  private async assertCanView(
    teamId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      return;
    }
    if (currentUser.role === 'leader') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      if (ownTeamId === teamId) {
        return;
      }
      throw new ForbiddenException('Bạn chỉ được xem cấu hình của nhóm mình');
    }
    throw new ForbiddenException(
      'Bạn không có quyền xem cấu hình tự động phân chia',
    );
  }

  private async assertIsOwnTeamLeader(
    teamId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role !== 'leader') {
      throw new ForbiddenException(
        'Chỉ Leader mới được cấu hình tự động phân chia',
      );
    }
    const ownTeamId = await this.getOwnTeamId(currentUser.id);
    if (ownTeamId !== teamId) {
      throw new ForbiddenException('Bạn chỉ được cấu hình cho nhóm mình');
    }
  }

  private async getOwnTeamId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return account?.teamId ?? null;
  }

  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }
  }

  private loadRule(teamId: string) {
    return this.prisma.distributionRule.findUnique({
      where: { teamId },
      include: DISTRIBUTION_RULE_INCLUDE,
    });
  }
}
