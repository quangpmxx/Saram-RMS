import { Controller, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/** Mục 7, docs/13-api-design.md — "Tất cả vai trò" (phạm vi theo quyền xem). */
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  getEvents(
    @Query() query: CalendarQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarService.getEvents(query, user);
  }
}
