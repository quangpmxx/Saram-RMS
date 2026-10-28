import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { AnonymousFeedbackController } from './anonymous-feedback.controller';
import { AnonymousFeedbackService } from './anonymous-feedback.service';

/** Không import AuditLogModule — đơn ẩn danh cố ý không ghi audit_logs (xem service). */
@Module({
  imports: [RealtimeModule],
  controllers: [AnonymousFeedbackController],
  providers: [AnonymousFeedbackService],
})
export class AnonymousFeedbackModule {}
