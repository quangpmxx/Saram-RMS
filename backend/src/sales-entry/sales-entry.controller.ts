import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SalesEntryService } from './sales-entry.service';
import { SalesEntryExportService } from './sales-entry-export.service';
import { ListDsSaleQueryDto } from './dto/list-ds-sale-query.dto';
import { UpsertDsSaleRowDto } from './dto/upsert-ds-sale-row.dto';
import { BulkDeleteDsSaleDto } from './dto/bulk-delete-ds-sale.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "DS Sale" — module con của
 * "Nhập doanh số". `@Roles('admin')` ở CẤP CONTROLLER — khớp đúng phạm vi
 * truy cập hiện tại của "Nhập doanh số" (roles: ["admin"] ở
 * app/(dashboard)/layout.tsx) — CHƯA tạo bộ quyền chi tiết Xem/Thêm/Sửa/
 * Xóa/Xuất riêng vì hệ thống hiện tại chỉ phân quyền theo role
 * (AccountPermission có tồn tại nhưng chỉ dùng cho 5 hành động cụ thể ở
 * trang Quản lý tài khoản, không có cơ chế enforcement chung cho module
 * mới) — người dùng đã xác nhận việc thiết lập bộ quyền chi tiết sẽ làm ở
 * phiên sau ("mai ta sẽ thống kê, thành lập 1 bộ quyền").
 *
 * THỨ TỰ ROUTE: "export"/"sale-accounts"/"pickup-accounts"/"companies" khai
 * báo TRƯỚC ":id" (chỉ PUT dùng ":id", không có GET ":id" nên thực ra
 * không xung đột, nhưng giữ thứ tự này cho nhất quán/an toàn khi mở rộng
 * sau này — khớp quy ước đã ghi ở candidates.controller.ts).
 */
@Controller('sales-entry/ds-sale')
@Roles('admin')
export class SalesEntryController {
  constructor(
    private readonly salesEntryService: SalesEntryService,
    private readonly exportService: SalesEntryExportService,
  ) {}

  @Get()
  list(@Query() query: ListDsSaleQueryDto) {
    return this.salesEntryService.list(query);
  }

  /** Mục 12, yêu cầu người dùng: "Tải Excel" — xuất theo bộ lọc hiện tại, không chỉ trang đang xem. */
  @Get('export')
  async exportXlsx(
    @Query() query: ListDsSaleQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportXlsx(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('sale-accounts')
  listSaleAccounts() {
    return this.salesEntryService.listSaleAccounts();
  }

  @Get('pickup-accounts')
  listPickupAccounts() {
    return this.salesEntryService.listPickupAccounts();
  }

  @Get('companies')
  listCompanies() {
    return this.salesEntryService.listCompanies();
  }

  @Post()
  create(
    @Body() dto: UpsertDsSaleRowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesEntryService.createRow(dto, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDsSaleRowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesEntryService.updateRow(id, dto, user);
  }

  @Delete()
  deleteMany(
    @Body() dto: BulkDeleteDsSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesEntryService.deleteRows(dto.ids, user);
  }
}
