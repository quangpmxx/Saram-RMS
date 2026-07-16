import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateShuttleDto } from './dto/create-shuttle.dto';
import { UpdateShuttleDto } from './dto/update-shuttle.dto';
import { ListShuttleQueryDto } from './dto/list-shuttle-query.dto';
import { CreateShuttleOptionDto } from './dto/create-shuttle-option.dto';
import { UpdateShuttleOptionDto } from './dto/update-shuttle-option.dto';
import {
  ShuttleOptionItemDto,
  ShuttleOptionsResponseDto,
  toShuttleOptionItem,
} from './dto/shuttle-options-response.dto';
import { SaleAccountItemDto } from './dto/sale-account-response.dto';
import {
  SHUTTLE_INCLUDE,
  ShuttleResponseDto,
  toShuttleResponse,
} from './dto/shuttle-response.dto';

const OPTION_FIELDS = [
  'company',
  'area',
  'type',
  'sale',
  'driver',
  'contractor',
  'status',
  'interview_result',
  'interview_time',
] as const;
type OptionField = (typeof OPTION_FIELDS)[number];

/**
 * Dự án phụ — nâng cấp toàn diện: "Danh sách đưa đón" — module ĐỘC LẬP, nhập
 * tay tự do, không liên kết Lead/module nghiệp vụ khác (yêu cầu trực tiếp
 * người dùng). Mọi vai trò đã đăng nhập đều được xem/thêm/sửa/xóa tự do —
 * không giới hạn theo nhóm/người phụ trách (khớp @Roles() bỏ trống ở
 * controller).
 */
