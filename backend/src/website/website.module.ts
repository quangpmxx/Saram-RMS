import { Module } from '@nestjs/common';
import {
  WebsitePublicController,
  WebsiteTextController,
} from './website.controller';
import { WebsiteService } from './website.service';

@Module({
  controllers: [WebsitePublicController, WebsiteTextController],
  providers: [WebsiteService],
})
export class WebsiteModule {}
