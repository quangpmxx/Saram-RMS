import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AllowWithoutModule } from '../common/decorators/require-cap.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AttendanceSheetService } from './attendance-sheet.service';
import {
  MySheetQueryDto,
  RespondSheetDto,
  SendSheetsDto,
  SheetMonthQueryDto,
} from './dto/attendance-sheet.dto';

/** Bảng công tháng gửi nhân viên xác nhận (2026-11-14). Quyền chi tiết kiểm trong service. */
@Controller('attendance')
export class AttendanceSheetController {
  constructor(private readonly sheets: AttendanceSheetService) {}

  @Get('sheets')
  list(
    @Query() query: SheetMonthQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheets.listForManager(query, user);
  }

  @Post('sheets/send')
  send(@Body() dto: SendSheetsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sheets.send(dto, user);
  }

  @Post('sheets/remind')
  remind(
    @Body() dto: SheetMonthQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheets.remind(dto, user);
  }

  @Post('sheets/notify-accounting')
  notifyAccounting(
    @Body() dto: SheetMonthQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheets.notifyAccounting(dto, user);
  }

  @Get('my-sheet')
  mine(
    @Query() query: MySheetQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheets.getMine(query, user);
  }

  /** Bảng công của chính mình: nhân viên chỉ có quyền "xem" trang Chấm công vẫn xác nhận được. */
  @AllowWithoutModule()
  @Post('my-sheet/respond')
  respond(
    @Body() dto: RespondSheetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sheets.respond(dto, user);
  }
}
