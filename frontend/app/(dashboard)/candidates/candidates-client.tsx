"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Cake,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
  Upload,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiError, clientApi, clientApiUpload } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { callStatusVariant } from "@/lib/call-status-variant";
import { noteColorBgHex } from "@/lib/note-colors";
import { zaloFriendStatusStyle } from "@/lib/zalo-friend-status";
import type {
  AccountRole,
  AssignBulkResult,
  Candidate,
  CreateCandidateResult,
  DuplicateWarning,
  ImportJobStatus,
  LeadSource,
  Note,
  PaginatedResult,
  StatusCatalogItem,
  Team,
  TeamMember,
} from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
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
import { DuplicateDetailBadge } from "./duplicate-detail-badge";
import { ActionLink } from "./action-link";
import { SourceBadge } from "./source-badge";
import { CareNoteCell } from "./care-note-cell";
import { TeamSaleFilter, type TeamSaleValue } from "./team-sale-filter";
import { CarePoolTable } from "./care-pool-table";
import { DistributionRuleModal } from "./distribution-rule-modal";

const PAGE_SIZE = 50;
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
  | { mode: "assign"; candidateIds: string[] }
  | { mode: "transfer"; candidate: Candidate };

type ViewMode = "all" | "pending" | "care_pool" | "mine";

interface Filters {
  keyword: string;
  source_id: string;
  team_sale: TeamSaleValue | null;
  /** Dự án phụ — nâng cấp toàn diện: bộ lọc ngày kiểu Google Analytics dùng chung (xem components/ui/date-range-picker.tsx). */
  date: DateRangeValue;
}

function callResultVariant(name: string): "success" | "warning" | "neutral" {
  if (name.includes("Không tiềm năng")) return "neutral";
  if (name.includes("Tiềm năng")) return "success";
  return "warning";
}