@Injectable()
export class ShuttleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(
    query: ListShuttleQueryDto,
  ): Promise<PaginatedResult<ShuttleResponseDto>> {
    const where: Prisma.ShuttleRecordWhereInput = {};

    if (query.keyword) {
      where.OR = [
        { fullName: { contains: query.keyword, mode: 'insensitive' } },
        { phoneNumber: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.date_from || query.date_to) {
      where.date = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }
    if (query.company) where.company = query.company;
    if (query.type) where.type = query.type;
    if (query.sale) where.sale = query.sale;
    if (query.driver) where.driver = query.driver;
    if (query.status) where.status = query.status;
    if (query.interview_result) where.interviewResult = query.interview_result;

    const [total, records] = await this.prisma.$transaction([
      this.prisma.shuttleRecord.count({ where }),
      this.prisma.shuttleRecord.findMany({
        where,
        include: SHUTTLE_INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: records.map(toShuttleResponse),
    };
  }

  async create(
    dto: CreateShuttleDto,
    currentUser: AuthenticatedUser,
  ): Promise<ShuttleResponseDto> {
    const record = await this.prisma.shuttleRecord.create({
      data: {
        date: new Date(dto.date),
        fullName: dto.full_name,
        phoneNumber: dto.phone_number,
        company: dto.company,
        area: dto.area,
        type: dto.type,
        sale: dto.sale,
        driver: dto.driver,
        interviewTime: dto.interview_time,
        contractor: dto.contractor,
        status: dto.status,
        interviewResult: dto.interview_result,
        note: dto.note,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
      include: SHUTTLE_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'shuttle_record',
      entityId: record.id,
      newValue: `${record.fullName} - ${record.phoneNumber}`,
    });

    const response = toShuttleResponse(record);
    this.realtime.emitTransportationChange('created', response, currentUser);
    return response;
  }

  async update(
    id: string,
    dto: UpdateShuttleDto,
    currentUser: AuthenticatedUser,
  ): Promise<ShuttleResponseDto> {
    const existing = await this.prisma.shuttleRecord.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng đưa đón');
    }

    const record = await this.prisma.shuttleRecord.update({
      where: { id },
      data: {
        date: dto.date === undefined ? undefined : new Date(dto.date),
        fullName: dto.full_name,
        phoneNumber: dto.phone_number,
        company: dto.company,
        area: dto.area,
        type: dto.type,
        sale: dto.sale,
        driver: dto.driver,
        interviewTime: dto.interview_time,
        contractor: dto.contractor,
        status: dto.status,
        interviewResult: dto.interview_result,
        note: dto.note,
        updatedById: currentUser.id,
      },
      include: SHUTTLE_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'shuttle_record',
      entityId: id,
      newValue: `${record.fullName} - ${record.phoneNumber}`,
    });

    const response = toShuttleResponse(record);
    this.realtime.emitTransportationChange('updated', response, currentUser);
    return response;
  }

  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.shuttleRecord.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng đưa đón');
    }

    await this.prisma.shuttleRecord.delete({ where: { id } });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'shuttle_record',
      entityId: id,
      oldValue: `${existing.fullName} - ${existing.phoneNumber}`,
    });

    this.realtime.emitTransportationDeleted(id, currentUser);
  }

  /**
   * Danh sách gợi ý (kèm màu) của 8 trường "chọn" — đọc từ bảng
   * shuttle_options (LƯU LẠI, khác cách cũ suy ra từ giá trị distinct trong
   * shuttle_records) để hỗ trợ xóa riêng từng giá trị mà không đụng dữ liệu
   * các dòng đưa đón đã nhập.
   */
  async getOptions(): Promise<ShuttleOptionsResponseDto> {
    const rows = await this.prisma.shuttleOption.findMany({
      orderBy: { value: 'asc' },
    });

    const byField = new Map<OptionField, ShuttleOptionItemDto[]>();
    for (const field of OPTION_FIELDS) byField.set(field, []);
    for (const row of rows) {
      if (!OPTION_FIELDS.includes(row.field as OptionField)) continue;
      byField.get(row.field as OptionField)?.push(toShuttleOptionItem(row));
    }

    return {
      companies: byField.get('company') ?? [],
      areas: byField.get('area') ?? [],
      types: byField.get('type') ?? [],
      // "sale" chỉ lưu MÀU (value = tên tài khoản thật, không phải tên tự
      // gõ) — xem addOption()/updateOption(), Sale ComboCell ở frontend
      // dùng key này để tô màu, KHÔNG dùng để liệt kê tên (lấy từ
      // listSaleAccounts() thay vì đây).
      sales: byField.get('sale') ?? [],
      drivers: byField.get('driver') ?? [],
      contractors: byField.get('contractor') ?? [],
      statuses: byField.get('status') ?? [],
      interviewResults: byField.get('interview_result') ?? [],
      interviewTimes: byField.get('interview_time') ?? [],
    };
  }

  /**
   * Thêm 1 giá trị mới vào danh sách gợi ý, kèm màu nền tự chọn. Dùng upsert
   * — nếu giá trị đã tồn tại (field, value) thì cập nhật lại màu thay vì báo
   * lỗi trùng, vì trải nghiệm mong muốn là "chọn lại màu cho giá trị này".
   */
  async addOption(
    dto: CreateShuttleOptionDto,
    currentUser: AuthenticatedUser,
  ): Promise<ShuttleOptionItemDto> {
    const option = await this.prisma.shuttleOption.upsert({
      where: { field_value: { field: dto.field, value: dto.value } },
      // update: chỉ ghi đè field nào THỰC SỰ có mặt trong request — bỏ
      // undefined (không phải null) để Prisma GIỮ NGUYÊN giá trị cũ, tránh
      // 1 lần gọi đổi màu nền vô tình xóa mất màu chữ đã chọn riêng trước đó
      // (và ngược lại) — 2 màu độc lập, mỗi lần chỉnh chỉ gửi đúng 1 trường.
      update: {
        colorKey: dto.color_key === undefined ? undefined : dto.color_key,
        textColorKey:
          dto.text_color_key === undefined ? undefined : dto.text_color_key,
      },
      create: {
        field: dto.field,
        value: dto.value,
        colorKey: dto.color_key ?? null,
        textColorKey: dto.text_color_key ?? null,
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'shuttle_option',
      entityId: option.id,
      fieldChanged: dto.field,
      newValue: dto.value,
    });

    return toShuttleOptionItem(option);
  }

  /**
   * Sửa 1 giá trị gợi ý đã thêm — đổi tên và/hoặc đổi màu. Chỉ sửa dòng
   * shuttle_options — KHÔNG cập nhật lại các dòng shuttle_records đang dùng
   * giá trị cũ (giữ nguyên nguyên tắc "chỉ là gợi ý", giống removeOption()).
   */
  async updateOption(
    id: string,
    dto: UpdateShuttleOptionDto,
    currentUser: AuthenticatedUser,
  ): Promise<ShuttleOptionItemDto> {
    const existing = await this.prisma.shuttleOption.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        'Không tìm thấy giá trị này trong danh sách gợi ý',
      );
    }

    try {
      const option = await this.prisma.shuttleOption.update({
        where: { id },
        data: {
          value: dto.value,
          colorKey: dto.color_key === undefined ? undefined : dto.color_key,
          textColorKey:
            dto.text_color_key === undefined ? undefined : dto.text_color_key,
        },
      });

      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'update',
        entityType: 'shuttle_option',
        entityId: id,
        fieldChanged: existing.field,
        oldValue: existing.value,
        newValue: option.value,
      });

      return toShuttleOptionItem(option);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Giá trị này đã tồn tại trong danh sách gợi ý',
        );
      }
      throw error;
    }
  }

  /** Chỉ xóa khỏi danh sách gợi ý — KHÔNG đụng tới các dòng đưa đón đã dùng giá trị này. */
  async removeOption(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.prisma.shuttleOption.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        'Không tìm thấy giá trị này trong danh sách gợi ý',
      );
    }

    await this.prisma.shuttleOption.delete({ where: { id } });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'shuttle_option',
      entityId: id,
      fieldChanged: existing.field,
      oldValue: existing.value,
    });
  }

  /**
   * Danh sách tài khoản role=sale, đang active — nguồn gợi ý cho cột "Sale"
   * (yêu cầu trực tiếp người dùng: "lấy nguồn danh sách nhân viên sale từ
   * danh sách tài khoản... về sau sẽ lấy dữ liệu để làm báo cáo"). Endpoint
   * riêng trong module Shuttle (không dùng /account — chỉ Admin gọi được
   * theo docs/13) để mọi vai trò đang dùng Danh sách đưa đón đều xem được.
   */
  async listSaleAccounts(): Promise<SaleAccountItemDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { role: 'sale', status: 'active' },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      full_name: account.fullName,
    }));
  }
}
