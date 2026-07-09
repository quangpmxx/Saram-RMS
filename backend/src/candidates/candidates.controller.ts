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
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { ListCandidatesQueryDto } from './dto/list-candidates-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 4, docs/13-api-design.md. Chỉ POST gắn @Roles('mkt') cố định (quy tắc
 * cứng theo vai trò, không phụ thuộc dữ liệu). Các endpoint còn lại không
 * gắn @Roles() vì quyền phụ thuộc dữ liệu (chủ sở hữu/nhóm) — toàn bộ kiểm
 * tra chi tiết nằm trong CandidatesService.
 */
@Controller('candidate')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  list(
    @Query() query: ListCandidatesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.list(query, user);
  }

  @Post()
  @Roles('mkt')
  create(
    @Body() dto: CreateCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.create(dto, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.candidatesService.remove(id, user);
    return { message: 'Đã xóa ứng viên' };
  }
}
