import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountRole,
  CheckinStatus as CheckinStatusValue,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { CheckinPreviewQueryDto } from './dto/checkin-preview-query.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';
import { ListCheckinQueryDto } from './dto/list-checkin-query.dto';
import {
  CheckinListResponseDto,
  CheckinPreviewResponseDto,
  CheckinRecordResponseDto,
  CheckinStatusResponseDto,
  CompanyLocationResponseDto,
} from './dto/checkin-response.dto';
import { parseUserAgent } from './user-agent.util';

const TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Mục 1, yêu cầu người dùng: "Nhân viên/Sale, MKT và Leader" tự Check in —
 * Admin/Quản lý không dùng. Khớp đúng EMPLOYEE_ROLES ở attendance.service.ts
 * (module Chấm công) — không phát minh danh sách vai trò riêng.
 */
const CHECKIN_ROLES: AccountRole[] = ['leader', 'mkt', 'sale'];

/** Mục 10: Admin/Quản lý/Leader/Nhân viên đều xem được (phạm vi khác nhau) — khớp VIEW_ROLES ở attendance.service.ts. */
const VIEW_ROLES = new Set(['admin', 'manager', 'leader', 'mkt', 'sale']);

/** Mục 10: chỉ Admin/Quản lý "xem chi tiết GPS, IP, thiết bị" của người KHÁC — Leader/Nhân viên chỉ xem được đầy đủ bản ghi CỦA CHÍNH MÌNH. */
const FULL_DETAIL_ROLES = new Set(['admin', 'manager']);

/** Mục 3, yêu cầu người dùng: "Accuracy lớn hơn 100m -> Cần xác minh". */
const ACCURACY_NEEDS_VERIFICATION_METERS = 100;

/** Bán kính Trái Đất (mét) — dùng cho công thức Haversine. */
const EARTH_RADIUS_METERS = 6371000;

const ACCOUNT_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  position: true,
  teamId: true,
  status: true,
  team: { select: { id: true, name: true } },
} satisfies Prisma.AccountSelect;

