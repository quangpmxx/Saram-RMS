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
import { RecruitmentScheduleService } from './recruitment-schedule.service';
import {
  AssignTeamDto,
  CreateRecruitmentPostingDto,
  UpdateRecruitmentPostingDto,
} from './dto/recruitment-posting.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Lịch tuyển dụng (2026-11-11): không gắn @Roles() — quyền vào trang/sửa do
 * ModulePermissionGuard chặn qua registry (code "recruitment-schedule":
 * người "chỉ xem" chỉ gọi được GET). Phạm vi theo nhóm (mỗi nhóm một lịch
 * riêng) do service tự giới hạn.
 */
@Controller('recruitment-schedule')
export class RecruitmentScheduleController {
  constructor(private readonly service: RecruitmentScheduleService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }

  @Get('teams')
  teams(@CurrentUser() user: AuthenticatedUser) {
    return this.service.teams(user);
  }

  @Post()
  create(
    @Body() dto: CreateRecruitmentPostingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Post('assign-team')
  @HttpCode(HttpStatus.OK)
  assignTeam(
    @Body() dto: AssignTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.assignUnassigned(dto.team_id, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecruitmentPostingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.remove(id, user);
    return { message: 'Đã xoá khỏi Lịch tuyển' };
  }
}
