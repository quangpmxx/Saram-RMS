import { RequireCap } from '../common/decorators/require-cap.decorator';
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
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { TeamMembersQueryDto } from './dto/team-members-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 3, docs/13-api-design.md. Dự án phụ — nâng cấp toàn diện: bổ sung
 * 'mkt' vào GET / — MKT giờ bắt buộc chọn nhóm khi up data mới (POST
 * /candidate), cần danh sách nhóm để hiển thị lựa chọn.
 */
@Controller('team')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // Phân quyền chi tiết (2026-11-07): mọi vai trò gọi được — phạm vi nhóm
  // xem được kiểm ở TeamsService (canSeeAllTeams).
  @Get()
  list(
    @Query() query: ListTeamsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.list(query, user);
  }

  @Post()
  @RequireCap('team.manage')
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Put(':id')
  @RequireCap('team.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.update(id, dto, user.id);
  }

  /** Yêu cầu trực tiếp người dùng (2026-07-15): xóa nhóm — cho xóa kể cả còn thành viên (tự gỡ). */
  @Delete(':id')
  @RequireCap('team.manage')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.teamsService.delete(id, user.id);
    return { message: 'Đã xóa nhóm' };
  }

  @Get(':id/member')
  getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TeamMembersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.getMembers(id, user, query);
  }
}
