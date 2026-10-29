import { vnNextMonthStart } from './care-time.util';

/**
 * Kho chăm sóc — toàn bộ công thức chỉ số dưới dạng hàm THUẦN (không đọc
 * DB), dùng CHUNG cho Kho, khối Dashboard và tab "Tiến độ chăm sóc" để 3
 * nơi luôn ra cùng một con số. Nguồn dữ liệu duy nhất: lead_notes (lần
 * chăm sóc thực tế, chỉ ghi chú chưa xóa) + care_assignments (lịch sử phân
 * công). Mọi chỉ số "data" đếm theo lead khác nhau (Set), lượt chăm sóc
 * đếm riêng theo số ghi chú.
 */

export interface AssignmentRow {
  id: string;
  leadId: string;
  assigneeId: string;
  assignedAt: Date;
  endedAt: Date | null;
}

export interface NoteRow {
  leadId: string;
  createdById: string;
  createdAt: Date;
}

/**
 * Lượt giao hết hiệu lực tại thời điểm SỚM NHẤT trong: lúc bị đóng (thu
 * hồi/giao lại/dừng chăm sóc) hoặc đầu tháng kế tiếp (tự hết hạn khi sang
 * tháng mới — không cần job nền).
 */
export function assignmentEffectiveEnd(a: AssignmentRow): Date {
  const expiry = vnNextMonthStart(a.assignedAt);
  return a.endedAt && a.endedAt < expiry ? a.endedAt : expiry;
}

export function isAssignmentAliveAt(a: AssignmentRow, t: Date): boolean {
  return a.assignedAt <= t && t < assignmentEffectiveEnd(a);
}

/** Ghi chú chưa xóa, gom theo (lead, người ghi), sắp tăng dần theo thời gian. */
export class NoteIndex {
  private readonly byLeadAuthor = new Map<string, Date[]>();
  private readonly byLead = new Map<string, Date[]>();

  constructor(notes: NoteRow[]) {
    for (const n of notes) {
      push(this.byLeadAuthor, `${n.leadId}|${n.createdById}`, n.createdAt);
      push(this.byLead, n.leadId, n.createdAt);
    }
    for (const list of this.byLeadAuthor.values()) sortDates(list);
    for (const list of this.byLead.values()) sortDates(list);
  }

  /** Ghi chú của đúng `authorId` trên `leadId` trong [from, to). */
  byAuthor(leadId: string, authorId: string, from: Date, to: Date): Date[] {
    return within(this.byLeadAuthor.get(`${leadId}|${authorId}`), from, to);
  }

  /** Ghi chú của bất kỳ ai trên `leadId` trong [from, to). */
  anyAuthor(leadId: string, from: Date, to: Date): Date[] {
    return within(this.byLead.get(leadId), from, to);
  }
}

/**
 * Thời điểm lượt giao được XỬ LÝ = ghi chú đầu tiên của CHÍNH Sale được
 * giao, sau lúc giao và trước khi lượt giao hết hiệu lực. null = chưa xử lý.
 * (Câu 1 đã chốt: chỉ tiêu của Sale chỉ tính ghi chú của chính Sale đó.)
 */
export function assignmentProcessedAt(
  a: AssignmentRow,
  notes: NoteIndex,
): Date | null {
  const list = notes.byAuthor(
    a.leadId,
    a.assigneeId,
    a.assignedAt,
    assignmentEffectiveEnd(a),
  );
  return list[0] ?? null;
}

const ONE_MS = 1;

/**
 * Lượt giao có được tính vào chỉ số tại mốc `cutoff` không: còn hiệu lực
 * ngay trước `cutoff`, HOẶC đã được xử lý trước `cutoff`. Lượt bị thu hồi/
 * giao lại mà chưa xử lý thì không tính — không phạt Sale vì data đã bị
 * lấy lại.
 */
function isCounted(
  a: AssignmentRow,
  processedAt: Date | null,
  cutoff: Date,
): boolean {
  return (
    isAssignmentAliveAt(a, new Date(cutoff.getTime() - ONE_MS)) ||
    (processedAt !== null && processedAt < cutoff)
  );
}

