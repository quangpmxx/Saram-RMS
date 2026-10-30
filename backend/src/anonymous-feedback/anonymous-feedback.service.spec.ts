import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AnonymousFeedbackService } from './anonymous-feedback.service';

const user = (role: AuthenticatedUser['role'], id = `${role}-1`) =>
  ({ id, role }) as AuthenticatedUser;

const DTO = {
  subject: 'Góp ý về ca làm việc',
  content: 'Nội dung phản ánh chi tiết',
};

describe('AnonymousFeedbackService', () => {
  let service: AnonymousFeedbackService;
  let prisma: {
    anonymousFeedback: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    account: { findMany: jest.Mock; count: jest.Mock };
    notification: { create: jest.Mock };
  };
  let realtime: { emitNotificationCreated: jest.Mock };

  beforeEach(async () => {
    prisma = {
      anonymousFeedback: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'fb-1', subject: DTO.subject }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'admin-1' }, { id: 'manager-1' }]),
        count: jest.fn(),
      },
      notification: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `n-${data.accountId}`,
            ...data,
            leadId: null,
            leaveRequestId: null,
            createdAt: new Date(),
            sender: null,
          }),
        ),
      },
    };
    realtime = { emitNotificationCreated: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnonymousFeedbackService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    service = moduleRef.get(AnonymousFeedbackService);
  });

  describe('gửi đơn', () => {
    it.each([
      'sale',
      'mkt',
      'leader',
      'accounting',
      'order_staff',
      'shuttle_staff',
    ] as const)('%s gửi được', async (role) => {
      await expect(service.create(DTO, user(role))).resolves.toEqual({
        message: 'Đã gửi đơn phản ánh ẩn danh',
      });
    });

    it.each(['admin', 'manager'] as const)(
      '%s không gửi (là người nhận)',
      async (role) => {
        await expect(service.create(DTO, user(role))).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it('chỉ có khoảng trắng → báo lỗi', async () => {
      await expect(
        service.create({ ...DTO, content: '   ' }, user('sale')),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lưu người gửi vào DB nhưng KHÔNG trả về cho người gửi (không có id đơn)', async () => {
      const result = await service.create(DTO, user('sale', 'sale-42'));
      expect(prisma.anonymousFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ senderId: 'sale-42' }),
        }),
      );
      expect(JSON.stringify(result)).not.toContain('sale-42');
      expect(result).not.toHaveProperty('id');
    });

    it('thông báo cho Quản lý/Admin: sender_id = null, actor realtime = null, không chứa id người gửi', async () => {
      await service.create(DTO, user('sale', 'sale-42'));
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      for (const [arg] of prisma.notification.create.mock.calls) {
        expect(arg.data.senderId).toBeNull();
        expect(arg.data.type).toBe('anonymous_feedback_created');
        expect(JSON.stringify(arg.data)).not.toContain('sale-42');
      }
      for (const [payload, actor] of realtime.emitNotificationCreated.mock
        .calls) {
        expect(actor).toBeNull();
        expect(JSON.stringify(payload)).not.toContain('sale-42');
      }
    });

    it('chọn người nhận: chỉ báo đúng người đó; người nhận phải là Admin/Quản lý đang hoạt động', async () => {
      prisma.account.count.mockResolvedValue(1);
      await service.create(
        { ...DTO, recipient_ids: JSON.stringify(['manager-1']) },
        user('sale'),
      );
      expect(prisma.anonymousFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recipientIds: ['manager-1'] }),
        }),
      );
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['manager-1'] } }),
        }),
      );

      prisma.account.count.mockResolvedValue(0);
      await expect(
        service.create(
          { ...DTO, recipient_ids: JSON.stringify(['sale-9']) },
          user('sale'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ảnh không phải JPEG/PNG/WebP (theo nội dung file) → báo lỗi, không lưu đơn', async () => {
      const fake = { buffer: Buffer.from('<script>alert(1)</script>') };
      await expect(
        service.create(DTO, user('sale'), [fake as Express.Multer.File]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.anonymousFeedback.create).not.toHaveBeenCalled();
    });

    it('lỗi gửi thông báo không làm hỏng việc gửi đơn', async () => {
      prisma.account.findMany.mockRejectedValue(new Error('db'));
      await expect(service.create(DTO, user('sale'))).resolves.toBeDefined();
    });
  });

  describe('xem đơn', () => {
    it.each(['admin', 'manager'] as const)(
      '%s xem được danh sách',
      async (role) => {
        await expect(service.list({}, user(role))).resolves.toEqual([]);
      },
    );

    it.each(['sale', 'leader', 'mkt', 'accounting'] as const)(
      '%s không xem được (kể cả người đã gửi)',
      async (role) => {
        await expect(service.list({}, user(role))).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it('truy vấn KHÔNG chọn cột người gửi, kết quả không có thông tin người gửi', async () => {
      prisma.anonymousFeedback.findMany.mockResolvedValue([
        {
          id: 'fb-1',
          ...DTO,
          recipientIds: [],
          imageFiles: [],
          createdAt: new Date('2026-10-28T03:00:00Z'),
        },
      ]);
      const rows = await service.list({}, user('admin'));
      const select = prisma.anonymousFeedback.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('senderId');
      expect(select).not.toHaveProperty('sender');
      expect(Object.keys(rows[0]).sort()).toEqual(
        [
          'content',
          'created_at',
          'id',
          'image_count',
          'recipients',
          'subject',
        ].sort(),
      );
    });

    it('chỉ thấy đơn gửi tất cả hoặc đơn có chọn mình', async () => {
      await service.list({}, user('manager', 'manager-7'));
      expect(prisma.anonymousFeedback.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          OR: [
            { recipientIds: { isEmpty: true } },
            { recipientIds: { has: 'manager-7' } },
          ],
        }),
      );
    });

    it('xem ảnh của đơn không gửi cho mình → không tìm thấy', async () => {
      prisma.anonymousFeedback.findFirst.mockResolvedValue(null);
      await expect(
        service.getImage('fb-1', 0, user('admin')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('xem chi tiết cũng không chọn cột người gửi', async () => {
      prisma.anonymousFeedback.findFirst.mockResolvedValue({
        id: 'fb-1',
        ...DTO,
        recipientIds: [],
        imageFiles: [],
        createdAt: new Date(),
      });
      await service.findOne('fb-1', user('manager'));
      const select = prisma.anonymousFeedback.findFirst.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('senderId');
      expect(select).not.toHaveProperty('sender');
    });
  });
});
