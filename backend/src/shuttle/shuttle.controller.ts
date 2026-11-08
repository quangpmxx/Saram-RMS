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
import { Roles } from '../common/decorators/roles.decorator';
import { ShuttleService } from './shuttle.service';
import { ShuttleImportService } from './shuttle-import.service';
import { CreateShuttleDto } from './dto/create-shuttle.dto';
import { UpdateShuttleDto } from './dto/update-shuttle.dto';
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

  /** Nhập Excel danh sách cũ — bước 1: xem trước, không ghi gì. Chỉ Admin. */
  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
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
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_BYTES } }),
  )
  importCommit(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('sheets') sheets: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Chưa chọn file Excel (.xlsx)');
    let names: unknown;
    try {
      names = JSON.parse(sheets ?? '[]');
    } catch {
      names = null;
    }
    if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) {
      throw new BadRequestException('Danh sách sheet không hợp lệ');
    }
    return this.importService.commit(file.buffer, names, user);
  }
}