export interface SaleDailyMetrics {
  /** Nhóm "Trong ngày": data được giao trong ngày. */
  today: { assigned: number; processed: number; pending: number };
  /** Tỷ lệ hoàn thành ngày (%), CHỈ tính trên nhóm Trong ngày. null khi mẫu số = 0. */
  completion_rate: number | null;
  /** Nhóm "Tồn cũ": giao từ các ngày trước trong tháng, chưa xử lý tính tới đầu ngày. */
  backlog: { start: number; processed: number; remaining: number };
  /** Tổng ghi chú của Sale trong ngày trên các data thuộc 2 nhóm trên. */
  care_turns: number;
}

/**
 * Chỉ số ngày [dayStart, dayEnd) của 1 Sale. `assignments` chỉ gồm lượt giao
 * của đúng Sale đó. Ngày đang diễn ra tính tới `now`.
 */
export function computeSaleDaily(
  assignments: AssignmentRow[],
  notes: NoteIndex,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
): SaleDailyMetrics {
  const cutoff = now < dayEnd ? now : dayEnd;
  const todayLeads = new Set<string>();
  const todayProcessed = new Set<string>();
  const backlogLeads = new Set<string>();
  const backlogProcessed = new Set<string>();
  const assigneeOf = new Map<string, string>();

  if (cutoff > dayStart) {
    for (const a of assignments) {
      const p = assignmentProcessedAt(a, notes);
      if (!isCounted(a, p, cutoff)) continue;
      const processedInWindow =
        p !== null && p >= dayStart && p < cutoff ? true : false;

      if (a.assignedAt >= dayStart && a.assignedAt < cutoff) {
        todayLeads.add(a.leadId);
        assigneeOf.set(a.leadId, a.assigneeId);
        if (processedInWindow) todayProcessed.add(a.leadId);
      } else if (
        a.assignedAt < dayStart &&
        isAssignmentAliveAt(a, dayStart) &&
        (p === null || p >= dayStart)
      ) {
        backlogLeads.add(a.leadId);
        assigneeOf.set(a.leadId, a.assigneeId);
        if (processedInWindow) backlogProcessed.add(a.leadId);
      }
    }
  }

  // 1 lead chỉ thuộc 1 nhóm — nếu vừa tồn cũ vừa được giao lại hôm nay thì
  // tính vào Trong ngày.
  for (const leadId of todayLeads) {
    backlogLeads.delete(leadId);
    backlogProcessed.delete(leadId);
  }

  let careTurns = 0;
  if (cutoff > dayStart) {
    for (const leadId of [...todayLeads, ...backlogLeads]) {
      careTurns += notes.byAuthor(
        leadId,
        assigneeOf.get(leadId)!,
        dayStart,
        cutoff,
      ).length;
    }
  }

  return {
    today: {
      assigned: todayLeads.size,
      processed: todayProcessed.size,
      pending: todayLeads.size - todayProcessed.size,
    },
    completion_rate: rate(todayProcessed.size, todayLeads.size),
    backlog: {
      start: backlogLeads.size,
      processed: backlogProcessed.size,
      remaining: backlogLeads.size - backlogProcessed.size,
    },
    care_turns: careTurns,
  };
}

export interface SaleMonthlyMetrics {
  /** Số data từng được giao cho Sale trong tháng (kể cả lượt đã bị thu hồi). */
  assigned: number;
  /** Số data Sale đã chăm sóc (ghi chú sau lúc giao) trong tháng. */
  processed: number;
  /** Số data đang giao cho Sale mà Sale chưa chăm sóc lần nào trong tháng. */
  pending: number;
  /** Tổng ghi chú của Sale trong tháng trên các data được giao. */
  care_turns: number;
  /** Lần ghi chú gần nhất của Sale trong tháng trên các data được giao. */
  last_care_at: Date | null;
}

