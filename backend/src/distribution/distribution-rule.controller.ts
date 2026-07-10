import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { DistributionRuleService } from './distribution-rule.service';
import { UpdateDistributionRuleDto } from './dto/update-distribution-rule.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 5, docs/13-api-design.md. Không gắn @Roles() vì quyền phụ thuộc dữ
 * liệu (nhóm mình) — toàn bộ kiểm tra chi tiết nằm trong DistributionRuleService.
 */
@Controller('distribution-rule')
export class DistributionRuleController {
  constructor(
    private readonly distributionRuleService: DistributionRuleService,
  ) {}

  @Get(':teamId')
  getRule(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.distributionRuleService.getRule(teamId, user);
  }

  @Put(':teamId')
  updateRule(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: UpdateDistributionRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.distributionRuleService.updateRule(teamId, dto, user);
  }

  @Post(':teamId/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.distributionRuleService.activate(teamId, user);
  }

  @Post(':teamId/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.distributionRuleService.pause(teamId, user);
  }
}
