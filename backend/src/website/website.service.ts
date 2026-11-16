import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WEBSITE_TEXT_KEY_PATTERN,
  WebsiteTextItemDto,
} from './dto/save-website-texts.dto';

/** Chữ sửa tại chỗ trên trang web công ty (2026-11-16). */
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

  /** Lưu nhiều đoạn một lần (một giao dịch). */
  async saveTexts(items: WebsiteTextItemDto[], accountId: string) {
    const keys = new Set(items.map((i) => i.key));
    if (keys.size !== items.length) {
      throw new BadRequestException('Có đoạn chữ bị gửi trùng');
    }
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.websiteText.upsert({
          where: { key: i.key },
          create: { key: i.key, value: i.value, updatedById: accountId },
          update: { value: i.value, updatedById: accountId },
        }),
      ),
    );
    return { saved: items.length };
  }

  /** Về chữ gốc: xoá bản đã sửa. */
  async resetText(key: string) {
    if (!WEBSITE_TEXT_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Mã đoạn chữ không hợp lệ');
    }
    await this.prisma.websiteText.deleteMany({ where: { key } });
    return { reset: key };
  }
}
