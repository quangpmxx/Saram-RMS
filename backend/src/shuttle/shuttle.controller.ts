import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireCap } from '../common/decorators/require-cap.decorator';
import { ShuttleService } from './shuttle.service';
import {
  ShuttleImportService,
  type DriverMapping,
} from './shuttle-import.service';
import { ShuttleSheetService } from './shuttle-sheet.service';
import {
  SaveShuttleSheetConfigDto,
  ShuttleSheetCommitDto,
  ShuttleSheetPreviewDto,
} from './dto/shuttle-sheet.dto';
import { CreateShuttleDto } from './dto/create-shuttle.dto';
import { UpdateShuttleDto } from './dto/update-shuttle.dto';
import { ReorderShuttleDto } from './dto/reorder-shuttle.dto';
import { ListShuttleQueryDto } from './dto/list-shuttle-query.dto';
import { CreateShuttleOptionDto } from './dto/create-shuttle-option.dto';
import { UpdateShuttleOptionDto } from './dto/update-shuttle-option.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện: "Danh sách đưa đón" — KHÔNG gắn @Roles()
 * ở bất kỳ route nào (yêu cầu trực tiếp người dùng: "Tất cả các vai trò
 * đang đăng nhập đều được xem, thêm, sửa, xóa dữ liệu ở trang này") —
 * RolesGuard mặc định cho phép mọi vai trò đã đăng nhập khi không có
 * @Roles() (xem roles.guard.ts).
 */
const IMPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;

@Controller('shuttle')
export class ShuttleController {
  constructor(
    private readonly shuttleService: ShuttleService,
    private readonly importService: ShuttleImportService,
    private readonly sheetService: ShuttleSheetService,
  ) {}

  @Get()
  list(@Query() query: ListShuttleQueryDto) {
    return this.shuttleService.list(query);
  }

  @Get('options')
  getOptions() {
    return this.shuttleService.getOptions();
  }

  @Get('sale-accounts')
  listSaleAccounts() {
    return this.shuttleService.listSaleAccounts();
  }

  /** Bổ sung 2026-07-28 (yêu cầu trực tiếp người dùng: "chuyển cả 2 cột sang liên kết tài khoản thật") — nguồn gợi ý cột "Đưa đón" (role='shuttle_staff'). */
  @Get('driver-accounts')
  listDriverAccounts() {
    return this.shuttleService.listDriverAccounts();
  }

  /** Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng" — nguồn gợi ý cột "Công ty", đọc từ OrderRecord (module Quản lý đơn hàng). */
  @Get('companies')
  listCompanies() {
    return this.shuttleService.listCompanies();
  }

  @Post('options')
  addOption(
    @Body() dto: CreateShuttleOptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shuttleService.addOption(dto, user);
  }

  @Put('options/:id')
  updateOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShuttleOptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shuttleService.updateOption(id, dto, user);
  }

  @Delete('options/:id')
  @HttpCode(HttpStatus.OK)
  async removeOption(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.shuttleService.removeOption(id, user);
    return { message: 'Đã xóa giá trị khỏi danh sách gợi ý' };
  }

  @Post()
  create(
    @Body() dto: CreateShuttleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shuttleService.create(dto, user);
  }

  /** Kéo thả sắp xếp dòng trong 1 ngày (2026-11-10). Đặt TRƯỚC ':id'. */
  @Put('reorder')
  reorder(
    @Body() dto: ReorderShuttleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shuttleService.reorder(dto, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShuttleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shuttleService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.shuttleService.remove(id, user);
    return { message: 'Đã xóa dòng đưa đón' };
  }

  /** Nhập Excel danh sách cũ — bước 1: xem trước, không ghi gì. Mặc định chỉ Admin. */
  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  @RequireCap('shuttle.import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_BYTES } }),
  )
  importPreview(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Chưa chọn file Excel (.xlsx)');
    return this.importService.preview(file.buffer);
  }

  /** Nhập Excel — bước 2: nhập các sheet đã chọn (gửi lại file). Chỉ Admin. */
  @Post('import/commit')
  @HttpCode(HttpStatus.OK)
  @RequireCap('shuttle.import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_BYTES } }),
  )
  importCommit(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('sheets') sheets: string | undefined,
    @Body('drivers') drivers: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Chưa chọn file Excel (.xlsx)');
    const parse = (raw: string | undefined, fallback: string): unknown => {
      try {
        return JSON.parse(raw ?? fallback);
      } catch {
        return null;
      }
    };
    const names = parse(sheets, '[]');
    if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) {
      throw new BadRequestException('Danh sách sheet không hợp lệ');
    }
    // Bảng ghép tên NV đưa đón trong sheet → id tài khoản (null = để trống) đã xác nhận.
    const mapping = parse(drivers, '{}');
    if (
      !mapping ||
      typeof mapping !== 'object' ||
      Array.isArray(mapping) ||
      !Object.values(mapping).every((v) => v === null || typeof v === 'string')
    ) {
      throw new BadRequestException('Bảng ghép NV đưa đón không hợp lệ');
    }
    return this.importService.commit(
      file.buffer,
      names,
      mapping as DriverMapping,
      user,
    );
  }

  /** Đồng bộ từ Google Sheet (2026-11-10) — đã cài đặt chưa + email robot để chia sẻ sheet. */
  @Get('sheet-sync/config')
  sheetConfig() {
    return this.sheetService.getConfig();
  }

  /** Lưu link sheet + chìa khoá robot. Mặc định chỉ Admin. */
  @Put('sheet-sync/config')
  @RequireCap('shuttle.sheet_config')
  saveSheetConfig(
    @Body() dto: SaveShuttleSheetConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheetService.saveConfig(dto, user);
  }

  /** Bước 1: đọc sheet, xem trước (không ghi gì). Ai sửa được Đưa đón đều dùng được. */
  @Post('sheet-sync/preview')
  @HttpCode(HttpStatus.OK)
  @RequireCap('shuttle.sheet_sync')
  sheetPreview(@Body() dto: ShuttleSheetPreviewDto) {
    return this.sheetService.preview(dto.tab);
  }

  /** Bước 2: thêm dòng mới + cập nhật dòng đã có theo sheet. */
  @Post('sheet-sync/commit')
  @HttpCode(HttpStatus.OK)
  @RequireCap('shuttle.sheet_sync')
  sheetCommit(
    @Body() dto: ShuttleSheetCommitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheetService.commit(dto.tab, dto.drivers ?? {}, user);
  }
}
