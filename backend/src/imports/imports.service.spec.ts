import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { ImportsService } from './imports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LeadDuplicateService } from '../candidates/lead-duplicate.service';
import { DistributionRuleService } from '../distribution/distribution-rule.service';

async function buildSampleWorkbookBuffer(
  rows: Array<[string, string, string, string?, string?, string?]>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ứng viên');
  sheet.addRow([
    'Tên lao động',
    'Số điện thoại',
    'Nguồn',
    'Năm sinh',
    'Địa chỉ',
    'Ghi chú',
  ]);
  rows.forEach((row) => sheet.addRow(row));
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: {
    importJob: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    leadSource: { findMany: jest.Mock };
    lead: { create: jest.Mock };
  };
  let duplicateService: { syncDuplicateFlags: jest.Mock };
  let auditLog: { log: jest.Mock };
  let distributionRuleService: { tryAutoAssign: jest.Mock };

  const mktUser = { id: 'mkt-1', role: 'mkt' as const, sessionId: 's' };
  const sources = [
    { id: 'src-fb', name: 'Facebook' },
    { id: 'src-tt', name: 'TikTok' },
  ];

  beforeEach(async () => {
    prisma = {
      importJob: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      leadSource: { findMany: jest.fn().mockResolvedValue(sources) },
      lead: { create: jest.fn() },
    };
    duplicateService = {
      syncDuplicateFlags: jest.fn().mockResolvedValue([{ id: 'lead-x' }]),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    distributionRuleService = {
      tryAutoAssign: jest
        .fn()
        .mockImplementation((lead: unknown) => Promise.resolve(lead)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: LeadDuplicateService, useValue: duplicateService },
        { provide: DistributionRuleService, useValue: distributionRuleService },
      ],
    }).compile();

    service = moduleRef.get(ImportsService);
  });

  describe('submitImport', () => {
    it('tạo job và trả về job_id ngay, không chờ xử lý xong', async () => {
      prisma.importJob.create.mockResolvedValue({ id: 'job-1' });
      prisma.importJob.update.mockResolvedValue({});
      const buffer = await buildSampleWorkbookBuffer([]);

      const result = await service.submitImport(
        {
          originalname: 'data.xlsx',
          buffer,
        } as Express.Multer.File,
        mktUser,
      );

      expect(result).toEqual({ job_id: 'job-1' });
      expect(prisma.importJob.create).toHaveBeenCalledWith({
        data: {
          uploadedById: 'mkt-1',
          fileName: 'data.xlsx',
          status: 'pending',
        },
      });
    });
  });

  describe('submitImport — lỗi xử lý nền không được để job kẹt "đang xử lý"', () => {
    /** submitImport cố ý không await xử lý nền → chờ tới khi điều kiện đúng. */
    async function waitUntil(condition: () => boolean): Promise<void> {
      for (let i = 0; i < 200 && !condition(); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    const failedUpdate = () =>
      prisma.importJob.update.mock.calls.find(
        (call: [{ data: { status?: string } }]) =>
          call[0].data.status === 'failed',
      ) as [{ where: { id: string }; data: { errors: string } }] | undefined;

    it('file không phải Excel hợp lệ → job chuyển "failed" kèm thông báo', async () => {
      prisma.importJob.create.mockResolvedValue({ id: 'job-bad' });
      prisma.importJob.update.mockResolvedValue({});

      await service.submitImport(
        {
          originalname: 'hong.xlsx',
          buffer: Buffer.from('đây không phải file xlsx'),
        } as Express.Multer.File,
        mktUser,
      );
      await waitUntil(() => failedUpdate() !== undefined);

      const call = failedUpdate();
      expect(call?.[0].where).toEqual({ id: 'job-bad' });
      expect(call?.[0].data.errors).toContain('Lỗi hệ thống');
      expect(call?.[0].data.errors).toContain('kiểm tra danh sách');
    });

    it('lỗi DB giữa chừng khi đang tạo lead → job chuyển "failed", không kẹt processing', async () => {
      prisma.importJob.create.mockResolvedValue({ id: 'job-mid' });
      prisma.importJob.update.mockResolvedValue({});
      prisma.lead.create.mockRejectedValue(new Error('db down'));
      const buffer = await buildSampleWorkbookBuffer([
        ['Nguyễn Văn A', '0900000001', 'Facebook'],
      ]);

      await service.submitImport(
        { originalname: 'data.xlsx', buffer } as Express.Multer.File,
        mktUser,
      );
      await waitUntil(() => failedUpdate() !== undefined);

      expect(failedUpdate()?.[0].where).toEqual({ id: 'job-mid' });
      expect(
        prisma.importJob.update.mock.calls.some(
          (call: [{ data: { status?: string } }]) =>
            call[0].data.status === 'completed',
        ),
      ).toBe(false);
    });

    it('đánh dấu "failed" cũng lỗi → không làm sập tiến trình (không unhandled rejection)', async () => {
      prisma.importJob.create.mockResolvedValue({ id: 'job-x' });
      prisma.importJob.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.submitImport(
          {
            originalname: 'hong.xlsx',
            buffer: Buffer.from('rác'),
          } as Express.Multer.File,
          mktUser,
        ),
      ).resolves.toEqual({ job_id: 'job-x' });
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('getJobStatus', () => {
    it('ném NotFoundException nếu job không tồn tại', async () => {
      prisma.importJob.findUnique.mockResolvedValue(null);
      await expect(
        service.getJobStatus('ghost', mktUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('chỉ MKT đã submit job đó mới xem được', async () => {
      prisma.importJob.findUnique.mockResolvedValue({
        id: 'job-1',
        uploadedById: 'mkt-2',
        status: 'completed',
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        duplicateCount: 0,
        errors: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getJobStatus('job-1', mktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('trả về đúng trạng thái job của chính mình', async () => {
      prisma.importJob.findUnique.mockResolvedValue({
        id: 'job-1',
        uploadedById: 'mkt-1',
        status: 'completed',
        totalRows: 2,
        successCount: 1,
        errorCount: 1,
        duplicateCount: 0,
        errors: JSON.stringify([{ row: 3, message: 'Thiếu SĐT' }]),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      const result = await service.getJobStatus('job-1', mktUser);

      expect(result.success_count).toBe(1);
      expect(result.errors).toEqual([{ row: 3, message: 'Thiếu SĐT' }]);
    });
  });

  describe('processImport (xử lý nền)', () => {
    it('đếm đúng số dòng thành công/lỗi, bỏ qua dòng trống, phát hiện trùng', async () => {
      const buffer = await buildSampleWorkbookBuffer([
        ['Nguyễn Văn A', '0900000001', 'Facebook', '1995', 'Hà Nội', 'ok'],
        ['Trần Thị B', '0900000002', 'Nguồn Không Tồn Tại'],
        ['', '', ''],
        ['Thiếu SĐT', '', 'TikTok'],
        ['Lê Văn C', '0900000003', 'TikTok'],
      ]);

      prisma.lead.create.mockImplementation(
        ({ data }: { data: { phoneNumber: string } }) =>
          Promise.resolve({
            id: `lead-${data.phoneNumber}`,
            phoneNumber: data.phoneNumber,
          }),
      );
      duplicateService.syncDuplicateFlags.mockImplementation((phone: string) =>
        Promise.resolve(
          phone === '0900000003' ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'a' }],
        ),
      );

      // Gọi trực tiếp method xử lý nền để test đồng bộ (submitImport cố ý không await).
      await (
        service as unknown as {
          processImport: (
            jobId: string,
            buf: Buffer,
            uploadedById: string,
          ) => Promise<void>;
        }
      ).processImport('job-1', buffer, mktUser.id);

      expect(prisma.lead.create).toHaveBeenCalledTimes(2); // 2 dòng hợp lệ
      expect(prisma.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'completed',
          totalRows: 4, // bỏ qua dòng trống hoàn toàn
          successCount: 2,
          errorCount: 2,
          duplicateCount: 1,
        }),
      });
    });
  });
});
