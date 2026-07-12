import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ColumnWidthService } from './column-width.service';
import { UpdateColumnWidthDto } from './dto/update-column-width.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện: độ rộng cột do Admin tùy chỉnh, áp dụng
 * chung cho mọi tài khoản. GET cố ý KHÔNG gắn @Roles() — mọi vai trò đã
 * đăng nhập đều đọc được để render đúng độ rộng đã lưu (khác /config vốn
 * chỉ Admin đọc được); PUT chỉ Admin mới chỉnh được.
 */
@Controller('column-width')
export class ColumnWidthController {
  constructor(private readonly columnWidthService: ColumnWidthService) {}

  @Get()
  list() {
    return this.columnWidthService.list();
  }

  @Put(':tableKey')
  @Roles('admin')
  update(
    @Param('tableKey') tableKey: string,
    @Body() dto: UpdateColumnWidthDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.columnWidthService.upsert(tableKey, dto, user);
  }
}