/** "YYYY-MM-DD" theo timezone hệ thống — dùng chung cách tính này trong toàn bộ module Chấm công (attendance.service.ts, leave-accrual.service.ts). */
function dateOnlyInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/**
 * Công thức Haversine — khoảng cách đường chim bay giữa 2 tọa độ GPS, đơn
 * vị mét (Mục 3, yêu cầu người dùng: "công thức phù hợp như Haversine").
 */
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Mục 3/4/9, yêu cầu người dùng: CẦN_XÁC_MINH được ưu tiên hơn (ghi đè) khi
 * accuracy > 100m HOẶC thiếu thông tin thiết bị cần thiết (Mục 9: "Thiếu
 * thông tin thiết bị cần thiết" là 1 căn cứ gắn cờ) — GPS không đủ tin cậy
 * thì không thể khẳng định "trong/ngoài bán kính", xếp riêng bất kể khoảng
 * cách.
 */
function classifyStatus(
  distanceMeters: number,
  radiusMeters: number,
  accuracyMeters: number,
  hasDeviceInfo: boolean,
): CheckinStatusValue {
  if (accuracyMeters > ACCURACY_NEEDS_VERIFICATION_METERS || !hasDeviceInfo) {
    return 'needs_verification';
  }
  return distanceMeters <= radiusMeters ? 'valid' : 'outside_company';
}

function toRecordResponse(record: {
  id: string;
  accountId: string;
  attendanceDate: Date;
  checkedInAt: Date;
  latitude: number;
  longitude: number;
  accuracy: number;
  resolvedAddress: string | null;
  companyLatitude: number;
  companyLongitude: number;
  allowedRadius: number;
  distanceFromCompany: number;
  status: CheckinStatusValue;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  operatingSystem: string | null;
  browser: string | null;
  note: string | null;
  createdAt: Date;
}): CheckinRecordResponseDto {
  return {
    id: record.id,
    account_id: record.accountId,
    attendance_date: record.attendanceDate.toISOString().slice(0, 10),
    checked_in_at: record.checkedInAt.toISOString(),
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy,
    resolved_address: record.resolvedAddress,
    company_latitude: record.companyLatitude,
    company_longitude: record.companyLongitude,
    allowed_radius_meters: record.allowedRadius,
    distance_from_company_meters: record.distanceFromCompany,
    status: record.status,
    ip_address: record.ipAddress,
    user_agent: record.userAgent,
    device: record.device,
    operating_system: record.operatingSystem,
    browser: record.browser,
    note: record.note,
    created_at: record.createdAt.toISOString(),
  };
}

/**
 * Mục 10: Leader/Nhân viên xem bản ghi Check in của NGƯỜI KHÁC (đồng đội
 * trong nhóm) thì KHÔNG được thấy GPS/IP/thiết bị chi tiết — chỉ Admin/
 * Quản lý (hoặc chính chủ bản ghi) mới thấy đầy đủ. Giữ lại trạng thái/địa
 * chỉ/khoảng cách/giờ vì cần thiết để quản lý theo dõi ai đã Check in.
 */
function redactRecordResponse(
  record: CheckinRecordResponseDto,
): CheckinRecordResponseDto {
  return {
    ...record,
    latitude: null,
    longitude: null,
    accuracy: null,
    company_latitude: null,
    company_longitude: null,
    ip_address: null,
    user_agent: null,
    device: null,
    operating_system: null,
    browser: null,
  };
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" trong module
 * Chấm công — triển khai theo 4 Phase (yêu cầu trực tiếp người dùng). PHASE
 * 4 (cuối cùng, bổ sung vào ĐÚNG service Phase 1+2+3, không tách riêng):
 * Admin Reset + audit log đầy đủ (Mục 8/9).
 */
@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getStatus(
    currentUser: AuthenticatedUser,
    requestIp: string | undefined,
    userAgent: string | undefined,
  ): Promise<CheckinStatusResponseDto> {
    const now = new Date();
    const attendanceDate = dateOnlyToUtcMidnight(
      dateOnlyInTimezone(now, TIMEZONE),
    );

    const [existing, companyLocation] = await Promise.all([
      this.prisma.checkinRecord.findFirst({
        where: { accountId: currentUser.id, attendanceDate, isVoided: false },
      }),
      this.prisma.companyLocationConfig.findFirst(),
    ]);

    const parsedUa = parseUserAgent(userAgent);

    return {
      checked_in_today: Boolean(existing),
      today_record: existing ? toRecordResponse(existing) : null,
      server_time: now.toISOString(),
      company_location_configured: Boolean(companyLocation),
      ip_address: requestIp ?? null,
      device: parsedUa.device,
      operating_system: parsedUa.operatingSystem,
      browser: parsedUa.browser,
    };
  }

  /**
   * Mục 2/3, yêu cầu người dùng: hiển thị khoảng cách/trạng thái TRƯỚC khi
   * xác nhận — dùng CHUNG logic tính với checkin() (qua computeDistanceAndStatus())
   * để không bao giờ lệch giữa preview và kết quả lưu thật, nhưng KHÔNG ghi
   * DB và KHÔNG trả tọa độ công ty ra ngoài (Mục 7).
   */
  async preview(
    query: CheckinPreviewQueryDto,
    currentUser: AuthenticatedUser,
    userAgent: string | undefined,
  ): Promise<CheckinPreviewResponseDto> {
    if (!CHECKIN_ROLES.includes(currentUser.role)) {
      throw new ForbiddenException(
        'Vai trò của bạn không sử dụng tính năng Check in',
      );
    }

    const companyLocation = await this.prisma.companyLocationConfig.findFirst();
    if (!companyLocation) {
      return {
        company_location_configured: false,
        distance_from_company_meters: null,
        status: null,
        location_label: null,
      };
    }

    const { distance, status } = this.computeDistanceAndStatus(
      query.latitude,
      query.longitude,
      query.accuracy,
      Boolean(userAgent),
      companyLocation,
    );

    return {
      company_location_configured: true,
      distance_from_company_meters: distance,
      status,
      location_label: status === 'valid' ? 'Công ty' : null,
    };
  }

  /**
   * Mục 6, yêu cầu người dùng: chặn trùng ở BACKEND/DATABASE, không chỉ
   * disable nút ở frontend — kiểm tra trước (thân thiện) rồi vẫn bắt lỗi
   * unique constraint (P2002) làm lớp chặn cuối cùng chống race condition.
   * Mục 5: IP lấy từ REQUEST phía server (KHÔNG tin body/header client tự
   * khai) — controller truyền `requestIp` từ `req.ip` (đã cấu hình `trust
   * proxy` ở main.ts), KHÔNG có field ip trong CreateCheckinDto.
   */
  async checkin(
    dto: CreateCheckinDto,
    currentUser: AuthenticatedUser,
    requestIp: string | undefined,
    userAgent: string | undefined,
  ): Promise<CheckinRecordResponseDto> {
    if (!CHECKIN_ROLES.includes(currentUser.role)) {
      throw new ForbiddenException(
        'Vai trò của bạn không sử dụng tính năng Check in',
      );
    }

    const companyLocation = await this.prisma.companyLocationConfig.findFirst();
    if (!companyLocation) {
      throw new ForbiddenException(
        'Quản trị viên chưa thiết lập vị trí công ty',
      );
    }

    const now = new Date();
    const attendanceDate = dateOnlyToUtcMidnight(
      dateOnlyInTimezone(now, TIMEZONE),
    );

    const existing = await this.prisma.checkinRecord.findFirst({
      where: { accountId: currentUser.id, attendanceDate, isVoided: false },
    });
    if (existing) {
      // Mục 9, yêu cầu người dùng: ghi log riêng "Check in bị từ chối do đã
      // có bản ghi" (KHÁC action 'create' của lượt Check in thành công).
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'reject',
        entityType: 'checkin_record',
        entityId: existing.id,
        newValue: 'Từ chối: đã Check in hôm nay rồi',
      });
      throw new ForbiddenException('Bạn đã Check in hôm nay rồi');
    }

    const { distance, status } = this.computeDistanceAndStatus(
      dto.latitude,
      dto.longitude,
      dto.accuracy,
      Boolean(userAgent),
      companyLocation,
    );
    const parsedUa = parseUserAgent(userAgent);

    try {
      const created = await this.prisma.checkinRecord.create({
        data: {
          accountId: currentUser.id,
          attendanceDate,
          checkedInAt: now,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          resolvedAddress: dto.resolved_address ?? null,
          // Snapshot cấu hình công ty (Mục 6) — Admin đổi cấu hình sau
          // KHÔNG được làm thay đổi kết quả bản ghi cũ này.
          companyLatitude: companyLocation.latitude,
          companyLongitude: companyLocation.longitude,
          allowedRadius: companyLocation.allowedRadius,
          distanceFromCompany: distance,
          status,
          ipAddress: requestIp ?? null,
          userAgent: userAgent ?? null,
          device: parsedUa.device,
          operatingSystem: parsedUa.operatingSystem,
          browser: parsedUa.browser,
        },
      });

      // Mục 9: ghi log "Check in thành công".
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'create',
        entityType: 'checkin_record',
        entityId: created.id,
        newValue: `Trạng thái=${status}, khoảng cách=${Math.round(distance)}m`,
      });

      return toRecordResponse(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.auditLog.log({
          accountId: currentUser.id,
          actionType: 'reject',
          entityType: 'checkin_record',
          newValue: 'Từ chối: đã Check in hôm nay rồi (race condition)',
        });
        throw new ForbiddenException('Bạn đã Check in hôm nay rồi');
      }
      throw error;
    }
  }

  private computeDistanceAndStatus(
    latitude: number,
    longitude: number,
    accuracy: number,
    hasDeviceInfo: boolean,
    companyLocation: {
      latitude: number;
      longitude: number;
      allowedRadius: number;
    },
  ): { distance: number; status: CheckinStatusValue } {
    const distance = haversineDistanceMeters(
      latitude,
      longitude,
      companyLocation.latitude,
      companyLocation.longitude,
    );
    const status = classifyStatus(
      distance,
      companyLocation.allowedRadius,
      accuracy,
      hasDeviceInfo,
    );
    return { distance, status };
  }

  /** Mục 7: "Chỉ Admin được xem và thay đổi cấu hình này." */
  async getCompanyLocation(
    currentUser: AuthenticatedUser,
  ): Promise<CompanyLocationResponseDto | null> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin được xem cấu hình vị trí công ty',
      );
    }
    const config = await this.prisma.companyLocationConfig.findFirst({
      include: { updatedBy: { select: { fullName: true } } },
    });
    if (!config) return null;
    return {
      address: config.address,
      latitude: config.latitude,
      longitude: config.longitude,
      allowed_radius_meters: config.allowedRadius,
      updated_at: config.updatedAt.toISOString(),
      updated_by_name: config.updatedBy.fullName,
    };
  }

  /**
   * Singleton (Mục 7) — luôn chỉ 1 bản ghi: update bản ghi hiện có nếu đã
   * tồn tại, tạo mới nếu đây là lần đầu Admin cấu hình.
   */
  async updateCompanyLocation(
    dto: UpdateCompanyLocationDto,
    currentUser: AuthenticatedUser,
  ): Promise<CompanyLocationResponseDto> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin được thay đổi cấu hình vị trí công ty',
      );
    }

    const existing = await this.prisma.companyLocationConfig.findFirst();
    const data = {
      address: dto.address.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      allowedRadius: dto.allowed_radius_meters,
      updatedById: currentUser.id,
    };

    const saved = existing
      ? await this.prisma.companyLocationConfig.update({
          where: { id: existing.id },
          data,
          include: { updatedBy: { select: { fullName: true } } },
        })
      : await this.prisma.companyLocationConfig.create({
          data,
          include: { updatedBy: { select: { fullName: true } } },
        });

    // Mục 9, yêu cầu người dùng: "Lưu audit log cho: ... Thay đổi cấu hình vị trí công ty".
    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'company_location_config',
      entityId: saved.id,
      oldValue: existing
        ? `${existing.address} (${existing.latitude}, ${existing.longitude}, bán kính ${existing.allowedRadius}m)`
        : undefined,
      newValue: `${saved.address} (${saved.latitude}, ${saved.longitude}, bán kính ${saved.allowedRadius}m)`,
    });

    return {
      address: saved.address,
      latitude: saved.latitude,
      longitude: saved.longitude,
      allowed_radius_meters: saved.allowedRadius,
      updated_at: saved.updatedAt.toISOString(),
      updated_by_name: saved.updatedBy.fullName,
    };
  }

  /**
   * Mục 11, yêu cầu người dùng: "trang quản lý Check in" — danh sách nhân
   * viên trong phạm vi + bản ghi Check in của họ TRONG 1 NGÀY, lọc theo
   * nhóm/nhân viên/trạng thái. Phạm vi RBAC giống hệt attendance.service.ts
   * (resolveEmployeeWhere) — Admin/Quản lý toàn bộ, Leader nhóm mình, Nhân
   * viên chỉ chính mình (Mục 10).
   */
  async listRecords(
    query: ListCheckinQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<CheckinListResponseDto> {
    if (!VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền xem Check in');
    }

    const employeeWhere = await this.resolveEmployeeWhere(query, currentUser);
    const employees = await this.prisma.account.findMany({
      where: employeeWhere,
      select: ACCOUNT_SELECT,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    const attendanceDate = dateOnlyToUtcMidnight(query.date);
    const employeeIds = employees.map((e) => e.id);
    const records =
      employeeIds.length === 0
        ? []
        : await this.prisma.checkinRecord.findMany({
            where: {
              accountId: { in: employeeIds },
              attendanceDate,
              isVoided: false,
            },
          });
    const recordByAccount = new Map(records.map((r) => [r.accountId, r]));

    const canViewFullDetail = FULL_DETAIL_ROLES.has(currentUser.role);

    let rows = employees.map((employee) => {
      const record = recordByAccount.get(employee.id);
      let checkin = record ? toRecordResponse(record) : null;
      const isSelf = employee.id === currentUser.id;
      if (checkin && !canViewFullDetail && !isSelf) {
        checkin = redactRecordResponse(checkin);
      }
      return {
        account_id: employee.id,
        full_name: employee.fullName,
        avatar_url: employee.avatarUrl,
        role: employee.role,
        position: employee.position,
        team_id: employee.teamId,
        team_name: employee.team?.name ?? null,
        checkin,
      };
    });

    if (query.status_filter && query.status_filter !== 'all') {
      rows = rows.filter((row) => {
        if (query.status_filter === 'checked_in') return row.checkin !== null;
        if (query.status_filter === 'not_checked_in')
          return row.checkin === null;
        return row.checkin?.status === query.status_filter;
      });
    }

    // Không phân trang (yêu cầu trực tiếp người dùng, 2026-07-15: "bỏ luôn
    // cái trang và lựa chọn số dòng này đi, hiện 1 trang thôi" — quy mô chỉ
    // vài chục nhân viên/ngày, phân trang là thừa) — trả toàn bộ 1 lần.
    return { date: query.date, employees: rows };
  }

  /** Mục 3, yêu cầu người dùng: Sale/MKT chỉ xem chính mình; Leader chỉ nhóm mình; Admin/Quản lý toàn bộ (khớp attendance.service.ts). */
  private async resolveEmployeeWhere(
    query: ListCheckinQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<Prisma.AccountWhereInput> {
    if (currentUser.role === 'sale' || currentUser.role === 'mkt') {
      return { id: currentUser.id, role: { in: CHECKIN_ROLES } };
    }
    if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      return {
        role: { in: CHECKIN_ROLES },
        teamId: account?.teamId ?? '__none__',
        ...(query.account_id ? { id: query.account_id } : {}),
        status: 'active',
      };
    }
    // admin/manager
    return {
      role: { in: CHECKIN_ROLES },
      ...(query.team_id ? { teamId: query.team_id } : {}),
      ...(query.account_id ? { id: query.account_id } : {}),
      status: 'active',
    };
  }

  /**
   * Mục 8, yêu cầu người dùng: "Admin được Reset bản ghi Check in của nhân
   * viên trong ngày để người đó có thể Check in lại." — CHỈ Admin (không
   * cho Leader/Nhân viên tự Reset), bắt buộc lý do (ResetCheckinDto),
   * KHÔNG xóa cứng — chỉ đánh dấu `isVoided=true`, bản ghi cũ vẫn còn
   * nguyên trong DB làm lịch sử. Ghi audit log đầy đủ: Admin thực hiện,
   * nhân viên bị Reset, thời gian, lý do, ID bản ghi cũ.
   */
  async reset(
    recordId: string,
    reason: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: true }> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException('Chỉ Admin được Reset Check in');
    }

    const record = await this.prisma.checkinRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || record.isVoided) {
      throw new NotFoundException(
        'Không tìm thấy bản ghi Check in đang hoạt động để Reset',
      );
    }

    const now = new Date();
    await this.prisma.checkinRecord.update({
      where: { id: recordId },
      data: {
        isVoided: true,
        voidedAt: now,
        voidedById: currentUser.id,
        voidReason: reason.trim(),
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'checkin_record',
      entityId: recordId,
      fieldChanged: 'is_voided',
      oldValue: 'false',
      newValue: `true (nhân viên bị Reset: ${record.accountId}, lý do: ${reason.trim()})`,
    });

    return { success: true };
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-16): Admin xem xét thủ công 1 bản
   * ghi Check in đang "Ngoài công ty"/"Cần xác minh" (vd GPS kém chính xác
   * nhưng Admin xác nhận nhân viên có mặt thật) và CHUYỂN THẲNG sang "Hợp
   * lệ" — KHÁC Reset (không hủy bản ghi, không cho Check in lại), chỉ đổi
   * field `status`, giữ nguyên toàn bộ dữ liệu GPS/IP/thiết bị gốc làm bằng
   * chứng. Idempotent nếu bản ghi đã "Hợp lệ" — không ghi audit log thừa.
   */
  async approveAsValid(
    recordId: string,
    currentUser: AuthenticatedUser,
  ): Promise<CheckinRecordResponseDto> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin được xác nhận trạng thái Check in',
      );
    }

    const record = await this.prisma.checkinRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || record.isVoided) {
      throw new NotFoundException(
        'Không tìm thấy bản ghi Check in đang hoạt động',
      );
    }

    if (record.status === 'valid') {
      return toRecordResponse(record);
    }

    const updated = await this.prisma.checkinRecord.update({
      where: { id: recordId },
      data: { status: 'valid' },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'checkin_record',
      entityId: recordId,
      fieldChanged: 'status',
      oldValue: record.status,
      newValue: `valid (Admin xác nhận thủ công, nhân viên: ${record.accountId})`,
    });

    return toRecordResponse(updated);
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-16): cột "Ghi chú" ở trang quản lý
   * Check in GPS — ghi chú tự do của Admin, sửa được nhiều lần (KHÁC
   * voidReason ở reset() — lý do bắt buộc, chỉ ghi 1 lần lúc Reset). Không
   * chặn theo isVoided (khác reset()/approveAsValid()) — Admin vẫn có thể
   * ghi chú thêm cho 1 bản ghi đã bị Reset (vd giải thích thêm bối cảnh).
   * Rỗng sau khi trim -> lưu null (xóa ghi chú), khớp quy ước các field text
   * tùy chọn khác trong hệ thống (vd Lead.mktNote).
   */
  async updateNote(
    recordId: string,
    note: string,
    currentUser: AuthenticatedUser,
  ): Promise<CheckinRecordResponseDto> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException('Chỉ Admin được sửa ghi chú Check in');
    }

    const record = await this.prisma.checkinRecord.findUnique({
      where: { id: recordId },
    });
    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi Check in');
    }

    const trimmed = note.trim();
    const updated = await this.prisma.checkinRecord.update({
      where: { id: recordId },
      data: { note: trimmed || null },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'checkin_record',
      entityId: recordId,
      fieldChanged: 'note',
      oldValue: record.note ?? '',
      newValue: trimmed,
    });

    return toRecordResponse(updated);
  }
}
