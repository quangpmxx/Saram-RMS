"use client";

import { useCan } from "@/lib/capability-context";
import { fetchNotesByLeadIds } from "@/lib/notes-batch";
import { formatDMYHM } from "@/lib/date-format";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
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
import type { AccountRole, LeadRealtimeEvent, Note, PaginatedResult } from "@/lib/types";
import {
  CARE_METHOD_LABEL,
  CARE_PRIORITY_LABEL,
  CARE_RELEVANT_CHANGES,
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
import { SortableTh, applySortParams, type SortOrder } from "@/components/ui/sortable-th";
import { SourceBadge } from "./source-badge";
import { shouldOpenRowDetail } from "./row-click";
import { NoteColorFilter, type NoteColorValue } from "./note-color-filter";
import { CallStatusCellContent, callStatusCellStyle } from "./call-status-cell";
import {
  LEAD_CARD_CLASS,
  LEAD_CARD_GRID_CLASS,
  LEAD_ZOOM_LEVELS,
  LeadLayoutToggle,
  useLeadLayout,
  type LeadZoomLevel,
} from "./lead-layout";

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
  assigned: DateRangeValue;
  /** Ngày lên số (yêu cầu người dùng 2026-11-06). */
  uploaded: DateRangeValue;
  /** Bộ lọc "Đánh giá" — màu đánh dấu: "" = tất cả. */
  note_color: NoteColorValue | "";
  scope: "all" | "assigned";
  /** Khoảng ngày cho thanh thống kê Được giao / Đã xử lý / Chưa xử lý. */
  stats_range: DateRangeValue;
  /** Bộ lọc Nhóm/Nhân viên riêng của thanh Tiến độ (không ảnh hưởng danh sách). */
  stats_team_id: string;
  stats_assignee_id: string;
  /** Bấm tiêu đề STT (yêu cầu người dùng 2026-10-30): desc = đảo thứ tự mặc định. */
  stt_order: SortOrder;
}

const EMPTY_FILTERS: CareFilters = {
  search: "",
  status: "",
  team_id: "",
  assignee_id: "",
  care_min: "",
  care_max: "",
  assigned: EMPTY_DATE_RANGE,
  uploaded: EMPTY_DATE_RANGE,
  note_color: "",
  scope: "all",
  stats_range: { preset: "this_month", ...computeDateRange("this_month") },
  stats_team_id: "",
  stats_assignee_id: "",
  stt_order: "asc",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300] as const;

/** Khung ghi chú thu gọn ở tab Chăm sóc — vừa dòng cao 84px, ~1,5 ghi chú. */
const CARE_NOTE_COLLAPSED_HEIGHT = 44;
/** Gộp nhiều sự kiện realtime liên tiếp (vd giao 50 data 1 lần) thành 1 lần tải lại. */
const REALTIME_DEBOUNCE_MS = 600;
/** Tab Kho đang ẩn: gộp các sự kiện realtime liên tiếp trong 15 giây thành 1 lần tải. */
const HIDDEN_RELOAD_DEBOUNCE_MS = 15000;

/**
 * Mở 1 data từ Kho rồi bấm "Quay lại"/"Lưu thông tin" → về đúng bộ lọc,
 * trang, vị trí cuộn cũ (yêu cầu người dùng 2026-10-28). Cùng cơ chế
 * sessionStorage với danh sách chính (LIST_STATE_SESSION_KEY).
 */
const CARE_STATE_SESSION_KEY = "saram_rms_care_warehouse_state";
/**
 * Lưu RIÊNG theo tài khoản (2026-10-30): trước đây dùng chung 1 khoá, đổi tài
 * khoản trên cùng trình duyệt thì tài khoản sau nhận lại bộ lọc/trang của
 * tài khoản trước.
 */
function careStateKey(accountId: string): string {
  return `${CARE_STATE_SESSION_KEY}:${accountId}`;
}

interface SavedCareState {
  filters: CareFilters;
  page: number;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  scrollTop: number;
  /** Query string lúc lưu — chỉ khôi phục khi quay lại đúng URL này (hoặc URL không có query). */
  search: string;
}

