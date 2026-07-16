import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TeamsModule } from './teams/teams.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ImportsModule } from './imports/imports.module';
import { CatalogModule } from './catalog/catalog.module';
import { CalendarModule } from './calendar/calendar.module';
import { CarePoolModule } from './care-pool/care-pool.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { DistributionModule } from './distribution/distribution.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationModule } from './notification/notification.module';
import { PermissionModule } from './permission/permission.module';
import { ColumnWidthModule } from './column-width/column-width.module';
import { ShuttleModule } from './shuttle/shuttle.module';
import { SaleReminderModule } from './sale-reminder/sale-reminder.module';
import { DailyReportsModule } from './daily-reports/daily-reports.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveAccrualModule } from './leave-accrual/leave-accrual.module';
import { CheckinModule } from './checkin/checkin.module';
import { ReportPenaltyModule } from './report-penalty/report-penalty.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { RealtimeModule } from './realtime/realtime.module';
import { BirthdayModule } from './birthday/birthday.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Phase 5 — bộ lập lịch/worker nền, bắt buộc cho Cột chăm sóc (M6, Mục
    // 4.3, tài liệu 10) và tái sử dụng sau cho nhắc lịch Zalo (M11, Phase 8).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    AccountsModule,
    TeamsModule,
    CandidatesModule,
    ImportsModule,
    CatalogModule,
    CalendarModule,
    CarePoolModule,
    SystemConfigModule,
    DistributionModule,
    DashboardModule,
    NotificationModule,
    PermissionModule,
    ColumnWidthModule,
    ShuttleModule,
    SaleReminderModule,
    DailyReportsModule,
    AttendanceModule,
    LeaveAccrualModule,
    CheckinModule,
    ReportPenaltyModule,
    LeaveRequestsModule,
    RealtimeModule,
    BirthdayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Mặc định yêu cầu đăng nhập cho mọi route (trừ @Public()), sau đó kiểm
    // tra vai trò (@Roles()) — áp dụng toàn cục để không route nào bị quên
    // gắn guard. Thứ tự chạy theo thứ tự khai báo: JwtAuthGuard trước.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
