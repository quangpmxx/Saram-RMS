import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { StatusController } from './status.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, StatusController],
  providers: [CatalogService],
})
export class CatalogModule {}
