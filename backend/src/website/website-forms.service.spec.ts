import { BadRequestException, HttpException } from '@nestjs/common';
import { WebsiteFormsService } from './website-forms.service';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidates/candidates.service';
import { LeadDuplicateService } from '../candidates/lead-duplicate.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('WebsiteFormsService', () => {
  let prisma: Record<string, Record<string, jest.Mock>> & {
    $transaction: jest.Mock;
  };
  let candidates: { create: jest.Mock };
  let duplicates: { findOriginTeam: jest.Mock };
  let realtime: { emitNotificationCreated: jest.Mock };
  let service: WebsiteFormsService;

  beforeEach(() => {
    prisma = {
      leadSource: { findFirst: jest.fn().mockResolvedValue({ id: 'src-web' }) },
      lead: { findFirst: jest.fn().mockResolvedValue(null) },
      account: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'admin-1', role: 'admin' }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'admin-1' }, { id: 'mgr-1' }]),
      },
      pancakeAutoUpTeam: {
        findMany: jest.fn().mockResolvedValue([
          { teamId: 'team-a', weight: 1 },
          { teamId: 'team-b', weight: 1 },
        ]),
      },
      team: { findMany: jest.fn().mockResolvedValue([]) },
      pancakeAutoUpConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cfg' }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ position: 2 }),
      },
      websiteContact: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => ({ id: 'c1', ...data })),
      },
      notification: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: `n-${data.accountId}`,
          ...data,
          createdAt: new Date(),
          sender: null,
        })),
      },
      $transaction: jest.fn(),
    } as never;
    candidates = { create: jest.fn().mockResolvedValue({}) };
    duplicates = { findOriginTeam: jest.fn().mockResolvedValue(null) };
    realtime = { emitNotificationCreated: jest.fn() };
    service = new WebsiteFormsService(
      prisma as unknown as PrismaService,
      candidates as unknown as CandidatesService,
      duplicates as unknown as LeadDuplicateService,
      realtime as unknown as RealtimeService,
    );
  });

  it('đăng ký tìm việc → tạo data nguồn Website, chia nhóm theo vòng, ghi chú khu vực', async () => {
    await service.registerWorker(
      {
        full_name: ' Nguyễn Văn A ',
        phone: '0971 242 250',
        area: 'KCN Quế Võ',
      },
      '1.1.1.1',
    );
    expect(candidates.create).toHaveBeenCalledWith(
      {
        full_name: 'Nguyễn Văn A',
        phone_number: '0971242250',
        source_id: 'src-web',
        team_id: 'team-b', // position 2 → phần tử thứ 2 của vòng [a, b]
        mkt_note: 'Đăng ký từ website · Muốn làm: KCN Quế Võ',
      },
      { id: 'admin-1', role: 'admin', sessionId: 'website-form' },
    );
  });

  it('số đang có ở nhóm khác trong 7 ngày → về nhóm đó, không tính lượt chia', async () => {
    duplicates.findOriginTeam.mockResolvedValue({ id: 'team-x' });
    await service.registerWorker(
      { full_name: 'B', phone: '0971242250' },
      '1.1.1.2',
    );
    expect(candidates.create.mock.calls[0][0].team_id).toBe('team-x');
    expect(prisma.pancakeAutoUpConfig.update).not.toHaveBeenCalled();
  });

  it('cùng số đăng ký lại trên web trong 24 giờ → không tạo thêm data', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'old' });
    await expect(
      service.registerWorker(
        { full_name: 'C', phone: '0971242250' },
        '1.1.1.3',
      ),
    ).resolves.toEqual({ ok: true });
    expect(candidates.create).not.toHaveBeenCalled();
  });

  it('ô ẩn có chữ (máy tự điền) → báo đã nhận nhưng không tạo gì', async () => {
    await service.registerWorker(
      { full_name: 'Bot', phone: '0971242250', website: 'http://spam' },
      '1.1.1.4',
    );
    expect(candidates.create).not.toHaveBeenCalled();
  });

  it('số điện thoại sai → báo lỗi', async () => {
    await expect(
      service.registerWorker({ full_name: 'D', phone: '12345' }, '1.1.1.5'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('một IP gửi quá 5 lần trong 10 phút → chặn', async () => {
    for (let i = 0; i < 5; i++) {
      await service.registerWorker(
        { full_name: 'E', phone: '0971242250' },
        '9.9.9.9',
      );
    }
    await expect(
      service.registerWorker(
        { full_name: 'E', phone: '0971242250' },
        '9.9.9.9',
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('chưa đặt tỉ lệ chia nhóm → xoay vòng đều mọi nhóm', async () => {
    prisma.pancakeAutoUpTeam.findMany.mockResolvedValue([]);
    prisma.team.findMany.mockResolvedValue([
      { id: 't1' },
      { id: 't2' },
      { id: 't3' },
    ]);
    prisma.pancakeAutoUpConfig.update.mockResolvedValue({ position: 3 });
    await service.registerWorker(
      { full_name: 'F', phone: '0971242250' },
      '1.1.1.6',
    );
    expect(candidates.create.mock.calls[0][0].team_id).toBe('t3');
  });

  it('doanh nghiệp gửi nhu cầu → lưu và báo chuông từng Admin/Quản lý', async () => {
    await service.contactBusiness(
      { company_name: 'Cty ABC', phone: '0912345678', need: '50 nữ' },
      '2.2.2.2',
    );
    expect(prisma.websiteContact.create).toHaveBeenCalledWith({
      data: { companyName: 'Cty ABC', phone: '0912345678', need: '50 nữ' },
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      type: 'website_contact',
      meta: { link: '/website-contacts' },
    });
    expect(realtime.emitNotificationCreated).toHaveBeenCalledTimes(2);
  });
});
