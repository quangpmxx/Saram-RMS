import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { LaborBonusService } from './labor-bonus.service';
import {
  LaborBonusQueryDto,
  MarkLaborBonusPaidDto,
  UnmarkLaborBonusPaidDto,
} from './dto/labor-bonus.dto';

/**
 * Kế toán › Thưởng lao động (2026-11-15) — cùng module "Kế toán" ở trang Phân quyền:
 * Kế toán/Admin tick chi, Quản lý chỉ xem (GET). Xem module-registry.ts.
 */
@Controller('labor-bonus')
export class LaborBonusController {
  constructor(private readonly service: LaborBonusService) {}

  @Get()
  list(@Query() query: LaborBonusQueryDto) {
    return this.service.list(query);
  }

  @Get('export')
  async export(
    @Query() query: LaborBonusQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.service.exportXlsx(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('mark-paid')
  markPaid(
    @Body() dto: MarkLaborBonusPaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markPaid(dto, user);
  }

  @Post('unmark-paid')
  unmarkPaid(
    @Body() dto: UnmarkLaborBonusPaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.unmarkPaid(dto.ids, user);
  }
}
