import {
  BadRequestException,
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
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — đủ cho ~20.000 dòng (Mục 2, docs/09)

/**
 * Mục 4, docs/13-api-design.md — MKT (đúng như POST /candidate). Dự án phụ
 * — nâng cấp toàn diện: bổ sung Admin theo đúng nguyên tắc "Admin/Quản lý
 * kế thừa toàn bộ quyền của vai trò cấp dưới" (yêu cầu trực tiếp người dùng).
 */
@Controller('candidate')
@Roles('mkt', 'admin')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

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
