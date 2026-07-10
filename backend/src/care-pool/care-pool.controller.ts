import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CarePoolService } from './care-pool.service';
import { ListCarePoolQueryDto } from './dto/list-care-pool-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 5, docs/13-api-design.md. Không gắn @Roles() vì quyền phụ thuộc dữ
 * liệu (nhóm/người giữ khóa) — toàn bộ kiểm tra chi tiết nằm trong
 * CarePoolService.
 */
@Controller('care-pool')
export class CarePoolController {
  constructor(private readonly carePoolService: CarePoolService) {}

  @Get()
  list(
    @Query() query: ListCarePoolQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.carePoolService.list(query, user);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.carePoolService.lock(id, user);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.carePoolService.release(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.carePoolService.remove(id, user);
    return { message: 'Đã gỡ khỏi cột chăm sóc' };
  }
}
