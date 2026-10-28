import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateAnonymousFeedbackDto } from './dto/create-anonymous-feedback.dto';
import { ListAnonymousFeedbackQueryDto } from './dto/list-anonymous-feedback-query.dto';
import {
  ANONYMOUS_FEEDBACK_PUBLIC_SELECT,
  AnonymousFeedbackResponseDto,
  toAnonymousFeedbackResponse,
} from './dto/anonymous-feedback-response.dto';

/** Chỉ Quản lý/Admin xem đơn; mọi vai trò còn lại (nhân viên + Leader) được gửi. */
const VIEW_ROLES = new Set(['admin', 'manager']);

/**
 * Đơn phản ánh ẩn danh (2026-10-28, yêu cầu trực tiếp người dùng).
 *
 * Nguyên tắc ẩn danh đã chốt: người gửi ĐƯỢC lưu trong DB (sender_id) nhưng
 * KHÔNG lộ ra ở bất kỳ đâu Quản lý/Admin nhìn thấy được:
 * - API trả đơn chỉ chọn ANONYMOUS_FEEDBACK_PUBLIC_SELECT (không có sender).
 * - Thông báo cho Quản lý/Admin để sender_id = null.
 * - Sự kiện realtime phát với actor = null.
 * - KHÔNG ghi audit_logs (trang Nhật ký của Admin hiện người thao tác) và
 *   không ghi log có thông tin người gửi.
 * - Người gửi cũng không xem lại được đơn đã gửi (không có API cho họ).
 */
@Injectable()
export class AnonymousFeedbackService {
  private readonly logger = new Logger(AnonymousFeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    dto: CreateAnonymousFeedbackDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    if (VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Quản lý/Admin là người nhận đơn phản ánh, không gửi đơn',
      );
    }
    const subject = dto.subject.trim();
    const content = dto.content.trim();
    if (!subject || !content) {
      throw new BadRequestException(
        'Vui lòng nhập đủ tiêu đề và nội dung phản ánh',
      );
    }

    const created = await this.prisma.anonymousFeedback.create({
      data: { senderId: currentUser.id, subject, content },
      select: { id: true, subject: true },
    });

    await this.notifyViewers(created.id, created.subject);
    return { message: 'Đã gửi đơn phản ánh ẩn danh' };
  }

  async list(
    query: ListAnonymousFeedbackQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<AnonymousFeedbackResponseDto[]> {
    this.assertViewer(currentUser);
    const where: Prisma.AnonymousFeedbackWhereInput = {};
    if (query.date_from || query.date_to) {
      where.createdAt = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }
    const rows = await this.prisma.anonymousFeedback.findMany({
      where,
      select: ANONYMOUS_FEEDBACK_PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAnonymousFeedbackResponse);
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<AnonymousFeedbackResponseDto> {
    this.assertViewer(currentUser);
    const row = await this.prisma.anonymousFeedback.findUnique({
      where: { id },
      select: ANONYMOUS_FEEDBACK_PUBLIC_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy đơn phản ánh');
    return toAnonymousFeedbackResponse(row);
  }

  private assertViewer(currentUser: AuthenticatedUser): void {
    if (!VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Chỉ Quản lý/Admin xem được đơn phản ánh');
    }
  }

  /**
   * Báo chuông cho mọi Quản lý/Admin đang hoạt động. sender_id = null và
   * actor = null — tuyệt đối không gắn thông tin người gửi. Lỗi gửi thông
   * báo không làm hỏng việc gửi đơn (đơn đã lưu).
   */
  private async notifyViewers(feedbackId: string, subject: string) {
    try {
      const viewers = await this.prisma.account.findMany({
        where: { role: { in: ['admin', 'manager'] }, status: 'active' },
        select: { id: true },
      });
      const now = new Date();
      const content = `Có đơn phản ánh ẩn danh mới: ${subject}`.slice(0, 500);
      for (const viewer of viewers) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId: viewer.id,
            type: 'anonymous_feedback_created',
            channel: 'in_app',
            content,
            senderId: null,
            scheduledAt: now,
            sentAt: now,
            status: 'sent',
          },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true, avatarUrl: true },
            },
          },
        });
        this.realtime.emitNotificationCreated(
          toNotificationResponse(notification),
          null,
        );
      }
    } catch (error) {
      // Chỉ ghi id đơn — không ghi người gửi.
      this.logger.error(
        `Gửi thông báo đơn phản ánh ẩn danh thất bại (feedback=${feedbackId})`,
        error as Error,
      );
    }
  }
}
