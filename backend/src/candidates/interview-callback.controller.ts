import { Body, Controller, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { LeadPipelineService } from './lead-pipeline.service';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { UpdateCallbackDto } from './dto/update-callback.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 6, docs/13-api-design.md — PUT /interview/:id và PUT /callback/:id
 * không nằm dưới tiền tố "/candidate" nên tách controller riêng (Nest chỉ
 * cho 1 tiền tố cố định mỗi @Controller()). Quyền/logic đầy đủ nằm trong
 * LeadPipelineService, giống các endpoint khác thuộc Mục 6.
 */
@Controller()
export class InterviewCallbackController {
  constructor(private readonly pipelineService: LeadPipelineService) {}

  @Put('interview/:id')
  updateInterview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateInterview(id, dto, user);
  }

  @Put('callback/:id')
  updateCallback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.updateCallback(id, dto, user);
  }
}
