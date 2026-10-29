"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Inbox,
  RotateCcw,
  Search,
  Shuffle,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { AccountRole, LeadRealtimeEvent, PaginatedResult } from "@/lib/types";
import {
  CARE_END_REASON_LABEL,
  CARE_METHOD_LABEL,
  CARE_PRIORITY_LABEL,
  CARE_RELEVANT_CHANGES,
  formatCareDateTime,
  type CareAccountRef,
  type CareAssignResult,
  type CareBatch,
  type CareRandomPreview,
  type CareWarehouseItem,
  type CareWarehouseListResult,
} from "@/lib/care-warehouse";
import { EMPTY_DATE_RANGE, computeDateRange, toDateOnly, type DateRangeValue } from "@/lib/date-range";
import { useLeadRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
import { SourceBadge } from "./source-badge";

/** Sale có thể nhận việc — Leader: Sale nhóm mình; Quản lý/Admin: mọi Sale. */
export interface CareSaleOption {
  id: string;
  name: string;
  team_id: string | null;
  team_name: string | null;
}

type StatusFilter = "" | "not_cared" | "cared" | "assigned_pending";

interface CareFilters {
  search: string;
  status: StatusFilter;
  team_id: string;
  assignee_id: string;
  care_min: string;
  care_max: string;
  last_care: DateRangeValue;
  assigned: DateRangeValue;
  scope: "all" | "assigned";
  /** Khoảng ngày cho thanh thống kê Được giao / Đã xử lý / Chưa xử lý. */
  stats_range: DateRangeValue;
}

const EMPTY_FILTERS: CareFilters = {
  search: "",
  status: "",
  team_id: "",
  assignee_id: "",
  care_min: "",
  care_max: "",
  last_care: EMPTY_DATE_RANGE,
  assigned: EMPTY_DATE_RANGE,
  scope: "all",
  stats_range: { preset: "this_month", ...computeDateRange("this_month") },
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const ASSIGNER_ROLES: AccountRole[] = ["admin", "manager", "leader"];
/** Gộp nhiều sự kiện realtime liên tiếp (vd giao 50 data 1 lần) thành 1 lần tải lại. */
const REALTIME_DEBOUNCE_MS = 600;

/**
 * Mở 1 data từ Kho rồi bấm "Quay lại"/"Lưu thông tin" → về đúng bộ lọc,
 * trang, vị trí cuộn cũ (yêu cầu người dùng 2026-10-28). Cùng cơ chế
 * sessionStorage với danh sách chính (LIST_STATE_SESSION_KEY).
 */
const CARE_STATE_SESSION_KEY = "saram_rms_care_warehouse_state";

interface SavedCareState {
  filters: CareFilters;
  page: number;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  scrollTop: number;
  /** Query string lúc lưu — chỉ khôi phục khi quay lại đúng URL này (hoặc URL không có query). */
  search: string;
}

/** Mở data từ tab khác (không phải Kho) → bỏ trạng thái Kho đã lưu, quay lại không bị đè bộ lọc cũ. */
export function clearSavedCareState() {
  try {
    sessionStorage.removeItem(CARE_STATE_SESSION_KEY);
  } catch {
    // sessionStorage không khả dụng — bỏ qua.
  }
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Có lỗi xảy ra";
}

/** Lượt giao tự hết hạn khi sang tháng mới (giờ Việt Nam) — khớp backend. */
function isSameVnMonth(iso: string): boolean {
  const month = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    }).format(d);
  return month(new Date(iso)) === month(new Date());
}

function saleLabel(option: CareSaleOption): string {
  return option.team_name ? `${option.name} — ${option.team_name}` : option.name;
}

function buildQuery(filters: CareFilters, page: number, pageSize: number): string {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    scope: filters.scope,
  });
  if (filters.search.trim()) q.set("search", filters.search.trim());
  if (filters.status) q.set("status", filters.status);
  if (filters.team_id) q.set("team_id", filters.team_id);
  if (filters.assignee_id) q.set("assignee_id", filters.assignee_id);
  if (filters.care_min !== "") q.set("care_count_min", filters.care_min);
  if (filters.care_max !== "") q.set("care_count_max", filters.care_max);
  if (filters.last_care.from) q.set("last_care_from", filters.last_care.from);
  if (filters.last_care.to) q.set("last_care_to", filters.last_care.to);
  if (filters.assigned.from) q.set("assigned_from", filters.assigned.from);
  if (filters.assigned.to) q.set("assigned_to", filters.assigned.to);
  // Preset (vd "Tháng này") tính lại mỗi lần tải để không bị cũ khi qua ngày.
  // "Tối đa" = không có from → backend không giới hạn đầu (vẫn gửi to).
  const range =
    filters.stats_range.preset === "custom" ? filters.stats_range : computeDateRange(filters.stats_range.preset);
  if (range.from) q.set("stats_from", range.from);
  q.set("stats_to", range.to || toDateOnly(new Date()));
  return q.toString();
}

