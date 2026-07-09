import {
  Body,
  Controller,
  Get,
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
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/** Mục 3, docs/13-api-design.md */
@Controller('team')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles('admin', 'manager', 'leader')
  list(
    @Query() query: ListTeamsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.list(query, user);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.update(id, dto, user.id);
  }

  @Get(':id/member')
  @Roles('admin', 'manager', 'leader')
  getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.getMembers(id, user);
  }
}