export function computeSaleMonthly(
  assignments: AssignmentRow[],
  notes: NoteIndex,
  monthStart: Date,
  monthEnd: Date,
  now: Date,
): SaleMonthlyMetrics {
  const cutoff = now < monthEnd ? now : monthEnd;
  const assigned = new Set<string>();
  const processed = new Set<string>();
  const alive = new Set<string>();
  const assigneeOf = new Map<string, string>();

  for (const a of assignments) {
    if (a.assignedAt < monthStart || a.assignedAt >= cutoff) continue;
    assigned.add(a.leadId);
    assigneeOf.set(a.leadId, a.assigneeId);
    const p = assignmentProcessedAt(a, notes);
    if (p !== null && p < cutoff) processed.add(a.leadId);
    if (isAssignmentAliveAt(a, new Date(cutoff.getTime() - ONE_MS))) {
      alive.add(a.leadId);
    }
  }

  let pending = 0;
  for (const leadId of alive) if (!processed.has(leadId)) pending++;

  let careTurns = 0;
  let lastCareAt: Date | null = null;
  for (const leadId of assigned) {
    const list = notes.byAuthor(
      leadId,
      assigneeOf.get(leadId)!,
      monthStart,
      cutoff,
    );
    careTurns += list.length;
    const last = list[list.length - 1];
    if (last && (!lastCareAt || last > lastCareAt)) lastCareAt = last;
  }

  return {
    assigned: assigned.size,
    processed: processed.size,
    pending,
    care_turns: careTurns,
    last_care_at: lastCareAt,
  };
}

export interface AssignmentRangeMetrics {
  /** Số data được giao trong khoảng (đếm theo data, không theo lượt giao). */
  assigned: number;
  /** Số data trong đó đã được Sale được giao ghi chú. */
  processed: number;
  /** assigned - processed. */
  pending: number;
}

/**
 * Thống kê đầu Kho chăm sóc theo khoảng ngày [from, to) (yêu cầu người dùng
 * 2026-10-29): data được giao trong khoảng, đã/chưa xử lý tính tới
 * min(now, to). Cùng quy tắc isCounted với chỉ số ngày — lượt bị thu hồi/
 * giao lại mà chưa xử lý thì không tính.
 */
export function computeAssignmentRange(
  assignments: AssignmentRow[],
  notes: NoteIndex,
  from: Date,
  to: Date,
  now: Date,
): AssignmentRangeMetrics {
  const cutoff = now < to ? now : to;
  const assigned = new Set<string>();
  const processed = new Set<string>();
  for (const a of assignments) {
    if (a.assignedAt < from || a.assignedAt >= cutoff) continue;
    const p = assignmentProcessedAt(a, notes);
    if (!isCounted(a, p, cutoff)) continue;
    assigned.add(a.leadId);
    if (p !== null && p < cutoff) processed.add(a.leadId);
  }
  return {
    assigned: assigned.size,
    processed: processed.size,
    pending: assigned.size - processed.size,
  };
}

export type MonthCareStatus = 'cared' | 'not_cared';

export interface LeadMonthSummary {
  month_status: MonthCareStatus;
  month_care_count: number;
  /** Lượt giao còn hiệu lực tại `now` (mới nhất), nếu có. */
  open_assignment: {
    id: string;
    assignee_id: string;
    assigned_at: Date;
    processed: boolean;
  } | null;
  /** Đang được giao cho 1 Sale mà Sale đó chưa xử lý. */
  assigned_pending: boolean;
  /**
   * Mức ưu tiên khi giao ngẫu nhiên — null = KHÔNG được chọn (đang giao
   * cho Sale khác mà chưa xử lý: không âm thầm giao lại).
   * 1: chưa chăm sóc + chưa từng được giao trong tháng.
   * 2: đã từng được giao trong tháng (lượt giao đã đóng) nhưng chưa chăm sóc.
   * 3: đã chăm sóc trong tháng, vẫn đủ điều kiện.
   */
  random_priority: 1 | 2 | 3 | null;
}

/**
 * Trạng thái 1 data trong Kho ở tháng chứa `now`. "Đã chăm sóc" tính ghi
 * chú của BẤT KỲ ai (Câu 1 đã chốt: data đó thực tế đã được chăm sóc).
 */
