import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import {
  LEGACY_MAX_ROWS,
  LegacyImportService,
  type LegacyImportInput,
} from './legacy-import.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — đủ cho ~20.000 dòng (Mục 2, docs/09)
/** File Google Sheet cũ có nhiều sheet tháng → lớn hơn file import thường. */
const LEGACY_MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024;

interface LegacyImportBody {
  sheet?: string;
  team_id?: string;
  limit?: string;
  mapping?: string;
}

function toLegacyInput(
  file: Express.Multer.File | undefined,
  body: LegacyImportBody,
): LegacyImportInput {
  if (!file) {
    throw new BadRequestException('Vui lòng đính kèm file Excel (.xlsx)');
  }
  const limit = body.limit ? Number.parseInt(body.limit, 10) : LEGACY_MAX_ROWS;
  if (!Number.isInteger(limit) || limit < 1 || limit > LEGACY_MAX_ROWS) {
    throw new BadRequestException(`Số dòng phải từ 1 đến ${LEGACY_MAX_ROWS}`);
  }
  return {
    buffer: file.buffer,
    sheet: body.sheet || undefined,
    teamId: body.team_id || undefined,
    limit,
  };
}

/**
 * Mục 4, docs/13-api-design.md — MKT (đúng như POST /candidate). Dự án phụ
 * — nâng cấp toàn diện: bổ sung Admin theo đúng nguyên tắc "Admin/Quản lý
 * kế thừa toàn bộ quyền của vai trò cấp dưới" (yêu cầu trực tiếp người dùng).
 */
@Controller('candidate')
@Roles('mkt', 'admin')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly legacyImportService: LegacyImportService,
  ) {}

  /** "Tải data cũ" bước 1 — đọc file, liệt kê sheet / xem trước (không ghi gì). */
  @Post('legacy-import/preview')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LEGACY_MAX_FILE_SIZE_BYTES },
    }),
  )
  legacyPreview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: LegacyImportBody,
  ) {
    return this.legacyImportService.preview(toLegacyInput(file, body));
  }

  /** "Tải data cũ" bước 2 — tạo data theo bảng ghép nhân viên ↔ tài khoản. */
  @Post('legacy-import/commit')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LEGACY_MAX_FILE_SIZE_BYTES },
    }),
  )
  legacyCommit(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: LegacyImportBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    let mapping: Record<string, string | null>;
    try {
      mapping = JSON.parse(body.mapping ?? '{}') as Record<
        string,
        string | null
      >;
    } catch {
      throw new BadRequestException('Bảng ghép nhân viên không hợp lệ');
    }
    return this.legacyImportService.commit(
      { ...toLegacyInput(file, body), mapping },
      user,
    );
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  submitImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng đính kèm file Excel (.xlsx)');
    }
    return this.importsService.submitImport(file, user);
  }

  @Get('import/:jobId')
  getStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.getJobStatus(jobId, user);
  }
}
