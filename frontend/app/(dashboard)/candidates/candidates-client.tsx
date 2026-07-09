"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-900">Ứng viên</h1>
        {currentUserRole === "mkt" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModal({ mode: "import" })}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Import Excel
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              + Thêm ứng viên mới
            </button>
          </div>
        )}
      </div>

      {banner && (
        <div
          role="status"
          className={`mb-4 whitespace-pre-line rounded-md px-4 py-2 text-sm ${
            banner.type === "error"
              ? "bg-red-50 text-red-700"
              : banner.type === "warning"
                ? "bg-amber-50 text-amber-800"
                : "bg-green-50 text-green-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Tìm theo tên/SĐT</span>
          <input
            value={filters.keyword}
            onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Tên hoặc số điện thoại"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Nguồn</span>
          <select
            value={filters.source_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, source_id: event.target.value }))}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Tất cả</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.is_duplicate_flagged}
            onChange={(event) => setFilters((prev) => ({ ...prev, is_duplicate_flagged: event.target.checked }))}
          />
          <span className="font-medium text-zinc-700">Chỉ hiện trùng SĐT</span>
        </label>
        <button
          type="button"
          onClick={() => void handleSearch()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Tìm kiếm
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tên lao động</th>
              <th className="px-4 py-3 font-medium">SĐT</th>
              <th className="px-4 py-3 font-medium">Nguồn</th>
              <th className="px-4 py-3 font-medium">Ngày up</th>
              <th className="px-4 py-3 font-medium">MKT phụ trách</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{candidate.full_name}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {candidate.phone_number}
                  {candidate.is_duplicate_flagged && (
                    <span
                      title="Số điện thoại này đang trùng với ứng viên khác"
                      className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                    >
                      Trùng SĐT
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{candidate.source.name}</td>
                <td className="px-4 py-3 text-zinc-600">{new Date(candidate.uploaded_at).toLocaleDateString("vi-VN")}</td>
                <td className="px-4 py-3 text-zinc-600">{candidate.uploaded_by.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    Chờ phân chia
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canModify(candidate) && (
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", candidate })}
                        className="text-xs font-medium text-zinc-700 hover:underline"
                      >
                        Sửa
                      </button>
                    )}
                    {canDelete(candidate) && (
                      <button
                        type="button"
                        disabled={pendingId === candidate.id}
                        onClick={() => void handleDelete(candidate)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  Chưa có ứng viên nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
        <span>
          Trang {page} — hiển thị {candidates.length} / {total} ứng viên
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => void refresh(page - 1)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => void refresh(page + 1)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
          >
            Sau
          </button>
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>

        <div className="mt-4 flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Tên lao động</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Số điện thoại</span>
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Nguồn</span>
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Năm sinh (không bắt buộc)</span>
            <input
              value={birthYear}
              onChange={(event) => setBirthYear(event.target.value)}
              inputMode="numeric"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Địa chỉ (không bắt buộc)</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Ghi chú MKT (không bắt buộc)</span>
            <textarea
              value={mktNote}
              onChange={(event) => setMktNote(event.target.value)}
              rows={2}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-zinc-900">Import ứng viên từ Excel</h2>
        <p className="mt-1 text-xs text-zinc-500">
          File .xlsx, cột theo thứ tự: Tên lao động, Số điện thoại, Nguồn, Năm sinh, Địa chỉ, Ghi chú. 3 cột đầu bắt
          buộc.
        </p>

        {!job && (
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        {job && (
          <div className="mt-4 rounded-md bg-zinc-50 p-4 text-sm">
            <p className="font-medium text-zinc-800">
              Trạng thái: {job.status === "completed" ? "Hoàn tất" : job.status === "failed" ? "Lỗi" : "Đang xử lý..."}
            </p>
            {isDone && (
              <>
                <p className="mt-2 text-zinc-600">Tổng số dòng: {job.total_rows}</p>
                <p className="text-green-700">Thành công: {job.success_count}</p>
                <p className="text-red-600">Lỗi: {job.error_count}</p>
                <p className="text-amber-700">Trùng SĐT: {job.duplicate_count}</p>
                {job.errors.length > 0 && (
                  <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-zinc-500">
                    {job.errors.map((rowError) => (
                      <li key={rowError.row}>
                        Dòng {rowError.row}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {!isDone && <p className="mt-2 text-zinc-500">Đang xử lý trong nền, vui lòng đợi...</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            {isDone ? "Đóng" : "Hủy"}
          </button>
          {!job && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSubmitting ? "Đang tải lên..." : "Bắt đầu import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
