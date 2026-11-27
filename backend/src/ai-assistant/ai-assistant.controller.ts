import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireCap } from '../common/decorators/require-cap.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AiAssistantService } from './ai-assistant.service';
import {
  AiChatLogQueryDto,
  AskAiDto,
  ListAiModelsDto,
  SaveAiConfigDto,
  SaveAiBudgetDto,
  SaveAiKnowledgeDto,
  SpeakAiDto,
} from './ai-assistant.dto';

/**
 * Trợ lý AI (2026-11-25): hỏi bằng Gemini (voice.assistant); liên kết khoá Gemini ở Cài đặt
 * tài khoản (voice.ai_config — mặc định chỉ Admin). Mỗi công cụ AI gọi tự kiểm quyền người hỏi.
 */
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly service: AiAssistantService) {}

  @Get('status')
  @RequireCap('voice.assistant')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.status(user);
  }

  @Post('ask')
  @HttpCode(200)
  @RequireCap('voice.assistant')
  ask(@Body() dto: AskAiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.ask(dto, user);
  }

  /** Đọc câu trả lời bằng giọng Gemini (WAV) — giọng giống nhau mọi trình duyệt. */
  @Post('speak')
  @HttpCode(200)
  @RequireCap('voice.assistant')
  async speak(
    @Body() dto: SpeakAiDto,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const wav = await this.service.speak(dto.text, user);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
  }

  /** Nghe bằng Gemini: nhận đoạn ghi âm (≤ 3 MB, ~20 giây), trả lại chữ. */
  @Post('transcribe')
  @HttpCode(200)
  @RequireCap('voice.assistant')
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: 3 * 1024 * 1024 } }),
  )
  transcribe(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.transcribe(file, user);
  }

  /** Trang Lịch sử chat AI: lọc ngày / nhân viên / gõ-nói / từ khoá, tổng hợp + chi tiết. */
  @Get('logs')
  @RequireCap('voice.view_chat_logs')
  chatLogs(@Query() q: AiChatLogQueryDto) {
    return this.service.chatLogs(q);
  }

  @Get('config')
  @RequireCap('voice.ai_config')
  getConfig() {
    return this.service.getConfig();
  }

  @Put('config')
  @RequireCap('voice.ai_config')
  saveConfig(
    @Body() dto: SaveAiConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveConfig(dto, user);
  }

  /** Trần chi phí AI mỗi tháng (USD). */
  @Put('budget')
  @RequireCap('voice.ai_config')
  saveBudget(
    @Body() dto: SaveAiBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveBudget(dto.monthly_budget_usd ?? null, user);
  }

  @Put('knowledge')
  @RequireCap('voice.ai_config')
  saveKnowledge(
    @Body() dto: SaveAiKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveKnowledge(dto, user);
  }

  /** POST để khoá vừa nhập (chưa lưu) đi trong body, không nằm trên URL. */
  @Post('models')
  @HttpCode(200)
  @RequireCap('voice.ai_config')
  listModels(@Body() dto: ListAiModelsDto) {
    return this.service.listModels(dto.api_key);
  }

  @Delete('config')
  @RequireCap('voice.ai_config')
  removeConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.service.removeConfig(user);
  }
}
