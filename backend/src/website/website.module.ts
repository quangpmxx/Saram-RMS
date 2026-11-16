import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  WebsiteContactsController,
  WebsitePublicController,
  WebsiteTextController,
} from './website.controller';
import { WebsiteService } from './website.service';
import { WebsiteFormsService } from './website-forms.service';

@Module({
  imports: [CandidatesModule, RealtimeModule],
  controllers: [
    WebsitePublicController,
    WebsiteTextController,
    WebsiteContactsController,
  ],
  providers: [WebsiteService, WebsiteFormsService],
})
export class WebsiteModule {}
