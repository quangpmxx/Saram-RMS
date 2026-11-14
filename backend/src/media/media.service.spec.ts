import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MediaService, normalizeTitle, titleSimilarity } from './media.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import type { AccountRole } from '../../generated/prisma/enums';

/** Media (2026-11-14): luồng giao việc → nộp → duyệt và phân quyền theo vai trò. */
describe('MediaService', () => {
  let prisma: Record<string, Record<string, jest.Mock>> & {
    $transaction: jest.Mock;
  };
  let realtime: { emitNotificationCreated: jest.Mock };
  let service: MediaService;

  const user = (
    role: AccountRole,
    id = `${role}-1`,
    caps?: Record<string, boolean>,
  ): AuthenticatedUser => ({
    id,
    role,
    sessionId: 's',
    capabilityOverrides: caps,
  });
  const staff = user('media_staff', 'staff-1');
  const otherStaff = user('media_staff', 'staff-2');
  const leader = user('media_staff', 'lead-1', {
    'media.assign': true,
    'media.review': true,
  });
  const mkt = user('mkt');

  const task = (over: Record<string, unknown> = {}) => ({
    id: 't1',
    code: 7,
    title: 'Video KTX',
    status: 'todo',
    progress: 0,
    assigneeId: 'staff-1',
    createdById: 'lead-1',
    members: [],
    submissions: [],
    ...over,
  });

  beforeEach(() => {
    const model = () => ({
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'new', code: 1, version: 1 }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    });
    prisma = {
      account: model(),
      orderRecord: model(),
      mediaTask: model(),
      mediaTaskMember: model(),
      mediaTaskActivity: model(),
      mediaSubmission: model(),
      mediaIdea: model(),
      mediaPublication: model(),
      notification: model(),
      $transaction: jest.fn(),
    } as never;
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    );
    prisma.notification.create.mockResolvedValue({
      id: 'n1',
      accountId: 'x',
      type: 'media_task',
      createdAt: new Date(),
      scheduledAt: new Date(),
      sender: null,
    });
    realtime = { emitNotificationCreated: jest.fn() };
    service = new MediaService(prisma as never, realtime as never);
  });

  describe('tạo / giao việc', () => {
    it('NV Media thường không tạo được việc', async () => {
      await expect(
        service.createTask({ title: 'A' }, staff),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Trưởng nhóm (được bật media.assign) tạo việc + báo người được giao', async () => {
      prisma.account.count.mockResolvedValue(1);
      prisma.mediaTask.create.mockResolvedValue({ id: 't1', code: 12 });
      const res = await service.createTask(
        { title: ' Video ', assignee_id: 'staff-1' },
        leader,
      );
      expect(res).toEqual({ id: 't1', code: 'MD-000012' });
      expect(prisma.mediaTask.create.mock.calls[0][0].data).toMatchObject({
        title: 'Video',
        assigneeId: 'staff-1',
        createdById: 'lead-1',
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create.mock.calls[0][0].data.accountId).toBe(
        'staff-1',
      );
    });

    it('MKT (Trưởng phòng) mặc định giao việc được, thiếu tên thì báo lỗi', async () => {
      await expect(
        service.createTask({ title: '  ' }, mkt),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('phạm vi xem', () => {
    it('NV Media chỉ thấy việc mình phụ trách / tham gia / tạo', async () => {
      await service.listTasks(staff, {});
      const where = prisma.mediaTask.findMany.mock.calls[0][0].where;
      expect(where.AND[0]).toEqual({
        OR: [
          { assigneeId: 'staff-1' },
          { editorId: 'staff-1' },
          { createdById: 'staff-1' },
          { members: { some: { accountId: 'staff-1' } } },
        ],
      });
    });

    it('Người duyệt thấy mọi việc', async () => {
      await service.listTasks(mkt, {});
      expect(prisma.mediaTask.findMany.mock.calls[0][0].where.AND[0]).toEqual(
        {},
      );
    });

    it('Mở việc ngoài phạm vi → 404', async () => {
      prisma.mediaTask.findFirst.mockResolvedValue(null);
      await expect(service.getTask('t1', otherStaff)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('trạng thái', () => {
    it('NV tự chuyển Chờ thực hiện → Đang thực hiện', async () => {
      prisma.mediaTask.findFirst.mockResolvedValue(task());
      await service.changeStatus('t1', 'in_progress', staff);
      expect(prisma.mediaTask.update.mock.calls[0][0].data.status).toBe(
        'in_progress',
      );
    });

    it('NV không tự đánh Hoàn thành (phải qua duyệt)', async () => {
      prisma.mediaTask.findFirst.mockResolvedValue(
        task({ status: 'in_progress' }),
      );
      await expect(
        service.changeStatus('t1', 'done', staff),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Người không tham gia không đổi được trạng thái', async () => {
      prisma.mediaTask.findFirst.mockResolvedValue(task());
      await expect(
        service.changeStatus('t1', 'in_progress', otherStaff),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('nộp & duyệt', () => {
    it('Nộp link → phiên bản kế tiếp, việc sang Chờ duyệt, báo người giao', async () => {
      prisma.mediaTask.findFirst.mockResolvedValue(
        task({ status: 'revision' }),
      );
      prisma.mediaSubmission.findFirst.mockResolvedValue({ version: 2 });
      prisma.mediaSubmission.create.mockResolvedValue({ id: 's3', version: 3 });
      const res = await service.submit(
        't1',
        { link: 'https://drive.google.com/x' },
        undefined,
        staff,
      );
      expect(res).toEqual({ id: 's3', version: 3 });
      expect(prisma.mediaSubmission.create.mock.calls[0][0].data.version).toBe(
        3,
      );
      expect(prisma.mediaTask.update.mock.calls[0][0].data.status).toBe(
        'in_review',
      );
      expect(prisma.notification.create.mock.calls[0][0].data.accountId).toBe(
        'lead-1',
      );
    });

    it('Nộp không có link lẫn file → lỗi; link sai dạng → lỗi', async () => {
      prisma.mediaTask.findFirst.mockResolvedValue(task());
      await expect(
        service.submit('t1', {}, undefined, staff),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.submit('t1', { link: 'drive/x' }, undefined, staff),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('NV Media thường không duyệt được', async () => {
      await expect(
        service.review('s1', { decision: 'approved' }, staff),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Yêu cầu chỉnh sửa bắt buộc ghi lý do', async () => {
      await expect(
        service.review('s1', { decision: 'revision' }, leader),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Duyệt → việc Hoàn thành 100%, báo người làm', async () => {
      prisma.mediaSubmission.findUnique.mockResolvedValue({
        id: 's1',
        version: 1,
        taskId: 't1',
        submittedById: 'staff-1',
        task: task({ status: 'in_review' }),
      });
      await service.review('s1', { decision: 'approved' }, leader);
      expect(prisma.mediaTask.update.mock.calls[0][0].data).toMatchObject({
        status: 'done',
        progress: 100,
      });
      expect(prisma.notification.create.mock.calls[0][0].data.accountId).toBe(
        'staff-1',
      );
    });

    it('Bản đã duyệt / đã có bản mới → không duyệt lại được', async () => {
      prisma.mediaSubmission.findUnique.mockResolvedValue({
        id: 's1',
        version: 1,
        taskId: 't1',
        submittedById: 'staff-1',
        task: task(),
      });
      prisma.mediaSubmission.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.review('s1', { decision: 'revision', note: 'Sửa' }, leader),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.mediaTask.update).not.toHaveBeenCalled();
    });
  });

  describe('lịch đăng', () => {
    it('NV chỉ sửa bài mình đăng / mình tạo', async () => {
      prisma.mediaPublication.findUnique.mockResolvedValue({
        id: 'p1',
        publisherId: 'staff-2',
        createdById: 'staff-2',
      });
      await expect(
        service.updateMetrics('p1', { views: 10 }, staff),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await service.updateMetrics('p1', { views: 10 }, otherStaff);
      expect(prisma.mediaPublication.update).toHaveBeenCalled();
    });
  });

  describe('trùng ý tưởng', () => {
    it('so tiêu đề bỏ dấu', () => {
      expect(normalizeTitle('Đời sống KTX — Nhà máy A!')).toBe(
        'doi song ktx nha may a',
      );
      expect(
        titleSimilarity(
          normalizeTitle('Review ký túc xá nhà máy Goertek'),
          normalizeTitle('review ky tuc xa Goertek'),
        ),
      ).toBeGreaterThanOrEqual(0.5);
      expect(titleSimilarity('luong thuong', 'an trua mien phi')).toBe(0);
    });
  });
});
