import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CareWarehouseService } from './care-warehouse.service';
import { ListCareWarehouseQueryDto } from './dto/list-care-warehouse-query.dto';
import { AssignCareDto, ReassignCareDto } from './dto/assign-care.dto';
import { RandomConfirmDto, RandomPreviewDto } from './dto/random-assign.dto';
import { ListBatchesQueryDto } from './dto/list-batches-query.dto';

/**
 * Kho chăm sóc (2026-10-28). Thuộc module quyền "Data lao động" (xem
 * module-registry.ts). Không gắn @Roles() vì quyền phụ thuộc dữ liệu
 * (nhóm, người được giao) — toàn bộ kiểm tra nằm trong CareWarehouseService.
 * Route tĩnh khai báo TRƯỚC route `:leadId/...` để "random/preview" không
 * bị khớp nhầm thành `:leadId`.
 */
@Controller('care-warehouse')
export class CareWarehouseController {
  constructor(private readonly service: CareWarehouseService) {}

  @Get()
  list(
    @Query() query: ListCareWarehouseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(query, user);
  }

  @Get('batches')
  listBatches(
    @Query() query: ListBatchesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listBatches(query, user);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  assign(@Body() dto: AssignCareDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.assignManual(dto.lead_ids, dto.assignee_id, user);
  }

  @Post('random/preview')
  @HttpCode(HttpStatus.OK)
  randomPreview(
    @Body() dto: RandomPreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.randomPreview(dto, user);
  }

  @Post('random/confirm')
  @HttpCode(HttpStatus.OK)
  randomConfirm(
    @Body() dto: RandomConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.randomConfirm(dto.pairs, user);
  }

  @Get(':leadId/assignments')
  leadAssignments(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.leadAssignments(leadId, user);
  }

  @Post(':leadId/claim')
  @HttpCode(HttpStatus.OK)
  claim(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.claim(leadId, user);
  }

  @Post(':leadId/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.revoke(leadId, user);
  }

  @Post(':leadId/reassign')
  @HttpCode(HttpStatus.OK)
  reassign(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: ReassignCareDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reassign(leadId, dto.assignee_id, user);
  }

  @Post(':leadId/stop')
  @HttpCode(HttpStatus.OK)
  stop(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setCareStopped(leadId, true, user);
  }

  @Post(':leadId/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setCareStopped(leadId, false, user);
  }

  /** Leader/Quản lý/Admin duyệt đề nghị dừng chăm sóc của Sale. */
  @Post(':leadId/stop-request/approve')
  @HttpCode(HttpStatus.OK)
  approveStopRequest(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.decideStopRequest(leadId, true, user);
  }

  @Post(':leadId/stop-request/reject')
  @HttpCode(HttpStatus.OK)
  rejectStopRequest(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.decideStopRequest(leadId, false, user);
  }
}
