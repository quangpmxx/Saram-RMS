import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { TIMEZONE } from '../care-warehouse/care-time.util';
import {
  CARE_STOP_AUDIT_FIELD,
  CARE_STOP_REQUEST_AUDIT_FIELD,
} from '../care-warehouse/care-warehouse.service';
import { CandidatesService } from './candidates.service';

/**
 * Yêu cầu người dùng (2026-10-29): khung bên phải trang Chi tiết data hiển
 * thị công khai lịch sử truy cập + thao tác ("Admin đã truy cập lúc...",
 * "Sale A đã cập nhật trạng thái... lúc 10:47"). Ai xem được data thì xem
 * được toàn bộ lịch sử của data đó (cùng phạm vi với GET /candidate/:id).
 *
 * Không tạo bảng mới — đọc lại audit_logs đã ghi sẵn (lead, ghi chú, lịch
 * PV, lịch gọi lại) + care_assignments (đợt giao chăm sóc ghi log theo đợt,
 * không theo từng data). Chỉ ghi thêm 1 loại log mới: action "view".
 */

/** Mở lại cùng 1 data trong khoảng này (F5, quay lại...) không ghi thêm lượt truy cập. */
export const VIEW_DEDUPE_MS = 5 * 60_000;
/** Giới hạn số dòng nhật ký đọc ra — data bình thường chỉ vài chục dòng. */
const MAX_LOG_ROWS = 500;

export interface LeadActivityActor {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
}

export interface LeadActivityItem {
  id: string;
  kind: 'view' | 'action';
  at: string;
  actor: LeadActivityActor | null;
  /** Phần mô tả sau tên người làm, vd "đã cập nhật Tình trạng cuộc gọi: Chưa gọi → Đã gọi". */
  text: string;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Họ tên',
  phone_number: 'Số điện thoại',
  birth_year: 'Năm sinh',
  address: 'Địa chỉ',
  source_id: 'Nguồn',
  mkt_note: 'Ghi chú MKT',
  call_status_id: 'Tình trạng cuộc gọi',
  call_result_id: 'Kết quả cuộc gọi',
  zalo_status_id: 'Kết quả',
  zalo_friend_status_id: 'Tình trạng Zalo',
  note_color: 'Đánh dấu màu',
};

const STATUS_FIELDS = new Set([
  'call_status_id',
  'call_result_id',
  'zalo_status_id',
  'zalo_friend_status_id',
  'status_id',
]);

const NOTE_COLOR_LABELS: Record<string, string> = {
  yellow: 'Vàng',
  green: 'Xanh',
  red: 'Đỏ',
};

const LOG_ENTITY_TYPES = [
  'lead',
  'lead_note',
  'interview_appointment',
  'callback_schedule',
] as const;

function formatVnDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date);
}

function quote(text: string | null, max = 160): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return `"${clean.length > max ? `${clean.slice(0, max)}…` : clean}"`;
}

const ACTOR_SELECT = {
  id: true,
  fullName: true,
  role: true,
  avatarUrl: true,
} as const;

type ActorRow = {
  id: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
};

type AuditRow = {
  id: string;
  actionType: string;
  entityType: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  account: ActorRow;
};

