"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Cake,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiError, clientApi, clientApiUpload } from "@/lib/api-client";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useSetPageTitle } from "@/lib/page-title-context";
import { DuplicateDetailBadge } from "./duplicate-detail-badge";
import { ActionLink } from "./action-link";
import { SourceBadge } from "./source-badge";
import { CareNoteCell } from "./care-note-cell";
import { TeamSaleFilter, type TeamSaleValue } from "./team-sale-filter";
import { CarePoolTable } from "./care-pool-table";

const PAGE_SIZE = 50;
/** Mục 8, docs/09 + Mục 5, docs/13: ai được phân chia/chuyển lead. */
const ASSIGNMENT_ROLES: AccountRole[] = ["admin", "manager", "leader"];
/** Mục 5, tài liệu 10 (S3): ai được xem "Chờ phân chia". */
const PENDING_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "mkt"];
/** Mục 5, docs/13: GET /care-pool — ai được xem "Cột chăm sóc" (MKT không có quyền). */
const CARE_POOL_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "sale"];

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; candidate: Candidate }
  | { mode: "import" }
  | { mode: "assign"; candidateIds: string[] }
  | { mode: "transfer"; candidate: Candidate };

type ViewMode = "all" | "pending" | "care_pool";

type DatePreset = "" | "today" | "yesterday" | "7d" | "30d" | "custom";

interface Filters {
  keyword: string;
  source_id: string;
  team_sale: TeamSaleValue | null;
  interview_status_id: string;
  employment_status_id: string;
  date_preset: DatePreset;
  date_from: string;
  date_to: string;
}

const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: "", label: "Tất cả" },
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "7d", label: "7 ngày gần đây" },
  { value: "30d", label: "30 ngày gần đây" },
  { value: "custom", label: "Tùy chọn..." },
];

