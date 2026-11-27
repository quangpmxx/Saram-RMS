import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { can } from '../common/permissions/capability-catalog';
import { vnDateOnly, vnDayRange } from '../care-warehouse/care-time.util';
import { CALLBACK_DONE_WINDOW_MIN, dailyOccurrences } from './calendar.service';

export interface MissedBySale {
  name: string;
  missed: number;
  deleted: number;
}

/** Nội dung chuông: "Hôm nay 4 lịch gọi lại chưa gọi: A 3 (1 đã xoá) · B 1". */
export function missedReportMessage(rows: MissedBySale[]): string {
  const total = rows.reduce((s, r) => s + r.missed, 0);
  const parts = rows.map(
    (r) => `${r.name} ${r.missed}${r.deleted ? ` (${r.deleted} đã xoá)` : ''}`,
  );
  return `Hôm nay ${total} lịch gọi lại chưa gọi: ${parts.join(' · ')}`;
}

/**
 * Báo cáo 22h (2026-11-27, yêu cầu người dùng): Sale nào có lịch gọi lại hôm nay mà bỏ quên —
 * không có ghi chú nào trên data trong 30 phút kể từ giờ hẹn. Tính CẢ lịch đã xoá (tránh xoá để
 * giấu). Gửi chuông cho người có quyền calendar.view_deleted (mặc định Admin + Quản lý).
 * Không ai quên → không gửi.
 */
@Injectable()
export class CallbackMissedReportService {
  private readonly logger = new Logger(CallbackMissedReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  @Cron('0 22 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async tick(): Promise<void> {
    try {
      const r = await this.run();
      this.logger.log(
        `Báo cáo quên gọi lại: ${r.rows.length} Sale, gửi ${r.notified} người`,
      );
    } catch (e) {
      this.logger.error('Báo cáo quên gọi lại thất bại', e as Error);
    }
  }

  /** Lịch bị quên hôm nay (giờ VN), theo người đặt lịch. */
  async missedToday(now = new Date()): Promise<MissedBySale[]> {
    const { start, end } = vnDayRange(vnDateOnly(now));
    const windowMs = CALLBACK_DONE_WINDOW_MIN * 60 * 1000;
    const callbacks = await this.prisma.callbackSchedule.findMany({
      where: {
        lead: { deletedAt: null },
        OR: [
          { repeatDaily: false, scheduledAt: { gte: start, lt: end } },
          { repeatDaily: true, isCompleted: false, scheduledAt: { lt: end } },
        ],
      },
      select: {
        leadId: true,
        scheduledAt: true,
        repeatDaily: true,
        deletedAt: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    // Mỗi lần hẹn hôm nay đã quá 30 phút (còn trong 30 phút thì chưa tính).
    const items = callbacks.flatMap((c) =>
      (c.repeatDaily
        ? dailyOccurrences(c.scheduledAt, start, new Date(end.getTime() - 1))
        : [c.scheduledAt]
      )
        .filter((at) => at.getTime() + windowMs <= now.getTime())
        // Lịch "Mỗi ngày" xoá trước giờ hẹn hôm nay thì hôm nay không còn lịch.
        .filter((at) => !c.repeatDaily || !c.deletedAt || at <= c.deletedAt)
        .map((at) => ({ ...c, at })),
    );
    if (!items.length) return [];
    const notes = await this.prisma.leadNote.findMany({
      where: {
        leadId: { in: [...new Set(items.map((i) => i.leadId))] },
        deletedAt: null,
        createdAt: { gte: start, lte: new Date(end.getTime() + windowMs) },
      },
      select: { leadId: true, createdAt: true },
    });
    const bySale = new Map<string, MissedBySale>();
    for (const i of items) {
      const t = i.at.getTime();
      const called = notes.some(
        (n) =>
          n.leadId === i.leadId &&
          n.createdAt.getTime() >= t &&
          n.createdAt.getTime() <= t + windowMs,
      );
      if (called) continue;
      const row = bySale.get(i.createdBy.id) ?? {
        name: i.createdBy.fullName,
        missed: 0,
        deleted: 0,
      };
      row.missed += 1;
      if (i.deletedAt) row.deleted += 1;
      bySale.set(i.createdBy.id, row);
    }
    return [...bySale.values()].sort((a, b) => b.missed - a.missed);
  }

  async run(
    now = new Date(),
  ): Promise<{ rows: MissedBySale[]; notified: number }> {
    const rows = await this.missedToday(now);
    if (!rows.length) return { rows, notified: 0 };
    const accounts = await this.prisma.account.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        role: true,
        capabilityOverrides: { select: { code: true, granted: true } },
      },
    });
    const recipients = accounts.filter((a) =>
      can(
        {
          role: a.role,
          capabilityOverrides: Object.fromEntries(
            a.capabilityOverrides.map((o) => [o.code, o.granted]),
          ),
        },
        'calendar.view_deleted',
      ),
    );
    const { start } = vnDayRange(vnDateOnly(now));
    const content = missedReportMessage(rows);
    let notified = 0;
    for (const r of recipients) {
      // Mỗi ngày 1 lần (khởi động lại máy chủ / chạy tay không gửi trùng).
      const already = await this.prisma.notification.findFirst({
        where: {
          accountId: r.id,
          type: 'callback_missed_report',
          createdAt: { gte: start },
        },
        select: { id: true },
      });
      if (already) continue;
      const created = await this.prisma.notification.create({
        data: {
          accountId: r.id,
          type: 'callback_missed_report',
          channel: 'in_app',
          content,
          meta: { link: '/calendar' },
          scheduledAt: now,
          sentAt: now,
          status: 'sent',
        },
      });
      this.realtime.emitNotificationCreated(
        toNotificationResponse(created),
        null,
      );
      notified += 1;
    }
    return { rows, notified };
  }
}
