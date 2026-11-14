import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
