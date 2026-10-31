import { Test } from '@nestjs/testing';
import { LeadAssignmentNoticeService } from './lead-assignment-notice.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('LeadAssignmentNoticeService', () => {
  let service: LeadAssignmentNoticeService;
  let prisma: { notification: { create: jest.Mock } };
  let realtime: { emitNotificationCreated: jest.Mock };

  const leader = { id: 'leader-1', role: 'leader' as const, sessionId: 's' };
  const lead = {
    id: 'lead-1',
    fullName: 'Nguyễn A',
    phoneNumber: '0900000001',
  };

  const created = {
    id: 'n-1',
    accountId: 'sale-1',
    leadId: 'lead-1',
    leaveRequestId: null,
    type: 'lead_assigned',
    channel: 'in_app',
    status: 'sent',
    content: 'x',
    senderId: 'leader-1',
    scheduledAt: new Date('2026-11-01T01:00:00Z'),
    sentAt: new Date('2026-11-01T01:00:00Z'),
    createdAt: new Date('2026-11-01T01:00:00Z'),
    meta: null,
    sender: {
      id: 'leader-1',
      fullName: 'Leader',
      role: 'leader',
      avatarUrl: null,
    },
  };

  beforeEach(async () => {
    prisma = { notification: { create: jest.fn().mockResolvedValue(created) } };
    realtime = { emitNotificationCreated: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadAssignmentNoticeService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    service = moduleRef.get(LeadAssignmentNoticeService);
  });

  const createdData = () =>
    (
      prisma.notification.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ]
    )[0].data;

  it('chia 1 data: tạo thông báo lead_assigned cho người nhận, gắn lead_id + người gửi, đẩy realtime', async () => {
    await service.notifyAssigned(lead, 'sale-1', leader);

    expect(createdData()).toMatchObject({
      accountId: 'sale-1',
      leadId: 'lead-1',
      type: 'lead_assigned',
      channel: 'in_app',
      senderId: 'leader-1',
      status: 'sent',
      content: 'Bạn được chia data "Nguyễn A" (0900000001)',
    });
    expect(realtime.emitNotificationCreated).toHaveBeenCalledTimes(1);
    expect(realtime.emitNotificationCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-1', account_id: 'sale-1' }),
      leader,
    );
  });

  it('chuyển data: nội dung dùng từ "chuyển"', async () => {
    await service.notifyAssigned(lead, 'sale-1', leader, 'transfer');
    expect(createdData().content).toBe(
      'Bạn được chuyển data "Nguyễn A" (0900000001)',
    );
  });

  it('chia hàng loạt: 1 thông báo gộp, không gắn lead_id', async () => {
    await service.notifyAssignedBulk(5, 'sale-1', leader);
    expect(createdData()).toMatchObject({
      leadId: null,
      content: 'Bạn được chia 5 data mới',
      senderId: 'leader-1',
    });
  });

  it('tự động chia: không có người gửi (hệ thống), gắn lead_id', async () => {
    await service.notifyAutoAssigned(lead, 'sale-1');
    expect(createdData()).toMatchObject({
      leadId: 'lead-1',
      senderId: null,
      content: 'Hệ thống tự động chia cho bạn data "Nguyễn A" (0900000001)',
    });
    expect(realtime.emitNotificationCreated).toHaveBeenCalledWith(
      expect.anything(),
      null,
    );
  });

  it('tự động chia hàng loạt (nhập Excel): 1 thông báo gộp', async () => {
    await service.notifyAutoAssignedBulk(12, 'sale-1');
    expect(createdData()).toMatchObject({
      leadId: null,
      senderId: null,
      content: 'Hệ thống tự động chia cho bạn 12 data mới',
    });
  });

  it('người chia chính là người nhận (tự nhận) → không gửi thông báo', async () => {
    await service.notifyAssigned(lead, 'leader-1', leader);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(realtime.emitNotificationCreated).not.toHaveBeenCalled();
  });

  it('lỗi ghi thông báo không ném ra ngoài (không làm hỏng việc chia data) và không đẩy realtime', async () => {
    prisma.notification.create.mockRejectedValue(new Error('db down'));
    await expect(
      service.notifyAssigned(lead, 'sale-1', leader),
    ).resolves.toBeUndefined();
    expect(realtime.emitNotificationCreated).not.toHaveBeenCalled();
  });
});
