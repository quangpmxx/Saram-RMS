"use client";

import { fetchNotesByLeadIds } from "@/lib/notes-batch";
import { formatDMY } from "@/lib/date-format";
import { LEAD_STATE_OPTIONS, type LeadStateFilter } from "@/lib/lead-state";
import { DaySeparatorRow } from "@/components/day-separator-row";
import { SortableTh, applySortParams, type SortState } from "@/components/ui/sortable-th";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Cake,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  StickyNote,
  Trash2,
  Upload,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiError, clientApi, clientApiUpload } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  canDecideStop,
  canDeleteLeads,
  canEditLead,
  canProcessLead,
  type LeadViewer,
} from "@/lib/lead-permissions";
import { zaloFriendStatusStyle } from "@/lib/zalo-friend-status";
import type {
  AccountRole,
  AssignBulkResult,
  Candidate,
  CreateCandidateResult,
  DuplicateWarning,
  ImportJobStatus,
  LeadRealtimeEvent,
  LeadSource,
  ModulePermissionLevel,
  Note,
  PaginatedResult,
  RemindTarget,
  StatusCatalogItem,
  Team,
  TeamMember,
} from "@/lib/types";
import { useLeadRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { Avatar } from "@/components/ui/avatar";
import { ViewOnlyBadge } from "@/components/ui/view-only-badge";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { EMPTY_DATE_RANGE, type DateRangeValue } from "@/lib/date-range";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { DuplicatePhone } from "./duplicate-phone";
import { ActionLink } from "./action-link";
import { LegacyImportModal } from "./legacy-import-modal";
import { shouldOpenRowDetail } from "./row-click";
import { SourceBadge } from "./source-badge";
import { CallStatusCellContent, callStatusCellStyle } from "./call-status-cell";
import { TeamSaleFilter, type TeamSaleValue } from "./team-sale-filter";
import { DistributionRuleModal } from "./distribution-rule-modal";
import { CareWarehousePanel, clearSavedCareState, type CareSaleOption } from "./care-warehouse-panel";

const PAGE_SIZE = 50;
/** Dự án phụ — nâng cấp toàn diện: cho chọn số dòng/trang, y hệt trang Đưa đón (yêu cầu trực tiếp người dùng). */
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300] as const;
/**
 * Yêu cầu trực tiếp người dùng: "xử lý xong 1 data, ấn Lưu hoặc Quay lại thì
 * quay lại ĐÚNG trang/vị trí cuộn lúc trước" — lưu tạm trạng thái danh sách
 * (trang, số dòng/trang, tab, bộ lọc, vị trí cuộn) vào sessionStorage NGAY
 * TRƯỚC khi điều hướng sang trang Chi tiết, khôi phục lại khi quay về trang
 * Ứng viên. Dùng sessionStorage (không phải localStorage) — chỉ tồn tại
 * trong phiên tab hiện tại, tự dọn khi đóng tab, không rò rỉ giữa các phiên
 * đăng nhập khác nhau trên cùng máy.
 */
const LIST_STATE_SESSION_KEY = "saram_rms_candidates_list_state";
/** Dự án phụ — nâng cấp toàn diện: mức thu phóng bảng, y hệt danh sách % của Google Sheet (yêu cầu trực tiếp người dùng). */
const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200] as const;
/** Mục 8, docs/09 + Mục 5, docs/13: ai được phân chia (cho người khác)/chuyển lead. */
const ASSIGNMENT_ROLES: AccountRole[] = ["admin", "manager", "leader"];
/**
 * Dự án phụ — nâng cấp toàn diện: bổ sung "sale" — Sale giờ cũng xem được
 * "Chờ phân chia" và tự nhận data qua nút "Nhận data" (xem handleClaim()),
 * khác ASSIGNMENT_ROLES (chỉ vai trò trên mới được phân chia CHO NGƯỜI KHÁC).
 */
const PENDING_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "mkt", "sale"];
/** Dự án phụ — nâng cấp toàn diện: tab "Cá nhân" (lead đang gán cho chính mình) — chỉ Sale. */
const MINE_VIEW_ROLES: AccountRole[] = ["sale"];

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; candidate: Candidate }
  | { mode: "import" }
  | { mode: "legacy-import" }
  | { mode: "assign"; candidateIds: string[] }
  | { mode: "transfer"; candidate: Candidate }
  | { mode: "remind"; candidate: Candidate };

type CandidateSortKey = "stt" | "date";
/** Mặc định khi vào: ngày giờ lên số giảm dần (yêu cầu người dùng 2026-10-30). */
const DEFAULT_CANDIDATE_SORT: SortState<CandidateSortKey> = { key: "date", order: "desc" };

/** "care" = Kho chăm sóc (2026-10-28). Cột chăm sóc cũ ("care_pool") đã gỡ hẳn (rà soát 2026-10-30). */
type ViewMode = "all" | "pending" | "mine" | "care";
/** Vai trò xem được tab Kho chăm sóc — MKT chỉ xem (toàn công ty), khớp backend. */
const CARE_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "sale", "mkt"];

interface Filters {
  keyword: string;
  source_id: string;
  /** Trạng thái data: "" = tất cả. Có thể thiếu ở trạng thái danh sách đã lưu từ bản cũ. */
  lead_state?: LeadStateFilter;
  team_sale: TeamSaleValue | null;
  /** Dự án phụ — nâng cấp toàn diện: bộ lọc ngày kiểu Google Analytics dùng chung (xem components/ui/date-range-picker.tsx). */
  date: DateRangeValue;
}

interface SavedListState {
  page: number;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  viewMode: ViewMode;
  filters: Filters;
  scrollTop: number;
  /** Cột đang sắp xếp (bấm tiêu đề STT/Ngày). Bản lưu cũ không có → mặc định. */
  sort?: SortState<CandidateSortKey>;
  /** Query string lúc lưu — quay lại đúng URL này (vd mở từ thông báo/Dashboard) vẫn khôi phục được. */
  search?: string;
}


