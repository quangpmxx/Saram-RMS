import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { MEDIA_MAX_FILE_BYTES, MediaService } from './media.service';
import {
  CreateMediaTaskDto,
  MediaCampaignDto,
  MediaCommentDto,
  MediaIdeaDto,
  MediaMetricsDto,
  MediaPlanDto,
  MediaPublicationDto,
  MediaReviewDto,
  MediaSubmitDto,
  MediaTaskProgressDto,
  MediaTaskStatusDto,
  UpdateMediaTaskDto,
} from './dto/media.dto';

/**
 * Media (2026-11-14). Vào trang / mức Xem-Sửa: ModulePermissionGuard (module
 * "media"). Quyền nhỏ (giao việc, duyệt, kế hoạch, lịch đăng, báo cáo) kiểm ở
 * MediaService bằng `can()` — capability-catalog, module 'media'.
 */
@Controller('media')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Get('options')
  options(@CurrentUser() user: AuthenticatedUser) {
    return this.service.options(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dashboard(user);
  }

  @Get('report')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.report(user, from, to);
  }

  // ---------------------------------------------------------------- chiến dịch
  @Get('campaigns')
  campaigns() {
    return this.service.listCampaigns();
  }

  @Post('campaigns')
  createCampaign(
    @Body() dto: MediaCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveCampaign(null, dto, user);
  }

  @Put('campaigns/:id')
  updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveCampaign(id, dto, user);
  }

  @Delete('campaigns/:id')
  removeCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeCampaign(id, user);
  }

  // ---------------------------------------------------------------- kế hoạch
  @Get('plans')
  plans(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.listPlans(from, to);
  }

  @Post('plans')
  createPlan(
    @Body() dto: MediaPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.savePlan(null, dto, user);
  }

  @Put('plans/:id')
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.savePlan(id, dto, user);
  }

  @Delete('plans/:id')
  removePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removePlan(id, user);
  }

  // ---------------------------------------------------------------- công việc
  @Get('tasks')
  tasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('assignee_id') assigneeId?: string,
    @Query('campaign_id') campaignId?: string,
    @Query('plan_id') planId?: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
  ) {
    return this.service.listTasks(user, {
      status,
      assignee_id: assigneeId,
      campaign_id: campaignId,
      plan_id: planId,
      q,
      mine,
    });
  }

  @Get('tasks/:id')
  task(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getTask(id, user);
  }

  @Post('tasks')
  createTask(
    @Body() dto: CreateMediaTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createTask(dto, user);
  }

  @Put('tasks/:id')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateTask(id, dto, user);
  }

  @Delete('tasks/:id')
  removeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeTask(id, user);
  }

  @Patch('tasks/:id/status')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaTaskStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeStatus(id, dto.status, user);
  }

  @Patch('tasks/:id/progress')
  progress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaTaskProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeProgress(id, dto.progress, user);
  }

  @Post('tasks/:id/comments')
  comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.comment(id, dto.content, user);
  }

  @Post('tasks/:id/submissions')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MEDIA_MAX_FILE_BYTES },
    }),
  )
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaSubmitDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submit(id, dto, file, user);
  }

  // ---------------------------------------------------------------- duyệt
  @Get('reviews/pending')
  pendingReviews(@CurrentUser() user: AuthenticatedUser) {
    return this.service.pendingReviews(user);
  }

  @Get('reviews/history')
  reviewHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.service.reviewHistory(user);
  }

  @Post('submissions/:id/review')
  @HttpCode(HttpStatus.OK)
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.review(id, dto, user);
  }

  @Get('submissions/:id/file')
  file(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.downloadFile(id, user);
  }

  // ---------------------------------------------------------------- ý tưởng
  @Get('ideas')
  ideas(
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('campaign_id') campaignId?: string,
  ) {
    return this.service.listIdeas({ q, kind, status, campaign_id: campaignId });
  }

  @Get('ideas/similar')
  similar(@Query('title') title: string, @Query('exclude') exclude?: string) {
    return this.service.similarIdeas(title, exclude);
  }

  @Post('ideas')
  createIdea(
    @Body() dto: MediaIdeaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveIdea(null, dto, user);
  }

  @Put('ideas/:id')
  updateIdea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaIdeaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveIdea(id, dto, user);
  }

  @Delete('ideas/:id')
  removeIdea(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeIdea(id, user);
  }

  // ---------------------------------------------------------------- lịch xuất bản
  @Get('publications')
  publications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listPublications(user, from, to);
  }

  @Post('publications')
  createPublication(
    @Body() dto: MediaPublicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.savePublication(null, dto, user);
  }

  @Put('publications/:id')
  updatePublication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaPublicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.savePublication(id, dto, user);
  }

  @Patch('publications/:id/metrics')
  metrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaMetricsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateMetrics(id, dto, user);
  }

  @Delete('publications/:id')
  removePublication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removePublication(id, user);
  }
}
