import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushSubscribeDto } from './dto/push-subscription.dto';
import { buildPushMessage, PushableNotification } from './push-message';

/**
 * Thông báo đẩy ra điện thoại/máy tính (Web Push, yêu cầu người dùng
 * 2026-11-06): nhận thông báo nổi kể cả khi đã tắt màn hình/đóng web.
 * Dùng dịch vụ đẩy miễn phí có sẵn của trình duyệt (Google/Apple/Mozilla),
 * xác thực bằng cặp khoá VAPID trong .env (VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, VAPID_SUBJECT). Thiếu khoá → tắt hẳn tính năng, không
 * ảnh hưởng gì khác.
 *
 * Mọi lỗi gửi đều chỉ ghi log — KHÔNG được làm hỏng luồng nghiệp vụ đang tạo
 * thông báo (gửi chạy nền, không await ở nơi gọi).
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'Chưa cấu hình VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY — tắt thông báo đẩy ra điện thoại',
      );
      return;
    }
    try {
      webpush.setVapidDetails(
        this.config.get<string>('VAPID_SUBJECT') ?? 'https://crm.saramvina.com',
        publicKey,
        privateKey,
      );
      this.publicKey = publicKey;
    } catch (error) {
      this.logger.error(`Khoá VAPID không hợp lệ: ${String(error)}`);
    }
  }

  /** Khoá công khai để trình duyệt đăng ký nhận thông báo; null = chưa bật tính năng. */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /** Lưu (hoặc chuyển chủ) 1 máy đăng ký nhận thông báo — 1 endpoint chỉ thuộc 1 tài khoản đang dùng máy đó. */
  async subscribe(
    accountId: string,
    dto: PushSubscribeDto,
    userAgent: string | undefined,
  ): Promise<void> {
    const data = {
      accountId,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent?.slice(0, 255) ?? null,
      lastUsedAt: new Date(),
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { endpoint: dto.endpoint, ...data },
      update: data,
    });
  }

  async unsubscribe(accountId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { accountId, endpoint },
    });
  }

  /** Đẩy 1 thông báo trong chuông ra mọi máy đã bật của người nhận — chạy nền, không chờ. */
  notify(accountId: string, notification: PushableNotification): void {
    if (!this.publicKey) return;
    void this.deliver(accountId, notification).catch((error) =>
      this.logger.warn(`Gửi thông báo đẩy thất bại: ${String(error)}`),
    );
  }

  private async deliver(
    accountId: string,
    notification: PushableNotification,
  ): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { accountId },
    });
    if (subscriptions.length === 0) return;
    const payload = JSON.stringify(buildPushMessage(notification));

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            // Máy đang ngủ/tắt mạng: giữ tối đa 10 phút rồi bỏ — trước giữ 1
            // ngày nên bật máy lên nhận cả loạt dồn 1 lúc (2026-11-09). Thông
            // báo bị bỏ vẫn còn trong chuông trên web.
            { TTL: 10 * 60, urgency: 'high' },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410: máy đã gỡ app/thu hồi quyền → xoá, không gửi nữa.
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.deleteMany({
              where: { id: sub.id },
            });
            return;
          }
          this.logger.warn(
            `Gửi thông báo đẩy tới 1 máy thất bại (status=${status ?? '-'}): ${String(error)}`,
          );
        }
      }),
    );
  }
}