@Injectable()
export class LeadActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly candidatesService: CandidatesService,
  ) {}

  /** Ghi 1 lượt truy cập trang Chi tiết — bỏ qua nếu vừa ghi trong VIEW_DEDUPE_MS. */
  async recordView(
    leadId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ recorded: boolean }> {
    await this.candidatesService.findOne(leadId, currentUser);

    const recent = await this.prisma.auditLog.findFirst({
      where: {
        accountId: currentUser.id,
        actionType: 'view',
        entityType: 'lead',
        entityId: leadId,
        createdAt: { gte: new Date(Date.now() - VIEW_DEDUPE_MS) },
      },
      select: { id: true },
    });
    if (recent) return { recorded: false };

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'view',
      entityType: 'lead',
      entityId: leadId,
    });
    return { recorded: true };
  }

  async list(
    leadId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ items: LeadActivityItem[] }> {
    await this.candidatesService.findOne(leadId, currentUser);

    const [lead, notes, interviews, callbacks, careAssignments] =
      await Promise.all([
        this.prisma.lead.findUniqueOrThrow({
          where: { id: leadId },
          select: {
            uploadedAt: true,
            uploadedBy: { select: ACTOR_SELECT },
          },
        }),
        this.prisma.leadNote.findMany({
          where: { leadId },
          select: { id: true },
        }),
        this.prisma.interviewAppointment.findMany({
          where: { leadId },
          select: { id: true },
        }),
        this.prisma.callbackSchedule.findMany({
          where: { leadId },
          select: { id: true },
        }),
        this.prisma.careAssignment.findMany({
          where: { leadId },
          select: {
            id: true,
            assignedAt: true,
            endedAt: true,
            endReason: true,
            assignee: { select: ACTOR_SELECT },
            endedBy: { select: ACTOR_SELECT },
            batch: {
              select: {
                method: true,
                createdBy: { select: ACTOR_SELECT },
              },
            },
          },
        }),
      ]);

    const logs: AuditRow[] = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'lead', entityId: leadId },
          { entityType: 'lead_note', entityId: { in: notes.map((n) => n.id) } },
          {
            entityType: 'interview_appointment',
            entityId: { in: interviews.map((i) => i.id) },
          },
          {
            entityType: 'callback_schedule',
            entityId: { in: callbacks.map((c) => c.id) },
          },
        ],
        entityType: { in: [...LOG_ENTITY_TYPES] },
      },
      select: {
        id: true,
        actionType: true,
        entityType: true,
        fieldChanged: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        account: { select: ACTOR_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_LOG_ROWS,
    });

    const names = await this.loadNames(logs);
    const items: LeadActivityItem[] = [];

    for (const log of logs) {
      const text = describeLog(log, names);
      if (text === null) continue;
      items.push({
        id: log.id,
        kind: log.actionType === 'view' ? 'view' : 'action',
        at: log.createdAt.toISOString(),
        actor: toActor(log.account),
        text,
      });
    }

    // Data nhập từ Excel/tự chia không có log "create" theo từng data — lấy
    // từ chính bản ghi để dòng thời gian luôn có điểm bắt đầu.
    const hasCreateLog = logs.some(
      (log) => log.entityType === 'lead' && log.actionType === 'create',
    );
    if (!hasCreateLog) {
      items.push({
        id: `lead-created-${leadId}`,
        kind: 'action',
        at: lead.uploadedAt.toISOString(),
        actor: toActor(lead.uploadedBy),
        text: 'đã nhập data',
      });
    }

    // Đợt giao chăm sóc ghi log theo đợt (nhiều data/1 dòng) — dựng lại từ
    // care_assignments để biết đúng data này được giao cho ai, lúc nào.
    for (const assignment of careAssignments) {
      const assigneeName = assignment.assignee.fullName;
      items.push({
        id: `care-assign-${assignment.id}`,
        kind: 'action',
        at: assignment.assignedAt.toISOString(),
        actor: toActor(assignment.batch.createdBy),
        text:
          assignment.batch.method === 'self'
            ? 'đã tự nhận chăm sóc data'
            : `đã giao chăm sóc cho ${assigneeName}${assignment.batch.method === 'random' ? ' (giao ngẫu nhiên)' : ''}`,
      });
      if (assignment.endedAt && assignment.endReason === 'revoked') {
        items.push({
          id: `care-revoke-${assignment.id}`,
          kind: 'action',
          at: assignment.endedAt.toISOString(),
          actor: assignment.endedBy ? toActor(assignment.endedBy) : null,
          text: `đã thu hồi chăm sóc của ${assigneeName}`,
        });
      }
    }

    items.sort((a, b) => b.at.localeCompare(a.at));
    return { items };
  }

  /** Đổi id (trạng thái, tài khoản, nguồn) trong old/new value thành tên hiển thị. */
  private async loadNames(logs: AuditRow[]): Promise<Map<string, string>> {
    const statusIds = new Set<string>();
    const accountIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const log of logs) {
      const values = [log.oldValue, log.newValue].filter(
        (v): v is string => !!v,
      );
      if (log.fieldChanged && STATUS_FIELDS.has(log.fieldChanged)) {
        values.forEach((v) => statusIds.add(v));
      } else if (log.fieldChanged === 'source_id') {
        values.forEach((v) => sourceIds.add(v));
      } else if (
        log.entityType === 'lead' &&
        (log.actionType === 'assign' || log.actionType === 'transfer')
      ) {
        values.forEach((v) => accountIds.add(v.split(' | ')[0]));
      }
    }

    const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
    const [statuses, accounts, sources] = await Promise.all([
      this.prisma.statusCatalog.findMany({
        where: { id: { in: [...statusIds].filter(isUuid) } },
        select: { id: true, name: true },
      }),
      this.prisma.account.findMany({
        where: { id: { in: [...accountIds].filter(isUuid) } },
        select: { id: true, fullName: true },
      }),
      this.prisma.leadSource.findMany({
        where: { id: { in: [...sourceIds].filter(isUuid) } },
        select: { id: true, name: true },
      }),
    ]);

    const names = new Map<string, string>();
    statuses.forEach((s) => names.set(s.id, s.name));
    sources.forEach((s) => names.set(s.id, s.name));
    accounts.forEach((a) => names.set(a.id, a.fullName));
    return names;
  }
}

