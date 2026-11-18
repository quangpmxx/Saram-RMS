import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WEBSITE_TEXT_KEY_PATTERN,
  WebsiteTextItemDto,
} from './dto/save-website-texts.dto';

/**
 * Chữ sửa tại chỗ trên trang web công ty (2026-11-16).
 * 2026-11-18: mỗi lần lưu / về bản gốc ghi lịch sử (website_text_history) trong cùng giao dịch.
 */
@Injectable()
export class WebsiteService {
  constructor(private readonly prisma: PrismaService) {}

  /** Toàn bộ chữ đã sửa, dạng { mã: chữ } — trang web gộp với chữ gốc. */
  async getTexts(): Promise<Record<string, string>> {
    const rows = await this.prisma.websiteText.findMany({
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Lưu nhiều đoạn một lần (một giao dịch); chỉ ghi lịch sử chỗ thật sự đổi. */
  async saveTexts(items: WebsiteTextItemDto[], accountId: string) {
    const keys = new Set(items.map((i) => i.key));
    if (keys.size !== items.length) {
      throw new BadRequestException('Có đoạn chữ bị gửi trùng');
    }
    await this.prisma.$transaction(async (tx) => {
      const old = await tx.websiteText.findMany({
        where: { key: { in: [...keys] } },
        select: { key: true, value: true },
      });
      const oldByKey = new Map(old.map((o) => [o.key, o.value]));
      const changed = items.filter((i) => oldByKey.get(i.key) !== i.value);
      for (const i of changed) {
        await tx.websiteText.upsert({
          where: { key: i.key },
          create: { key: i.key, value: i.value, updatedById: accountId },
          update: { value: i.value, updatedById: accountId },
        });
      }
      if (changed.length > 0) {
        await tx.websiteTextHistory.createMany({
          data: changed.map((i) => ({
            key: i.key,
            oldValue: oldByKey.get(i.key) ?? null,
            newValue: i.value,
            accountId,
          })),
        });
      }
    });
    return { saved: items.length };
  }

  /** Về chữ gốc: xoá bản đã sửa (có ghi lịch sử nếu đang có bản sửa). */
  async resetText(key: string, accountId?: string) {
    if (!WEBSITE_TEXT_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Mã đoạn chữ không hợp lệ');
    }
    await this.prisma.$transaction(async (tx) => {
      const old = await tx.websiteText.findUnique({ where: { key } });
      if (!old) return;
      await tx.websiteText.delete({ where: { key } });
      await tx.websiteTextHistory.create({
        data: {
          key,
          oldValue: old.value,
          newValue: null,
          accountId: accountId ?? null,
        },
      });
    });
    return { reset: key };
  }

  /** Lịch sử sửa gần nhất (mới nhất trước), kèm tên người sửa. */
  async listHistory(limit = 100) {
    const take = Math.min(Math.max(limit, 1), 300);
    const rows = await this.prisma.websiteTextHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    const ids = [
      ...new Set(rows.map((r) => r.accountId).filter((v): v is string => !!v)),
    ];
    const accounts = ids.length
      ? await this.prisma.account.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameById = new Map(accounts.map((a) => [a.id, a.fullName]));
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      old_value: r.oldValue,
      new_value: r.newValue,
      account_name: r.accountId ? (nameById.get(r.accountId) ?? null) : null,
      created_at: r.createdAt,
    }));
  }

  /** Quay về giá trị trước của một lần sửa (null = về bản gốc). */
  async restoreHistory(id: string, accountId: string) {
    const row = await this.prisma.websiteTextHistory.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Không tìm thấy lần sửa này');
    if (row.oldValue === null) return this.resetText(row.key, accountId);
    await this.saveTexts([{ key: row.key, value: row.oldValue }], accountId);
    return { restored: row.key };
  }
}
