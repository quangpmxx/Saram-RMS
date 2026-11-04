import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CandidatesModule } from '../candidates/candidates.module';
import {
  PancakeAutoUpController,
  PancakeController,
} from './pancake.controller';
import { PancakeService } from './pancake.service';

@Module({
  imports: [AuditLogModule, CandidatesModule],
  controllers: [PancakeController, PancakeAutoUpController],
  providers: [PancakeService],
})
export class PancakeModule {}
