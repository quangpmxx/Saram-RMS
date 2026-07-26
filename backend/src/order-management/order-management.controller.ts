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
} from '@nestjs/common';
import { OrderManagementService } from './order-management.service';
import { CreateOrderRecordDto } from './dto/create-order-record.dto';
import { UpdateOrderRecordDto } from './dto/update-order-record.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-26, yêu cầu trực tiếp người dùng):
 * module "Quản lý đơn hàng" — không gắn @Roles() ở đây, quyền truy cập
 * (chỉ Admin xem/dùng được) do ModulePermissionGuard chặn qua registry
 * (module-permission/module-registry.ts, code "order-management",
 * defaultRoles ['admin']).
 */
@Controller('order-management')
export class OrderManagementController {
  constructor(
    private readonly orderManagementService: OrderManagementService,
  ) {}

  @Get()
  list() {
    return this.orderManagementService.list();
  }

  @Post()
  create(
    @Body() dto: CreateOrderRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orderManagementService.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orderManagementService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.orderManagementService.remove(id, user);
    return { message: 'Đã xóa đơn hàng' };
  }
}
