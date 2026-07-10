import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LeadDuplicateService } from '../candidates/lead-duplicate.service';
import { DistributionRuleService } from '../distribution/distribution-rule.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  ImportJobResponseDto,
  ImportRowError,
  toImportJobResponse,
} from './dto/import-job-response.dto';
import { getCellText, isRowEmpty } from './excel-row.util';

const HEADER_ROW_NUMBER = 1;

/**
 * Cột kỳ vọng trong file Excel import — quy ước kỹ thuật (không thuộc phần
 * nghiệp vụ đã Design Freeze, vì tài liệu 09/13 không chỉ định định dạng
 * file cụ thể). Xem file mẫu docs/samples/mau-import-ung-vien.xlsx.
 * 1=Tên lao động, 2=Số điện thoại, 3=Nguồn, 4=Năm sinh, 5=Địa chỉ, 6=Ghi chú.
 */
const COLUMN = {
  FULL_NAME: 1,
  PHONE_NUMBER: 2,
  SOURCE: 3,
  BIRTH_YEAR: 4,
  ADDRESS: 5,
  MKT_NOTE: 6,
} as const;

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly duplicateService: LeadDuplicateService,
    private readonly distributionRuleService: DistributionRuleService,
  ) {}

  /**
   * Mục 4, docs/13: nhận file, đẩy job vào nền, trả job_id ngay (không chờ
   * xử lý xong) — tránh timeout với batch lớn (Mục 4.3, docs/10).
   */
  async submitImport(
    file: Express.Multer.File,
    currentUser: AuthenticatedUser,
  ): Promise<{ job_id: string }> {
    const job = await this.prisma.importJob.create({
      data: {
        uploadedById: currentUser.id,
        fileName: file.originalname,
        status: 'pending',
      },
    });

    // Cố ý không await — xử lý bất đồng bộ trong nền, không chặn response.
    void this.processImport(job.id, file.buffer, currentUser.id).catch(
      (error: unknown) => {
        this.logger.error(
          `Import job ${job.id} thất bại`,
          error instanceof Error ? error.stack : String(error),
        );
      },
    );

    return { job_id: job.id };
  }

  async getJobStatus(
    jobId: string,
    currentUser: AuthenticatedUser,
  ): Promise<ImportJobResponseDto> {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException('Không tìm thấy lượt import');
    }
    if (job.uploadedById !== currentUser.id) {
      throw new ForbiddenException(
        'Bạn chỉ được xem lượt import do chính mình thực hiện',
      );
    }

    return toImportJobResponse(job);
  }

  private async processImport(
    jobId: string,
    buffer: Buffer,
    uploadedById: string,
  ): Promise<void> {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          totalRows: 0,
          errors: JSON.stringify([
            { row: 0, message: 'File không có sheet dữ liệu' },
          ]),
        },
      });
      return;
    }

    const sources = await this.prisma.leadSource.findMany();
    const sourceByName = new Map(
      sources.map((source) => [source.name.toLowerCase(), source]),
    );

    let successCount = 0;
    let duplicateCount = 0;
    const errors: ImportRowError[] = [];
    let totalRows = 0;

    for (
      let rowNumber = HEADER_ROW_NUMBER + 1;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      const row = sheet.getRow(rowNumber);
      if (isRowEmpty(row)) {
        continue;
      }
      totalRows += 1;

      const fullName = getCellText(row, COLUMN.FULL_NAME);
      const phoneNumber = getCellText(row, COLUMN.PHONE_NUMBER);
      const sourceName = getCellText(row, COLUMN.SOURCE);
      const birthYearRaw = getCellText(row, COLUMN.BIRTH_YEAR);
      const address = getCellText(row, COLUMN.ADDRESS);
      const mktNote = getCellText(row, COLUMN.MKT_NOTE);

      if (!fullName || !phoneNumber || !sourceName) {
        errors.push({
          row: rowNumber,
          message: 'Thiếu Tên lao động, Số điện thoại hoặc Nguồn (bắt buộc)',
        });
        continue;
      }

      const source = sourceByName.get(sourceName.toLowerCase());
      if (!source) {
        errors.push({
          row: rowNumber,
          message: `Nguồn không hợp lệ: "${sourceName}" (phải là Facebook/TikTok/Zalo/Khác)`,
        });
        continue;
      }

      const birthYear = birthYearRaw
        ? Number.parseInt(birthYearRaw, 10)
        : undefined;
      if (birthYearRaw && !Number.isFinite(birthYear)) {
        errors.push({
          row: rowNumber,
          message: `Năm sinh không hợp lệ: "${birthYearRaw}"`,
        });
        continue;
      }

      const created = await this.prisma.lead.create({
        data: {
          fullName,
          phoneNumber,
          sourceId: source.id,
          birthYear,
          address: address || undefined,
          mktNote: mktNote || undefined,
          uploadedById,
        },
      });

      // Phase 6 — mỗi lead từ import cũng là "lead mới về", áp dụng tự động
      // phân chia (nếu có nhóm đang bật) giống hệt lead nhập tay.
      await this.distributionRuleService.tryAutoAssign(created);

      const matches = await this.duplicateService.syncDuplicateFlags(
        created.phoneNumber,
      );
      if (matches.length > 1) {
        duplicateCount += 1;
      }

      successCount += 1;
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        totalRows,
        successCount,
        errorCount: errors.length,
        duplicateCount,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
      },
    });

    await this.auditLog.log({
      accountId: uploadedById,
      actionType: 'create',
      entityType: 'import_job',
      entityId: jobId,
      newValue: `success=${successCount}, error=${errors.length}, duplicate=${duplicateCount}`,
    });
  }
}
