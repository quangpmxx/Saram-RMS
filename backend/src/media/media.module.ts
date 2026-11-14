import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaVideoController } from './media-video.controller';
import { MediaVideoService } from './media-video.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MediaController, MediaVideoController],
  providers: [MediaService, MediaVideoService],
})
export class MediaModule {}
