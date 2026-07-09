import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { toAccountResponse } from '../accounts/dto/account-response.dto';
import { TeamResponseDto, toTeamResponse } from './dto/team-response.dto';
import { TeamMemberResponseDto } from './dto/team-member-response.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';

const LEADER_SELECT = { id: true, fullName: true } as const;
const TEAM_INCLUDE = {
  leader: { select: LEADER_SELECT },
  _count: { select: { members: true } },
} as const;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Mục 3, docs/13: Admin/Quản lý xem tất cả; Leader chỉ xem nhóm mình. */
  async list(
    query: ListTeamsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<TeamResponseDto>> {
    const where: Prisma.TeamWhereInput = {};

    if (currentUser.role === 'leader') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      where.id = ownTeamId ?? '__none__';
    }

    const [total, teams] = await this.prisma.$transaction([
      this.prisma.team.count({ where }),
      this.prisma.team.findMany({
        where,
        include: TEAM_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: teams.map(toTeamResponse),
    };
  }

  async create(dto: CreateTeamDto, actorId: string): Promise<TeamResponseDto> {
    if (dto.leader_id) {
      await this.assertAccountIsLeader(dto.leader_id);
    }

    try {
      const team = await this.prisma.team.create({
        data: { name: dto.name, leaderId: dto.leader_id },
        include: TEAM_INCLUDE,
      });

      await this.auditLog.log({
        accountId: actorId,
        actionType: 'create',
        entityType: 'team',
        entityId: team.id,
        newValue: team.name,
      });

      return toTeamResponse(team);
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateTeamDto,
    actorId: string,
  ): Promise<TeamResponseDto> {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    if (dto.leader_id) {
      await this.assertAccountIsLeader(dto.leader_id);
    }

    try {
      const team = await this.prisma.team.update({
        where: { id },
        data: {
          name: dto.name,
          leaderId: dto.leader_id === undefined ? undefined : dto.leader_id,
        },
        include: TEAM_INCLUDE,
      });

      if (dto.leader_id !== undefined && dto.leader_id !== existing.leaderId) {
        await this.auditLog.log({
          accountId: actorId,
          actionType: 'update',
          entityType: 'team',
          entityId: id,
          fieldChanged: 'leader_id',
          oldValue: existing.leaderId ?? undefined,
          newValue: dto.leader_id ?? undefined,
        });
      }

      return toTeamResponse(team);
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  /**
   * Mục 3, docs/13: danh sách nhân viên (Sale) trong nhóm kèm khối lượng lead
   * đang phụ trách. `assigned_count` có dữ liệu thật từ Phase 2 (đếm số
   * `leads.assigned_to` chưa xóa mềm); `care_pool_count` luôn 0 tới khi
   * Phase 5 dựng cột chăm sóc.
   */
  async getMembers(
    teamId: string,
    currentUser: AuthenticatedUser,
  ): Promise<TeamMemberResponseDto[]> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    if (currentUser.role === 'leader') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      if (ownTeamId !== teamId) {
        throw new ForbiddenException('Bạn chỉ được xem nhóm của mình');
      }
    }

    const members = await this.prisma.account.findMany({
      where: { teamId, role: 'sale' },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { fullName: 'asc' },
    });

    const workload = await this.prisma.lead.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { in: members.map((member) => member.id) },
        deletedAt: null,
      },
      _count: { _all: true },
    });
    const assignedCountByAccountId = new Map(
      workload.map((row) => [row.assignedToId, row._count._all]),
    );

    return members.map((member) => ({
      ...toAccountResponse(member),
      assigned_count: assignedCountByAccountId.get(member.id) ?? 0,
      care_pool_count: 0,
    }));
  }

  private async getOwnTeamId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return account?.teamId ?? null;
  }

  private async assertAccountIsLeader(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản leader_id');
    }
    if (account.role !== 'leader') {
      throw new UnprocessableEntityException(
        'Tài khoản được gán làm leader phải có vai trò leader',
      );
    }
  }

  private mapKnownError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Tài khoản này đã là leader của một nhóm khác',
      );
    }
    return error as Error;
  }
}
