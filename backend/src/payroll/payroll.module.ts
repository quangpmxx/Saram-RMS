import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MyPayslipController, PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollDemoService } from './payroll-demo.service';
import { LaborBonusController } from './labor-bonus.controller';
import { LaborBonusService } from './labor-bonus.service';

/** Tiền lương (2026-11-13): thành phần lương, mẫu bảng lương, bảng lương tháng, phiếu lương. */
@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [PayrollController, MyPayslipController, LaborBonusController],
  providers: [PayrollService, PayrollDemoService, LaborBonusService],
})
export class PayrollModule {}
