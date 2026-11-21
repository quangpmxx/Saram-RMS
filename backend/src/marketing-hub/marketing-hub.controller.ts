import {
  AllowWithoutModule,
  RequireCap,
} from '../common/decorators/require-cap.decorator';
import {
  BadRequestException,
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
  MarketingPeriodQueryDto,
  OverviewQueryDto,
  SaveCostThresholdsDto,
  SaveMktSourcesDto,
  SetAdsetStatusDto,
  SetMktSourceDto,
} from './dto/marketing-hub.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Marketing Hub. Xem: Admin/Quản lý/MKT. Liên kết/đồng bộ/gỡ: Admin hoặc MKT
 * (MKT chỉ với tài khoản của mình — kiểm trong service). Đổi người phụ trách: Admin.
 */
@Controller('marketing-hub')
export class MarketingHubController {
  constructor(private readonly service: MarketingHubService) {}

  @Get('overview')
  overview(@Query() query: OverviewQueryDto) {
    return this.service.overview(query);
  }

  /** Bảng Data theo camp: số data Pancake từ quảng cáo theo nhân viên + camp, kèm số đỏ/vàng/xanh/đóng. */
  @Get('campaign-data')
  campaignData(
    @Query() query: OverviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.campaignData(query, user);
  }

  /** Bật/tắt 1 ad set trên Facebook (MKT: chỉ TKQC mình phụ trách — kiểm trong service). */
  @Patch('adsets/:adsetId/status')
  @RequireCap('mkt.toggle_adset')
  setAdsetStatus(
    @Param('adsetId') adsetId: string,
    @Body() dto: SetAdsetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!/^d{1,64}$/.test(adsetId))
      throw new BadRequestException('Mã ad set không hợp lệ');
    return this.service.setAdsetActive(adsetId, dto.active, user);
  }

  /** Nút Làm mới bảng Data theo ad set: tra lại ngay tên ad set còn thiếu với Facebook. */
  @Post('campaign-data/refresh')
  @HttpCode(200)
  refreshAdsets() {
    return this.service.refreshAdsets();
  }

  /** Khối Chi phí Marketing trên Dashboard (Admin/Quản lý/MKT) — theo khoảng from/to, trống = hôm nay. */
  @Get('today')
  @AllowWithoutModule()
  @RequireCap('dashboard.mkt_cost')
  today(@Query() query: MarketingPeriodQueryDto) {
    return this.service.today(query);
  }

  @Post('ad-accounts/connect')
  @HttpCode(200)
  @RequireCap('mkt.link_own')
  connect(
    @Body() dto: ConnectAdAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.connect(dto.access_token, user);
  }

  /** Quét token đã lưu để thêm tài khoản quảng cáo mới (đặt trước route :id). */
  @Post('ad-accounts/discover')
  @HttpCode(200)
  @RequireCap('mkt.link_own')
  discover(@CurrentUser() user: AuthenticatedUser) {
    return this.service.discoverNew(user);
  }

  @Post('ad-accounts/:id/sync')
  @HttpCode(200)
  @RequireCap('mkt.link_own')
  sync(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.syncNow(id, user);
  }

  @Patch('ad-accounts/:id/owner')
  @RequireCap('mkt.assign_owner')
  changeOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeOwner(id, dto.owner_id, user);
  }

  /** Gắn Nguồn MKT cho TKQC (để đếm số data / giá số): chỉ Admin. */
  @Patch('ad-accounts/:id/mkt-source')
  @RequireCap('mkt.config')
  setMktSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMktSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setMktSource(id, dto.mkt_source_id ?? null, user);
  }

  /** Ngưỡng tô màu giá số: chỉ Admin sửa (xem kèm trong overview). */
  @Put('cost-thresholds')
  @RequireCap('mkt.config')
  saveCostThresholds(
    @Body() dto: SaveCostThresholdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveCostThresholds(dto.green_max, dto.red_min, user);
  }

  /** Danh mục Nguồn MKT — xem: Admin/Quản lý/MKT (dùng ở form thêm lao động). */
  @Get('mkt-sources')
  @AllowWithoutModule()
  listMktSources() {
    return this.service.listMktSources();
  }

  /** Thêm/sửa/xoá Nguồn MKT: chỉ Admin. */
  @Put('mkt-sources')
  @RequireCap('mkt.config')
  saveMktSources(
    @Body() dto: SaveMktSourcesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveMktSources(dto.items, user);
  }

  @Delete('ad-accounts/:id')
  @RequireCap('mkt.link_own')
  disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.disconnect(id, user);
  }
}
