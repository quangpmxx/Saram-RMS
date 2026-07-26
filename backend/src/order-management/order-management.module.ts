import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OrderManagementController } from './order-management.controller';
import { OrderManagementService } from './order-management.service';

@Module({
  imports: [AuditLogModule],
  controllers: [OrderManagementController],
  providers: [OrderManagementService],
})
export class OrderManagementModule {}
