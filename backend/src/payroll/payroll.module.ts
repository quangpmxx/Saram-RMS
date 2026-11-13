import { Module } from '@nestjs/common';
import { MyPayslipController, PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollDemoService } from './payroll-demo.service';

/** Tiền lương (2026-11-13): thành phần lương, mẫu bảng lương, bảng lương tháng, phiếu lương. */
@Module({
  controllers: [PayrollController, MyPayslipController],
  providers: [PayrollService, PayrollDemoService],
})
export class PayrollModule {}
