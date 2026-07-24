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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "DS Sale" — module con của
 * "Nhập doanh số".
 *
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, "Phân quyền" phiên bản đơn
 * giản): BỎ `@Roles('admin')` cấp controller cũ — thay bằng
 * ModulePermissionGuard (toàn cục, xem module-permission.guard.ts) tra
 * theo module "sales-entry" (defaultRoles ['admin'], khớp y hệt hành vi
 * cũ khi Admin CHƯA cấu hình gì riêng) — cho phép Admin cấp quyền
 * Xem/Chỉnh sửa module này cho tài khoản khác qua trang "Phân quyền" mà
 * không cần sửa code.
 *
 * THỨ TỰ ROUTE: "export"/"sale-accounts"/"pickup-accounts"/"companies" khai
 * báo TRƯỚC ":id" (chỉ PUT dùng ":id", không có GET ":id" nên thực ra
 * không xung đột, nhưng giữ thứ tự này cho nhất quán/an toàn khi mở rộng
 * sau này — khớp quy ước đã ghi ở candidates.controller.ts).
 */
@Controller('sales-entry/ds-sale')
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
