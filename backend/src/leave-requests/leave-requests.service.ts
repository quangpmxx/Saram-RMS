import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveRequestDecisionDto } from './dto/leave-request-decision.dto';
import { ListLeaveRequestQueryDto } from './dto/list-leave-request-query.dto';
import {
  LEAVE_REQUEST_INCLUDE,
  LeaveRequestResponseDto,
  toLeaveRequestResponse,
} from './dto/leave-request-response.dto';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới "Tạo đơn"): Sale/MKT/Leader được tạo đơn xin
 * nghỉ phép. Leader tạo đơn cho CHÍNH MÌNH thì tự động là "Leader phụ
 * trách" của chính đơn đó (Team.leaderId === chính họ) — logic
 * pending_leader/leaderDecide() bên dưới KHÔNG cần đổi gì thêm, tự nhiên
 * cho phép Leader tự duyệt bước của mình rồi mới chuyển tiếp Admin.
 * Admin/Quản lý vẫn KHÔNG tạo đơn — không phải "nhân viên".
 */
const CREATE_ROLES = new Set(['mkt', 'sale', 'leader']);

/** "YYYY-MM-DD" -> Date UTC nửa đêm — đủ dùng cho cột @db.Date, không cần theo timezone hệ thống vì đây là NGÀY LỊCH đơn thuần (không phải mốc "hôm nay" như attendance/checkin). */
function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Mục yêu cầu người dùng: "Ấn gửi đơn thì leader sẽ nhận được thông báo
   * cần duyệt" — nhân viên KHÔNG thuộc nhóm nào, hoặc nhóm chưa có Leader,
   * thì bỏ qua bước Leader (không có ai để duyệt), lên thẳng Admin.
   */
  async create(
    dto: CreateLeaveRequestDto,
    currentUser: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    if (!CREATE_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Vai trò của bạn không tạo được đơn xin nghỉ phép',
      );
    }

    const startDate = dateOnlyToUtcMidnight(dto.start_date);
    const endDate = dateOnlyToUtcMidnight(dto.end_date);
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu',
      );
    }
    const daysCount =
      Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

    const account = await this.prisma.account.findUnique({
      where: { id: currentUser.id },
      include: { team: true },
    });
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const hasLeader = Boolean(account.team?.leaderId);
    const status = hasLeader ? 'pending_leader' : 'pending_admin';

    const created = await this.prisma.leaveRequest.create({
      data: {
        accountId: currentUser.id,
        recipientText: dto.recipient_text?.trim() || 'Ban Giám đốc / Quản lý',
        startDate,
        endDate,
        daysCount,
        reason: dto.reason.trim(),
        handoverTo: dto.handover_to.trim(),
        status,
      },
      include: LEAVE_REQUEST_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'leave_request',
      entityId: created.id,
      newValue: `${dto.start_date} -> ${dto.end_date} (${daysCount} ngày)`,
    });

    if (hasLeader && account.team) {
      await this.notify(
        [account.team.leaderId!],
        'leave_request_pending_leader',
        created.id,
        `${account.fullName} gửi đơn xin nghỉ phép ${daysCount} ngày, cần bạn duyệt`,
        currentUser,
      );
    } else {
      await this.notifyAdmins(
        created.id,
        `${account.fullName} gửi đơn xin nghỉ phép ${daysCount} ngày, cần bạn duyệt`,
        currentUser,
      );
    }

    return toLeaveRequestResponse(created);
  }

  /**
   * Mục yêu cầu người dùng: phạm vi xem — Sale/MKT chỉ đơn của chính mình;
   * Leader xem đơn của thành viên nhóm mình; Admin/Quản lý xem toàn bộ
   * (Quản lý CHỈ xem — không có quyền duyệt, khớp đúng nguyên văn yêu cầu
   * "leader duyệt xong... chuyển cho ADMIN duyệt tiếp", không nhắc Quản lý).
   */
  async list(
    query: ListLeaveRequestQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto[]> {
    const where: Prisma.LeaveRequestWhereInput = {};
    if (query.status_filter && query.status_filter !== 'all') {
      where.status = query.status_filter;
    }
    if (query.date_from || query.date_to) {
      where.createdAt = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }

    if (currentUser.role === 'sale' || currentUser.role === 'mkt') {
      where.accountId = currentUser.id;
    } else if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      where.account = { teamId: account?.teamId ?? '__none__' };
    } else if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      throw new ForbiddenException('Bạn không có quyền xem đơn xin nghỉ phép');
    }

    const requests = await this.prisma.leaveRequest.findMany({
      where,
      include: LEAVE_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(toLeaveRequestResponse);
  }

  async getById(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.findOwnedOrScoped(id, currentUser);
    return toLeaveRequestResponse(request);
  }

  /** Mục yêu cầu người dùng: "leader duyệt xong sẽ hiện đã duyệt... chuyển cho admin duyệt tiếp". */
  async leaderDecide(
    id: string,
    dto: LeaveRequestDecisionDto,
    currentUser: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    if (currentUser.role !== 'leader') {
      throw new ForbiddenException('Chỉ Leader được duyệt bước này');
    }

    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { account: { include: { team: true } } },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn xin nghỉ phép');
    }
    if (request.status !== 'pending_leader') {
      throw new BadRequestException(
        'Đơn này không ở trạng thái chờ Leader duyệt',
      );
    }
    if (request.account.team?.leaderId !== currentUser.id) {
      throw new ForbiddenException(
        'Bạn chỉ được duyệt đơn của thành viên trong nhóm mình',
      );
    }

    const nextStatus =
      dto.decision === 'approved' ? 'pending_admin' : 'rejected';
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        leaderDecision: dto.decision,
        leaderDecisionById: currentUser.id,
        leaderDecisionAt: new Date(),
        leaderNote: dto.note?.trim() || undefined,
      },
      include: LEAVE_REQUEST_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: dto.decision === 'approved' ? 'update' : 'reject',
      entityType: 'leave_request',
      entityId: id,
      fieldChanged: 'leader_decision',
      newValue: dto.decision,
    });

    if (dto.decision === 'approved') {
      await this.notifyAdmins(
        id,
        `Đơn xin nghỉ phép của ${request.account.fullName} đã qua Leader duyệt, cần bạn duyệt tiếp`,
        currentUser,
      );
    } else {
      await this.notify(
        [request.accountId],
        'leave_request_decided',
        id,
        `Đơn xin nghỉ phép của bạn đã bị Leader từ chối${dto.note ? `: ${dto.note.trim()}` : ''}`,
        currentUser,
      );
    }

    return toLeaveRequestResponse(updated);
  }

  /** Mục yêu cầu người dùng: bước duyệt cuối cùng — CHỈ Admin. */
  async adminDecide(
    id: string,
    dto: LeaveRequestDecisionDto,
    currentUser: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException('Chỉ Admin được duyệt bước này');
    }

    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn xin nghỉ phép');
    }
    if (request.status !== 'pending_admin') {
      throw new BadRequestException(
        'Đơn này không ở trạng thái chờ Admin duyệt',
      );
    }

    const nextStatus = dto.decision === 'approved' ? 'approved' : 'rejected';
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        adminDecision: dto.decision,
        adminDecisionById: currentUser.id,
        adminDecisionAt: new Date(),
        adminNote: dto.note?.trim() || undefined,
      },
      include: LEAVE_REQUEST_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: dto.decision === 'approved' ? 'update' : 'reject',
      entityType: 'leave_request',
      entityId: id,
      fieldChanged: 'admin_decision',
      newValue: dto.decision,
    });

    await this.notify(
      [request.accountId],
      'leave_request_decided',
      id,
      dto.decision === 'approved'
        ? 'Đơn xin nghỉ phép của bạn đã được duyệt'
        : `Đơn xin nghỉ phép của bạn đã bị Admin từ chối${dto.note ? `: ${dto.note.trim()}` : ''}`,
      currentUser,
    );

    return toLeaveRequestResponse(updated);
  }

  private async findOwnedOrScoped(id: string, currentUser: AuthenticatedUser) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_INCLUDE,
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn xin nghỉ phép');
    }

    if (currentUser.role === 'sale' || currentUser.role === 'mkt') {
      if (request.accountId !== currentUser.id) {
        throw new ForbiddenException('Bạn chỉ được xem đơn của chính mình');
      }
    } else if (currentUser.role === 'leader') {
      const [leaderAccount, requestAccount] = await Promise.all([
        this.prisma.account.findUnique({ where: { id: currentUser.id } }),
        this.prisma.account.findUnique({ where: { id: request.accountId } }),
      ]);
      if (
        !leaderAccount?.teamId ||
        requestAccount?.teamId !== leaderAccount.teamId
      ) {
        throw new ForbiddenException(
          'Bạn chỉ được xem đơn của thành viên trong nhóm mình',
        );
      }
    } else if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      throw new ForbiddenException('Bạn không có quyền xem đơn xin nghỉ phép');
    }

    return request;
  }

  private async notifyAdmins(
    leaveRequestId: string,
    content: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const admins = await this.prisma.account.findMany({
      where: { role: 'admin', status: 'active' },
      select: { id: true },
    });
    await this.notify(
      admins.map((a) => a.id),
      'leave_request_pending_admin',
      leaveRequestId,
      content,
      currentUser,
    );
  }

  private async notify(
    accountIds: string[],
    type:
      | 'leave_request_pending_leader'
      | 'leave_request_pending_admin'
      | 'leave_request_decided',
    leaveRequestId: string,
    content: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (accountIds.length === 0) return;
    try {
      const now = new Date();
      const senderId = currentUser.id;
      await this.prisma.notification.createMany({
        data: accountIds.map((accountId) => ({
          accountId,
          leaveRequestId,
          type,
          channel: 'in_app' as const,
          content,
          senderId,
          scheduledAt: now,
          sentAt: now,
          status: 'sent' as const,
        })),
      });

      // createMany() không trả lại các dòng vừa tạo — truy vấn lại đúng lô
      // vừa ghi bằng (leaveRequestId, type, scheduledAt) — đủ định danh (1
      // bước duyệt chỉ kích hoạt notify() đúng 1 lần cho đúng type đó).
      const created = await this.prisma.notification.findMany({
        where: {
          accountId: { in: accountIds },
          leaveRequestId,
          type,
          scheduledAt: now,
        },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, avatarUrl: true },
          },
        },
      });
      for (const notification of created) {
        this.realtime.emitNotificationCreated(
          toNotificationResponse(notification),
          currentUser,
        );
      }
    } catch (error) {
      this.logger.error(
        `Gửi thông báo đơn xin nghỉ phép thất bại (leave_request=${leaveRequestId})`,
        error as Error,
      );
    }
  }
}