/** Tóm tắt kết quả 1 lần giao (số đã giao + lý do từng data bị bỏ qua). */
function summarizeAssign(result: CareAssignResult): {
  ok: string;
  skipped: string | null;
} {
  const ok = `Đã giao ${result.assigned.length} data`;
  if (result.skipped.length === 0) return { ok, skipped: null };
  const counts = new Map<string, number>();
  for (const s of result.skipped) counts.set(s.message, (counts.get(s.message) ?? 0) + 1);
  return {
    ok,
    skipped: `Bỏ qua ${result.skipped.length} data: ${[...counts].map(([m, n]) => `${n} — ${m}`).join("; ")}`,
  };
}

/**
 * Kho chăm sóc (2026-10-28) — tab trong trang Data lao động. Tự quản lý dữ
 * liệu riêng (GET /care-warehouse), không dùng chung state danh sách của
 * các tab Tất cả/Chờ phân chia/Cá nhân để không ảnh hưởng 3 tab đó.
 */
export function CareWarehousePanel({
  active,
  onWarehouseTotal,
  currentUserId,
  currentUserRole,
  isReadOnly,
  teams,
  saleOptions,
  initialAssigneeId,
  onOpenLead,
}: {
  /**
   * Tab Kho đang hiển thị. Panel được gắn sẵn (ẩn) từ lúc mở trang để tải
   * ngầm trước; mỗi lần chuyển sang tab Kho thì làm mới nền, vẫn hiện dữ
   * liệu cũ trong lúc chờ.
   */
  active: boolean;
  /** Báo tổng data trong Kho lên thẻ "Chăm sóc (N)" mỗi lần tải xong. */
  onWarehouseTotal?: (total: number) => void;
  currentUserId: string;
  currentUserRole: AccountRole;
  isReadOnly: boolean;
  teams: { id: string; name: string }[];
  saleOptions: CareSaleOption[];
  /** Mở sẵn Kho đã lọc theo 1 Sale (bấm từ bảng Tiến độ chăm sóc). */
  initialAssigneeId?: string;
  /** Sắp mở trang Chi tiết 1 data — trang cha lưu tab hiện tại để quay lại đúng Kho. */
  onOpenLead?: () => void;
}) {
  const toast = useToast();
  const canAssign = ASSIGNER_ROLES.includes(currentUserRole) && !isReadOnly;
  const canClaim = currentUserRole === "sale" && !isReadOnly;
  const canPickTeam = ["admin", "manager", "mkt"].includes(currentUserRole);
  /** MKT (chỉ xem) và tài khoản "Chỉ xem" không có thao tác nào → ẩn cột Hành động. */
  const hasActions = canAssign || canClaim;

  const [filters, setFilters] = useState<CareFilters>({
    ...EMPTY_FILTERS,
    assignee_id: initialAssigneeId ?? "",
  });
  const [applied, setApplied] = useState<CareFilters>(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const [data, setData] = useState<CareWarehouseListResult | null>(null);
  /** Query đã tải xong gần nhất — đang tải = query hiện tại chưa tải xong. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | { mode: "none" }
    | { mode: "manual"; leadIds: string[] }
    | { mode: "reassign"; item: CareWarehouseItem }
    | { mode: "random" }
    | { mode: "history" }
  >({ mode: "none" });

  const queryKey = buildQuery(applied, page, pageSize);
  const isLoading = loadedKey !== queryKey;

  const tableScrollRef = useRef<HTMLDivElement>(null);
  /** Vị trí cuộn bảng cần đặt lại sau khi khôi phục xong dữ liệu. */
  const pendingScrollRef = useRef<number | null>(null);
  /** Vừa khôi phục trạng thái cũ → lần chạy đầu của hiệu ứng ?care_scope không đè lên. */
  const skipUrlScopeRef = useRef(false);

  function saveStateForReturn() {
    try {
      const state: SavedCareState = {
        filters: applied,
        page,
        pageSize,
        scrollTop: tableScrollRef.current?.scrollTop ?? 0,
        search: window.location.search,
      };
      sessionStorage.setItem(CARE_STATE_SESSION_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage không khả dụng — bỏ qua, không chặn điều hướng.
    }
    onOpenLead?.();
  }

  // Quay lại từ trang Chi tiết → khôi phục bộ lọc/trang/vị trí cuộn đã lưu.
  useEffect(() => {
    if (initialAssigneeId) return;
    let saved: SavedCareState;
    try {
      const raw = sessionStorage.getItem(CARE_STATE_SESSION_KEY);
      if (!raw) return;
      saved = JSON.parse(raw) as SavedCareState;
    } catch {
      return;
    }
    if (window.location.search && saved.search !== window.location.search) return;
    skipUrlScopeRef.current = true;
    pendingScrollRef.current = saved.scrollTop;
    queueMicrotask(() => {
      setFilters({ ...EMPTY_FILTERS, ...saved.filters });
      setApplied({ ...EMPTY_FILTERS, ...saved.filters });
      setPage(saved.page);
      setPageSize(saved.pageSize);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dữ liệu đã khôi phục tải xong và tab Kho đang hiện → cuộn về chỗ cũ.
  useEffect(() => {
    if (pendingScrollRef.current === null || !active || isLoading) return;
    const top = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => tableScrollRef.current?.scrollTo({ top }));
  }, [active, isLoading, data]);

  // Truy vấn mới nhất đã gửi — kết quả của truy vấn cũ về muộn (người dùng
  // vừa đổi bộ lọc) bị bỏ qua, không đè lên kết quả mới (gây nhảy dữ liệu).
  const latestKeyRef = useRef<string | null>(null);
  const load = useCallback(
    (key: string, silent = false) => {
      latestKeyRef.current = key;
      return clientApi<CareWarehouseListResult>(`/care-warehouse?${key}`)
        .then((result) => {
          if (latestKeyRef.current !== key) return;
          setData(result);
          onWarehouseTotal?.(result.stats.warehouse_total);
          // Bỏ chọn những data không còn trên trang (vd vừa được giao/rời Kho).
          setSelected((prev) => {
            const visible = new Set(result.items.map((i) => i.id));
            const next = new Set([...prev].filter((id) => visible.has(id)));
            return next.size === prev.size ? prev : next;
          });
        })
        .catch((error: unknown) => {
          if (!silent && latestKeyRef.current === key) toast.error(errorText(error));
        })
        .finally(() => {
          if (latestKeyRef.current === key) setLoadedKey(key);
        });
    },
    [toast, onWarehouseTotal],
  );

  // Đang ẩn (tải ngầm) thì không báo lỗi — tránh hiện thông báo lỗi Kho khi
  // người dùng đang ở tab khác.
  const activeRef = useRef(active);
  useEffect(() => {
    void load(queryKey, !activeRef.current);
  }, [load, queryKey]);

  // Chuyển sang tab Kho: làm mới nền (dữ liệu tải ngầm/lần trước vẫn hiện ngay).
  useEffect(() => {
    if (active && !activeRef.current) void load(queryKey, true);
    activeRef.current = active;
  }, [active, load, queryKey]);

  // Realtime: mọi thay đổi có thể làm data vào/ra Kho hoặc đổi trạng thái
  // chăm sóc → tải lại nhẹ trang hiện tại (không reset bộ lọc/trang/lựa chọn).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void load(queryKey, true), REALTIME_DEBOUNCE_MS);
  }, [load, queryKey]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  useLeadRealtime((event: LeadRealtimeEvent) => {
    if (CARE_RELEVANT_CHANGES.has(event.change_type)) scheduleReload();
  });
  useRealtimeReconnect(scheduleReload);

  function applyFilters(next: CareFilters = filters) {
    setFilters(next);
    setApplied(next);
    setPage(1);
  }

  // ?care_scope=assigned (bấm thông báo "được giao data chăm sóc") → bật bộ
  // lọc "Được giao", kể cả khi đang đứng sẵn ở trang này (URL đổi, panel
  // không mount lại).
  const searchParams = useSearchParams();
  const urlScope = searchParams.get("care_scope");
  useEffect(() => {
    if (skipUrlScopeRef.current) {
      skipUrlScopeRef.current = false;
      return;
    }
    if (urlScope !== "assigned") return;
    queueMicrotask(() => {
      setFilters((prev) => ({ ...prev, scope: "assigned" }));
      setApplied((prev) => ({ ...prev, scope: "assigned" }));
      setPage(1);
    });
  }, [urlScope, searchParams]);

  async function reloadNow() {
    await load(queryKey, true);
  }

  async function handleClaim(item: CareWarehouseItem) {
    setPendingId(item.id);
    try {
      await clientApi(`/care-warehouse/${item.id}/claim`, { method: "POST" });
      toast.success(`Đã nhận "${item.full_name}"`);
      await reloadNow();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPendingId(null);
    }
  }

  async function handleRevoke(item: CareWarehouseItem) {
    setPendingId(item.id);
    try {
      await clientApi(`/care-warehouse/${item.id}/revoke`, { method: "POST" });
      toast.success("Đã thu hồi");
      await reloadNow();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPendingId(null);
    }
  }

  const items = data?.items ?? [];
  const stats = data?.stats;
  const total = data?.total ?? 0;
  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <div>
      {stats && (
        <CareStatsBar
          stats={stats}
          month={data.month}
          isSale={currentUserRole === "sale"}
          statsRange={applied.stats_range}
          onStatsRangeChange={(stats_range) => applyFilters({ ...filters, stats_range })}
        />
      )}

      <Card className="mb-2 flex flex-wrap items-end gap-1.5 p-2">
        {currentUserRole === "sale" && (
          <div className="inline-flex self-end rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            {(["all", "assigned"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => applyFilters({ ...filters, scope })}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  applied.scope === scope ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {scope === "all" ? "Tất cả data" : "Được giao"}
              </button>
            ))}
          </div>
        )}
        <Field uiSize="xs" label="Tìm kiếm" className="min-w-[180px] flex-1">
          <Input
            uiSize="xs"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Tên, SĐT, ghi chú, năm sinh, địa chỉ"
          />
        </Field>
        <Field uiSize="xs" label="Trạng thái chăm sóc (tháng)">
          <Select
            uiSize="xs"
            value={filters.status}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                status: e.target.value as StatusFilter,
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="not_cared">Chưa chăm sóc</option>
            <option value="cared">Đã chăm sóc</option>
            <option value="assigned_pending">Đã giao, chưa xử lý</option>
          </Select>
        </Field>
        {canPickTeam && (
          <Field uiSize="xs" label="Nhóm Sale">
            <Select
              uiSize="xs"
              value={filters.team_id}
              onChange={(e) => setFilters((p) => ({ ...p, team_id: e.target.value }))}
            >
              <option value="">Tất cả</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {saleOptions.length > 0 && (
          <Field uiSize="xs" label="Sale được giao">
            <Select
              uiSize="xs"
              className="max-w-44"
              value={filters.assignee_id}
              onChange={(e) => setFilters((p) => ({ ...p, assignee_id: e.target.value }))}
            >
              <option value="">Tất cả</option>
              {saleOptions
                .filter((s) => !filters.team_id || s.team_id === filters.team_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {saleLabel(s)}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field uiSize="xs" label="Số lần chăm sóc (tổng)">
          <div className="flex items-center gap-1">
            <Input
              uiSize="xs"
              type="number"
              min={0}
              className="w-14"
              placeholder="Từ"
              value={filters.care_min}
              onChange={(e) => setFilters((p) => ({ ...p, care_min: e.target.value }))}
            />
            <span className="text-slate-400">–</span>
            <Input
              uiSize="xs"
              type="number"
              min={0}
              className="w-14"
              placeholder="Đến"
              value={filters.care_max}
              onChange={(e) => setFilters((p) => ({ ...p, care_max: e.target.value }))}
            />
          </div>
        </Field>
        <Field uiSize="xs" label="Chăm sóc gần nhất" className="w-36">
          <DateRangePicker
            value={filters.last_care}
            onChange={(next) => setFilters((p) => ({ ...p, last_care: next }))}
            placeholder="Tất cả"
            allowClear
          />
        </Field>
        <Field uiSize="xs" label="Ngày phân công" className="w-36">
          <DateRangePicker
            value={filters.assigned}
            onChange={(next) => setFilters((p) => ({ ...p, assigned: next }))}
            placeholder="Tất cả"
            allowClear
          />
        </Field>
        <Button type="button" size="xs" variant="secondary" onClick={() => applyFilters()}>
          <Search className="h-3.5 w-3.5" strokeWidth={2} />
          Lọc
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => applyFilters({ ...EMPTY_FILTERS, scope: filters.scope })}
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Xóa lọc
        </Button>
      </Card>

      {(canAssign || ASSIGNER_ROLES.includes(currentUserRole)) && (
        <Card className="mb-2 flex flex-wrap items-center justify-between gap-2 p-2">
          <span className="text-xs text-slate-600">
            {selected.size > 0 ? `Đã chọn ${selected.size} data` : "Chọn data trong bảng để giao thủ công"}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setModal({ mode: "history" })}>
              <History className="h-3.5 w-3.5" strokeWidth={2} />
              Lịch sử phân công
            </Button>
            {canAssign && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => setModal({ mode: "random" })}>
                  <Shuffle className="h-3.5 w-3.5" strokeWidth={2} />
                  Giao ngẫu nhiên
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={() => setModal({ mode: "manual", leadIds: [...selected] })}
                >
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                  Giao data đã chọn
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div ref={tableScrollRef} className="max-h-[calc(100vh-260px)] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-brand-50/95 text-[10px] font-semibold tracking-wider text-brand-900 uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur">
              <tr>
                <th className="w-px border-r border-slate-100 px-1 py-2 text-center whitespace-nowrap">STT</th>
                {canAssign && (
                  <th className="w-8 border-r border-slate-100 px-2 py-2 text-center">
                    <Checkbox
                      aria-label="Chọn tất cả trên trang"
                      checked={allOnPageSelected}
                      onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
                    />
                  </th>
                )}
                <th className="border-r border-slate-100 px-2 py-2">Lao động</th>
                <th className="border-r border-slate-100 px-2 py-2">Trạng thái tháng</th>
                <th className="border-r border-slate-100 px-2 py-2">Sale được giao</th>
                <th className="border-r border-slate-100 px-2 py-2">Kết quả gần nhất</th>
                <th className="border-r border-slate-100 px-2 py-2 text-center">Lần CS tháng / tổng</th>
                {hasActions && <th className="px-2 py-2 text-center">Hành động</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const care = item.care;
                const open = care.open_assignment;
                const isMine = open?.assignee?.id === currentUserId;
                const isPending = pendingId === item.id;
                const teamName = item.assigned_team_id ? teamNameById.get(item.assigned_team_id) : undefined;
                return (
                  <tr
                    key={item.id}
                    className={cn("align-top hover:bg-brand-50/50", index % 2 === 1 ? "bg-slate-50/60" : "bg-white")}
                  >
                    <td className="border-r border-slate-100 px-1 py-2 text-center text-[10px] text-slate-500 tabular-nums">
                      {((data?.page ?? 1) - 1) * (data?.page_size ?? pageSize) + index + 1}
                    </td>
                    {canAssign && (
                      <td className="border-r border-slate-100 px-2 py-2 text-center">
                        <Checkbox
                          aria-label={`Chọn ${item.full_name}`}
                          checked={selected.has(item.id)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            })
                          }
                        />
                      </td>
                    )}
                    <td className="border-r border-slate-100 px-2 py-2">
                      <Link
                        href={`/candidates/${item.id}`}
                        onClick={saveStateForReturn}
                        className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {item.full_name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1 text-slate-500">
                        <span>{item.phone_number}</span>
                        <SourceBadge name={item.source.name} className="px-1.5 py-0 text-[10px]" />
                      </div>
                      {item.assigned_to && (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Phụ trách: {item.assigned_to.name}
                          {teamName ? ` · ${teamName}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-2">
                      <div className="flex flex-col items-start gap-1">
                        {care.month_status === "cared" ? (
                          <Badge variant="success">Đã chăm sóc</Badge>
                        ) : (
                          <Badge variant="warning">Chưa chăm sóc</Badge>
                        )}
                        {care.assigned_pending && <Badge variant="danger">Đã giao, chưa xử lý</Badge>}
                        {item.care_stop_requested_at && (
                          <Badge variant="warning" title="Sale đề nghị dừng chăm sóc — mở Chi tiết để duyệt">
                            Chờ duyệt đóng
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="border-r border-slate-100 px-2 py-2">
                      {open?.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            fullName={open.assignee.name}
                            avatarUrl={open.assignee.avatar_url}
                            className="h-6 w-6 shrink-0 text-[10px]"
                          />
                          <div className="leading-tight">
                            <p className="font-medium text-slate-800">
                              {isMine ? "Bạn" : <NameWithRoleHint account={open.assignee} />}
                            </p>
                            <p className="text-[10px] text-slate-400">{open.processed ? "Đã xử lý" : "Chưa xử lý"}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Chưa giao</span>
                      )}
                    </td>
                    <td className="max-w-[220px] border-r border-slate-100 px-2 py-2">
                      {care.last_care_result ? (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {care.last_care_result.call_status && (
                              <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                                {care.last_care_result.call_status.name}
                              </Badge>
                            )}
                            {care.last_care_result.call_result && (
                              <Badge variant="neutral" className="px-1.5 py-0 text-[10px]">
                                {care.last_care_result.call_result.name}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-slate-600" title={care.last_care_result.content}>
                            {care.last_care_result.content}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-2 text-center font-medium text-slate-700">
                      {care.month_care_count} / {care.total_care_count}
                    </td>
                    {hasActions && (
                      <td className="px-2 py-2">
                        <div className="flex flex-col items-center gap-1">
                          {canClaim && !care.assigned_pending && !isMine && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => void handleClaim(item)}
                            >
                              <UserCheck className="h-3.5 w-3.5" strokeWidth={2} />
                              Nhận
                            </Button>
                          )}
                          {canAssign && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => setModal({ mode: "reassign", item })}
                            >
                              {open ? "Giao lại" : "Giao"}
                            </Button>
                          )}
                          {canAssign && open && (
                            <Button
                              type="button"
                              size="xs"
                              variant="danger"
                              disabled={isPending}
                              onClick={() => void handleRevoke(item)}
                            >
                              Thu hồi
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && items.length === 0 && (
          <EmptyState
            title="Không có data nào trong Kho khớp bộ lọc"
            description="Data vào Kho khi đã có người phụ trách, đã có ít nhất 1 ghi chú, không có lịch gọi lại hôm nay và chưa bị dừng chăm sóc."
            icon={<Inbox className="h-5 w-5" strokeWidth={1.75} />}
          />
        )}
        {isLoading && items.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Đang tải…</p>}
      </Card>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>
          Trang {page} — hiển thị {items.length} / {total} data
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs whitespace-nowrap">Số dòng/trang</span>
          <Select
            uiSize="xs"
            className="w-16"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {modal.mode === "manual" && (
        <SalePickerModal
          title="Giao data cho Sale"
          description={`Sẽ giao ${modal.leadIds.length} data đã chọn.`}
          saleOptions={saleOptions}
          onClose={() => setModal({ mode: "none" })}
          onConfirm={async (assigneeId) => {
            const result = await clientApi<CareAssignResult>("/care-warehouse/assign", {
              method: "POST",
              body: JSON.stringify({
                lead_ids: modal.leadIds,
                assignee_id: assigneeId,
              }),
            });
            setSelected(new Set());
            await reloadNow();
            return result;
          }}
        />
      )}

      {modal.mode === "reassign" && (
        <SalePickerModal
          title={modal.item.care.open_assignment ? "Giao lại data" : "Giao data"}
          description={`"${modal.item.full_name}"${
            modal.item.care.open_assignment?.assignee
              ? ` — đang giao cho ${modal.item.care.open_assignment.assignee.name}`
              : ""
          }`}
          saleOptions={saleOptions.filter(
            (s) => !modal.item.assigned_team_id || s.team_id === modal.item.assigned_team_id,
          )}
          onClose={() => setModal({ mode: "none" })}
          onConfirm={async (assigneeId) => {
            await clientApi(`/care-warehouse/${modal.item.id}/reassign`, {
              method: "POST",
              body: JSON.stringify({ assignee_id: assigneeId }),
            });
            await reloadNow();
            return {
              batch_id: null,
              assigned: [{ lead_id: modal.item.id, assignee_id: assigneeId }],
              skipped: [],
            };
          }}
        />
      )}

      {modal.mode === "random" && (
        <RandomAssignModal saleOptions={saleOptions} onClose={() => setModal({ mode: "none" })} onDone={reloadNow} />
      )}

      {modal.mode === "history" && (
        <BatchHistoryModal teamId={applied.team_id} onClose={() => setModal({ mode: "none" })} />
      )}
    </div>
  );
}

/**
 * Thanh thống kê đầu Kho (yêu cầu người dùng 2026-10-29):
 * - Sale: Được giao / Đã xử lý / Chưa xử lý của chính mình theo khoảng ngày.
 * - Leader/Quản lý/Admin: Tổng đã giao / Đã xử lý / Chưa xử lý theo khoảng
 *   ngày + Đã chăm sóc / Data trong Kho (đếm theo data, reset mỗi tháng).
 * Lọc trạng thái danh sách dùng ô "Trạng thái" ở thanh bộ lọc bên dưới.
 */
function CareStatsBar({
  stats,
  month,
  isSale,
  statsRange,
  onStatsRangeChange,
}: {
  stats: CareWarehouseListResult["stats"];
  month: string;
  isSale: boolean;
  statsRange: DateRangeValue;
  onStatsRangeChange: (value: DateRangeValue) => void;
}) {
  const [year, mm] = month.split("-");
  const tiles: { key: string; label: string; value: string; tone: string }[] = [
    {
      key: "assigned",
      label: isSale ? "Được giao" : "Tổng đã giao",
      value: String(stats.range.assigned),
      tone: "text-slate-900",
    },
    { key: "processed", label: "Đã xử lý", value: String(stats.range.processed), tone: "text-emerald-700" },
    { key: "pending", label: "Chưa xử lý", value: String(stats.range.pending), tone: "text-red-700" },
  ];
  if (!isSale) {
    tiles.push({
      key: "cared",
      label: `Đã chăm sóc / Data trong Kho (T${Number(mm)}/${year})`,
      value: `${stats.cared} / ${stats.total}`,
      tone: "text-brand-700",
    });
  }
  return (
    <Card className="mb-2 p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Users className="h-3.5 w-3.5 text-brand-600" strokeWidth={2} />
          Kho chăm sóc
        </span>
        <div className="w-40">
          <DateRangePicker value={statsRange} onChange={onStatsRangeChange} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tiles.map((t) => (
          <div key={t.key} className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-1.5">
            <p className="text-[11px] text-slate-500">{t.label}</p>
            <p className={cn("text-lg font-bold tabular-nums", t.tone)}>{t.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Chọn 1 Sale rồi xác nhận — dùng cho Giao thủ công và Giao lại. Hiện kết quả sau khi giao. */
function SalePickerModal({
  title,
  description,
  saleOptions,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  saleOptions: CareSaleOption[];
  onClose: () => void;
  onConfirm: (assigneeId: string) => Promise<CareAssignResult>;
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CareAssignResult | null>(null);

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    try {
      setResult(await onConfirm(assigneeId));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  const summary = result ? summarizeAssign(result) : null;
  return (
    <Modal
      title={title}
      description={description}
      footer={
        result ? (
          <Button type="button" onClick={onClose}>
            Đóng
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="button" disabled={!assigneeId || isSubmitting} onClick={() => void submit()}>
              {isSubmitting ? "Đang giao…" : "Xác nhận giao"}
            </Button>
          </>
        )
      }
    >
      {summary ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-emerald-700">{summary.ok}</p>
          {summary.skipped && <p className="text-amber-700">{summary.skipped}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Sale nhận data">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">— Chọn Sale —</option>
              {saleOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {saleLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-slate-500">
            Giao data không được tính là chăm sóc. Data chỉ tính đã xử lý khi Sale được giao ghi chú cho data đó.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

/** Giao ngẫu nhiên: chọn Sale + số lượng → xem trước → xác nhận đúng danh sách đã xem. */
function RandomAssignModal({
  saleOptions,
  onClose,
  onDone,
}: {
  saleOptions: CareSaleOption[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"per_assignee" | "total">("per_assignee");
  const [amount, setAmount] = useState("10");
  const [preview, setPreview] = useState<CareRandomPreview | null>(null);
  const [result, setResult] = useState<CareAssignResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNumber = Number(amount);
  const amountValid = Number.isInteger(amountNumber) && amountNumber >= 1;

  async function runPreview() {
    setIsBusy(true);
    setError(null);
    try {
      setPreview(
        await clientApi<CareRandomPreview>("/care-warehouse/random/preview", {
          method: "POST",
          body: JSON.stringify({
            assignee_ids: [...chosen],
            [mode]: amountNumber,
          }),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setIsBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await clientApi<CareAssignResult>("/care-warehouse/random/confirm", {
        method: "POST",
        body: JSON.stringify({
          pairs: preview.pairs.map((p) => ({
            lead_id: p.lead_id,
            assignee_id: p.assignee_id,
          })),
        }),
      });
      setResult(res);
      await onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setIsBusy(false);
    }
  }

  const nameById = new Map(saleOptions.map((s) => [s.id, s.name]));
  const summary = result ? summarizeAssign(result) : null;

  let footer;
  if (result) {
    footer = (
      <Button type="button" onClick={onClose}>
        Đóng
      </Button>
    );
  } else if (preview) {
    footer = (
      <>
        <Button type="button" variant="outline" onClick={() => setPreview(null)}>
          Quay lại
        </Button>
        <Button type="button" disabled={isBusy || preview.picked_total === 0} onClick={() => void confirm()}>
          {isBusy ? "Đang giao…" : `Xác nhận giao ${preview.picked_total} data`}
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="button" disabled={isBusy || chosen.size === 0 || !amountValid} onClick={() => void runPreview()}>
          {isBusy ? "Đang chọn…" : "Xem trước"}
        </Button>
      </>
    );
  }

  return (
    <Modal
      title="Giao ngẫu nhiên"
      description="Ưu tiên: (1) chưa chăm sóc, chưa giao trong tháng → (2) đã giao nhưng chưa chăm sóc → (3) đã chăm sóc trong tháng. Data đang giao cho Sale khác mà chưa xử lý không bị lấy."
      maxWidth="max-w-2xl"
      footer={footer}
    >
      {summary ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-emerald-700">{summary.ok}</p>
          {summary.skipped && (
            <p className="text-amber-700">
              {summary.skipped} (data đã thay đổi trong lúc xem trước — đã kiểm tra lại khi xác nhận)
            </p>
          )}
        </div>
      ) : preview ? (
        <div className="space-y-3 text-sm">
          {preview.shortage && (
            <p className="rounded-lg bg-amber-50 p-2 text-amber-800">
              Chỉ có {preview.picked_total} / {preview.requested_total} data đủ điều kiện để giao.
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {([1, 2, 3] as const).map((p) => (
              <Badge key={p} variant="neutral">
                Mức {p} — {CARE_PRIORITY_LABEL[p]}: {preview.by_priority[p]}
              </Badge>
            ))}
          </div>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">Sale</th>
                <th className="py-1 text-right">Yêu cầu</th>
                <th className="py-1 text-right">Thực tế</th>
              </tr>
            </thead>
            <tbody>
              {preview.per_assignee.map((row) => (
                <tr key={row.assignee.id} className="border-t border-slate-100">
                  <td className="py-1">{row.assignee.name}</td>
                  <td className="py-1 text-right tabular-nums">{row.requested}</td>
                  <td
                    className={cn(
                      "py-1 text-right font-medium tabular-nums",
                      row.picked < row.requested && "text-amber-700",
                    )}
                  >
                    {row.picked}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <tbody>
                {preview.pairs.map((p) => (
                  <tr key={p.lead_id} className="border-b border-slate-50">
                    <td className="px-2 py-1">
                      {p.full_name} <span className="text-slate-400">{p.phone_number}</span>
                    </td>
                    <td className="px-2 py-1 text-slate-500">Mức {p.priority}</td>
                    <td className="px-2 py-1 font-medium">→ {nameById.get(p.assignee_id) ?? "Sale"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 font-medium text-slate-700">Chọn Sale nhận ({chosen.size})</p>
            <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
              {saleOptions.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={chosen.has(s.id)}
                    onChange={(e) =>
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                  {saleLabel(s)}
                </label>
              ))}
              {saleOptions.length === 0 && <p className="text-xs text-slate-400">Không có Sale nào để giao.</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Cách nhập số lượng">
              <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="per_assignee">Số data cho mỗi Sale</option>
                <option value="total">Tổng số data (chia đều)</option>
              </Select>
            </Field>
            <Field label="Số lượng">
              <Input
                type="number"
                min={1}
                className="w-24"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function BatchHistoryModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResult<CareBatch> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ page: String(page), page_size: "20" });
    if (teamId) q.set("team_id", teamId);
    clientApi<PaginatedResult<CareBatch>>(`/care-warehouse/batches?${q.toString()}`)
      .then(setData)
      .catch((e) => toast.error(errorText(e)));
  }, [page, teamId, toast]);

  return (
    <Modal
      title="Lịch sử phân công"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-slate-500">{data ? `${data.total} đợt` : ""}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!data || page * data.page_size >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
            <Button type="button" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      {!data ? (
        <p className="text-sm text-slate-400">Đang tải…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có đợt phân công nào.</p>
      ) : (
        <div className="space-y-2">
          {data.items.map((batch) => {
            const assignees = new Map<string, CareAccountRef>();
            for (const a of batch.assignments) assignees.set(a.assignee.id, a.assignee);
            const isOpen = expanded === batch.id;
            return (
              <div key={batch.id} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : batch.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{formatCareDateTime(batch.created_at)}</span>
                    <Badge variant="info">{CARE_METHOD_LABEL[batch.method]}</Badge>
                    <span className="text-slate-500">
                      bởi <NameWithRoleHint account={batch.created_by} />
                    </span>
                  </span>
                  <span className="text-slate-600">
                    {batch.lead_count} data → {[...assignees.values()].map((a) => a.name).join(", ")}
                  </span>
                </button>
                {isOpen && (
                  <table className="w-full border-t border-slate-100 text-xs">
                    <tbody>
                      {batch.assignments.map((a) => (
                        <tr key={a.id} className="border-b border-slate-50">
                          <td className="px-3 py-1">
                            <Link href={`/candidates/${a.lead.id}`} className="hover:text-brand-700 hover:underline">
                              {a.lead.full_name}
                            </Link>{" "}
                            <span className="text-slate-400">{a.lead.phone_number}</span>
                          </td>
                          <td className="px-3 py-1">{a.assignee.name}</td>
                          <td className="px-3 py-1 text-slate-500">
                            {a.end_reason
                              ? `${CARE_END_REASON_LABEL[a.end_reason]} ${formatCareDateTime(a.ended_at)}${
                                  a.ended_by ? ` (${a.ended_by.name})` : ""
                                }`
                              : isSameVnMonth(a.assigned_at)
                                ? "Đang giao"
                                : "Hết hạn (sang tháng mới)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