/** Mở data từ tab khác (không phải Kho) → bỏ trạng thái Kho đã lưu, quay lại không bị đè bộ lọc cũ. */
export function clearSavedCareState(accountId: string) {
  try {
    sessionStorage.removeItem(careStateKey(accountId));
  } catch {
    // sessionStorage không khả dụng — bỏ qua.
  }
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Có lỗi xảy ra";
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
  if (filters.assigned.from) q.set("assigned_from", filters.assigned.from);
  if (filters.assigned.to) q.set("assigned_to", filters.assigned.to);
  if (filters.uploaded.from) q.set("uploaded_from", filters.uploaded.from);
  if (filters.uploaded.to) q.set("uploaded_to", filters.uploaded.to);
  if (filters.note_color) q.set("note_color", filters.note_color);
  // Preset (vd "Tháng này") tính lại mỗi lần tải để không bị cũ khi qua ngày.
  // "Tối đa" = không có from → backend không giới hạn đầu (vẫn gửi to).
  const range =
    filters.stats_range.preset === "custom" ? filters.stats_range : computeDateRange(filters.stats_range.preset);
  if (range.from) q.set("stats_from", range.from);
  q.set("stats_to", range.to || toDateOnly(new Date()));
  if (filters.stats_team_id) q.set("stats_team_id", filters.stats_team_id);
  if (filters.stats_assignee_id) q.set("stats_assignee_id", filters.stats_assignee_id);
  if (filters.stt_order === "desc") applySortParams(q, { key: "stt", order: "desc" });
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
  const router = useRouter();
  // Phân quyền chi tiết (2026-11-07): theo quyền nhỏ, backend chặn thật.
  const can = useCan();
  const isAssigner = can("care.assign");
  const canAssign = isAssigner && !isReadOnly;
  const canClaim = can("care.claim") && !isReadOnly;
  const canPickTeam = can("care.view_all");
  /** Không có quyền xem tiến độ cả nhóm → thống kê/bộ lọc chỉ của mình (mặc định Sale). */
  const isSelfOnly = !can("care.progress");
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
  /** Kiểu xem bảng ngang / ô thẻ — dùng chung với tab Tất cả (điện thoại luôn ô thẻ). */
  const { layout, chosen: chosenLayout, setLayout } = useLeadLayout();
  /** Thu phóng danh sách (giống tab Tất cả). */
  const [zoomLevel, setZoomLevel] = useState<LeadZoomLevel>(100);
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
      sessionStorage.setItem(careStateKey(currentUserId), JSON.stringify(state));
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
      const raw = sessionStorage.getItem(careStateKey(currentUserId));
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
  /**
   * Lỗi của lần tải gần nhất (2026-10-30): trước đây lỗi lúc tải ngầm bị bỏ
   * qua và bảng hiện "Không có data nào" như Kho trống thật — giờ hiện lỗi
   * kèm nút Tải lại.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(
    (key: string, silent = false) => {
      latestKeyRef.current = key;
      return clientApi<CareWarehouseListResult>(`/care-warehouse?${key}`)
        .then((result) => {
          if (latestKeyRef.current !== key) return;
          setLoadError(null);
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
          if (latestKeyRef.current !== key) return;
          setLoadError(errorText(error));
          if (!silent) toast.error(errorText(error));
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

  // Chuyển sang tab Kho: làm mới nền (dữ liệu tải ngầm/lần trước vẫn hiện
  // ngay). Chưa có dữ liệu (lần tải ngầm lỗi) thì tải lại và báo lỗi nếu có.
  useEffect(() => {
    if (active && !activeRef.current) void load(queryKey, data !== null);
    activeRef.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi đổi tab, không chạy lại khi dữ liệu về
  }, [active, load, queryKey]);

  // Realtime: mọi thay đổi có thể làm data vào/ra Kho hoặc đổi trạng thái
  // chăm sóc → tải lại nhẹ trang hiện tại (không reset bộ lọc/trang/lựa chọn).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    // Tab Kho đang ẩn: vẫn tải ngầm (để số "Chăm sóc (N)" trên tab luôn đúng)
    // nhưng gộp thưa hơn nhiều — API Kho nặng (đo 2026-10-30: ~3,5s), không nên
    // tải lại theo từng sự kiện khi người dùng không nhìn vào.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => void load(queryKey, true),
      activeRef.current ? REALTIME_DEBOUNCE_MS : HIDDEN_RELOAD_DEBOUNCE_MS,
    );
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
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setFilters(next);
    setApplied(next);
    setPage(1);
  }

  /**
   * Gõ đến đâu lọc đến đó (yêu cầu người dùng 2026-10-29): chờ ngừng gõ
   * 350ms rồi áp dụng riêng ô Tìm kiếm; xoá hết chữ = về toàn bộ data.
   */
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(search: string) {
    applyTypedFilter({ search });
  }

  /**
   * Ô gõ chữ/số (Tìm kiếm, Số lần chăm sóc): chờ ngừng gõ 350ms rồi lọc luôn.
   * Các ô chọn thì gọi thẳng applyFilters() — đổi là lọc ngay, không cần bấm
   * "Lọc" (yêu cầu người dùng 2026-10-30).
   */
  function applyTypedFilter(patch: Partial<CareFilters>) {
    setFilters((p) => ({ ...p, ...patch }));
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setApplied((p) => ({ ...p, ...patch }));
      setPage(1);
    }, 350);
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

  /** Duyệt đề nghị dừng chăm sóc của Sale ngay tại bảng (giống nút ở trang Chi tiết). */
  async function handleApproveStop(item: CareWarehouseItem) {
    if (!window.confirm(`Duyệt đóng data "${item.full_name}"? Data sẽ dừng chăm sóc.`)) return;
    setPendingId(item.id);
    try {
      await clientApi(`/care-warehouse/${item.id}/stop-request/approve`, { method: "POST" });
      toast.success("Đã duyệt — data đã đóng");
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

  /**
   * Cột "Nội dung ghi chú" (yêu cầu người dùng 2026-10-29) — toàn bộ lịch sử
   * ghi chú của data, đồng bộ với cột "Tình trạng cuộc gọi" ở tab Tất cả
   * (cùng nguồn GET /candidate/notes, cùng component hiển thị). Mỗi lần danh
   * sách tải lại (kể cả do realtime) thì tải lại ghi chú của trang.
   */
  const [notesByLeadId, setNotesByLeadId] = useState<Map<string, Note[]>>(new Map());
  useEffect(() => {
    const ids = (data?.items ?? []).map((item) => item.id);
    if (ids.length === 0) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchNotesByLeadIds(ids, controller.signal).then((byLead) => {
        if (cancelled) return;
        setNotesByLeadId(new Map(ids.map((id) => [id, (byLead[id] ?? []).filter((note) => !note.is_deleted)])));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data]);
  const stats = data?.stats;
  const total = data?.total ?? 0;
  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  /** Bấm chỗ trống trên hàng/ô thẻ → mở Chi tiết (yêu cầu người dùng 2026-10-29). */
  function openDetailOnClick(event: ReactMouseEvent<HTMLElement>, item: CareWarehouseItem) {
    if (!shouldOpenRowDetail(event)) return;
    saveStateForReturn();
    router.push(`/candidates/${item.id}`);
  }

  /**
   * Nội dung từng ô của 1 data trong Kho — dùng chung cho dạng bảng ngang và dạng
   * ô thẻ (2026-11-04) để 2 kiểu xem luôn hiện đủ, giống hệt dữ liệu.
   */
  function careParts(item: CareWarehouseItem, index: number, asCard: boolean) {
    const care = item.care;
    const open = care.open_assignment;
    const isMine = open?.assignee?.id === currentUserId;
    const isPending = pendingId === item.id;
    const teamName = item.assigned_team_id ? teamNameById.get(item.assigned_team_id) : undefined;
    // Đang giữ số: không giao/nhận cho người khác người giữ số (backend cũng chặn).
    const heldById = item.is_held ? (item.held_by?.id ?? null) : undefined;
    const canGiveHeld = heldById === undefined || saleOptions.some((s) => s.id === heldById);
    const stt =
      applied.stt_order === "desc"
        ? (data?.total ?? 0) - (((data?.page ?? 1) - 1) * (data?.page_size ?? pageSize) + index)
        : ((data?.page ?? 1) - 1) * (data?.page_size ?? pageSize) + index + 1;

    const checkbox = canAssign ? (
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
    ) : null;

    const info = (
      <>
        <Link
          href={`/candidates/${item.id}`}
          onClick={saveStateForReturn}
          // Tên căn trái thẳng hàng SĐT/năm sinh — giống tab Tất cả (yêu cầu người dùng 2026-11-05).
          className={cn(
            "block text-left font-medium text-slate-800 hover:text-brand-700 hover:underline",
            asCard && "text-sm",
          )}
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
      </>
    );

    const status = (
      <div className={cn("flex gap-1", asCard ? "flex-row flex-wrap items-center" : "flex-col items-start")}>
        {care.month_status === "cared" ? (
          <Badge variant="success">Đã chăm sóc</Badge>
        ) : (
          <Badge variant="warning">Chưa chăm sóc</Badge>
        )}
        {care.assigned_pending && <Badge variant="danger">Đã giao, chưa xử lý</Badge>}
        {item.is_held && (
          <span className="flex flex-col rounded-lg bg-accent-50 px-2.5 py-0.5 text-xs leading-tight font-medium whitespace-nowrap text-accent-700 ring-1 ring-accent-600/20 ring-inset">
            <span>Số đang được giữ bởi</span>
            <span className="font-semibold">{item.held_by?.name ?? "—"}</span>
          </span>
        )}
        {item.care_stop_requested_at && (
          <Badge variant="info" title="Sale đề nghị dừng chăm sóc — mở Chi tiết để duyệt">
            Chờ duyệt đóng
          </Badge>
        )}
      </div>
    );

    const assignee = open?.assignee ? (
      <div className="flex items-center gap-1.5">
        <Avatar fullName={open.assignee.name} avatarUrl={open.assignee.avatar_url} className="h-6 w-6 shrink-0 text-[10px]" />
        <div className="leading-tight">
          <p className="font-medium text-slate-800">{isMine ? "Bạn" : <NameWithRoleHint account={open.assignee} />}</p>
          <p className="text-[10px] text-slate-400">{open.processed ? "Đã xử lý" : "Chưa xử lý"}</p>
        </div>
      </div>
    ) : (
      <span className="text-slate-400">Chưa giao</span>
    );

    const notes = <CallStatusCellContent notes={notesByLeadId.get(item.id)} collapsedMaxHeight={CARE_NOTE_COLLAPSED_HEIGHT} />;

    const actions = hasActions ? (
      <div className={cn("flex items-center gap-1", asCard ? "flex-row flex-wrap justify-end" : "flex-col")}>
        {canClaim && !care.assigned_pending && !isMine && (heldById === undefined || heldById === currentUserId) && (
          <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={() => void handleClaim(item)}>
            <UserCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Nhận
          </Button>
        )}
        {canAssign && item.care_stop_requested_at && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-50"
            disabled={isPending}
            onClick={() => void handleApproveStop(item)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Duyệt đóng
          </Button>
        )}
        {canAssign && canGiveHeld && (
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
          <Button type="button" size="xs" variant="danger" disabled={isPending} onClick={() => void handleRevoke(item)}>
            Thu hồi
          </Button>
        )}
      </div>
    ) : null;

    return { stt, checkbox, info, status, assignee, notes, actions, monthCount: care.month_care_count, totalCount: care.total_care_count };
  }

  /** Nút Lịch sử phân công / Giao ngẫu nhiên / Giao data đã chọn — nằm trên thanh Tiến độ (2026-11-04). */
  const assignActions =
    canAssign || isAssigner ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="xs" variant="outline" onClick={() => setModal({ mode: "history" })}>
          <History className="h-3.5 w-3.5" strokeWidth={2} />
          Lịch sử phân công
        </Button>
        {canAssign && (
          <>
            <Button type="button" size="xs" variant="outline" onClick={() => setModal({ mode: "random" })}>
              <Shuffle className="h-3.5 w-3.5" strokeWidth={2} />
              Giao ngẫu nhiên
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={selected.size === 0}
              title={selected.size === 0 ? "Tick chọn data trong danh sách để giao thủ công" : undefined}
              onClick={() => setModal({ mode: "manual", leadIds: [...selected] })}
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
              Giao data đã chọn{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          </>
        )}
      </div>
    ) : null;

  return (
    <div>
      {stats && (
        <CareStatsBar
          stats={stats}
          isSale={isSelfOnly}
          canPickTeam={canPickTeam}
          teams={teams}
          saleOptions={saleOptions}
          statsFilters={applied}
          onStatsFiltersChange={(patch) => applyFilters({ ...filters, ...patch })}
          actions={assignActions}
        />
      )}

      <Card className="mb-2 flex flex-wrap items-end gap-1.5 p-2">
        <div className="hidden flex-col gap-0.5 text-xs md:flex">
          <span className="font-medium text-slate-700">Kiểu xem</span>
          <LeadLayoutToggle value={chosenLayout} onChange={setLayout} />
        </div>
        <Field uiSize="xs" label="Thu phóng">
          <Select
            uiSize="xs"
            className="w-16!"
            value={String(zoomLevel)}
            onChange={(e) => setZoomLevel(Number(e.target.value) as LeadZoomLevel)}
          >
            {LEAD_ZOOM_LEVELS.map((zoom) => (
              <option key={zoom} value={zoom}>
                {zoom}%
              </option>
            ))}
          </Select>
        </Field>
        {isSelfOnly && (
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
        {/* Thu gọn nhãn/độ rộng để cả thanh lọc nằm 1 dòng trên laptop (yêu cầu người dùng 2026-11-04). */}
        <Field uiSize="xs" label="Tìm kiếm" className="min-w-[110px] flex-1">
          <Input
            uiSize="xs"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Tên, SĐT, ghi chú, năm sinh, địa chỉ"
          />
        </Field>
        <Field uiSize="xs" label="Trạng thái (30 ngày)" title="Trạng thái chăm sóc trong 30 ngày">
          <Select
            uiSize="xs"
            value={filters.status}
            onChange={(e) => applyFilters({ ...filters, status: e.target.value as StatusFilter })}
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
              onChange={(e) => applyFilters({ ...filters, team_id: e.target.value })}
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
              className="max-w-32!"
              value={filters.assignee_id}
              onChange={(e) => applyFilters({ ...filters, assignee_id: e.target.value })}
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
        <Field uiSize="xs" label="Lần CS" title="Số lần chăm sóc (tổng)">
          {/* Ô số gọn, ẩn nút tăng/giảm để đủ chỗ cho 2–3 chữ số. */}
          <div className="flex items-center gap-0.5 [&_input]:[appearance:textfield] [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none">
            <Input
              uiSize="xs"
              type="number"
              min={0}
              className="w-10! px-1! text-center"
              placeholder="Từ"
              value={filters.care_min}
              onChange={(e) => applyTypedFilter({ care_min: e.target.value })}
            />
            <span className="text-slate-400">–</span>
            <Input
              uiSize="xs"
              type="number"
              min={0}
              className="w-10! px-1! text-center"
              placeholder="Đến"
              value={filters.care_max}
              onChange={(e) => applyTypedFilter({ care_max: e.target.value })}
            />
          </div>
        </Field>
        <Field uiSize="xs" label="Đánh giá">
          <NoteColorFilter
            value={filters.note_color}
            onChange={(next) => applyFilters({ ...filters, note_color: next })}
          />
        </Field>
        <Field uiSize="xs" label="Ngày lên số" className="w-32">
          <DateRangePicker
            value={filters.uploaded}
            onChange={(next) => applyFilters({ ...filters, uploaded: next })}
            placeholder="Tất cả"
            allowClear
          />
        </Field>
        <Field uiSize="xs" label="Ngày phân công" className="w-32">
          <DateRangePicker
            value={filters.assigned}
            onChange={(next) => applyFilters({ ...filters, assigned: next })}
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
          className="whitespace-nowrap"
          onClick={() => applyFilters({ ...EMPTY_FILTERS, scope: filters.scope })}
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Xóa lọc
        </Button>
      </Card>

      {/* Chưa có thanh Tiến độ (đang tải) → nút giao tạm hiện ở khung riêng. */}
      {!stats && assignActions && <Card className="mb-2 flex justify-end p-2">{assignActions}</Card>}

      <Card className="overflow-hidden p-0">
        {/* Điện thoại: không cuộn lồng trong khung — cả trang cuộn. */}
        <div ref={tableScrollRef} className="md:max-h-[calc(100vh-260px)] md:overflow-auto">
          {/* "zoom" bọc nội dung, không bọc khối cuộn (giống tab Tất cả) để max-height không lệch. */}
          <div style={{ zoom: zoomLevel / 100 }}>
          {layout === "cards" ? (
            // Dạng ô thẻ (2026-11-04): đủ dữ liệu như bảng; điện thoại 1 cột xếp dọc.
            <div className={LEAD_CARD_GRID_CLASS}>
              {items.map((item, index) => {
                const p = careParts(item, index, true);
                return (
                  <div key={item.id} className={LEAD_CARD_CLASS} onClick={(event) => openDetailOnClick(event, item)}>
                    {/* Header ô thẻ nền đậm như đầu bảng (yêu cầu người dùng 2026-11-04). */}
                    <div className="flex items-center gap-2 bg-slate-700 px-3 py-1.5">
                      {p.checkbox && <span onClick={(e) => e.stopPropagation()}>{p.checkbox}</span>}
                      <span className="text-[10px] text-slate-300 tabular-nums">#{p.stt}</span>
                      <span className="ml-auto text-[11px] text-slate-300">
                        CS 30 ngày <b className="text-white tabular-nums">{p.monthCount}</b> · Tổng{" "}
                        <b className="text-white tabular-nums">{p.totalCount}</b>
                      </span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,40%)] gap-x-3 px-3 py-2">
                      <div className="min-w-0">{p.info}</div>
                      <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-slate-400 uppercase">Sale được giao</p>
                        {p.assignee}
                      </div>
                    </div>
                    <div className="px-3 pb-2">{p.status}</div>
                    <div className="mx-3 mb-2 rounded-lg px-2 py-1 ring-1 ring-slate-100" style={callStatusCellStyle(item)}>
                      {p.notes}
                    </div>
                    {p.actions && <div className="mt-auto border-t border-slate-100 px-3 py-2">{p.actions}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-700 text-[10px] font-semibold tracking-wider text-white uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)]">
              <tr>
                {/* Ô tick đứng trước STT (yêu cầu người dùng 2026-10-30, giống tab Tất cả). */}
                {canAssign && (
                  <th className="w-px border-r border-slate-600 px-1 py-2 text-center">
                    <Checkbox
                      aria-label="Chọn tất cả trên trang"
                      checked={allOnPageSelected}
                      onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
                    />
                  </th>
                )}
                <SortableTh
                  sortKey="stt"
                  sort={{ key: "stt", order: applied.stt_order }}
                  onSort={(next) => applyFilters({ ...filters, stt_order: next.order })}
                  className="w-px border-r border-slate-600 px-1 py-2 text-center whitespace-nowrap"
                >
                  STT
                </SortableTh>
                <th className="border-r border-slate-600 px-2 py-2 text-center">Lao động</th>
                <th className="w-px border-r border-slate-600 px-2 py-2 text-center whitespace-nowrap">Trạng thái</th>
                <th className="border-r border-slate-600 px-2 py-2 text-center">Sale được giao</th>
                <th className="min-w-[300px] border-r border-slate-600 px-2 py-2 text-center">Nội dung ghi chú</th>
                {/* Tách "Lần CS tháng / tổng" thành 2 cột hẹp vừa dữ liệu (yêu cầu người dùng 2026-10-30). */}
                <th className="w-px border-r border-slate-600 px-1.5 py-2 text-center leading-tight">
                  <span className="whitespace-nowrap">CS trong</span>
                  <br />
                  <span className="whitespace-nowrap">30 ngày</span>
                </th>
                <th className="w-px border-r border-slate-600 px-1.5 py-2 text-center leading-tight">
                  <span className="whitespace-nowrap">Tổng</span>
                  <br />
                  <span className="whitespace-nowrap">lượt CS</span>
                </th>
                {hasActions && <th className="px-2 py-2 text-center">Hành động</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-400">
              {items.map((item, index) => {
                const p = careParts(item, index, false);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      // Chiều cao dòng cố định (yêu cầu người dùng 2026-10-30); ghi chú dài
                      // bị cắt ở CARE_NOTE_COLLAPSED_HEIGHT, bấm "Xem thêm" mới mở ra.
                      "h-[84px] cursor-pointer align-top hover:bg-brand-50/50",
                      index % 2 === 1 ? "bg-slate-50/60" : "bg-white",
                    )}
                    onClick={(event) => openDetailOnClick(event, item)}
                  >
                    {canAssign && (
                      // Bấm vào ô (kể cả khoảng trống quanh ô tick) không mở trang Chi tiết.
                      <td className="border-r border-slate-100 px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {p.checkbox}
                      </td>
                    )}
                    <td className="border-r border-slate-100 px-1 py-2 text-center text-[10px] text-slate-500 tabular-nums">{p.stt}</td>
                    <td className="border-r border-slate-100 px-2 py-2">{p.info}</td>
                    <td className="w-px border-r border-slate-100 px-2 py-2 whitespace-nowrap">{p.status}</td>
                    <td className="border-r border-slate-100 px-2 py-2">{p.assignee}</td>
                    <td className="min-w-[300px] border-r border-slate-100 px-2 py-1" style={callStatusCellStyle(item)}>
                      {p.notes}
                    </td>
                    <td className="w-px border-r border-slate-100 px-1.5 py-2 text-center font-medium text-slate-700 tabular-nums">
                      {p.monthCount}
                    </td>
                    <td className="w-px border-r border-slate-100 px-1.5 py-2 text-center font-medium text-slate-700 tabular-nums">
                      {p.totalCount}
                    </td>
                    {hasActions && <td className="px-2 py-2">{p.actions}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          </div>
        </div>
        {!isLoading && items.length === 0 && loadError && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-sm">
            <p className="text-red-600">Không tải được Kho chăm sóc: {loadError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load(queryKey)}>
              Tải lại
            </Button>
          </div>
        )}
        {!isLoading && items.length === 0 && !loadError && (
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
            (s) =>
              (!modal.item.assigned_team_id || s.team_id === modal.item.assigned_team_id) &&
              (!modal.item.is_held || s.id === modal.item.held_by?.id),
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
  isSale,
  canPickTeam,
  teams,
  saleOptions,
  statsFilters,
  onStatsFiltersChange,
  actions,
}: {
  /** Nút giao data (Lịch sử phân công / Giao ngẫu nhiên / Giao đã chọn) — đặt cạnh chữ "Tiến độ". */
  actions?: ReactNode;
  stats: CareWarehouseListResult["stats"];
  isSale: boolean;
  /** Quản lý/Admin/MKT: chọn Nhóm hoặc Tất cả. */
  canPickTeam: boolean;
  teams: { id: string; name: string }[];
  saleOptions: CareSaleOption[];
  statsFilters: Pick<CareFilters, "stats_range" | "stats_team_id" | "stats_assignee_id">;
  onStatsFiltersChange: (
    patch: Partial<Pick<CareFilters, "stats_range" | "stats_team_id" | "stats_assignee_id">>,
  ) => void;
}) {
  const staffOptions = saleOptions.filter(
    (s) => !statsFilters.stats_team_id || s.team_id === statsFilters.stats_team_id,
  );
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
      label: "Đã CS/Data",
      value: `${stats.range.cared_month} / ${stats.range.in_warehouse}`,
      tone: "text-brand-700",
    });
  }
  return (
    // Chữ "Tiến độ" + ô số liệu (nhỏ gọn, nhãn trên/số dưới) cùng 1 hàng bên trái;
    // bộ lọc Nhóm/NV/ngày + nút giao data dồn bên phải (2026-11-06).
    <Card className="mb-2 px-2.5 py-1.5">
      {/* Ô số liệu kéo cao bằng cụm bộ lọc + nút bên phải (items-stretch). */}
      <div className="flex flex-wrap items-stretch justify-between gap-2">
        <div className="flex flex-wrap items-stretch gap-2">
          <span className="flex items-center gap-1.5 self-center text-xs font-semibold text-slate-800">
            <Users className="h-3.5 w-3.5 text-brand-600" strokeWidth={2} />
            Tiến độ
          </span>
          {tiles.map((t) => (
            <div
              key={t.key}
              className="flex min-w-[110px] flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-center"
            >
              <p className="text-[11px] text-slate-500">{t.label}</p>
              <p className={cn("text-lg leading-tight font-bold tabular-nums", t.tone)}>{t.value}</p>
            </div>
          ))}
        </div>
        <div className="ml-auto flex flex-col items-end justify-center gap-1">
          <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
          {canPickTeam && (
            <Select
              uiSize="xs"
              className="w-40!"
              aria-label="Nhóm"
              value={statsFilters.stats_team_id}
              onChange={(e) => {
                const teamId = e.target.value;
                const keep = saleOptions.some(
                  (s) => s.id === statsFilters.stats_assignee_id && (!teamId || s.team_id === teamId),
                );
                onStatsFiltersChange({
                  stats_team_id: teamId,
                  stats_assignee_id: keep ? statsFilters.stats_assignee_id : "",
                });
              }}
            >
              <option value="">Tất cả nhóm</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
          {!isSale && (
            <Select
              uiSize="xs"
              className="w-44!"
              aria-label="Nhân viên"
              value={statsFilters.stats_assignee_id}
              onChange={(e) => onStatsFiltersChange({ stats_assignee_id: e.target.value })}
            >
              <option value="">Tất cả nhân viên</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {canPickTeam && !statsFilters.stats_team_id ? saleLabel(s) : s.name}
                </option>
              ))}
            </Select>
          )}
          <div className="w-40">
            <DateRangePicker
              value={statsFilters.stats_range}
              onChange={(stats_range) => onStatsFiltersChange({ stats_range })}
            />
          </div>
          </div>
          {actions}
        </div>
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
  // Loại data muốn giao theo số lần CS trong 30 ngày; rỗng = tất cả.
  const [careCounts, setCareCounts] = useState<Set<number>>(new Set());
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
            ...(careCounts.size ? { care_counts: [...careCounts] } : {}),
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
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">
              Loại data muốn giao (không chọn = tất cả)
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[
                [0, "Chưa CS trong 30 ngày"],
                [1, "CS 1 lần"],
                [2, "CS 2 lần"],
                [3, "CS 3 lần"],
                [4, "CS 4 lần trở lên"],
              ].map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={careCounts.has(v as number)}
                    onChange={() => {
                      const next = new Set(careCounts);
                      if (!next.delete(v as number)) next.add(v as number);
                      setCareCounts(next);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
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
          {data.items.map((batch) => (
            <div
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{formatDMYHM(batch.created_at)}</span>
                <Badge variant="info">{CARE_METHOD_LABEL[batch.method]}</Badge>
                <span className="text-slate-500">
                  bởi <NameWithRoleHint account={batch.created_by} />
                </span>
              </span>
              <span className="text-slate-600">
                {batch.lead_count} data → {batch.assignees.map((a) => a.name).join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
