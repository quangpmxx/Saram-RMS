import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { MarketingHubService } from './marketing-hub.service';
import {
  ChangeOwnerDto,
  ConnectAdAccountDto,
  OverviewQueryDto,
  SaveCostThresholdsDto,
  SaveMktSourcesDto,
  SetMktSourceDto,
} from './dto/marketing-hub.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Marketing Hub. Xem: Admin/Quản lý/MKT. Liên kết/đồng bộ/gỡ: Admin hoặc MKT
 * (MKT chỉ với tài khoản của mình — kiểm trong service). Đổi người phụ trách: Admin.
 */
@Controller('marketing-hub')
@Roles('admin', 'manager', 'mkt')
export class MarketingHubController {
  constructor(private readonly service: MarketingHubService) {}

  @Get('overview')
  overview(@Query() query: OverviewQueryDto) {
    return this.service.overview(query);
  }

  /** Khối Marketing hôm nay trên Dashboard (Admin/Quản lý/MKT). */
  @Get('today')
  today() {
    return this.service.today();
  }

  @Post('ad-accounts/connect')
  @HttpCode(200)
  @Roles('admin', 'mkt')
  connect(
    @Body() dto: ConnectAdAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.connect(dto.access_token, user);
  }

  @Post('ad-accounts/:id/sync')
  @HttpCode(200)
  @Roles('admin', 'mkt')
  sync(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.syncNow(id, user);
  }

  @Patch('ad-accounts/:id/owner')
  @Roles('admin')
  changeOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeOwner(id, dto.owner_id, user);
  }

  /** Gắn Nguồn MKT cho TKQC (để đếm số data / giá số): chỉ Admin. */
  @Patch('ad-accounts/:id/mkt-source')
  @Roles('admin')
  setMktSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMktSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setMktSource(id, dto.mkt_source_id ?? null, user);
  }

  /** Ngưỡng tô màu giá số: chỉ Admin sửa (xem kèm trong overview). */
  @Put('cost-thresholds')
  @Roles('admin')
  saveCostThresholds(
    @Body() dto: SaveCostThresholdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveCostThresholds(dto.green_max, dto.red_min, user);
  }

  /** Danh mục Nguồn MKT — xem: Admin/Quản lý/MKT (dùng ở form thêm lao động). */
  @Get('mkt-sources')
  listMktSources() {
    return this.service.listMktSources();
  }

  /** Thêm/sửa/xoá Nguồn MKT: chỉ Admin. */
  @Put('mkt-sources')
  @Roles('admin')
  saveMktSources(
    @Body() dto: SaveMktSourcesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveMktSources(dto.items, user);
  }

  @Delete('ad-accounts/:id')
  @Roles('admin', 'mkt')
  disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.disconnect(id, user);
  }
}
