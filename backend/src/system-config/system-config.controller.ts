import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/** Mục 9, docs/13-api-design.md — "Quyền sử dụng: Admin" cho cả 2 endpoint. */
@Controller('config')
@Roles('admin')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  list() {
    return this.systemConfigService.list();
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.systemConfigService.update(key, dto, user);
  }
}
