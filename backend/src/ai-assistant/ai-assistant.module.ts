import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { CareWarehouseModule } from '../care-warehouse/care-warehouse.module';
import { MarketingHubModule } from '../marketing-hub/marketing-hub.module';
import { ModulePermissionModule } from '../module-permission/module-permission.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [
    AuditLogModule,
    DashboardModule,
    CareWarehouseModule,
    MarketingHubModule,
    ModulePermissionModule,
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