function toActor(account: ActorRow): LeadActivityActor {
  return {
    id: account.id,
    name: account.fullName,
    role: account.role,
    avatar_url: account.avatarUrl ?? null,
  };
}

/** Mô tả 1 dòng nhật ký bằng tiếng Việt; null = không hiển thị. */
export function describeLog(
  log: Pick<
    AuditRow,
    'actionType' | 'entityType' | 'fieldChanged' | 'oldValue' | 'newValue'
  >,
  names: Map<string, string>,
): string | null {
  const name = (id: string | null) => (id ? (names.get(id) ?? id) : '');
  const { actionType, fieldChanged, oldValue, newValue } = log;

  if (log.entityType === 'lead_note') {
    if (actionType === 'create') return `đã thêm ghi chú ${quote(newValue)}`;
    if (actionType === 'update')
      return `đã sửa ghi chú thành ${quote(newValue)}`;
    if (actionType === 'delete') return 'đã xóa 1 ghi chú';
    return null;
  }

  if (log.entityType === 'interview_appointment') {
    if (actionType === 'create') {
      const attempt = /attempt_no=(\d+)/.exec(newValue ?? '')?.[1];
      const company = /partner_company_name=(.*)$/.exec(newValue ?? '')?.[1];
      return `đã đặt lịch phỏng vấn${attempt ? ` lần ${attempt}` : ''}${company ? ` tại ${company}` : ''}`;
    }
    if (actionType === 'delete') {
      const attempt = /attempt_no=(\d+)/.exec(oldValue ?? '')?.[1];
      return `đã xoá lịch phỏng vấn${attempt ? ` lần ${attempt}` : ''}`;
    }
    if (fieldChanged === 'status_id') {
      return `đã cập nhật trạng thái phỏng vấn: ${name(oldValue) || '(trống)'} → ${name(newValue) || '(trống)'}`;
    }
    return 'đã cập nhật lịch phỏng vấn';
  }

  if (log.entityType === 'callback_schedule') {
    if (actionType === 'create') {
      const at = /scheduled_at=(\S+)/.exec(newValue ?? '')?.[1];
      return `đã đặt lịch gọi lại${at ? ` lúc ${formatVnDateTime(at)}` : ''}`;
    }
    if (actionType === 'delete') {
      const at = /scheduled_at=(\S+)/.exec(oldValue ?? '')?.[1];
      return `đã xoá lịch gọi lại${at ? ` lúc ${formatVnDateTime(at)}` : ''}`;
    }
    return 'đã cập nhật lịch gọi lại';
  }

  // entityType === 'lead'
  switch (actionType) {
    case 'view':
      return 'đã truy cập';
    case 'create':
      return 'đã tạo data';
    case 'delete':
      return 'đã xóa data';
    case 'hold':
      return newValue === 'true' ? 'đã giữ số' : 'đã bỏ giữ số';
    case 'lock':
      return 'đã nhận xử lý data từ cột chăm sóc';
    case 'unlock':
      return 'đã trả data về cột chăm sóc';
    case 'assign':
      return `đã giao data cho ${name(newValue)}`;
    case 'transfer': {
      const [target, reason] = (newValue ?? '').split(' | reason: ');
      const from = oldValue ? ` từ ${name(oldValue)}` : '';
      return `đã chuyển data${from} sang ${name(target)}${reason ? ` (lý do: ${reason})` : ''}`;
    }
  }

  if (fieldChanged === CARE_STOP_AUDIT_FIELD) {
    return newValue ? 'đã dừng chăm sóc' : 'đã cho tiếp tục chăm sóc';
  }
  if (fieldChanged === CARE_STOP_REQUEST_AUDIT_FIELD) {
    if (newValue === 'requested') return 'đã đề nghị dừng chăm sóc';
    if (newValue === 'approved') return 'đã duyệt đề nghị dừng chăm sóc';
    if (newValue === 'rejected') return 'đã từ chối đề nghị dừng chăm sóc';
    return 'đã cập nhật đề nghị dừng chăm sóc';
  }
  if (fieldChanged === 'removed_from_care_pool_at') {
    return 'đã đưa data ra khỏi cột chăm sóc';
  }
  if (fieldChanged) {
    const label = FIELD_LABELS[fieldChanged] ?? fieldChanged;
    const show = (value: string | null) => {
      if (!value) return '(trống)';
      if (fieldChanged === 'note_color')
        return NOTE_COLOR_LABELS[value] ?? value;
      if (STATUS_FIELDS.has(fieldChanged) || fieldChanged === 'source_id') {
        return name(value);
      }
      return value;
    };
    return `đã cập nhật ${label}: ${show(oldValue)} → ${show(newValue)}`;
  }
  return 'đã cập nhật data';
}
