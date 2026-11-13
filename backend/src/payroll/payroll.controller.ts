import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { PAYROLL_VARIABLES, PayrollService } from './payroll.service';
import { PayrollDemoService } from './payroll-demo.service';
import {
  CreatePayrollDto,
  PayrollStatusDto,
  PreviewQueryDto,
  PreviewTemplateDto,
  RespondSlipDto,
  SaveCommissionRatesDto,
  UpdateAccountSettingDto,
  UpdateSlipDto,
  UpsertComponentDto,
  UpsertTemplateDto,
} from './dto/payroll.dto';

/**
 * Tiền lương (2026-11-13) — module "Kế toán" ở trang Phân quyền: Kế toán/Admin sửa,
 * Quản lý chỉ xem (GET). Xem module-registry.ts.
 */
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly demo: PayrollDemoService,
  ) {}

  /** Dữ liệu demo — chỉ máy dev (xem payroll-demo.service.ts). */
  @Get('demo')
  demoAvailable() {
    return { available: this.demo.available };
  }
  @Post('demo')
  seedDemo(@CurrentUser() user: AuthenticatedUser) {
    return this.demo.seed(user);
  }
  @Delete('demo')
  clearDemo() {
    return this.demo.clear();
  }

  @Get('variables')
  variables() {
    return PAYROLL_VARIABLES;
  }

  @Get('components')
  listComponents() {
    return this.service.listComponents();
  }
  @Post('components')
  createComponent(@Body() dto: UpsertComponentDto) {
    return this.service.saveComponent(null, dto);
  }
  @Put('components/:id')
  updateComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertComponentDto,
  ) {
    return this.service.saveComponent(id, dto);
  }
  @Delete('components/:id')
  deleteComponent(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteComponent(id);
  }

  @Get('templates')
  listTemplates() {
    return this.service.listTemplates();
  }
  @Post('templates')
  createTemplate(@Body() dto: UpsertTemplateDto) {
    return this.service.saveTemplate(null, dto);
  }
  @Put('templates/:id')
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.service.saveTemplate(id, dto);
  }
  /** Xem trước mẫu đang sửa (chưa lưu) — chỉ người được sửa. */
  @Post('templates/preview')
  previewTemplate(@Body() dto: PreviewTemplateDto) {
    return this.service.previewTemplate(dto.items, dto.account_id, dto.name);
  }
  /** Xem trước mẫu đã lưu — ai xem được trang Kế toán cũng dùng được. */
  @Get('templates/:id/preview')
  previewSavedTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PreviewQueryDto,
  ) {
    return this.service.previewSavedTemplate(id, query.account_id);
  }
  @Delete('templates/:id')
  deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTemplate(id);
  }

  @Get('account-settings')
  listAccountSettings() {
    return this.service.listAccountSettings();
  }
  @Put('account-settings/:accountId')
  saveAccountSetting(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateAccountSettingDto,
  ) {
    return this.service.saveAccountSetting(accountId, dto);
  }

  @Get('commission-rates')
  listCommissionRates() {
    return this.service.listCommissionRates();
  }
  @Put('commission-rates')
  saveCommissionRates(@Body() dto: SaveCommissionRatesDto) {
    return this.service.saveCommissionRates(dto);
  }

  @Get('periods')
  listPayrolls() {
    return this.service.listPayrolls();
  }
  @Post('periods')
  createPayroll(
    @Body() dto: CreatePayrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createPayroll(dto, user);
  }
  @Get('periods/:id/export')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.service.exportXlsx(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
  @Get('periods/:id')
  getPayroll(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPayroll(id);
  }
  @Post('periods/:id/recompute')
  recompute(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.compute(id);
  }
  @Post('periods/:id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayrollStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeStatus(id, dto.action, user);
  }
  @Delete('periods/:id')
  deletePayroll(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deletePayroll(id);
  }
  @Get('reports/overview')
  reportOverview() {
    return this.service.reportOverview();
  }
  @Get('reports/account/:accountId')
  reportAccountHistory(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.service.reportAccountHistory(accountId);
  }
  @Put('slips/:id')
  updateSlip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlipDto,
  ) {
    return this.service.updateSlip(id, dto);
  }
}

/**
 * "Phiếu lương" của chính người đang đăng nhập — module riêng "payslip" (mặc định mọi
 * vai trò) để nhân viên không cần quyền vào trang Kế toán.
 */
@Controller('my-payslip')
export class MyPayslipController {
  constructor(private readonly service: PayrollService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMySlips(user);
  }

  @Post(':id/respond')
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondSlipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.respondMySlip(id, dto, user);
  }
}
