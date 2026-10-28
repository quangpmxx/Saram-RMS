import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AnonymousFeedbackService } from './anonymous-feedback.service';

const user = (role: AuthenticatedUser['role'], id = `${role}-1`) =>
  ({ id, role }) as AuthenticatedUser;

const DTO = {
  recipient: 'Ban Giám đốc',
  subject: 'Góp ý về ca làm việc',
  content: 'Nội dung phản ánh chi tiết',
};

describe('AnonymousFeedbackService', () => {
  let service: AnonymousFeedbackService;
  let prisma: {
    anonymousFeedback: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    account: { findMany: jest.Mock };
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
        findUnique: jest.fn(),
      },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'admin-1' }, { id: 'manager-1' }]),
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
        { id: 'fb-1', ...DTO, createdAt: new Date('2026-10-28T03:00:00Z') },
      ]);
      const rows = await service.list({}, user('admin'));
      const select = prisma.anonymousFeedback.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('senderId');
      expect(select).not.toHaveProperty('sender');
      expect(Object.keys(rows[0]).sort()).toEqual(
        ['content', 'created_at', 'id', 'recipient', 'subject'].sort(),
      );
    });

    it('xem chi tiết cũng không chọn cột người gửi', async () => {
      prisma.anonymousFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        ...DTO,
        createdAt: new Date(),
      });
      await service.findOne('fb-1', user('manager'));
      const select =
        prisma.anonymousFeedback.findUnique.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('senderId');
      expect(select).not.toHaveProperty('sender');
    });
  });
});
