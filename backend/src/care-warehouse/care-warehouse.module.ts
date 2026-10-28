import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { CareProgressController } from './care-progress.controller';
import { CareWarehouseController } from './care-warehouse.controller';
import { CareWarehouseService } from './care-warehouse.service';

@Module({
  imports: [RealtimeModule],
  controllers: [CareWarehouseController, CareProgressController],
  providers: [CareWarehouseService],
})
export class CareWarehouseModule {}
