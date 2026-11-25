import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireCap } from '../common/decorators/require-cap.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AiAssistantService } from './ai-assistant.service';
import {
  AskAiDto,
  ListAiModelsDto,
  SaveAiConfigDto,
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
  async speak(@Body() dto: SpeakAiDto, @Res() res: Response) {
    const wav = await this.service.speak(dto.text);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
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
