import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListStatusQueryDto } from './dto/list-status-query.dto';

/** Mục 9, docs/13-api-design.md — "Tất cả vai trò đã đăng nhập". */
@Controller('status')
export class StatusController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Query() query: ListStatusQueryDto) {
    return this.catalogService.listStatusCatalog(query.category);
  }
}
