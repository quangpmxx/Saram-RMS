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
import { LeadPipelineService } from './lead-pipeline.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { ListCandidatesQueryDto } from './dto/list-candidates-query.dto';
import { PendingCandidatesQueryDto } from './dto/pending-candidates-query.dto';
import { AssignCandidateDto } from './dto/assign-candidate.dto';
import { AssignBulkDto } from './dto/assign-bulk.dto';
import { TransferCandidateDto } from './dto/transfer-candidate.dto';
import { UpdateCallStatusDto } from './dto/update-call-status.dto';
import { UpdateCallResultDto } from './dto/update-call-result.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { CreateCallbackDto } from './dto/create-callback.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 4-6, docs/13-api-design.md. Chỉ POST / gắn @Roles('mkt') cố định (quy
 * tắc cứng theo vai trò, không phụ thuộc dữ liệu). Các endpoint còn lại
 * không gắn @Roles() vì quyền phụ thuộc dữ liệu (chủ sở hữu/nhóm) — toàn bộ
 * kiểm tra chi tiết nằm trong CandidatesService/LeadPipelineService.
 *
 * LƯU Ý THỨ TỰ ROUTE: "pending" và "assign-bulk" phải khai báo TRƯỚC ":id"
 * — Nest/Express khớp route theo thứ tự khai báo, nếu ":id" đứng trước thì
 * "GET /candidate/pending" sẽ bị hiểu nhầm thành "GET /candidate/:id" với
 * id="pending".
 */
@Controller('candidate')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly pipelineService: LeadPipelineService,
  ) {}

  @Get()
  list(
    @Query() query: ListCandidatesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.list(query, user);
  }

  @Get('pending')
  getPending(
    @Query() query: PendingCandidatesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.getPending(query, user);
  }

  @Post()
  @Roles('mkt')
  create(
    @Body() dto: CreateCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.create(dto, user);
  }

  @Post('assign-bulk')
  @HttpCode(HttpStatus.OK)
  assignBulk(
    @Body() dto: AssignBulkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.assignBulk(dto, user);
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

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.assign(id, dto, user);
  }

  @Post(':id/transfer')
  @HttpCode(HttpStatus.OK)
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.transfer(id, dto, user);
  }

  @Get(':id/duplicates')
  getDuplicateDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.getDuplicateDetail(id, user);
  }

  @Put(':id/call-status')
  updateCallStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateCallStatus(id, dto, user);
  }

  @Put(':id/call-result')
  updateCallResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateCallResult(id, dto, user);
  }

  @Get(':id/note')
  listNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListNotesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.listNotes(id, query, user);
  }

  @Post(':id/note')
  createNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.createNote(id, dto, user);
  }

  @Delete(':id/note/:noteId')
  @HttpCode(HttpStatus.OK)
  async deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.pipelineService.deleteNote(id, noteId, user);
    return { message: 'Đã xóa ghi chú' };
  }

  @Post(':id/interview')
  createInterview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.createInterview(id, dto, user);
  }

  @Get(':id/interview')
  listInterviews(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.listInterviews(id, user);
  }

  @Post(':id/callback')
  createCallback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCallbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.createCallback(id, dto, user);
  }
}
