import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CareWarehouseService } from './care-warehouse.service';
import { CareProgressQueryDto } from './dto/care-progress-query.dto';

/**
 * Tiến độ chăm sóc — 1 API DUY NHẤT cho cả khối trên Dashboard lẫn tab
 * "Tiến độ chăm sóc" trong Báo cáo, để 2 nơi luôn ra cùng con số. Thuộc
 * module quyền "Trang chủ Dashboard" (xem module-registry.ts); phạm vi dữ
 * liệu theo vai trò kiểm tra trong CareWarehouseService.progress().
 */
@Controller('care-progress')
export class CareProgressController {
  constructor(private readonly service: CareWarehouseService) {}

  @Get()
  progress(
    @Query() query: CareProgressQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.progress(query, user);
  }
}
