"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Phone, Plus, Search, Trash2, Upload, UploadCloud } from "lucide-react";
import { ApiError, clientApi, clientApiUpload } from "@/lib/api-client";
import type {
  AccountRole,
  Candidate,
  CreateCandidateResult,
  DuplicateWarning,
  ImportJobStatus,
  LeadSource,
  PaginatedResult,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

const PAGE_SIZE = 50;

type ModalState = { mode: "none" } | { mode: "create" } | { mode: "edit"; candidate: Candidate } | { mode: "import" };

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
}: {
  initialCandidates: Candidate[];
  initialTotal: number;
  sources: LeadSource[];
  currentUserId: string;
  currentUserRole: AccountRole;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ keyword: "", source_id: "", is_duplicate_flagged: false });
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [banner, setBanner] = useState<{ type: "error" | "success" | "warning"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function canModify(candidate: Candidate): boolean {
    if (currentUserRole === "admin" || currentUserRole === "manager") return true;
    if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
    return false;
  }

  function canDelete(candidate: Candidate): boolean {
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
    return false;
  }

  async function refresh(targetPage = page) {
    const query = new URLSearchParams({ page: String(targetPage), page_size: String(PAGE_SIZE) });
    if (filters.keyword) query.set("keyword", filters.keyword);
    if (filters.source_id) query.set("source_id", filters.source_id);
    if (filters.is_duplicate_flagged) query.set("is_duplicate_flagged", "true");

    const result = await clientApi<PaginatedResult<Candidate>>(`/candidate?${query.toString()}`);
    setCandidates(result.items);
    setTotal(result.total);
    setPage(targetPage);
    router.refresh();
  }

  async function handleSearch() {
    await refresh(1);
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

      {banner && <Banner type={banner.type} text={banner.text} />}

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Tìm theo tên/SĐT" className="min-w-[200px] flex-1">
          <Input
            value={filters.keyword}
            onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
            placeholder="Tên hoặc số điện thoại"
          />
        </Field>
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
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <Checkbox
            checked={filters.is_duplicate_flagged}
            onChange={(event) => setFilters((prev) => ({ ...prev, is_duplicate_flagged: event.target.checked }))}
          />
          <span className="font-medium text-slate-700">Chỉ hiện trùng SĐT</span>
        </label>
        <Button type="button" variant="secondary" onClick={() => void handleSearch()}>
          <Search className="h-4 w-4" strokeWidth={2} />
          Tìm kiếm
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
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
                  <td className="px-4 py-3 font-medium text-slate-800">{candidate.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} />
                      {candidate.phone_number}
                      {candidate.is_duplicate_flagged && (
                        <Badge variant="warning" title="Số điện thoại này đang trùng với ứng viên khác">
                          Trùng SĐT
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{candidate.source.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(candidate.uploaded_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{candidate.uploaded_by.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">Chờ phân chia</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canModify(candidate) && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", candidate })}>
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                          Sửa
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
          <EmptyState title="Chưa có ứng viên nào khớp bộ lọc" icon={<Search className="h-5 w-5" strokeWidth={1.75} />} />
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
