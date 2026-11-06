import { ValidationPipe } from '@nestjs/common';
import * as webpush from 'web-push';
import { PushSubscribeDto } from './dto/push-subscription.dto';
import { buildPushMessage } from './push-message';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('buildPushMessage — chữ + trang mở khớp chuông thông báo', () => {
  it('có nội dung → tiêu đề = loại, thân = nội dung, mở trang data', () => {
    expect(
      buildPushMessage({
        id: 'n1',
        type: 'lead_assigned',
        content: 'Bạn được chia data "A" (0901)',
        lead_id: 'lead-1',
      }),
    ).toEqual({
      title: 'Được chia data',
      body: 'Bạn được chia data "A" (0901)',
      url: '/candidates/lead-1',
      tag: 'n1',
    });
  });

  it('không có nội dung → thân = tên loại; đơn nghỉ phép mở tab đơn', () => {
    expect(
      buildPushMessage({
        id: 'n2',
        type: 'leave_request_decided',
        content: null,
        leave_request_id: 'lr-1',
      }),
    ).toMatchObject({
      title: 'Saram CRM',
      body: 'Kết quả đơn xin nghỉ phép',
      url: '/attendance?tab=requests&open=lr-1',
    });
  });
});

describe('PushService', () => {
  const sendNotification = webpush.sendNotification as jest.Mock;

  function build(env: Record<string, string | undefined>) {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', endpoint: 'https://push/1', p256dh: 'k1', auth: 'a1' },
          { id: 's2', endpoint: 'https://push/2', p256dh: 'k2', auth: 'a2' },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
      },
    };
    const config = { get: (key: string) => env[key] };
    const service = new PushService(prisma as never, config as never);
    service.onModuleInit();
    return { service, prisma };
  }

  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => sendNotification.mockReset());

  it('chưa cấu hình khoá VAPID → tắt hẳn, không gửi gì', async () => {
    const { service, prisma } = build({});
    expect(service.getPublicKey()).toBeNull();
    service.notify('acc-1', { id: 'n1' });
    await flush();
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('gửi tới mọi máy của người nhận; máy báo 410 (đã gỡ) → tự xoá', async () => {
    const { service, prisma } = build({
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
    });
    sendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        Object.assign(new Error('gone'), { statusCode: 410 }),
      );

    service.notify('acc-1', {
      id: 'n1',
      type: 'admin_message',
      content: 'Họp 3h',
    });
    await flush();
    await flush();

    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { accountId: 'acc-1' },
    });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: 's2' },
    });
  });

  it('lỗi gửi khác (vd 500) → chỉ ghi log, không xoá, không ném lỗi ra ngoài', async () => {
    const { service, prisma } = build({
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
    });
    sendNotification.mockRejectedValue(
      Object.assign(new Error('boom'), { statusCode: 500 }),
    );
    expect(() => service.notify('acc-1', { id: 'n1' })).not.toThrow();
    await flush();
    await flush();
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PushSubscribeDto — đúng dạng PushSubscription.toJSON() của trình duyệt', () => {
  it('nhận cả expirationTime: null (trình duyệt luôn gửi kèm)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
    await expect(
      pipe.transform(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
          expirationTime: null,
          keys: { p256dh: 'BPk', auth: 'xyz' },
        },
        { type: 'body', metatype: PushSubscribeDto },
      ),
    ).resolves.toBeDefined();
  });
});
