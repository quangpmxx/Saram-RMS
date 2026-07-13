import {
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
} from '@nestjs/common';
import { ShuttleService } from './shuttle.service';
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
@Controller('shuttle')
export class ShuttleController {
  constructor(private readonly shuttleService: ShuttleService) {}

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
}