/** UI Polish — quy đổi preset khoảng ngày "Ngày lên số" sang mốc giờ chính xác đầu/cuối ngày (giờ địa phương). */
function computeDatePresetRange(preset: DatePreset): { date_from: string; date_to: string } | null {
  if (!preset || preset === "custom") return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  if (preset === "today") {
    return { date_from: startOfToday.toISOString(), date_to: endOfToday.toISOString() };
  }
  if (preset === "yesterday") {
    const start = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const end = new Date(startOfToday.getTime() - 1);
    return { date_from: start.toISOString(), date_to: end.toISOString() };
  }
  const daysBack = preset === "7d" ? 6 : 29;
  const start = new Date(startOfToday.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { date_from: start.toISOString(), date_to: endOfToday.toISOString() };
}

/** UI Polish — màu badge trạng thái PV/đi làm dựa theo tên đã chốt (Mục 7, docs/09), thuần hiển thị. */
function interviewStatusVariant(name: string): "success" | "danger" | "info" {
  if (name.includes("Đỗ")) return "success";
  if (name.includes("Bùng") || name.includes("Trượt")) return "danger";
  return "info";
}

function employmentStatusVariant(name: string): "success" | "danger" {
  return name.includes("Không") ? "danger" : "success";
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

export function CandidatesClient({
  initialCandidates,
  initialTotal,
  sources,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
  initialTeamMembers,
  interviewStatuses,
  employmentStatuses,
  teams,
  allSaleMembers,
}: {
  initialCandidates: Candidate[];
  initialTotal: number;
  sources: LeadSource[];
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserTeamId: string | null;
  initialTeamMembers: TeamMember[];
  interviewStatuses: StatusCatalogItem[];
  employmentStatuses: StatusCatalogItem[];
  teams: Team[];
  allSaleMembers: TeamMember[];
}) {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [filters, setFilters] = useState<Filters>({
    keyword: "",
    source_id: "",
    team_sale: null,
    interview_status_id: "",
    employment_status_id: "",
    date_preset: "",
    date_from: "",
    date_to: "",
  });
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [banner, setBanner] = useState<{ type: "error" | "success" | "warning"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [notesByLeadId, setNotesByLeadId] = useState<Map<string, Note[]>>(new Map());

  useSetPageTitle("Ứng viên", "Thu thập, tìm kiếm và quản lý dữ liệu ứng viên.");

  const canAssign = ASSIGNMENT_ROLES.includes(currentUserRole);
  const canViewPending = PENDING_VIEW_ROLES.includes(currentUserRole);
  const canViewCarePool = CARE_POOL_VIEW_ROLES.includes(currentUserRole);

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
    if (currentUserRole === "sale") return candidate.assigned_to?.id === currentUserId;
    return false;
  }

  function canDelete(candidate: Candidate): boolean {
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
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
      if (filters.interview_status_id) query.set("interview_status_id", filters.interview_status_id);
      if (filters.employment_status_id) query.set("employment_status_id", filters.employment_status_id);
      if (filters.date_preset === "custom") {
        if (filters.date_from) query.set("date_from", new Date(filters.date_from).toISOString());
        if (filters.date_to) query.set("date_to", new Date(`${filters.date_to}T23:59:59.999`).toISOString());
      } else {
        const range = computeDatePresetRange(filters.date_preset);
        if (range) {
          query.set("date_from", range.date_from);
          query.set("date_to", range.date_to);
        }
      }
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
    if (!window.confirm(`Xóa ứng viên "${candidate.full_name}"? Hành động này không thể hoàn tác trên giao diện.`)) {
      return;
    }
    setPendingId(candidate.id);
    setBanner(null);
    try {
      await clientApi(`/candidate/${candidate.id}`, { method: "DELETE" });
      await refresh();
      setBanner({ type: "success", text: `Đã xóa ứng viên "${candidate.full_name}"` });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-start justify-between gap-3 md:hidden">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Ứng viên</h1>
          <p className="mt-0.5 text-xs text-slate-500">Thu thập, tìm kiếm và quản lý dữ liệu ứng viên.</p>
        </div>
      </div>

      {currentUserRole === "mkt" && (
        <div className="mb-2 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setModal({ mode: "import" })}>
            <Upload className="h-4 w-4" strokeWidth={2} />
            Nhập từ Excel
          </Button>
          <Button type="button" size="sm" onClick={() => setModal({ mode: "create" })}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Thêm ứng viên mới
          </Button>
        </div>
      )}

      {currentUserRole === "leader" && teamMembers.length > 0 && (
        <Card className="mb-2 p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Users className="h-3.5 w-3.5 text-brand-600" strokeWidth={2} />
            Khối lượng công việc nhóm
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

      {banner && <Banner type={banner.type} text={banner.text} />}

      {(canViewPending || canViewCarePool) && (
        <div className="mb-2 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
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
          {canViewCarePool && (
            <button
              type="button"
              onClick={() => void handleViewModeChange("care_pool")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === "care_pool" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Cột chăm sóc
            </button>
          )}
        </div>
      )}

      {viewMode !== "care_pool" && (
      <Card className="mb-2 flex flex-wrap items-end gap-2 p-2.5">
        {viewMode === "all" && (
          <Field uiSize="sm" label="Tìm theo tên, SĐT hoặc ghi chú" className="min-w-[200px] flex-1">
            <Input
              uiSize="sm"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
              placeholder="Tên, SĐT hoặc nội dung ghi chú chăm sóc"
            />
          </Field>
        )}
        <Field uiSize="sm" label="Nguồn">
          <Select
            uiSize="sm"
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
        {viewMode === "all" && (
          <>
            <Field uiSize="sm" label="Trạng thái PV">
              <Select
                uiSize="sm"
                value={filters.interview_status_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, interview_status_id: event.target.value }))}
              >
                <option value="">Tất cả</option>
                {interviewStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field uiSize="sm" label="Trạng thái đi làm">
              <Select
                uiSize="sm"
                value={filters.employment_status_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, employment_status_id: event.target.value }))}
              >
                <option value="">Tất cả</option>
                {employmentStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field uiSize="sm" label="Ngày lên số">
              <Select
                uiSize="sm"
                value={filters.date_preset}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, date_preset: event.target.value as DatePreset }))
                }
              >
                {DATE_PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            {filters.date_preset === "custom" && (
              <>
                <Field uiSize="sm" label="Từ ngày">
                  <Input
                    uiSize="sm"
                    type="date"
                    value={filters.date_from}
                    onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
                  />
                </Field>
                <Field uiSize="sm" label="Đến ngày">
                  <Input
                    uiSize="sm"
                    type="date"
                    value={filters.date_to}
                    onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
                  />
                </Field>
              </>
            )}
            {currentUserRole !== "sale" && currentUserRole !== "mkt" && (
              <Field uiSize="sm" label="Nhóm / Nhân viên" className="w-40">
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
        <Button type="button" size="sm" variant="secondary" onClick={() => void handleSearch()}>
          <Search className="h-4 w-4" strokeWidth={2} />
          Tìm kiếm
        </Button>
      </Card>
      )}

      {viewMode === "pending" && canAssign && selectedIds.size > 0 && (
        <Card className="mb-2 flex items-center justify-between gap-3 p-2.5">
          <span className="text-sm text-slate-600">Đã chọn {selectedIds.size} ứng viên</span>
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
            onBanner={setBanner}
          />
        ) : (
        <div className="max-h-[calc(100vh-180px)] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              {viewMode === "pending" && canAssign && <col className="w-10" />}
              <col className="w-[96px]" />
              <col className="w-[210px]" />
              <col className="w-[112px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-[140px]" />
              <col className="w-[132px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-brand-50/95 text-[11px] font-semibold tracking-wider text-brand-900 uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur">
              <tr>
                {viewMode === "pending" && canAssign && <th className="border-r border-slate-100 px-4 py-3" />}
                <th className="border-r border-slate-100 px-2 py-3 text-center">Ngày lên số</th>
                <th className="border-r border-slate-100 px-4 py-3">Data lao động</th>
                <th className="border-r border-slate-100 px-3 py-3">Nguồn</th>
                <th className="border-r border-slate-100 px-3 py-3">Nhân viên</th>
                <th className="border-r border-slate-100 px-4 py-3">Tình trạng cuộc gọi</th>
                <th className="border-r border-slate-100 px-3 py-3">Kết quả</th>
                <th className="px-2 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((candidate, index) => {
                const uploadedAt = formatUploadedAt(candidate.uploaded_at);
                const teamName = candidate.assigned_team_id ? teamNameById.get(candidate.assigned_team_id) : undefined;
                const candidateNotes = notesByLeadId.get(candidate.id);

                return (
                  <tr
                    key={candidate.id}
                    className={`align-top transition-colors hover:bg-brand-50/50 ${index % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
                  >
                    {viewMode === "pending" && canAssign && (
                      <td className="border-r border-slate-100 px-4 py-3">
                        <Checkbox checked={selectedIds.has(candidate.id)} onChange={() => toggleSelected(candidate.id)} />
                      </td>
                    )}

                    <td className="border-r border-slate-100 px-2 py-3 text-center whitespace-nowrap">
                      <p className="font-medium text-slate-800">{uploadedAt.date}</p>
                      <p className="text-xs text-slate-400">{uploadedAt.time}</p>
                    </td>

                    <td className="border-r border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {candidate.full_name}
                        </Link>
                        {candidate.is_duplicate_flagged && <DuplicateDetailBadge candidateId={candidate.id} />}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                        {candidate.phone_number}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                        <Cake className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                        {candidate.birth_year ?? "--"}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                        <span className="break-words whitespace-normal">{candidate.address ?? "--"}</span>
                      </div>
                    </td>

                    <td className="border-r border-slate-100 px-3 py-3">
                      <SourceBadge name={candidate.source.name} />
                    </td>

                    <td className="border-r border-slate-100 px-3 py-3">
                      {candidate.assigned_to ? (
                        <div className="flex items-start gap-1.5">
                          <Avatar fullName={candidate.assigned_to.name} className="h-7 w-7 shrink-0 text-[11px]" />
                          <div className="min-w-0 leading-tight">
                            <p className="font-medium break-words text-slate-800">{candidate.assigned_to.name}</p>
                            {teamName && <p className="text-xs break-words text-slate-400">{teamName}</p>}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="neutral">Chờ phân chia</Badge>
                      )}
                    </td>

                    <td className="border-r border-slate-100 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {candidate.call_status ? (
                          <Badge variant="info">{candidate.call_status.name}</Badge>
                        ) : (
                          <Badge variant="neutral">Chưa gọi</Badge>
                        )}
                        {candidate.call_result && (
                          <Badge variant={callResultVariant(candidate.call_result.name)}>{candidate.call_result.name}</Badge>
                        )}
                      </div>
                      <CareNoteCell notes={candidateNotes} />
                    </td>

                    <td className="border-r border-slate-100 px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {candidate.current_interview_status ? (
                          <Badge variant={interviewStatusVariant(candidate.current_interview_status.name)}>
                            {candidate.current_interview_status.name}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Chưa hẹn PV</Badge>
                        )}
                        {candidate.current_employment_status && (
                          <Badge variant={employmentStatusVariant(candidate.current_employment_status.name)}>
                            {candidate.current_employment_status.name}
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-0.5">
                        {canModify(candidate) && (
                          <ActionLink icon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} />} onClick={() => setModal({ mode: "edit", candidate })}>
                            Sửa
                          </ActionLink>
                        )}
                        {canAssign && !candidate.assigned_to && (
                          <ActionLink
                            icon={<UserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
                            onClick={() => setModal({ mode: "assign", candidateIds: [candidate.id] })}
                          >
                            Phân chia
                          </ActionLink>
                        )}
                        {canAssign && candidate.assigned_to && (
                          <ActionLink
                            icon={<ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />}
                            onClick={() => setModal({ mode: "transfer", candidate })}
                          >
                            Chuyển
                          </ActionLink>
                        )}
                        {canDelete(candidate) && (
                          <ActionLink
                            icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                            tone="danger"
                            disabled={pendingId === candidate.id}
                            onClick={() => void handleDelete(candidate)}
                          >
                            Xóa
                          </ActionLink>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        {viewMode !== "care_pool" && candidates.length === 0 && (
          <EmptyState
            title={viewMode === "pending" ? "Không có ứng viên nào đang chờ phân chia" : "Chưa có ứng viên nào khớp bộ lọc"}
            icon={<Search className="h-5 w-5" strokeWidth={1.75} />}
          />
        )}
      </Card>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>
          Trang {page} — hiển thị {candidates.length} / {total} ứng viên
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
          title="Thêm ứng viên mới"
          sources={sources}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            const result = await clientApi<CreateCandidateResult>("/candidate", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            setModal({ mode: "none" });
            await refresh();
            setBanner(buildCreateBanner(result));
          }}
        />
      )}

      {modal.mode === "edit" && (
        <CandidateFormModal
          title={`Sửa ứng viên "${modal.candidate.full_name}"`}
          sources={sources}
          initialCandidate={modal.candidate}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi(`/candidate/${modal.candidate.id}`, { method: "PUT", body: JSON.stringify(payload) });
            setModal({ mode: "none" });
            await refresh();
            setBanner({ type: "success", text: "Đã cập nhật ứng viên" });
          }}
        />
      )}

      {modal.mode === "import" && (
        <ImportModal
          onClose={() => setModal({ mode: "none" })}
          onFinished={async (summary) => {
            await refresh();
            setBanner({
              type: summary.error_count > 0 ? "warning" : "success",
              text: `Import xong: ${summary.success_count} thành công, ${summary.error_count} lỗi, ${summary.duplicate_count} trùng SĐT.`,
            });
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
            setBanner({ type: "success", text: `Đã phân chia ${count} ứng viên` });
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
            setBanner({ type: "success", text: "Đã chuyển ứng viên sang Sale khác" });
          }}
        />
      )}
    </div>
  );
}

function buildCreateBanner(result: CreateCandidateResult): { type: "warning" | "success"; text: string } {
  if (!result.duplicate_warning) {
    return { type: "success", text: "Đã thêm ứng viên mới" };
  }
  const warning: DuplicateWarning = result.duplicate_warning;
  const details = warning.matches
    .map((match) => `- ${new Date(match.uploaded_at).toLocaleDateString("vi-VN")} bởi ${match.uploaded_by}`)
    .join("\n");
  return {
    type: "warning",
    text: `Đã thêm ứng viên mới, nhưng SĐT ${warning.phone_number} đã trùng với:\n${details}`,
  };
}

interface CandidateFormPayload {
  full_name: string;
  phone_number: string;
  source_id: string;
  mkt_note?: string;
  birth_year?: number;
  address?: string;
}

function CandidateFormModal({
  title,
  sources,
  initialCandidate,
  onClose,
  onSubmit,
}: {
  title: string;
  sources: LeadSource[];
  initialCandidate?: Candidate;
  onClose: () => void;
  onSubmit: (payload: CandidateFormPayload) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(initialCandidate?.full_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialCandidate?.phone_number ?? "");
  const [sourceId, setSourceId] = useState(initialCandidate?.source.id ?? sources[0]?.id ?? "");
  const [birthYear, setBirthYear] = useState(initialCandidate?.birth_year?.toString() ?? "");
  const [address, setAddress] = useState(initialCandidate?.address ?? "");
  const [mktNote, setMktNote] = useState(initialCandidate?.mkt_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName,
        phone_number: phoneNumber,
        source_id: sourceId,
        mkt_note: mktNote || undefined,
        birth_year: birthYear ? Number(birthYear) : undefined,
        address: address || undefined,
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

        <Field label="Năm sinh (không bắt buộc)">
          <Input value={birthYear} onChange={(event) => setBirthYear(event.target.value)} inputMode="numeric" />
        </Field>

        <Field label="Địa chỉ (không bắt buộc)">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>

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
      title="Nhập ứng viên từ Excel"
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
      setError("Vui lòng chọn Sale nhận ứng viên");
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
      title={candidateIds.length > 1 ? `Phân chia ${candidateIds.length} ứng viên` : "Phân chia ứng viên"}
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

        <Field label="Sale nhận ứng viên" hint={isLoadingMembers ? "Đang tải danh sách Sale..." : undefined}>
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

  const missingTeamError = candidate.assigned_team_id ? null : "Ứng viên chưa thuộc nhóm nào";

  async function handleSubmit() {
    if (!accountId) {
      setError("Vui lòng chọn Sale nhận ứng viên");
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
      title={`Chuyển ứng viên "${candidate.full_name}"`}
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
