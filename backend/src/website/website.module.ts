import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  WebsiteContactsController,
  WebsiteManageController,
  WebsitePublicController,
  WebsiteTextController,
} from './website.controller';
import { WebsiteService } from './website.service';
import { WebsiteFormsService } from './website-forms.service';
import { WebsiteContentService } from './website-content.service';

@Module({
  imports: [CandidatesModule, RealtimeModule],
  controllers: [
    WebsitePublicController,
    WebsiteTextController,
    WebsiteContactsController,
    WebsiteManageController,
  ],
  providers: [WebsiteService, WebsiteFormsService, WebsiteContentService],
})
export class WebsiteModule {}