function formatUploadedAt(value: string): { date: string; time: string } {
  const parsed = new Date(value);
  return {
    date: formatDMY(parsed),
    time: parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Dự án phụ — nâng cấp toàn diện: màu nền ô "Kết quả" — "Đã gửi CCCD" = xanh
 * lá full ô, để trống = không màu. Dùng style inline (không phải class
 * Tailwind) — ô này nằm trong bảng có thể lồng nhiều lớp nền/hover, style
 * inline luôn thắng chắc chắn (cùng lý do đã áp dụng cho màu nền ô ghi chú
 * — xem lib/note-colors.ts).
 */
/** Cột "Zalo": viết tắt "kết bạn" → "KB" cho gọn bằng cột "Kết quả" (yêu cầu người dùng 2026-10-29). */
function shortZaloFriendName(name: string): string {
  return name.replace(/kết bạn/i, "KB");
}

function zaloStatusStyle(name: string | undefined): { backgroundColor: string; color: string } | undefined {
  if (name === "Đã gửi CCCD") return { backgroundColor: "#15803d", color: "#ffffff" };
  return undefined;
}

export function CandidatesClient({
  permissionLevel,
  initialCandidates,
  initialTotal,
  sources,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
  initialTeamMembers,
  teams,
  allSaleMembers,
  zaloStatuses,
  zaloFriendStatuses,
  initialViewMode,
  initialFilters,
  initialCareAssigneeId,
}: {
  permissionLevel: ModulePermissionLevel;
  initialCandidates: Candidate[];
  initialTotal: number;
  sources: LeadSource[];
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserTeamId: string | null;
  initialTeamMembers: TeamMember[];
  teams: Team[];
  allSaleMembers: TeamMember[];
  zaloStatuses: StatusCatalogItem[];
  /** Cột "Zalo" (2026-10-29): trạng thái kết bạn Zalo — Chưa kết bạn / Đã kết bạn / Không có Zalo. */
  zaloFriendStatuses: StatusCatalogItem[];
  /**
   * Phase 7 — mở sẵn đúng danh sách đã lọc khi bấm vào 1 con số breakdown
   * từ Dashboard/Reports (Mục 1/8, docs/12). Không truyền (trang Ứng viên
   * vào bình thường) → giữ nguyên hành vi mặc định như trước.
   */
  initialViewMode?: ViewMode;
  initialFilters?: Filters;
  /** Kho chăm sóc — mở sẵn đã lọc theo 1 Sale (?view=care&care_assignee=...). */
  initialCareAssigneeId?: string;
}) {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? "all");
  const [filters, setFilters] = useState<Filters>(
    initialFilters ?? {
      keyword: "",
      source_id: "",
      team_sale: null,
      date: EMPTY_DATE_RANGE,
    },
  );
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(100);
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [notesByLeadId, setNotesByLeadId] = useState<Map<string, Note[]>>(new Map());
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  /** Người dùng đã tự bấm chọn tab — khôi phục trạng thái cũ (sessionStorage) không được đè lên. */
  const userPickedViewRef = useRef(false);
  /** Tìm kiếm khi gõ: hẹn giờ chờ ngừng gõ + số thứ tự lượt tải (bỏ kết quả của lượt cũ về muộn). */
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRequestSeqRef = useRef(0);
  // Bấm tiêu đề STT/Ngày để sắp xếp (yêu cầu người dùng 2026-10-30). Ref để
  // fetchPage đọc được ngay giá trị mới (state chưa kịp cập nhật).
  const [sort, setSort] = useState<SortState<CandidateSortKey>>(DEFAULT_CANDIDATE_SORT);
  const sortRef = useRef(sort);

  useSetPageTitle("Data lao động");
  // Dự án phụ — nâng cấp toàn diện (2026-07-24, "Phân quyền" phiên bản đơn
  // giản, Mục 2/6): "Chỉ xem" — khóa toàn bộ bảng bằng pointer-events (rất
  // nhiều điểm nhập trực tiếp/inline khắp bảng). Backend
  // (ModulePermissionGuard) là lớp chặn thật.
  const isReadOnly = permissionLevel === "view";

  const canAssign = ASSIGNMENT_ROLES.includes(currentUserRole);
  // Có quyền xoá data (Admin; MKT với data mình up) → cũng được tick chọn để "Xoá data đã chọn".
  // Quyền trên từng data dùng chung với trang chi tiết — lib/lead-permissions.ts.
  const viewer: LeadViewer = { id: currentUserId, role: currentUserRole, teamId: currentUserTeamId };
  const canDeleteAny = canDeleteLeads(currentUserRole);
  const canSelect = canAssign || canDeleteAny;
  const canViewPending = PENDING_VIEW_ROLES.includes(currentUserRole);
  const canViewMine = MINE_VIEW_ROLES.includes(currentUserRole);
  const canClaim = currentUserRole === "sale";
  const canViewCare = CARE_VIEW_ROLES.includes(currentUserRole);
  const [careTotal, setCareTotal] = useState<number | null>(null);
  // Leader: Sale nhóm mình (initialTeamMembers); Quản lý/Admin: mọi Sale.
  const careSaleOptions: CareSaleOption[] = (currentUserRole === "leader" ? teamMembers : allSaleMembers)
    .filter((m) => m.role === "sale" && m.status === "active")
    .map((m) => ({ id: m.id, name: m.full_name, team_id: m.team_id, team_name: m.team_name }));

  /**
   * UI Polish (bổ sung) — "Tình trạng cuộc gọi" cần hiện TOÀN BỘ lịch sử
   * chăm sóc (không chỉ ghi chú gần nhất như trước), nhưng GET /candidate
   * (danh sách) không trả về nội dung ghi chú (Mục 0.1, docs/13 — đối tượng
   * Candidate không có trường note). Tải ghi chú của CẢ TRANG bằng 1 request
   * GET /candidate/notes?ids=... (2026-10-28) — trước đây gọi
   * GET /candidate/:id/note cho từng dòng (~50 request, mất ~20 giây trên DB
   * dev chỉ 1 kết nối, kéo chậm cả tab Kho chăm sóc). Cùng phạm vi quyền xem.
   */
  useEffect(() => {
    // Tab Kho chăm sóc không hiển thị bảng này — không tải ghi chú.
    if (viewMode === "care" || candidates.length === 0) return;
    let cancelled = false;
    const controller = new AbortController();
    const ids = candidates.map((candidate) => candidate.id);

    fetchNotesByLeadIds(ids, controller.signal).then((byLead) => {
        if (cancelled) return;
        setNotesByLeadId(new Map(ids.map((id) => [id, (byLead[id] ?? []).filter((note) => !note.is_deleted)])));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [candidates, viewMode]);

  /** Khớp decideStopRequest() ở backend: Leader (nhóm của data)/Quản lý/Admin. */
  function canApproveStop(candidate: Candidate): boolean {
    if (isReadOnly || !candidate.care_stop_requested_at || candidate.care_stopped_at) return false;
    return canDecideStop(candidate, viewer);
  }

  /**
   * Tách riêng phần gọi API khỏi refresh() để tái dùng cho realtime (Mục 3,
   * yêu cầu người dùng — "refetch nhẹ trang hiện tại", KHÔNG được reset
   * selectedIds/gọi router.refresh() như refresh() gốc vốn làm cho các thao
   * tác chủ động của người dùng, vd chuyển trang/lọc).
   */
  async function fetchPage(
    targetPage: number,
    mode: ViewMode,
    targetPageSize: number,
    // Yêu cầu người dùng — khôi phục trạng thái danh sách khi quay lại từ
    // trang Chi tiết: cho phép truyền thẳng bộ lọc đã lưu thay vì đọc từ
    // closure `filters` (state chưa kịp cập nhật ngay sau setFilters()).
    activeFilters: Filters = filters,
  ): Promise<PaginatedResult<Candidate>> {
    const query = new URLSearchParams({ page: String(targetPage), page_size: String(targetPageSize) });
    if (activeFilters.source_id) query.set("source_id", activeFilters.source_id);
    applySortParams(query, sortRef.current);

    if (mode === "pending") {
      return clientApi<PaginatedResult<Candidate>>(`/candidate/pending?${query.toString()}`);
    }

    if (activeFilters.keyword) query.set("keyword", activeFilters.keyword);
    if (activeFilters.lead_state) query.set("lead_state", activeFilters.lead_state);
    if (activeFilters.team_sale?.type === "team") query.set("team_id", activeFilters.team_sale.id);
    if (activeFilters.team_sale?.type === "sale") query.set("assigned_to", activeFilters.team_sale.id);
    // DateRangePicker đã tự quy đổi preset ("7 ngày qua"...) thành from/to cụ
    // thể ngay lúc bấm "Cập nhật" — ở đây chỉ còn việc quy đổi sang mốc ISO
    // đầu/cuối ngày (giờ địa phương) như hành vi gốc, không cần phân biệt
    // preset/tùy chỉnh nữa.
    if (activeFilters.date.from) query.set("date_from", new Date(activeFilters.date.from).toISOString());
    if (activeFilters.date.to) query.set("date_to", new Date(`${activeFilters.date.to}T23:59:59.999`).toISOString());
    // Dự án phụ — nâng cấp toàn diện: tab "Cá nhân" (chỉ Sale) — thu hẹp
    // "Tất cả" (nay đã theo phạm vi cả nhóm) về đúng lead đang gán cho
    // chính mình, dùng lại đúng filter assigned_to=me backend đã hỗ trợ.
    if (mode === "mine") query.set("assigned_to", "me");
    return clientApi<PaginatedResult<Candidate>>(`/candidate?${query.toString()}`);
  }

  /** Yêu cầu người dùng — lưu tạm trạng thái danh sách NGAY TRƯỚC khi mở trang Chi tiết ứng viên, để khôi phục lại khi quay về. */
  function saveListStateForReturn() {
    try {
      const state: SavedListState = {
        page,
        pageSize,
        viewMode,
        filters,
        sort,
        scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
        search: window.location.search,
      };
      sessionStorage.setItem(`${LIST_STATE_SESSION_KEY}:${currentUserId}`, JSON.stringify(state));
      if (viewMode !== "care") clearSavedCareState(currentUserId);
    } catch {
      // sessionStorage không khả dụng (chế độ ẩn danh chặn...) — bỏ qua, không chặn điều hướng.
    }
  }

  /**
   * Khôi phục đúng trang/bộ lọc/tab/vị trí cuộn đã lưu — CHỈ khi vào trang
   * bằng đường mặc định, KHÔNG có query string lọc sẵn nào (vd bấm từ 1 con
   * số breakdown ở Dashboard/Báo cáo — Phase 7, docs/12) — trường hợp đó ưu
   * tiên đúng bộ lọc được yêu cầu hơn trạng thái cũ đã lưu. LƯU Ý: page.tsx
   * (server) LUÔN tính sẵn initialViewMode/initialFilters với giá trị mặc
   * định ("all"/rỗng) dù URL không có query string nào — không thể dùng 2
   * prop đó để phân biệt, phải tự kiểm tra thẳng URLSearchParams hiện tại.
   */
  useEffect(() => {
    const hasExplicitFilterParams = [
      "view",
      "source_id",
      "date_from",
      "date_to",
      "team_id",
      "assigned_to",
      "keyword",
      "lead_state",
    ].some((key) => searchParams.has(key));
    let raw: string | null = null;
    try {
      // Lưu riêng theo tài khoản — xem careStateKey() ở care-warehouse-panel.tsx.
      raw = sessionStorage.getItem(`${LIST_STATE_SESSION_KEY}:${currentUserId}`);
    } catch {
      return;
    }
    if (!raw) return;

    let saved: SavedListState;
    try {
      saved = JSON.parse(raw) as SavedListState;
    } catch {
      return;
    }
    // Có bộ lọc trên URL thì chỉ khôi phục khi quay lại ĐÚNG URL đã lưu
    // (Quay lại từ trang Chi tiết) — mở mới từ Dashboard/thông báo vẫn theo URL.
    if (hasExplicitFilterParams && saved.search !== window.location.search) return;

    void (async () => {
      // Kho chăm sóc tự tải dữ liệu riêng — chỉ cần mở lại đúng tab.
      if (saved.viewMode === "care") {
        setViewMode("care");
        return;
      }
      try {
        sortRef.current = saved.sort ?? DEFAULT_CANDIDATE_SORT;
        const result = await fetchPage(saved.page, saved.viewMode, saved.pageSize, saved.filters);
        // Người dùng đã tự chọn tab trong lúc chờ tải → KHÔNG đè lại bằng tab
        // cũ đã lưu (lỗi: bấm "Kho chăm sóc" xong bị bật về "Tất cả").
        if (userPickedViewRef.current) {
          sortRef.current = DEFAULT_CANDIDATE_SORT;
          return;
        }
        setCandidates(result.items);
        setTotal(result.total);
        setPage(saved.page);
        setPageSize(saved.pageSize);
        setViewMode(saved.viewMode);
        setFilters(saved.filters);
        setSort(sortRef.current);
        // Đợi 1 khung hình để bảng render đủ dữ liệu mới (đủ chiều cao để
        // cuộn tới đúng vị trí) rồi mới đặt lại scrollTop.
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo({ top: saved.scrollTop });
        });
      } catch {
        // Không khôi phục được (trang/bộ lọc đã lưu không còn hợp lệ...) — giữ nguyên dữ liệu SSR trang 1 mặc định.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSort(next: SortState<CandidateSortKey>) {
    sortRef.current = next;
    setSort(next);
    void refresh(1);
  }

  async function refresh(targetPage = page, mode: ViewMode = viewMode, targetPageSize = pageSize) {
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    const seq = ++listRequestSeqRef.current;
    const result = await fetchPage(targetPage, mode, targetPageSize);
    if (seq !== listRequestSeqRef.current) return;
    setCandidates(result.items);
    setTotal(result.total);
    setPage(targetPage);
    setPageSize(targetPageSize);
    setSelectedIds(new Set());
    router.refresh();
  }

  /**
   * Yêu cầu người dùng (Mục 3, 4, 6) — cập nhật nền, KHÔNG reset lựa chọn,
   * KHÔNG router.refresh() (tránh giật/nhấp nháy). Dùng cho: (a) record mới
   * khớp bộ lọc trang hiện tại xuất hiện qua realtime, (b) refetch 1 lần sau
   * khi kết nối lại (Mục 6). Lỗi mạng tạm thời thì bỏ qua lặng lẽ — dữ liệu
   * cũ vẫn hiển thị, sự kiện tiếp theo hoặc lần refetch sau sẽ tự sửa.
   */
  async function silentRefetchCurrentPage() {
    if (viewMode === "care") return;
    try {
      const result = await fetchPage(page, viewMode, pageSize);
      setCandidates(result.items);
      setTotal(result.total);
    } catch {
      // bỏ qua lỗi tải nền
    }
  }

  /**
   * Yêu cầu người dùng — đồng bộ realtime cho danh sách Data lao động (không
   * F5, không polling, không reload toàn trang). Chiến lược: nếu dòng đang
   * hiển thị trong trang hiện tại thì vá (patch) trực tiếp trong state hiện
   * có (giữ nguyên vị trí cuộn/trang/bộ lọc); nếu dòng không còn khớp điều
   * kiện của viewMode đang xem (vd bị người khác nhận ở tab "Chờ phân chia")
   * thì loại khỏi danh sách; nếu là dòng MỚI có thể khớp trang hiện tại
   * (tạo mới/mới vào kho chăm sóc) thì refetch nhẹ thay vì tự đoán vị trí
   * chèn (Mục 4 cho phép "thêm đúng vị trí HOẶC refetch nhẹ"). Với tab "Tất
   * cả": không lọc lại theo từ khóa/khoảng ngày phía client (đủ điều kiện
   * phòng Socket.IO đã đảm bảo đúng quyền xem — việc 1 dòng tạm thời không
   * khớp từ khóa tìm kiếm sau khi sửa là sai lệch nhỏ về UX, không phải lỗ
   * hổng phân quyền).
   */
  function handleRealtimeEvent(event: LeadRealtimeEvent) {
    // Tab Kho chăm sóc tự lắng nghe realtime riêng (CareWarehousePanel).
    if (viewMode === "care") return;
    if (event.note) {
      const note = event.note;
      setNotesByLeadId((prev) => {
        if (!prev.has(event.lead_id)) return prev;
        const next = new Map(prev);
        const list = next.get(event.lead_id) ?? [];
        if (event.change_type === "note_deleted") {
          next.set(event.lead_id, list.filter((n) => n.id !== note.id));
        } else {
          const existingIndex = list.findIndex((n) => n.id === note.id);
          next.set(
            event.lead_id,
            existingIndex === -1 ? [...list, note] : list.map((n, i) => (i === existingIndex ? note : n)),
          );
        }
        return next;
      });
    }

    const wasShown = candidates.some((c) => c.id === event.lead_id);

    if (event.change_type === "deleted") {
      if (!wasShown) return;
      setCandidates((prev) => prev.filter((c) => c.id !== event.lead_id));
      setTotal((t) => Math.max(0, t - 1));
      return;
    }

    if (!event.candidate) return;
    const updated = event.candidate;

    const stillEligible =
      viewMode === "pending"
        ? updated.assigned_to === null
        : viewMode === "mine"
          ? updated.assigned_to?.id === currentUserId
          : true;

    if (wasShown) {
      if (stillEligible) {
        setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        setCandidates((prev) => prev.filter((c) => c.id !== updated.id));
        setTotal((t) => Math.max(0, t - 1));
      }
      return;
    }

    if (event.change_type === "created") {
      void silentRefetchCurrentPage();
    }
  }

  useLeadRealtime(handleRealtimeEvent);
  useRealtimeReconnect(() => void silentRefetchCurrentPage());

  async function handlePageSizeChange(nextSize: (typeof PAGE_SIZE_OPTIONS)[number]) {
    await refresh(1, viewMode, nextSize);
  }

  async function refreshTeamMembers(teamId: string) {
    const members = await clientApi<TeamMember[]>(`/team/${teamId}/member`);
    setTeamMembers(members);
  }

  // ?view=care (bấm thông báo Kho chăm sóc) khi ĐANG ở trang này: URL đổi
  // nhưng component không mount lại → tự chuyển sang tab Kho.
  const urlView = searchParams.get("view");
  useEffect(() => {
    if (urlView !== "care" || !canViewCare) return;
    userPickedViewRef.current = true;
    queueMicrotask(() => setViewMode("care"));
  }, [urlView, canViewCare]);

  async function handleViewModeChange(mode: ViewMode) {
    userPickedViewRef.current = true;
    setViewMode(mode);
    // Kho chăm sóc tự tải dữ liệu riêng (CareWarehousePanel).
    if (mode === "care") return;
    await refresh(1, mode);
  }

  async function handleSearch() {
    await refresh(1);
  }

  /**
   * Gõ đến đâu lọc đến đó (yêu cầu người dùng 2026-10-29): chờ ngừng gõ
   * 350ms rồi tải lại trang 1; xoá hết chữ = về toàn bộ data. Tải nhẹ (không
   * router.refresh) vì chạy theo từng lần gõ.
   */
  function handleKeywordChange(keyword: string) {
    applyFiltersNow({ ...filters, keyword }, 350);
  }

  /**
   * Đổi bộ lọc là lọc luôn, không cần bấm Tìm kiếm (yêu cầu người dùng
   * 2026-10-30). Ô gõ chữ chờ ngừng gõ (delayMs); ô chọn thì lọc ngay.
   */
  function applyFiltersNow(nextFilters: Filters, delayMs = 0) {
    setFilters(nextFilters);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    keywordTimerRef.current = setTimeout(async () => {
      const seq = ++listRequestSeqRef.current;
      try {
        const result = await fetchPage(1, viewMode, pageSize, nextFilters);
        if (seq !== listRequestSeqRef.current) return;
        setCandidates(result.items);
        setTotal(result.total);
        setPage(1);
        setSelectedIds(new Set());
      } catch (error) {
        if (seq === listRequestSeqRef.current) {
          toast.error(error instanceof ApiError ? error.message : "Không tải được kết quả tìm kiếm");
        }
      }
    }, delayMs);
  }

  // Phân chia hàng loạt chỉ áp dụng data chưa có Sale phụ trách (backend assign-bulk cũng bỏ qua data đã chia).
  const selectedOnPage = candidates.filter((c) => selectedIds.has(c.id));
  const selectedUnassignedIds = selectedOnPage.filter((c) => !c.assigned_to).map((c) => c.id);
  const selectedAssignedCount = selectedOnPage.length - selectedUnassignedIds.length;
  const allOnPageSelected = candidates.length > 0 && candidates.every((c) => selectedIds.has(c.id));
  // "Xoá data đã chọn" chỉ gồm data mình có quyền xoá (backend kiểm lại từng data).
  const selectedDeletableIds = (canDeleteAny ? selectedOnPage : []).map((c) => c.id);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  /** Xoá (mềm) các data đã tick chọn — hỏi xác nhận trước (yêu cầu người dùng 2026-10-30). */
  async function handleBulkDelete() {
    const ids = selectedDeletableIds;
    if (ids.length === 0) return;
    const skippedNote =
      selectedIds.size > ids.length ? `
(${selectedIds.size - ids.length} data bạn không có quyền xoá sẽ được giữ nguyên.)` : "";
    if (!window.confirm(`Xoá ${ids.length} data đã chọn?${skippedNote}`)) return;
    setIsBulkDeleting(true);
    try {
      const result = await clientApi<{ deleted_count: number; skipped_count: number }>("/candidate/delete-bulk", {
        method: "POST",
        body: JSON.stringify({ candidate_ids: ids }),
      });
      await refresh();
      const text = `Đã xoá ${result.deleted_count} data${result.skipped_count ? `, bỏ qua ${result.skipped_count} data` : ""}`;
      if (result.skipped_count) toast.warning(text);
      else toast.success(text);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDelete(candidate: Candidate) {
    setPendingId(candidate.id);
    try {
      await clientApi(`/candidate/${candidate.id}`, { method: "DELETE" });
      await refresh();
      toast.success(`Đã xóa lao động "${candidate.full_name}"`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setPendingId(null);
    }
  }

  async function handleApproveStop(candidate: Candidate) {
    if (!window.confirm(`Duyệt đóng data "${candidate.full_name}"? Data sẽ dừng chăm sóc.`)) return;
    setPendingId(candidate.id);
    try {
      await clientApi(`/care-warehouse/${candidate.id}/stop-request/approve`, { method: "POST" });
      await refresh();
      toast.success("Đã duyệt — data đã đóng");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setPendingId(null);
    }
  }

  /** Dự án phụ — nâng cấp toàn diện: Sale tự nhận 1 lead đang "Chờ phân chia" cho chính mình. */
  async function handleClaim(candidate: Candidate) {
    setPendingId(candidate.id);
    try {
      await clientApi(`/candidate/${candidate.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ account_id: currentUserId }),
      });
      await refresh();
      toast.success(`Đã nhận lao động "${candidate.full_name}"`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setPendingId(null);
    }
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: sửa cột "Kết quả" ngay tại bảng danh
   * sách — chọn xong lưu ngay (không cần nút Lưu riêng), cập nhật trực tiếp
   * dòng đó trong bảng (không tải lại cả trang cho nhanh).
   */
  async function handleZaloStatusChange(candidate: Candidate, zaloStatusId: string | null) {
    try {
      const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/zalo-status`, {
        method: "PUT",
        body: JSON.stringify({ zalo_status_id: zaloStatusId }),
      });
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    }
  }

  /** Cột "Zalo" (yêu cầu người dùng 2026-10-29) — chọn xong lưu ngay, cập nhật đúng dòng đó. */
  async function handleZaloFriendStatusChange(candidate: Candidate, zaloFriendStatusId: string | null) {
    try {
      const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/zalo-friend-status`, {
        method: "PUT",
        body: JSON.stringify({ zalo_friend_status_id: zaloFriendStatusId }),
      });
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    }
  }

  return (
    <div className="w-full">
      {isReadOnly && (
        <div className="mb-2">
          <ViewOnlyBadge />
        </div>
      )}
      {/* UI Polish — tinh chỉnh mật độ hiển thị: thu nhỏ tiêu đề ~11% (text-lg → text-base), giảm mb-2 → mb-1 để sát bộ lọc hơn. */}
      <div className="mb-1 flex items-start justify-between gap-3 md:hidden">
        <div>
          <h1 className="text-base font-bold text-slate-900">Data lao động</h1>
        </div>
      </div>

      {currentUserRole === "leader" && teamMembers.length > 0 && (
        <Card className="mb-2 p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Users className="h-3.5 w-3.5 text-brand-600" strokeWidth={2} />
              Khối lượng công việc nhóm
            </div>
            {currentUserTeamId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsDistributionModalOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                Cấu hình phân chia tự động
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((member) => (
              <Badge key={member.id} variant="info">
                {member.full_name}: {member.assigned_count} lead
              </Badge>
            ))}
          </div>
        </Card>
      )}


      {/* Dự án phụ — nâng cấp toàn diện: gộp hàng tab (Tất cả/Chờ phân chia/Cá
          nhân) và 2 nút Nhập từ Excel/Thêm lao động mới vào chung 1 hàng
          (song song, 2 đầu trái-phải) để tiết kiệm chiều cao cho phần bảng data. */}
      {(canViewPending || canViewMine || currentUserRole === "mkt" || currentUserRole === "admin") && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {(canViewPending || canViewMine) && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => void handleViewModeChange("all")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  viewMode === "all" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Tất cả
              </button>
              {canViewPending && (
                <button
                  type="button"
                  onClick={() => void handleViewModeChange("pending")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "pending" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Chờ phân chia
                </button>
              )}
              {canViewMine && (
                <button
                  type="button"
                  onClick={() => void handleViewModeChange("mine")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "mine" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Cá nhân
                </button>
              )}
              {canViewCare && (
                <button
                  type="button"
                  onClick={() => void handleViewModeChange("care")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "care" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {careTotal === null ? "Chăm sóc" : `Chăm sóc (${careTotal})`}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {/* Yêu cầu trực tiếp người dùng (2026-07-15): bỏ "Trùng lặp"
                khỏi menu sidebar, thay bằng 1 nút ngay trong trang Data lao
                động — vẫn cùng route /duplicates, cùng phạm vi vai trò như
                mục nav cũ (mọi vai trò đều xem được). */}
            <Button type="button" size="sm" variant="outline" onClick={() => router.push("/duplicates")}>
              <Copy className="h-4 w-4" strokeWidth={2} />
              Trùng lặp
            </Button>
            {(currentUserRole === "mkt" || currentUserRole === "admin") && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isReadOnly}
                  onClick={() => setModal({ mode: "import" })}
                >
                  <Upload className="h-4 w-4" strokeWidth={2} />
                  Nhập từ Excel
                </Button>
                {currentUserRole === "admin" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isReadOnly}
                    onClick={() => setModal({ mode: "legacy-import" })}
                  >
                    <History className="h-4 w-4" strokeWidth={2} />
                    Tải data cũ
                  </Button>
                )}
              </>
            )}
            {/* Admin cấu hình Chia tự động cho mọi nhóm (rà soát phân quyền 2026-10-30). */}
            {currentUserRole === "admin" && teams.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReadOnly}
                onClick={() => setIsDistributionModalOpen(true)}
              >
                <Shuffle className="h-4 w-4" strokeWidth={2} />
                Chia tự động
              </Button>
            )}
            {/* Thêm data thủ công: MKT, Quản lý, Admin (rà soát phân quyền 2026-10-30). */}
            {(currentUserRole === "mkt" || currentUserRole === "manager" || currentUserRole === "admin") && (
              <Button type="button" size="sm" disabled={isReadOnly} onClick={() => setModal({ mode: "create" })}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Thêm lao động mới
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Kho chăm sóc luôn được gắn sẵn (ẩn khi ở tab khác): tự tải ngầm ngay
          khi mở trang và giữ nguyên dữ liệu/bộ lọc khi chuyển qua lại — bấm
          sang tab Kho là hiện ngay, không phải chờ tải. */}
      {canViewCare && (
        <div className={viewMode === "care" ? undefined : "hidden"}>
          <CareWarehousePanel
            active={viewMode === "care"}
            onWarehouseTotal={setCareTotal}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            isReadOnly={isReadOnly}
            teams={teams}
            saleOptions={careSaleOptions}
            initialAssigneeId={initialCareAssigneeId}
            onOpenLead={saveListStateForReturn}
          />
        </div>
      )}

      {viewMode !== "care" && (
      <>
      {/* UI Polish — tinh chỉnh mật độ hiển thị: giảm padding/khoảng cách khung bộ lọc (~15-20%), giữ nguyên chức năng. */}
      <Card className="mb-2 flex flex-wrap items-end gap-1.5 p-2">
        {(viewMode === "all" || viewMode === "mine") && (
          <Field uiSize="xs" label="Tìm kiếm" className="min-w-[200px] flex-1">
            <Input
              uiSize="xs"
              value={filters.keyword}
              onChange={(event) => handleKeywordChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
              placeholder="Tên, SĐT, ghi chú, năm sinh, địa chỉ"
            />
          </Field>
        )}
        <Field uiSize="xs" label="Thu phóng">
          <Select
            uiSize="xs"
            className="w-16"
            value={String(zoomLevel)}
            onChange={(event) => setZoomLevel(Number(event.target.value) as (typeof ZOOM_LEVELS)[number])}
          >
            {ZOOM_LEVELS.map((zoom) => (
              <option key={zoom} value={zoom}>
                {zoom}%
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Nguồn">
          <Select
            uiSize="xs"
            value={filters.source_id}
            onChange={(event) => applyFiltersNow({ ...filters, source_id: event.target.value })}
          >
            <option value="">Tất cả</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </Field>
        {(viewMode === "all" || viewMode === "mine") && (
          <>
            <Field uiSize="xs" label="Trạng thái" className="w-28">
              <Select
                uiSize="xs"
                value={filters.lead_state ?? ""}
                onChange={(event) =>
                  applyFiltersNow({ ...filters, lead_state: event.target.value as LeadStateFilter })
                }
              >
                <option value="">Tất cả</option>
                {LEAD_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field uiSize="xs" label="Ngày lên số" className="w-40">
              <DateRangePicker
                value={filters.date}
                onChange={(next) => applyFiltersNow({ ...filters, date: next })}
                placeholder="Tất cả"
                allowClear
              />
            </Field>
            {currentUserRole !== "sale" && currentUserRole !== "mkt" && (
              <Field uiSize="xs" label="Nhóm / Nhân viên" className="w-40">
                <TeamSaleFilter
                  teams={teams}
                  saleMembers={allSaleMembers}
                  value={filters.team_sale}
                  onChange={(value) => applyFiltersNow({ ...filters, team_sale: value })}
                />
              </Field>
            )}
          </>
        )}
        <Button type="button" size="xs" variant="secondary" onClick={() => void handleSearch()}>
          <Search className="h-3.5 w-3.5" strokeWidth={2} />
          Tìm kiếm
        </Button>
      </Card>

      {canSelect && selectedIds.size > 0 && (
        <Card className="mb-2 flex flex-wrap items-center justify-between gap-3 p-2.5">
          <span className="text-sm text-slate-600">
            Đã chọn {selectedIds.size} lao động
            {canAssign && selectedAssignedCount > 0 && (
              <span className="text-slate-400"> — {selectedAssignedCount} data đã có Sale phụ trách sẽ được bỏ qua khi phân chia</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              Bỏ chọn
            </Button>
            {canDeleteAny && (
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={isReadOnly || isBulkDeleting || selectedDeletableIds.length === 0}
                title={selectedDeletableIds.length === 0 ? "Bạn không có quyền xoá các data đã chọn" : undefined}
                onClick={() => void handleBulkDelete()}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                {isBulkDeleting ? "Đang xoá..." : `Xoá data đã chọn (${selectedDeletableIds.length})`}
              </Button>
            )}
            {canAssign && (
              <Button
                type="button"
                size="sm"
                disabled={isReadOnly || selectedUnassignedIds.length === 0}
                title={selectedUnassignedIds.length === 0 ? "Các data đã chọn đều đã có Sale phụ trách" : undefined}
                onClick={() => setModal({ mode: "assign", candidateIds: selectedUnassignedIds })}
              >
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                Phân chia đã chọn ({selectedUnassignedIds.length})
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div ref={scrollContainerRef} className="max-h-[calc(100vh-180px)] overflow-auto">
          {/* Dự án phụ — nâng cấp toàn diện: bọc riêng <table> trong 1 div có
              "zoom" (không phải transform: scale) — zoom tính lại layout thật
              theo tỉ lệ mới nên thu nhỏ hiện được nhiều dòng hơn, không để lại
              khoảng trắng thừa; không zoom khối cuộn ngoài để max-height tính
              bằng viewport (100vh-180px) không bị lệch theo tỉ lệ zoom. */}
          <div style={{ zoom: zoomLevel / 100 }}>
          {/* UI Polish — giảm cỡ chữ toàn bảng (text-sm → text-xs) theo yêu cầu. */}
          {/* UI Polish — nhường tối đa diện tích cho cột "Tình trạng cuộc gọi"
              (280px → 370px). Nguyên tắc cố định từ đây: mỗi khi thu hẹp các
              cột khác, phần dôi ra mặc định cộng vào cột này (trừ khi có yêu
              cầu khác). Các cột còn lại thu hẹp hết mức trong khi vẫn đảm bảo
              hiển thị đủ dữ liệu — width/min-width/max-width cố định bằng px
              trên từng <col> (table-fixed dùng đúng giá trị này, không phụ
              thuộc nội dung/data dài ngắn). */}
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <colgroup>
              {/* Ô tick + STT: rộng CỐ ĐỊNH vừa nội dung (yêu cầu người dùng 2026-10-30).
                  Các cột còn lại giữ đúng tỉ lệ cũ bằng %; cột "Tình trạng cuộc gọi" để
                  tự động nên nhận toàn bộ phần còn lại (trước đây mọi cột đều px nên
                  bảng phóng to đều tất cả, kể cả ô tick/STT). */}
              {canSelect && <col className="w-6" />}
              <col className="w-9" />
              <col className="w-[6%]" />
              <col className="w-[17%]" />
              <col className="w-[6%]" />
              <col className="w-[10%]" />
              {/* Tình trạng cuộc gọi — tự động (phần còn lại). */}
              <col />
              {/* Cột "Zalo" (2026-10-29) rộng bằng cột "Kết quả". */}
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[3.3%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-brand-50/95 text-[10px] font-semibold tracking-wider text-brand-900 uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur">
              <tr>
                {canSelect && (
                  <th className="border-r border-slate-100 px-0 py-2 text-center">
                    <Checkbox
                      aria-label="Chọn tất cả trên trang"
                      checked={allOnPageSelected}
                      onChange={(event) =>
                        setSelectedIds(event.target.checked ? new Set(candidates.map((c) => c.id)) : new Set())
                      }
                    />
                  </th>
                )}
                <SortableTh sortKey="stt" sort={sort} onSort={handleSort} className="border-r border-slate-100 px-0 py-2 text-center">
                  STT
                </SortableTh>
                <SortableTh sortKey="date" sort={sort} onSort={handleSort} className="border-r border-slate-100 px-0.5 py-2 text-center">
                  Ngày
                </SortableTh>
                <th className="border-r border-slate-100 px-1.5 py-2 text-center">Thông tin lao động</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Nguồn</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Nhân viên</th>
                <th className="border-r border-slate-100 px-4 py-2 text-center">Tình trạng cuộc gọi</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Zalo</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Kết quả</th>
                <th className="px-1 py-2 text-center">HĐ</th>
              </tr>
            </thead>
            <tbody
              className={cn(
                "divide-y divide-brand-400",
                // "Chỉ xem" vẫn phải xem được Chi tiết ứng viên (Mục 2: "Được
                // xem") — khóa pointer-events toàn <tbody> (input/nút/checkbox
                // inline rất nhiều, không disable riêng lẻ nổi) nhưng MỞ LẠI
                // riêng thẻ <a> (link "Xem chi tiết") bằng arbitrary variant.
                isReadOnly && "pointer-events-none opacity-60 [&_a]:pointer-events-auto",
              )}
            >
              {candidates.map((candidate, index) => {
                const uploadedAt = formatUploadedAt(candidate.uploaded_at);
                const teamName = candidate.assigned_team_id ? teamNameById.get(candidate.assigned_team_id) : undefined;
                const candidateNotes = notesByLeadId.get(candidate.id);
                // Sang ngày mới (theo cột Ngày) → dải xanh đậm ngăn cách.
                const isNewDay = index > 0 && formatUploadedAt(candidates[index - 1].uploaded_at).date !== uploadedAt.date;

                return (
                  <Fragment key={candidate.id}>
                  {isNewDay && <DaySeparatorRow colSpan={canSelect ? 10 : 9} />}
                  <tr
                    // UI Polish — h-28 (thay vì h-24): với tên/địa chỉ đã cố định 1 dòng ở
                    // trên, 96px hơi thiếu 1 chút khiến vài hàng vẫn bị đẩy cao hơn — 112px
                    // đủ chỗ cho đúng 4 dòng cố định (tên + SĐT + năm sinh + địa chỉ), mọi
                    // hàng cao bằng nhau tuyệt đối.
                    className={`h-28 cursor-pointer align-top transition-colors hover:bg-brand-50/50 ${index % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
                    onClick={(event) => {
                      // Bấm chỗ nào trên hàng cũng mở Chi tiết (yêu cầu người dùng 2026-10-29).
                      if (!shouldOpenRowDetail(event)) return;
                      saveListStateForReturn();
                      router.push(`/candidates/${candidate.id}`);
                    }}
                  >
                    {canSelect && (
                      // Bấm vào ô (kể cả khoảng trống quanh ô tick) không mở trang Chi tiết.
                      <td className="border-r border-slate-100 px-0 py-2 text-center" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          aria-label={`Chọn ${candidate.full_name}`}
                          checked={selectedIds.has(candidate.id)}
                          onChange={() => toggleSelected(candidate.id)}
                        />
                      </td>
                    )}
                    <td className="border-r border-slate-100 px-0 py-2 text-center text-[10px] text-slate-500 tabular-nums">
                      {sort.key === "stt" && sort.order === "desc"
                        ? total - ((page - 1) * pageSize + index)
                        : (page - 1) * pageSize + index + 1}
                    </td>

                    <td className="border-r border-slate-100 px-0.5 py-2 text-center whitespace-nowrap">
                      <p className="font-medium text-slate-800">{uploadedAt.date}</p>
                      <p className="text-[10px] text-slate-400">{uploadedAt.time}</p>
                    </td>

                    <td
                      className={cn("border-r border-slate-100 px-1.5 py-2", candidate.care_stopped_at && "relative")}
                    >
                      {/* Data đã đóng (dừng chăm sóc) → dấu X đỏ gạch chéo cả ô, nền giữ
                          trắng (yêu cầu người dùng 2026-10-29). Không chặn click vào ô. */}
                      {candidate.care_stopped_at && (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          className="pointer-events-none absolute inset-0 z-[1] h-full w-full text-red-500/70"
                        >
                          <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                          <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </svg>
                      )}
                      {/* UI Polish — tên cho phép xuống dòng tối đa 2 dòng rồi ellipsis
                          (line-clamp-2) thay vì cố định 1 dòng, theo yêu cầu tinh chỉnh độ
                          rộng cột — cột đã hẹp lại nên 1 dòng dễ cắt cụt tên quá sớm. Các
                          trường còn lại vẫn 1 dòng + ellipsis để không giãn cột. */}
                      {/* Trùng SĐT: bôi nền cam ngay trên số điện thoại (yêu cầu người dùng 2026-10-29, thay nhãn chéo "Trùng"). */}
                      <div>
                        {/* Tên căn giữa ô (yêu cầu người dùng 2026-10-29, giữ cỡ chữ 12px). */}
                        <div>
                          <Link
                            href={`/candidates/${candidate.id}`}
                            title={candidate.full_name}
                            onClick={saveListStateForReturn}
                            className={cn(
                              "line-clamp-2 text-center font-medium text-slate-800 hover:text-brand-700 hover:underline",
                              candidate.is_held && "bg-orange-200",
                            )}
                          >
                            {candidate.full_name}
                          </Link>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-slate-500">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                          {candidate.is_duplicate_flagged ? (
                            <DuplicatePhone candidateId={candidate.id} phoneNumber={candidate.phone_number} />
                          ) : (
                            <span className="truncate">{candidate.phone_number}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-slate-500">
                        <Cake className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                        {candidate.birth_year ?? "--"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                        <span className="truncate" title={candidate.address ?? undefined}>
                          {candidate.address ?? "--"}
                        </span>
                      </div>
                      {candidate.mkt_note && (
                        <div className="mt-0.5 flex items-center gap-1 text-red-600">
                          <StickyNote className="h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={2} />
                          <span className="truncate" title={candidate.mkt_note}>
                            {candidate.mkt_note}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-2 text-center">
                      <SourceBadge name={candidate.source.name} className="text-[10px] px-1.5 py-0" />
                    </td>

                    <td className="border-r border-slate-100 px-1 py-2">
                      {candidate.assigned_to ? (
                        // UI Polish — Avatar chuyển lên trên, tên/nhóm bên dưới. Cột đã hẹp
                        // thêm ~30% nên tên/nhóm đổi từ truncate (1 dòng) sang line-clamp-2
                        // (xuống dòng tối đa 2 dòng rồi ellipsis) để không cắt cụt quá sớm.
                        <div className="flex flex-col items-center gap-0.5 text-center">
                          <Avatar
                            fullName={candidate.assigned_to.name}
                            avatarUrl={candidate.assigned_to.avatar_url}
                            className="h-6 w-6 shrink-0 text-[10px]"
                          />
                          <div className="min-w-0 w-full leading-tight">
                            <p className="line-clamp-2 font-medium text-slate-800" title={candidate.assigned_to.name}>
                              <NameWithRoleHint account={candidate.assigned_to} />
                            </p>
                            {teamName && (
                              <p className="line-clamp-2 text-[10px] text-slate-400" title={teamName}>
                                {teamName}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge variant="neutral" className="text-[10px] px-2 py-0">
                            Chờ phân chia
                          </Badge>
                          {/* Yêu cầu trực tiếp người dùng (2026-07-16): MKT bắt buộc chọn nhóm
                              khi up data, nhưng Admin chưa thấy data "Chờ phân chia" thuộc
                              nhóm nào — bổ sung tên nhóm ngay dưới badge, khớp đúng cách hiện
                              teamName ở nhánh assigned_to bên trên. */}
                          {teamName && (
                            <p className="line-clamp-2 text-[10px] text-slate-400" title={teamName}>
                              {teamName}
                            </p>
                          )}
                          {canClaim && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={pendingId === candidate.id}
                              onClick={() => void handleClaim(candidate)}
                            >
                              <UserPlus className="h-3 w-3" strokeWidth={2} />
                              {pendingId === candidate.id ? "Đang nhận..." : "Nhận data"}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="border-r border-slate-100 px-3 py-1" style={callStatusCellStyle(candidate)}>
                      <CallStatusCellContent notes={candidateNotes} />
                    </td>

                    {/* Cột "Zalo" (yêu cầu người dùng 2026-10-29) — trạng thái kết bạn
                        Zalo, cùng kiểu khối như cột "Kết quả". Nhiều lựa chọn nên đặt
                        <select> trong suốt phủ lên khối chữ: vẫn mở danh sách chọn thật
                        mà chữ dài vẫn xuống dòng được. */}
                    <td className="border-r border-slate-100 px-1 py-2 text-center align-middle">
                      {(() => {
                        const status = candidate.zalo_friend_status;
                        const pillStyle = status ? zaloFriendStatusStyle(status.name) : undefined;
                        const pillClass = cn(
                          "mx-auto flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-center text-[10px] leading-tight font-semibold break-words whitespace-normal",
                          status ? "ring-1 ring-inset ring-black/10" : "border border-slate-200 text-slate-600",
                        );
                        if (!canProcessLead(candidate, viewer)) {
                          return (
                            <span style={pillStyle} className={pillClass}>
                              {status ? shortZaloFriendName(status.name) : "--"}
                            </span>
                          );
                        }
                        return (
                          <div className="relative">
                            <div style={pillStyle} className={pillClass}>
                              <span>{status ? shortZaloFriendName(status.name) : "--"}</span>
                              <ChevronDown className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2.5} />
                            </div>
                            <select
                              aria-label={`Trạng thái Zalo của ${candidate.full_name}`}
                              value={status?.id ?? ""}
                              onChange={(event) => void handleZaloFriendStatusChange(candidate, event.target.value || null)}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            >
                              <option value="">Chưa cập nhật</option>
                              {zaloFriendStatuses.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {shortZaloFriendName(s.name)}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-2 text-center align-middle">
                      {/* Kho chăm sóc: Sale đã đề nghị dừng chăm sóc, đang chờ duyệt → nhãn
                          vàng nhỏ. Data đã đóng chỉ còn dấu X đỏ ở ô Thông tin lao động
                          (bỏ nút đỏ "ĐÃ ĐÓNG" ở cột này — yêu cầu người dùng 2026-10-29). */}
                      {!candidate.care_stopped_at && candidate.care_stop_requested_at ? (
                        <span
                          title={`Chờ duyệt dừng chăm sóc${candidate.care_stop_requested_by ? ` — đề nghị bởi ${candidate.care_stop_requested_by.name}` : ""}`}
                          className="mx-auto mb-1 block w-full rounded-md bg-amber-100 px-0.5 py-0.5 text-center text-[9px] leading-tight font-semibold text-amber-800 ring-1 ring-amber-300"
                        >
                          Chờ duyệt đóng
                        </span>
                      ) : null}
                      {canProcessLead(candidate, viewer) ? (
                        // Chỉ 1 lựa chọn thật ("Đã gửi CCCD") nên bấm = đảo trạng thái
                        // (có/không) thay vì mở danh sách chọn — mũi tên chỉ là gợi ý
                        // hình ảnh giống ô chọn, không phải dropdown thật (select gốc
                        // của trình duyệt không xuống dòng được khi chữ dài).
                        <button
                          type="button"
                          onClick={() =>
                            void handleZaloStatusChange(
                              candidate,
                              candidate.zalo_status ? null : (zaloStatuses[0]?.id ?? null),
                            )
                          }
                          style={zaloStatusStyle(candidate.zalo_status?.name)}
                          className={cn(
                            "mx-auto flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-center text-[10px] leading-tight font-semibold break-words whitespace-normal",
                            candidate.zalo_status ? "text-inherit" : "border border-slate-200 text-slate-600",
                          )}
                        >
                          <span>{candidate.zalo_status?.name ?? "--"}</span>
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2.5} />
                        </button>
                      ) : (
                        <span
                          style={zaloStatusStyle(candidate.zalo_status?.name)}
                          className={cn(
                            "mx-auto block w-fit max-w-full rounded-lg px-1.5 py-1 text-center text-[10px] font-semibold break-words whitespace-normal",
                            candidate.zalo_status ? "text-inherit" : "border border-slate-200 text-slate-600",
                          )}
                        >
                          {candidate.zalo_status?.name ?? "--"}
                        </span>
                      )}
                    </td>

                    <td className="px-1 py-2">
                      <div className="flex flex-wrap items-center gap-0.5">
                        {canEditLead(candidate, viewer) && (
                          <ActionLink
                            icon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Sửa"
                            onClick={() => setModal({ mode: "edit", candidate })}
                          />
                        )}
                        {canAssign && !candidate.assigned_to && (
                          <ActionLink
                            icon={<UserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Phân chia"
                            onClick={() => setModal({ mode: "assign", candidateIds: [candidate.id] })}
                          />
                        )}
                        {canAssign && candidate.assigned_to && !candidate.is_held && (
                          <ActionLink
                            icon={<ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Chuyển"
                            onClick={() => setModal({ mode: "transfer", candidate })}
                          />
                        )}
                        {canAssign && candidate.assigned_team_id && (
                          <ActionLink
                            icon={<PhoneCall className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Nhắc gọi lại"
                            onClick={() => setModal({ mode: "remind", candidate })}
                          />
                        )}
                        {canApproveStop(candidate) && (
                          <ActionLink
                            icon={<CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Duyệt đóng (Sale đề nghị dừng chăm sóc)"
                            className="bg-brand-50 text-brand-700 ring-1 ring-brand-600/20"
                            disabled={pendingId === candidate.id}
                            onClick={() => void handleApproveStop(candidate)}
                          >
                            Duyệt đóng
                          </ActionLink>
                        )}
                        {canDeleteAny && (
                          <ActionLink
                            icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Xóa"
                            tone="danger"
                            disabled={pendingId === candidate.id}
                            onClick={() => void handleDelete(candidate)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        {candidates.length === 0 && (
          <EmptyState
            title={viewMode === "pending" ? "Không có lao động nào đang chờ phân chia" : "Chưa có lao động nào khớp bộ lọc"}
            icon={<Search className="h-5 w-5" strokeWidth={1.75} />}
          />
        )}
      </Card>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>
          Trang {page} — hiển thị {candidates.length} / {total} lao động
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs whitespace-nowrap">Số dòng/trang</span>
            <Select
              uiSize="xs"
              className="w-16"
              value={String(pageSize)}
              onChange={(event) => void handlePageSizeChange(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => void refresh(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => void refresh(page + 1)}
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>
      </>
      )}

      {modal.mode === "create" && (
        <CandidateFormModal
          title="Thêm lao động mới"
          sources={sources}
          teams={teams}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            const result = await clientApi<CreateCandidateResult>("/candidate", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            setModal({ mode: "none" });
            await refresh();
            const created = buildCreateBanner(result);
            if (created.type === "success") toast.success(created.text);
            else toast.warning(created.text);
          }}
        />
      )}

      {modal.mode === "edit" && (
        <CandidateFormModal
          title={`Sửa lao động "${modal.candidate.full_name}"`}
          sources={sources}
          teams={teams}
          initialCandidate={modal.candidate}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi(`/candidate/${modal.candidate.id}`, { method: "PUT", body: JSON.stringify(payload) });
            setModal({ mode: "none" });
            await refresh();
            toast.success("Đã cập nhật lao động");
          }}
        />
      )}

      {modal.mode === "legacy-import" && (
        <LegacyImportModal
          teams={teams}
          onClose={() => setModal({ mode: "none" })}
          onFinished={async (result) => {
            await refresh();
            toast.success(`Đã tải ${result.created} data cũ vào ${result.team}`);
          }}
        />
      )}

      {modal.mode === "import" && (
        <ImportModal
          onClose={() => setModal({ mode: "none" })}
          onFinished={async (summary) => {
            await refresh();
            const text = `Import xong: ${summary.success_count} thành công, ${summary.error_count} lỗi, ${summary.duplicate_count} trùng SĐT.`;
            if (summary.error_count > 0) toast.warning(text);
            else toast.success(text);
          }}
        />
      )}

      {modal.mode === "assign" && (
        <AssignModal
          candidateIds={modal.candidateIds}
          currentUserRole={currentUserRole}
          ownTeamMembers={teamMembers}
          onClose={() => setModal({ mode: "none" })}
          onAssigned={async (count) => {
            setModal({ mode: "none" });
            await refresh();
            if (currentUserTeamId) await refreshTeamMembers(currentUserTeamId);
            toast.success(`Đã phân chia ${count} lao động`);
          }}
        />
      )}

      {modal.mode === "transfer" && (
        <TransferModal
          candidate={modal.candidate}
          onClose={() => setModal({ mode: "none" })}
          onTransferred={async () => {
            setModal({ mode: "none" });
            await refresh();
            if (currentUserTeamId) await refreshTeamMembers(currentUserTeamId);
            toast.success("Đã chuyển lao động sang Sale khác");
          }}
        />
      )}

      {modal.mode === "remind" && (
        <RemindModal
          candidate={modal.candidate}
          onClose={() => setModal({ mode: "none" })}
          onSent={(fullName) => {
            setModal({ mode: "none" });
            toast.success(`Đã nhắc "${fullName}" xử lý cuộc gọi cho lao động này`);
          }}
        />
      )}

      {isDistributionModalOpen && currentUserRole === "admin" && teams.length > 0 && (
        <DistributionRuleModal
          teamId={teams[0].id}
          teams={teams}
          onClose={() => setIsDistributionModalOpen(false)}
          onChanged={() => toast.success("Đã cập nhật cấu hình tự động phân chia")}
        />
      )}
      {isDistributionModalOpen && currentUserRole !== "admin" && currentUserTeamId && (
        <DistributionRuleModal
          teamId={currentUserTeamId}
          teamMembers={teamMembers}
          onClose={() => setIsDistributionModalOpen(false)}
          onChanged={() => toast.success("Đã cập nhật cấu hình tự động phân chia")}
        />
      )}
    </div>
  );
}

function buildCreateBanner(result: CreateCandidateResult): { type: "warning" | "success"; text: string } {
  if (!result.duplicate_warning) {
    return { type: "success", text: "Đã thêm lao động mới" };
  }
  const warning: DuplicateWarning = result.duplicate_warning;
  const details = warning.matches
    .map((match) => `- ${formatDMY(match.uploaded_at)} bởi ${match.uploaded_by}`)
    .join("\n");
  return {
    type: "warning",
    text: `Đã thêm lao động mới, nhưng SĐT ${warning.phone_number} đã trùng với:\n${details}`,
  };
}

interface CandidateFormPayload {
  full_name: string;
  phone_number: string;
  source_id: string;
  mkt_note?: string;
  team_id?: string;
  birth_year?: number;
  address?: string;
}

/**
 * Dự án phụ — nâng cấp toàn diện: SỬA nghiệp vụ theo yêu cầu trực tiếp
 * người dùng — form "Thêm lao động mới" chỉ còn 4 trường (Tên, SĐT, Nhóm,
 * Ghi chú MKT) + Nguồn giữ nguyên như cũ; bỏ Năm sinh/Địa chỉ (MKT không
 * biết, để Sale tự khai thác — vẫn sửa được sau qua trang Chi tiết lao
 * động). Bắt buộc chọn Nhóm ngay khi up — data thuộc đúng 1 nhóm, chỉ
 * Leader/Sale nhóm đó thấy được (chờ Leader phân số hoặc Sale tự nhận).
 * Form "Sửa" (edit) giữ nguyên như cũ — không đổi Năm sinh/Địa chỉ, không
 * có Nhóm (đổi nhóm không thuộc phạm vi form này).
 */
function CandidateFormModal({
  title,
  sources,
  teams,
  initialCandidate,
  onClose,
  onSubmit,
}: {
  title: string;
  sources: LeadSource[];
  teams: Team[];
  initialCandidate?: Candidate;
  onClose: () => void;
  onSubmit: (payload: CandidateFormPayload) => Promise<void>;
}) {
  const isEditing = Boolean(initialCandidate);
  const [fullName, setFullName] = useState(initialCandidate?.full_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialCandidate?.phone_number ?? "");
  const [sourceId, setSourceId] = useState(initialCandidate?.source.id ?? sources[0]?.id ?? "");
  const [teamId, setTeamId] = useState("");
  const [birthYear, setBirthYear] = useState(initialCandidate?.birth_year?.toString() ?? "");
  const [address, setAddress] = useState(initialCandidate?.address ?? "");
  const [mktNote, setMktNote] = useState(initialCandidate?.mkt_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!isEditing && !teamId) {
      setError("Vui lòng chọn nhóm");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName,
        phone_number: phoneNumber,
        source_id: sourceId,
        mkt_note: mktNote || undefined,
        ...(isEditing
          ? { birth_year: birthYear ? Number(birthYear) : undefined, address: address || undefined }
          : { team_id: teamId }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
        <Field label="Tên lao động">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>

        <Field label="Số điện thoại">
          <Input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
        </Field>

        <Field label="Nguồn">
          <Select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </Field>

        {isEditing ? (
          <>
            <Field label="Năm sinh (không bắt buộc)">
              <Input value={birthYear} onChange={(event) => setBirthYear(event.target.value)} inputMode="numeric" />
            </Field>

            <Field label="Địa chỉ (không bắt buộc)">
              <Input value={address} onChange={(event) => setAddress(event.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Nhóm">
            <Select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">-- Chọn nhóm --</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Ghi chú MKT (không bắt buộc)">
          <Textarea value={mktNote} onChange={(event) => setMktNote(event.target.value)} rows={2} />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ImportModal({
  onClose,
  onFinished,
}: {
  onClose: () => void;
  onFinished: (summary: ImportJobStatus) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function pollJob(jobId: string) {
    // File lớn có thể chạy vài phút ở nền: chờ ~9 phút (1 giây/lần trong phút đầu,
    // sau đó 3 giây/lần). Trước đây bỏ cuộc im lặng sau 60 giây, người dùng tưởng
    // chưa xong rồi import lại → trùng data.
    for (let attempt = 0; attempt < 220; attempt += 1) {
      const status = await clientApi<ImportJobStatus>(`/candidate/import/${jobId}`);
      setJob(status);
      if (status.status === "completed" || status.status === "failed") {
        await onFinished(status);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt < 60 ? 1000 : 3000));
    }
    setError(
      "Import đang chạy lâu hơn dự kiến. Hệ thống vẫn tiếp tục nhập ở nền — vui lòng KHÔNG import lại file này, đợi ít phút rồi tải lại trang để xem kết quả.",
    );
  }

  async function handleSubmit() {
    if (!file) {
      setError("Vui lòng chọn file Excel (.xlsx)");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { job_id } = await clientApiUpload<{ job_id: string }>("/candidate/import", formData);
      await pollJob(job_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra khi import");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDone = job?.status === "completed" || job?.status === "failed";

  return (
    <Modal
      title="Nhập lao động từ Excel"
      description="File .xlsx, cột theo thứ tự: Tên lao động, Số điện thoại, Nguồn, Năm sinh, Địa chỉ, Ghi chú. 3 cột đầu bắt buộc."
      maxWidth="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {isDone ? "Đóng" : "Hủy"}
          </Button>
          {!job && (
            <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
              <UploadCloud className="h-4 w-4" strokeWidth={2} />
              {isSubmitting ? "Đang tải lên..." : "Bắt đầu import"}
            </Button>
          )}
        </>
      }
    >
      {!job && (
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
            <UploadCloud className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
            <span className="text-sm font-medium text-slate-600">
              {file ? file.name : "Chọn file Excel (.xlsx) hoặc kéo thả vào đây"}
            </span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      {job && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-800">
            Trạng thái: {job.status === "completed" ? "Hoàn tất" : job.status === "failed" ? "Lỗi" : "Đang xử lý..."}
          </p>
          {isDone && (
            <>
              <p className="mt-3 text-slate-600">Tổng số dòng: {job.total_rows}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="success">Thành công: {job.success_count}</Badge>
                <Badge variant="danger">Lỗi: {job.error_count}</Badge>
                <Badge variant="warning">Trùng SĐT: {job.duplicate_count}</Badge>
              </div>
              {job.errors.length > 0 && (
                <ul className="mt-3 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-slate-500">
                  {job.errors.map((rowError) => (
                    <li key={rowError.row}>
                      {rowError.row > 0 ? `Dòng ${rowError.row}: ` : ""}
                      {rowError.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {!isDone &&
            (error ? (
              <p role="alert" className="mt-2 text-red-600">
                {error}
              </p>
            ) : (
              <p className="mt-2 text-slate-500">Đang xử lý trong nền, vui lòng đợi...</p>
            ))}
        </div>
      )}
    </Modal>
  );
}

/**
 * Mục 5, docs/13: POST /candidate/:id/assign + /candidate/assign-bulk.
 * Leader: chọn thẳng Sale trong nhóm mình (ownTeamMembers có sẵn từ props).
 * Quản lý/Admin: không giới hạn nhóm — phải chọn Nhóm trước để tải đúng
 * danh sách Sale của nhóm đó qua GET /team/:id/member.
 */
function AssignModal({
  candidateIds,
  currentUserRole,
  ownTeamMembers,
  onClose,
  onAssigned,
}: {
  candidateIds: string[];
  currentUserRole: AccountRole;
  ownTeamMembers: TeamMember[];
  onClose: () => void;
  onAssigned: (count: number) => Promise<void>;
}) {
  const needsTeamPicker = currentUserRole !== "leader";
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [members, setMembers] = useState<TeamMember[]>(ownTeamMembers);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadTeams() {
    setIsLoadingTeams(true);
    try {
      const result = await clientApi<PaginatedResult<Team>>("/team?page=1&page_size=100");
      setTeams(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được danh sách nhóm");
    } finally {
      setIsLoadingTeams(false);
    }
  }

  async function handleTeamChange(teamId: string) {
    setSelectedTeamId(teamId);
    setAccountId("");
    setMembers([]);
    if (!teamId) return;
    setIsLoadingMembers(true);
    try {
      const result = await clientApi<TeamMember[]>(`/team/${teamId}/member`);
      setMembers(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được danh sách Sale");
    } finally {
      setIsLoadingMembers(false);
    }
  }

  async function handleSubmit() {
    if (!accountId) {
      setError("Vui lòng chọn Sale nhận lao động");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (candidateIds.length === 1) {
        await clientApi(`/candidate/${candidateIds[0]}/assign`, {
          method: "POST",
          body: JSON.stringify({ account_id: accountId }),
        });
        await onAssigned(1);
      } else {
        const result = await clientApi<AssignBulkResult>("/candidate/assign-bulk", {
          method: "POST",
          body: JSON.stringify({ candidate_ids: candidateIds, account_id: accountId }),
        });
        await onAssigned(result.assigned_count);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={candidateIds.length > 1 ? `Phân chia ${candidateIds.length} lao động` : "Phân chia lao động"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting || !accountId} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Phân chia"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {needsTeamPicker && (
          <Field label="Nhóm">
            <Select
              value={selectedTeamId}
              onFocus={() => !teams && void loadTeams()}
              onChange={(event) => void handleTeamChange(event.target.value)}
            >
              <option value="">{isLoadingTeams ? "Đang tải..." : "— Chọn nhóm —"}</option>
              {teams?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Sale nhận lao động" hint={isLoadingMembers ? "Đang tải danh sách Sale..." : undefined}>
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">— Chọn Sale —</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name} ({member.assigned_count} lead đang phụ trách)
              </option>
            ))}
          </Select>
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Mục 5, docs/13: POST /candidate/:id/transfer — Sale đích bắt buộc thuộc
 * đúng nhóm đang sở hữu lead (candidate.assigned_team_id), nên tải thẳng
 * danh sách Sale của nhóm đó, không cần chọn nhóm.
 */
function TransferModal({
  candidate,
  onClose,
  onTransferred,
}: {
  candidate: Candidate;
  onClose: () => void;
  onTransferred: () => Promise<void>;
}) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(candidate.assigned_team_id));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!candidate.assigned_team_id) {
      return;
    }
    clientApi<TeamMember[]>(`/team/${candidate.assigned_team_id}/member`)
      .then((result) => setMembers(result.filter((member) => member.id !== candidate.assigned_to?.id)))
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Không tải được danh sách Sale"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.assigned_team_id]);

  const missingTeamError = candidate.assigned_team_id ? null : "Lao động chưa thuộc nhóm nào";

  async function handleSubmit() {
    if (!accountId) {
      setError("Vui lòng chọn Sale nhận lao động");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/candidate/${candidate.id}/transfer`, {
        method: "POST",
        body: JSON.stringify({ new_account_id: accountId, reason: reason || undefined }),
      });
      await onTransferred();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Chuyển lao động "${candidate.full_name}"`}
      description={`Đang thuộc: ${candidate.assigned_to?.name ?? "—"}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting || !accountId} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Chuyển"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Chuyển sang Sale" hint={isLoading ? "Đang tải danh sách Sale..." : undefined}>
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">— Chọn Sale —</option>
            {members?.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name} ({member.assigned_count} lead đang phụ trách)
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Lý do (không bắt buộc)">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
        </Field>

        {(error || loadError || missingTeamError) && (
          <p role="alert" className="text-sm text-red-600">
            {error ?? loadError ?? missingTeamError}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "nút Nhắc gọi lại ở cột HĐ —
 * Leader/Admin/Quản lý ấn vào hiện danh sách nhân viên TRONG NHÓM đang phụ
 * trách data đó (kể cả Leader), chọn 1 người để nhắc xử lý — người được
 * chọn nhận thông báo nổi + chuông + âm thanh." Tái dùng đúng NotificationBell
 * đã có sẵn (GET /candidate/:id/remind-target liệt kê người có thể nhắc,
 * POST /candidate/:id/remind gửi thông báo).
 */
function RemindModal({
  candidate,
  onClose,
  onSent,
}: {
  candidate: Candidate;
  onClose: () => void;
  onSent: (fullName: string) => void;
}) {
  const [targets, setTargets] = useState<RemindTarget[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    clientApi<RemindTarget[]>(`/candidate/${candidate.id}/remind-target`)
      .then((result) => setTargets(result))
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Không tải được danh sách thành viên nhóm"))
      .finally(() => setIsLoading(false));
  }, [candidate.id]);

  async function handleSubmit() {
    if (!accountId) {
      setError("Vui lòng chọn thành viên cần nhắc");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/candidate/${candidate.id}/remind`, {
        method: "POST",
        body: JSON.stringify({ account_id: accountId }),
      });
      const target = targets?.find((t) => t.id === accountId);
      onSent(target?.full_name ?? "thành viên");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Nhắc gọi lại — "${candidate.full_name}"`}
      description={`SĐT: ${candidate.phone_number}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting || !accountId} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang gửi..." : "Gửi nhắc nhở"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nhắc thành viên" hint={isLoading ? "Đang tải danh sách thành viên..." : undefined}>
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">— Chọn thành viên —</option>
            {targets?.map((target) => (
              <option key={target.id} value={target.id}>
                {target.full_name} ({ACCOUNT_ROLE_LABEL[target.role]})
              </option>
            ))}
          </Select>
        </Field>

        {!isLoading && targets?.length === 0 && (
          <p className="text-sm text-slate-500">Nhóm này chưa có thành viên nào khác để nhắc.</p>
        )}

        {(error || loadError) && (
          <p role="alert" className="text-sm text-red-600">
            {error ?? loadError}
          </p>
        )}
      </div>
    </Modal>
  );
}
