import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/** Mục 9, docs/13-api-design.md — "Tất cả vai trò đã đăng nhập". */
@Controller('lead-source')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list() {
    return this.catalogService.listLeadSources();
  }
}
