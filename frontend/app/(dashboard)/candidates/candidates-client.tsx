"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
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
  PaginatedResult,
  Team,
  TeamMember,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { DuplicateDetailBadge } from "./duplicate-detail-badge";

const PAGE_SIZE = 50;
/** Mục 8, docs/09 + Mục 5, docs/13: ai được phân chia/chuyển lead. */
const ASSIGNMENT_ROLES: AccountRole[] = ["admin", "manager", "leader"];
/** Mục 5, tài liệu 10 (S3): ai được xem "Chờ phân chia". */
const PENDING_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "mkt"];

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; candidate: Candidate }
  | { mode: "import" }
  | { mode: "assign"; candidateIds: string[] }
  | { mode: "transfer"; candidate: Candidate };

type ViewMode = "all" | "pending";

interface Filters {
  keyword: string;
  source_id: string;
  is_duplicate_flagged: boolean;
}

export function CandidatesClient({
  initialCandidates,
  initialTotal,
  sources,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
  initialTeamMembers,
}: {
  initialCandidates: Candidate[];
  initialTotal: number;
  sources: LeadSource[];
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserTeamId: string | null;
  initialTeamMembers: TeamMember[];
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [filters, setFilters] = useState<Filters>({ keyword: "", source_id: "", is_duplicate_flagged: false });
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [banner, setBanner] = useState<{ type: "error" | "success" | "warning"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);

  const canAssign = ASSIGNMENT_ROLES.includes(currentUserRole);
  const canViewPending = PENDING_VIEW_ROLES.includes(currentUserRole);

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
    } else {
      if (filters.keyword) query.set("keyword", filters.keyword);
      if (filters.is_duplicate_flagged) query.set("is_duplicate_flagged", "true");
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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Ứng viên"
        description="Thu thập, tìm kiếm và quản lý dữ liệu ứng viên."
        actions={
          currentUserRole === "mkt" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setModal({ mode: "import" })}>
                <Upload className="h-4 w-4" strokeWidth={2} />
                Nhập từ Excel
              </Button>
              <Button type="button" onClick={() => setModal({ mode: "create" })}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Thêm ứng viên mới
              </Button>
            </>
          ) : undefined
        }
      />

      {currentUserRole === "leader" && teamMembers.length > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-brand-600" strokeWidth={2} />
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

      {canViewPending && (
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => void handleViewModeChange("all")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              viewMode === "all" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => void handleViewModeChange("pending")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              viewMode === "pending" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Chờ phân chia
          </button>
        </div>
      )}

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        {viewMode === "all" && (
          <Field label="Tìm theo tên/SĐT" className="min-w-[200px] flex-1">
            <Input
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
              placeholder="Tên hoặc số điện thoại"
            />
          </Field>
        )}
        <Field label="Nguồn">
          <Select
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
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <Checkbox
              checked={filters.is_duplicate_flagged}
              onChange={(event) => setFilters((prev) => ({ ...prev, is_duplicate_flagged: event.target.checked }))}
            />
            <span className="font-medium text-slate-700">Chỉ hiện trùng SĐT</span>
          </label>
        )}
        <Button type="button" variant="secondary" onClick={() => void handleSearch()}>
          <Search className="h-4 w-4" strokeWidth={2} />
          Tìm kiếm
        </Button>
      </Card>

      {viewMode === "pending" && canAssign && selectedIds.size > 0 && (
        <Card className="mb-4 flex items-center justify-between gap-3 p-3">
          <span className="text-sm text-slate-600">Đã chọn {selectedIds.size} ứng viên</span>
          <Button type="button" onClick={() => setModal({ mode: "assign", candidateIds: [...selectedIds] })}>
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Phân chia đã chọn
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
                {viewMode === "pending" && canAssign && <th className="w-10 px-4 py-3" />}
                <th className="px-4 py-3">Tên lao động</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Ngày up</th>
                <th className="px-4 py-3">MKT phụ trách</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="transition-colors hover:bg-slate-50">
                  {viewMode === "pending" && canAssign && (
                    <td className="px-4 py-3">
                      <Checkbox checked={selectedIds.has(candidate.id)} onChange={() => toggleSelected(candidate.id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/candidates/${candidate.id}`} className="hover:text-brand-700 hover:underline">
                      {candidate.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} />
                      {candidate.phone_number}
                      {candidate.is_duplicate_flagged && <DuplicateDetailBadge candidateId={candidate.id} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{candidate.source.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(candidate.uploaded_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{candidate.uploaded_by.name}</td>
                  <td className="px-4 py-3">
                    {candidate.assigned_to ? (
                      <Badge variant="success">Đã giao: {candidate.assigned_to.name}</Badge>
                    ) : (
                      <Badge variant="neutral">Chờ phân chia</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {canModify(candidate) && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", candidate })}>
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                          Sửa
                        </Button>
                      )}
                      {canAssign && !candidate.assigned_to && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ mode: "assign", candidateIds: [candidate.id] })}
                        >
                          <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                          Phân chia
                        </Button>
                      )}
                      {canAssign && candidate.assigned_to && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ mode: "transfer", candidate })}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />
                          Chuyển
                        </Button>
                      )}
                      {canDelete(candidate) && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={pendingId === candidate.id}
                          onClick={() => void handleDelete(candidate)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          Xóa
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {candidates.length === 0 && (
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
