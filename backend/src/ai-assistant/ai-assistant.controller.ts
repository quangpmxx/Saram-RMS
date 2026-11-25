import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireCap } from '../common/decorators/require-cap.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AiAssistantService } from './ai-assistant.service';
import { AskAiDto, ListAiModelsDto, SaveAiConfigDto } from './ai-assistant.dto';

/**
 * Trợ lý AI (2026-11-25): hỏi bằng Gemini (voice.assistant); liên kết khoá Gemini ở Cài đặt
 * tài khoản (voice.ai_config — mặc định chỉ Admin). Mỗi công cụ AI gọi tự kiểm quyền người hỏi.
 */
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly service: AiAssistantService) {}

  @Get('status')
  @RequireCap('voice.assistant')
  status() {
    return this.service.status();
  }

  @Post('ask')
  @HttpCode(200)
  @RequireCap('voice.assistant')
  ask(@Body() dto: AskAiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.ask(dto, user);
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