function formatUploadedAt(value: string): { date: string; time: string } {
  const parsed = new Date(value);
  return {
    date: parsed.toLocaleDateString("vi-VN"),
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
function zaloStatusStyle(name: string | undefined): { backgroundColor: string; color: string } | undefined {
  if (name === "Đã gửi CCCD") return { backgroundColor: "#15803d", color: "#ffffff" };
  return undefined;
}

export function CandidatesClient({
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
  initialViewMode,
  initialFilters,
}: {
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
  /**
   * Phase 7 — mở sẵn đúng danh sách đã lọc khi bấm vào 1 con số breakdown
   * từ Dashboard/Reports (Mục 1/8, docs/12). Không truyền (trang Ứng viên
   * vào bình thường) → giữ nguyên hành vi mặc định như trước.
   */
  initialViewMode?: ViewMode;
  initialFilters?: Filters;
}) {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
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

  useSetPageTitle("Data lao động", "Thu thập, tìm kiếm và quản lý dữ liệu lao động.");

  const canAssign = ASSIGNMENT_ROLES.includes(currentUserRole);
  const canViewPending = PENDING_VIEW_ROLES.includes(currentUserRole);
  const canViewMine = MINE_VIEW_ROLES.includes(currentUserRole);
  const canClaim = currentUserRole === "sale";

  /**
   * UI Polish (bổ sung) — "Tình trạng cuộc gọi" cần hiện TOÀN BỘ lịch sử
   * chăm sóc (không chỉ ghi chú gần nhất như trước), nhưng GET /candidate
   * (danh sách) không trả về nội dung ghi chú (Mục 0.1, docs/13 — đối tượng
   * Candidate không có trường note). Tái dùng đúng API đã có
   * GET /candidate/:id/note cho từng dòng đang hiển thị, không thêm API mới.
   */
  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      candidates.map(async (candidate) => {
        try {
          const notes = await clientApi<Note[]>(`/candidate/${candidate.id}/note`);
          const visible = notes.filter((note) => !note.is_deleted);
          return [candidate.id, visible] as const;
        } catch {
          return [candidate.id, [] as Note[]] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        setNotesByLeadId(new Map(entries));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [candidates]);

  function canModify(candidate: Candidate): boolean {
    if (currentUserRole === "admin" || currentUserRole === "manager") return true;
    if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
    if (currentUserRole === "leader") return candidate.assigned_team_id === currentUserTeamId;
    // Dự án phụ — nâng cấp toàn diện: Sale sửa được ứng viên KHÔNG phải của
    // mình nếu cùng nhóm, NHƯNG chỉ khi ứng viên đã được xử lý ít nhất 1 lần
    // (last_activity_at khác null) — khớp assertCanModify()/loadLeadForUpdate()
    // ở backend, tránh giành số hoàn toàn mới của đồng nghiệp.
    if (currentUserRole === "sale") {
      if (candidate.assigned_to?.id === currentUserId) return true;
      return candidate.assigned_team_id === currentUserTeamId && candidate.last_activity_at !== null;
    }
    return false;
  }

  function canDelete(candidate: Candidate): boolean {
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
    return false;
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: cho sửa cột "Kết quả" (đổi ý từ "Tình
   * trạng Zalo" — vẫn dùng chung field zalo_status kỹ thuật cũ, chỉ đổi tên
   * hiển thị + giá trị) ngay tại bảng danh sách, không cần vào trang Chi
   * tiết. Khớp ĐÚNG phạm vi quyền của canUpdatePipeline() ở trang Chi tiết /
   * loadLeadForUpdate() ở backend — KHÔNG gồm MKT (cùng nhóm field "tiến
   * trình cuộc gọi", không phải field cơ bản MKT được sửa qua canModify()).
   */
  function canUpdateZaloStatus(candidate: Candidate): boolean {
    if (currentUserRole === "admin" || currentUserRole === "manager") return true;
    if (currentUserRole === "leader") return candidate.assigned_team_id === currentUserTeamId;
    if (currentUserRole === "sale") {
      if (candidate.assigned_to?.id === currentUserId) return true;
      return candidate.assigned_team_id === currentUserTeamId && candidate.last_activity_at !== null;
    }
    return false;
  }

  async function refresh(targetPage = page, mode: ViewMode = viewMode) {
    const query = new URLSearchParams({ page: String(targetPage), page_size: String(PAGE_SIZE) });
    if (filters.source_id) query.set("source_id", filters.source_id);

    let result: PaginatedResult<Candidate>;
    if (mode === "pending") {
      result = await clientApi<PaginatedResult<Candidate>>(`/candidate/pending?${query.toString()}`);
    } else if (mode === "care_pool") {
      // Mục 5, docs/13: GET /care-pool không nhận cùng bộ filter với /candidate
      // (chỉ page/page_size/team_id) — dùng query riêng, không lẫn filters hiện tại.
      const carePoolQuery = new URLSearchParams({ page: String(targetPage), page_size: String(PAGE_SIZE) });
      result = await clientApi<PaginatedResult<Candidate>>(`/care-pool?${carePoolQuery.toString()}`);
    } else {
      if (filters.keyword) query.set("keyword", filters.keyword);
      if (filters.team_sale?.type === "team") query.set("team_id", filters.team_sale.id);
      if (filters.team_sale?.type === "sale") query.set("assigned_to", filters.team_sale.id);
      // DateRangePicker đã tự quy đổi preset ("7 ngày qua"...) thành from/to cụ
      // thể ngay lúc bấm "Cập nhật" — ở đây chỉ còn việc quy đổi sang mốc ISO
      // đầu/cuối ngày (giờ địa phương) như hành vi gốc, không cần phân biệt
      // preset/tùy chỉnh nữa.
      if (filters.date.from) query.set("date_from", new Date(filters.date.from).toISOString());
      if (filters.date.to) query.set("date_to", new Date(`${filters.date.to}T23:59:59.999`).toISOString());
      // Dự án phụ — nâng cấp toàn diện: tab "Cá nhân" (chỉ Sale) — thu hẹp
      // "Tất cả" (nay đã theo phạm vi cả nhóm) về đúng lead đang gán cho
      // chính mình, dùng lại đúng filter assigned_to=me backend đã hỗ trợ.
      if (mode === "mine") query.set("assigned_to", "me");
      result = await clientApi<PaginatedResult<Candidate>>(`/candidate?${query.toString()}`);
    }

    setCandidates(result.items);
    setTotal(result.total);
    setPage(targetPage);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function refreshTeamMembers(teamId: string) {
    const members = await clientApi<TeamMember[]>(`/team/${teamId}/member`);
    setTeamMembers(members);
  }

  async function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    await refresh(1, mode);
  }

  async function handleSearch() {
    await refresh(1);
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
    if (!window.confirm(`Xóa lao động "${candidate.full_name}"? Hành động này không thể hoàn tác trên giao diện.`)) {
      return;
    }
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

  return (
    <div className="w-full">
      {/* UI Polish — tinh chỉnh mật độ hiển thị: thu nhỏ tiêu đề ~11% (text-lg → text-base), giảm mb-2 → mb-1 để sát bộ lọc hơn. */}
      <div className="mb-1 flex items-start justify-between gap-3 md:hidden">
        <div>
          <h1 className="text-base font-bold text-slate-900">Data lao động</h1>
          <p className="mt-0.5 text-xs text-slate-500">Thu thập, tìm kiếm và quản lý dữ liệu lao động.</p>
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
            </div>
          )}

          {(currentUserRole === "mkt" || currentUserRole === "admin") && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setModal({ mode: "import" })}>
                <Upload className="h-4 w-4" strokeWidth={2} />
                Nhập từ Excel
              </Button>
              <Button type="button" size="sm" onClick={() => setModal({ mode: "create" })}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Thêm lao động mới
              </Button>
            </div>
          )}
        </div>
      )}

      {viewMode !== "care_pool" && (
      // UI Polish — tinh chỉnh mật độ hiển thị: giảm padding/khoảng cách khung bộ lọc (~15-20%), giữ nguyên chức năng.
      <Card className="mb-2 flex flex-wrap items-end gap-1.5 p-2">
        {(viewMode === "all" || viewMode === "mine") && (
          <Field uiSize="xs" label="Tìm theo tên, SĐT hoặc ghi chú" className="min-w-[200px] flex-1">
            <Input
              uiSize="xs"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
              placeholder="Tên, SĐT hoặc nội dung ghi chú chăm sóc"
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
            onChange={(event) => setFilters((prev) => ({ ...prev, source_id: event.target.value }))}
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
            <Field uiSize="xs" label="Ngày lên số" className="w-40">
              <DateRangePicker
                value={filters.date}
                onChange={(next) => setFilters((prev) => ({ ...prev, date: next }))}
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
                  onChange={(value) => setFilters((prev) => ({ ...prev, team_sale: value }))}
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
      )}

      {viewMode === "pending" && canAssign && selectedIds.size > 0 && (
        <Card className="mb-2 flex items-center justify-between gap-3 p-2.5">
          <span className="text-sm text-slate-600">Đã chọn {selectedIds.size} lao động</span>
          <Button type="button" size="sm" onClick={() => setModal({ mode: "assign", candidateIds: [...selectedIds] })}>
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Phân chia đã chọn
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {viewMode === "care_pool" ? (
          <CarePoolTable
            candidates={candidates}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            teamNameById={teamNameById}
            onChanged={() => refresh(page, "care_pool")}
            onBanner={(b) => (b.type === "success" ? toast.success(b.text) : toast.error(b.text))}
          />
        ) : (
        <div className="max-h-[calc(100vh-180px)] overflow-auto">
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
              {viewMode === "pending" && canAssign && <col className="w-10 min-w-10 max-w-10" />}
              <col className="w-[38px] min-w-[38px] max-w-[38px]" />
              <col className="w-[108px] min-w-[108px] max-w-[108px]" />
              <col className="w-[38px] min-w-[38px] max-w-[38px]" />
              <col className="w-[64px] min-w-[64px] max-w-[64px]" />
              <col className="w-[353px] min-w-[353px] max-w-[353px]" />
              <col className="w-[38px] min-w-[38px] max-w-[38px]" />
              <col className="w-[21px] min-w-[21px] max-w-[21px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-brand-50/95 text-[10px] font-semibold tracking-wider text-brand-900 uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur">
              <tr>
                {viewMode === "pending" && canAssign && <th className="border-r border-slate-100 px-4 py-2" />}
                <th className="border-r border-slate-100 px-0.5 py-2 text-center">Ngày</th>
                <th className="border-r border-slate-100 px-1.5 py-2 text-center">Thông tin lao động</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Nguồn</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Nhân viên</th>
                <th className="border-r border-slate-100 px-4 py-2 text-center">Tình trạng cuộc gọi</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center">Kết quả</th>
                <th className="px-1 py-2 text-center">HĐ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-400">
              {candidates.map((candidate, index) => {
                const uploadedAt = formatUploadedAt(candidate.uploaded_at);
                const teamName = candidate.assigned_team_id ? teamNameById.get(candidate.assigned_team_id) : undefined;
                const candidateNotes = notesByLeadId.get(candidate.id);

                return (
                  <tr
                    key={candidate.id}
                    // UI Polish — h-28 (thay vì h-24): với tên/địa chỉ đã cố định 1 dòng ở
                    // trên, 96px hơi thiếu 1 chút khiến vài hàng vẫn bị đẩy cao hơn — 112px
                    // đủ chỗ cho đúng 4 dòng cố định (tên + SĐT + năm sinh + địa chỉ), mọi
                    // hàng cao bằng nhau tuyệt đối.
                    className={`h-28 align-top transition-colors hover:bg-brand-50/50 ${index % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
                  >
                    {viewMode === "pending" && canAssign && (
                      <td className="border-r border-slate-100 px-4 py-2">
                        <Checkbox checked={selectedIds.has(candidate.id)} onChange={() => toggleSelected(candidate.id)} />
                      </td>
                    )}

                    <td className="border-r border-slate-100 px-0.5 py-2 text-center whitespace-nowrap">
                      <p className="font-medium text-slate-800">{uploadedAt.date}</p>
                      <p className="text-[10px] text-slate-400">{uploadedAt.time}</p>
                    </td>

                    <td
                      className="cursor-pointer border-r border-slate-100 px-1.5 py-2"
                      onClick={(event) => {
                        // UI Polish — cả ô mở được chi tiết ứng viên, không chỉ riêng tên
                        // nữa. Bỏ qua nếu click trúng chính link tên hoặc nhãn "Trùng SĐT"
                        // (role="button") — 2 phần tử đó tự xử lý click riêng, tránh điều
                        // hướng 2 lần chồng lên nhau.
                        const target = event.target as HTMLElement;
                        if (target.closest("a, [role='button']")) return;
                        router.push(`/candidates/${candidate.id}`);
                      }}
                    >
                      {/* UI Polish — tên cho phép xuống dòng tối đa 2 dòng rồi ellipsis
                          (line-clamp-2) thay vì cố định 1 dòng, theo yêu cầu tinh chỉnh độ
                          rộng cột — cột đã hẹp lại nên 1 dòng dễ cắt cụt tên quá sớm. Các
                          trường còn lại vẫn 1 dòng + ellipsis để không giãn cột. */}
                      {/* UI Polish — nhãn "Trùng SĐT" đổi từ badge viên thuốc cạnh tên sang
                          nhãn nhỏ chéo ở góc phải trên cùng của cụm tên + SĐT (thay vì chiếm
                          chỗ ngang bên cạnh tên) — cần bọc relative đúng vùng này. */}
                      <div className="relative">
                        <div className={cn(candidate.is_duplicate_flagged && "pr-4")}>
                          <Link
                            href={`/candidates/${candidate.id}`}
                            title={candidate.full_name}
                            className={cn(
                              "line-clamp-2 font-medium text-slate-800 hover:text-brand-700 hover:underline",
                              candidate.is_held && "bg-orange-200",
                            )}
                          >
                            {candidate.full_name}
                          </Link>
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 flex items-center gap-1 text-slate-500",
                            candidate.is_duplicate_flagged && "pr-4",
                          )}
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                          <span className="truncate">{candidate.phone_number}</span>
                        </div>
                        {candidate.is_duplicate_flagged && <DuplicateDetailBadge candidateId={candidate.id} />}
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
                          <Avatar fullName={candidate.assigned_to.name} className="h-6 w-6 shrink-0 text-[10px]" />
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

                    <td
                      className="border-r border-slate-100 px-4 py-2"
                      style={{ backgroundColor: noteColorBgHex(candidate.note_color) }}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {candidate.call_status ? (
                          <Badge variant={callStatusVariant(candidate.call_status.name)} className="text-[10px] px-2 py-0">
                            {candidate.call_status.name}
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px] px-2 py-0">
                            Chưa gọi
                          </Badge>
                        )}
                        {candidate.call_result && (
                          <Badge variant={callResultVariant(candidate.call_result.name)} className="text-[10px] px-2 py-0">
                            {candidate.call_result.name}
                          </Badge>
                        )}
                        {candidate.zalo_friend_status && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0 text-[10px] font-medium whitespace-nowrap ring-1 ring-inset ring-black/10"
                            style={zaloFriendStatusStyle(candidate.zalo_friend_status.name)}
                          >
                            {candidate.zalo_friend_status.name}
                          </span>
                        )}
                      </div>
                      <CareNoteCell notes={candidateNotes} />
                    </td>

                    <td className="border-r border-slate-100 px-1 py-2 text-center align-middle">
                      {canUpdateZaloStatus(candidate) ? (
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
                        {canModify(candidate) && (
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
                        {canAssign && candidate.assigned_to && (
                          <ActionLink
                            icon={<ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />}
                            title="Chuyển"
                            onClick={() => setModal({ mode: "transfer", candidate })}
                          />
                        )}
                        {canDelete(candidate) && (
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
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        )}
        {viewMode !== "care_pool" && candidates.length === 0 && (
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
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => void refresh(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => void refresh(page + 1)}
          >
            Sau
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>

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

      {isDistributionModalOpen && currentUserTeamId && (
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
    .map((match) => `- ${new Date(match.uploaded_at).toLocaleDateString("vi-VN")} bởi ${match.uploaded_by}`)
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
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await clientApi<ImportJobStatus>(`/candidate/import/${jobId}`);
      setJob(status);
      if (status.status === "completed" || status.status === "failed") {
        await onFinished(status);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
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
                      Dòng {rowError.row}: {rowError.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {!isDone && <p className="mt-2 text-slate-500">Đang xử lý trong nền, vui lòng đợi...</p>}
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