export function summarizeLeadMonth(
  leadId: string,
  leadAssignments: AssignmentRow[],
  notes: NoteIndex,
  monthStart: Date,
  now: Date,
): LeadMonthSummary {
  const monthNotes = notes.anyAuthor(
    leadId,
    monthStart,
    new Date(now.getTime() + ONE_MS),
  );
  const cared = monthNotes.length > 0;

  let open: AssignmentRow | null = null;
  let hadAssignment = false;
  for (const a of leadAssignments) {
    if (a.assignedAt >= monthStart && a.assignedAt <= now) hadAssignment = true;
    if (
      isAssignmentAliveAt(a, now) &&
      (!open || a.assignedAt > open.assignedAt)
    ) {
      open = a;
    }
  }
  const openProcessed = open
    ? assignmentProcessedAt(open, notes) !== null
    : false;
  const assignedPending = open !== null && !openProcessed;

  let priority: LeadMonthSummary['random_priority'];
  if (assignedPending) priority = null;
  else if (cared) priority = 3;
  else priority = hadAssignment ? 2 : 1;

  return {
    month_status: cared ? 'cared' : 'not_cared',
    month_care_count: monthNotes.length,
    open_assignment: open
      ? {
          id: open.id,
          assignee_id: open.assigneeId,
          assigned_at: open.assignedAt,
          processed: openProcessed,
        }
      : null,
    assigned_pending: assignedPending,
    random_priority: priority,
  };
}

/**
 * Câu 6 đã chốt: dựng lại trạng thái "Dừng chăm sóc" TẠI MỐC `at` từ nhật
 * ký audit_logs (field_changed = 'care_stopped_at'), để số liệu tháng cũ
 * không đổi khi về sau có người bấm Dừng/Tiếp tục.
 */
export function wasCareStoppedAt(
  entries: { createdAt: Date; newValue: string | null }[],
  at: Date,
): boolean {
  let latest: { createdAt: Date; newValue: string | null } | null = null;
  for (const e of entries) {
    if (e.createdAt < at && (!latest || e.createdAt >= latest.createdAt)) {
      latest = e;
    }
  }
  return Boolean(latest?.newValue);
}

export interface RandomCandidate {
  leadId: string;
  teamId: string;
  priority: 1 | 2 | 3;
}

export interface RandomAssignee {
  id: string;
  teamId: string;
  quota: number;
}

export interface RandomPick {
  leadId: string;
  assigneeId: string;
  priority: 1 | 2 | 3;
}

/**
 * Giao ngẫu nhiên: trong từng nhóm, xếp data theo mức ưu tiên 1 → 2 → 3
 * (cùng mức thì xáo ngẫu nhiên), rồi chia vòng lần lượt cho các Sale của
 * nhóm đó tới khi đủ chỉ tiêu từng người hoặc hết data. Mỗi data chỉ được
 * chọn 1 lần. `random` truyền vào để test được.
 */
export function pickRandomAssignments(
  candidates: RandomCandidate[],
  assignees: RandomAssignee[],
  random: () => number = Math.random,
): RandomPick[] {
  const byTeam = new Map<string, RandomCandidate[]>();
  for (const c of candidates) push(byTeam, c.teamId, c);

  const picks: RandomPick[] = [];
  const teams = new Map<string, RandomAssignee[]>();
  for (const a of assignees) push(teams, a.teamId, a);

  for (const [teamId, members] of teams) {
    const pool = shuffle(byTeam.get(teamId) ?? [], random).sort(
      (x, y) => x.priority - y.priority,
    );
    const remaining = new Map(members.map((m) => [m.id, m.quota]));
    let cursor = 0;
    while (cursor < pool.length) {
      let gaveAny = false;
      for (const m of members) {
        if (cursor >= pool.length) break;
        if ((remaining.get(m.id) ?? 0) <= 0) continue;
        const c = pool[cursor++];
        picks.push({
          leadId: c.leadId,
          assigneeId: m.id,
          priority: c.priority,
        });
        remaining.set(m.id, remaining.get(m.id)! - 1);
        gaveAny = true;
      }
      if (!gaveAny) break;
    }
  }
  return picks;
}

export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function sortDates(list: Date[]): void {
  list.sort((a, b) => a.getTime() - b.getTime());
}

function within(list: Date[] | undefined, from: Date, to: Date): Date[] {
  if (!list) return [];
  return list.filter((d) => d >= from && d < to);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
