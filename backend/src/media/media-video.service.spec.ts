import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MediaVideoService } from './media-video.service';
import { MediaService } from './media.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import type { AccountRole } from '../../generated/prisma/enums';

/** Sổ video (2026-11-14): ai được thêm/sửa dòng, khi nào được chuyển "Xong". */
describe('MediaVideoService', () => {
  let prisma: Record<string, Record<string, jest.Mock>> & {
    $transaction: jest.Mock;
  };
  let service: MediaVideoService;

  const user = (
    role: AccountRole,
    id: string,
    caps?: Record<string, boolean>,
  ): AuthenticatedUser => ({
    id,
    role,
    sessionId: 's',
    capabilityOverrides: caps,
  });
  const staff = user('media_staff', 'staff-1');
  const leader = user('media_staff', 'lead-1', { 'media.assign': true });

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'v1',
    code: 3,
    title: 'Video 08/08',
    type: 'video',
    status: 'todo',
    progress: 0,
    assigneeId: 'staff-1',
    editorId: null,
    createdById: 'staff-1',
    doneLink: null,
    rawLink: null,
    description: null,
    workDate: new Date('2026-08-08'),
    createdAt: new Date('2026-08-08T03:00:00Z'),
    members: [],
    contentGroup: null,
    publications: [],
    campaignId: null,
    companyId: null,
    factory: null,
    ...over,
  });

  beforeEach(() => {
    const model = () => ({
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'v1', code: 3 }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    });
    prisma = {
      account: model(),
      mediaTask: model(),
      mediaTaskActivity: model(),
      mediaPublication: model(),
      mediaChannel: model(),
      notification: model(),
      $transaction: jest.fn(),
    } as never;
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    );
    const media = new MediaService(
      prisma as never,
      { emitNotificationCreated: jest.fn() } as never,
    );
    jest.spyOn(media, 'notify').mockResolvedValue(undefined);
    service = new MediaVideoService(prisma as never, media);
  });

  it('NV tự thêm dòng: mặc định mình là người quay, tự đặt tên "Video dd/mm"', async () => {
    prisma.mediaTask.findUnique.mockResolvedValue(row());
    await service.create({ work_date: '2026-08-08' }, staff);
    const data = prisma.mediaTask.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      assigneeId: 'staff-1',
      type: 'video',
      title: 'Video 08/08',
    });
  });

  it('NV không thêm được video của người khác', async () => {
    await expect(
      service.create({ shooter_id: 'staff-9' }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Người giao việc thêm được video cho người khác', async () => {
    prisma.mediaTask.findUnique.mockResolvedValue(
      row({ assigneeId: 'staff-9' }),
    );
    await service.create({ shooter_id: 'staff-9' }, leader);
    expect(prisma.mediaTask.create.mock.calls[0][0].data.assigneeId).toBe(
      'staff-9',
    );
  });

  it('Chuyển Xong phải có link video xong', async () => {
    prisma.mediaTask.findFirst.mockResolvedValue(row());
    await expect(
      service.update('v1', { status: 'done' }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Người dựng dán link + chuyển Xong được (không qua duyệt)', async () => {
    prisma.mediaTask.findFirst.mockResolvedValue(
      row({ editorId: 'staff-2', createdById: 'lead-1' }),
    );
    prisma.mediaTask.findUnique.mockResolvedValue(row());
    await service.update(
      'v1',
      { done_link: 'https://vt.tiktok.com/x', status: 'done' },
      user('media_staff', 'staff-2'),
    );
    expect(prisma.mediaTask.update.mock.calls[0][0].data).toMatchObject({
      status: 'done',
      doneLink: 'https://vt.tiktok.com/x',
      progress: 100,
    });
  });

  it('Video đang chờ duyệt: NV không tự đổi trạng thái', async () => {
    prisma.mediaTask.findFirst.mockResolvedValue(
      row({ status: 'in_review', doneLink: 'https://x.y' }),
    );
    await expect(
      service.update('v1', { status: 'done' }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Người ngoài video không sửa được', async () => {
    prisma.mediaTask.findFirst.mockResolvedValue(
      row({ assigneeId: 'staff-9', createdById: 'staff-9' }),
    );
    await expect(
      service.update('v1', { note: 'x' }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Chọn kênh + đã đăng → tạo bài đăng gắn video', async () => {
    prisma.mediaTask.findFirst.mockResolvedValue(
      row({ doneLink: 'https://vt.tiktok.com/x', status: 'done' }),
    );
    prisma.mediaTask.findUnique.mockResolvedValue(row());
    prisma.mediaChannel.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Chi Đại Việt',
      platform: 'tiktok',
    });
    await service.update('v1', { channel_id: 'c1', posted: true }, staff);
    expect(prisma.mediaPublication.create.mock.calls[0][0].data).toMatchObject({
      taskId: 'v1',
      channelId: 'c1',
      channel: 'Chi Đại Việt',
      status: 'published',
      link: 'https://vt.tiktok.com/x',
    });
  });

  it('Danh mục chỉ người quản lý kế hoạch sửa', async () => {
    await expect(
      service.saveChannel(null, { name: 'Kênh A' }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
