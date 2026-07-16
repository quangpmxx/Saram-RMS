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
import { QuickEditCandidateDto } from './dto/quick-edit-candidate.dto';
import { ListCandidatesQueryDto } from './dto/list-candidates-query.dto';
import { PendingCandidatesQueryDto } from './dto/pending-candidates-query.dto';
import { ListDuplicatesQueryDto } from './dto/list-duplicates-query.dto';
import { AssignCandidateDto } from './dto/assign-candidate.dto';
import { AssignBulkDto } from './dto/assign-bulk.dto';
import { TransferCandidateDto } from './dto/transfer-candidate.dto';
import { RemindCallbackDto } from './dto/remind-callback.dto';
import { UpdateCallStatusDto } from './dto/update-call-status.dto';
import { UpdateCallResultDto } from './dto/update-call-result.dto';
import { UpdateZaloStatusDto } from './dto/update-zalo-status.dto';
import { UpdateZaloFriendStatusDto } from './dto/update-zalo-friend-status.dto';
import { UpdateNoteColorDto } from './dto/update-note-color.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { CreateCallbackDto } from './dto/create-callback.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 4-6, docs/13-api-design.md. POST / gắn @Roles('mkt', 'admin') cố định
 * (quy tắc cứng theo vai trò, không phụ thuộc dữ liệu) — Dự án phụ, nâng
 * cấp toàn diện: bổ sung 'admin' theo đúng nguyên tắc đã áp dụng xuyên suốt
 * "Admin/Quản lý kế thừa toàn bộ quyền của vai trò cấp dưới" (yêu cầu trực
 * tiếp người dùng), gốc docs/13 chỉ ghi 'mkt'. Các endpoint còn lại không
 * gắn @Roles() vì quyền phụ thuộc dữ liệu (chủ sở hữu/nhóm) — toàn bộ kiểm
 * tra chi tiết nằm trong CandidatesService/LeadPipelineService.
 *
 * LƯU Ý THỨ TỰ ROUTE: "pending", "duplicate" và "assign-bulk" phải khai báo
 * TRƯỚC ":id" — Nest/Express khớp route theo thứ tự khai báo, nếu ":id" đứng
 * trước thì "GET /candidate/pending" sẽ bị hiểu nhầm thành "GET /candidate/:id"
 * với id="pending".
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

  @Get('duplicate')
  listDuplicates(
    @Query() query: ListDuplicatesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.listDuplicates(query, user);
  }

  @Post()
  @Roles('mkt', 'admin')
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

  /**
   * UI Polish — API MỚI, không thuộc danh sách đã chốt tại Mục 4, docs/13.
   * Cố ý KHÔNG gắn @Roles() và không qua assertCanModify() của update() —
   * cho phép TẤT CẢ vai trò đã đăng nhập sửa nhanh Năm sinh/Địa chỉ trên
   * mọi ứng viên, theo đúng yêu cầu trực tiếp người dùng (xem candidates.service.ts).
   */
  @Put(':id/quick-edit')
  quickEdit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuickEditCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.quickEdit(id, dto, user);
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

  @Post(':id/hold')
  @HttpCode(HttpStatus.OK)
  hold(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.hold(id, user);
  }

  @Delete(':id/hold')
  @HttpCode(HttpStatus.OK)
  unhold(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.unhold(id, user);
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

  /** Yêu cầu trực tiếp người dùng (2026-07-16): danh sách thành viên nhóm để chọn khi "Nhắc gọi lại". */
  @Get(':id/remind-target')
  getRemindTargets(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.getRemindTargets(id, user);
  }

  /** Yêu cầu trực tiếp người dùng (2026-07-16): "Nhắc gọi lại" — gửi thông báo nổi/chuông/âm thanh cho 1 thành viên trong nhóm. */
  @Post(':id/remind')
  @HttpCode(HttpStatus.OK)
  remindCallback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemindCallbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidatesService.remindCallback(id, dto, user);
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

  @Put(':id/zalo-status')
  updateZaloStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZaloStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateZaloStatus(id, dto, user);
  }

  @Put(':id/zalo-friend-status')
  updateZaloFriendStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZaloFriendStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateZaloFriendStatus(id, dto, user);
  }

  @Put(':id/note-color')
  updateNoteColor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteColorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateNoteColor(id, dto, user);
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

  @Put(':id/note/:noteId')
  updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateNote(id, noteId, dto, user);
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
