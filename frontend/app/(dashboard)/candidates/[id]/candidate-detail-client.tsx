"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, MessageSquarePlus, Phone, PhoneCall, Trash2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { AccountRole, Candidate, Note, StatusCatalogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

/** Mục 8, docs/09 + Mục 6, docs/13: ai được cập nhật cuộc gọi/thêm ghi chú (KHÔNG gồm MKT). */
function canUpdatePipeline(
  candidate: Candidate,
  currentUserId: string,
  currentUserRole: AccountRole,
  currentUserTeamId: string | null,
): boolean {
  if (currentUserRole === "admin" || currentUserRole === "manager") return true;
  if (currentUserRole === "sale") return candidate.assigned_to?.id === currentUserId;
  if (currentUserRole === "leader") return candidate.assigned_team_id === currentUserTeamId;
  return false;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

export function CandidateDetailClient({
  initialCandidate,
  initialNotes,
  callStatuses,
  callResults,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
}: {
  initialCandidate: Candidate;
  initialNotes: Note[];
  callStatuses: StatusCatalogItem[];
  callResults: StatusCatalogItem[];
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserTeamId: string | null;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState(initialCandidate);
  const [notes, setNotes] = useState(initialNotes);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);

  const canUpdate = canUpdatePipeline(candidate, currentUserId, currentUserRole, currentUserTeamId);
  const visibleNotes = notes.filter((note) => !note.is_deleted);
  const canDeleteNote = (note: Note) => currentUserRole === "sale" && note.created_by.id === currentUserId;

  async function refreshNotes() {
    const result = await clientApi<Note[]>(`/candidate/${candidate.id}/note`);
    setNotes(result);
  }

  async function handleDeleteNote(note: Note) {
    if (!window.confirm("Xóa ghi chú này? Vẫn được lưu trong lịch sử hệ thống.")) return;
    setPendingNoteId(note.id);
    setBanner(null);
    try {
      await clientApi(`/candidate/${candidate.id}/note/${note.id}`, { method: "DELETE" });
      await refreshNotes();
      setBanner({ type: "success", text: "Đã xóa ghi chú" });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingNoteId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/candidates" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Quay lại danh sách ứng viên
      </Link>

      <PageHeader
        title={candidate.full_name}
        description={`${candidate.phone_number} · Nguồn: ${candidate.source.name}`}
        actions={
          canUpdate ? (
            <Button type="button" onClick={() => setIsCallModalOpen(true)}>
              <PhoneCall className="h-4 w-4" strokeWidth={2} />
              Gọi ngay
            </Button>
          ) : undefined
        }
      />

      {banner && <Banner type={banner.type} text={banner.text} />}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Thông tin ứng viên</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Năm sinh</dt>
              <dd className="text-slate-800">{candidate.birth_year ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Địa chỉ</dt>
              <dd className="text-right text-slate-800">{candidate.address ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">MKT nhập</dt>
              <dd className="text-slate-800">{candidate.uploaded_by.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Ngày up</dt>
              <dd className="text-slate-800">{formatDateTime(candidate.uploaded_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Sale phụ trách</dt>
              <dd className="text-slate-800">{candidate.assigned_to?.name ?? "Chờ phân chia"}</dd>
            </div>
            {candidate.mkt_note && (
              <div className="border-t border-slate-100 pt-2">
                <dt className="text-slate-500">Ghi chú MKT</dt>
                <dd className="mt-1 text-slate-800">{candidate.mkt_note}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Tiến trình cuộc gọi</p>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tình trạng cuộc gọi</span>
              {candidate.call_status ? (
                <Badge variant="info">{candidate.call_status.name}</Badge>
              ) : (
                <Badge variant="neutral">Chưa cập nhật</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Kết quả cuộc gọi</span>
              {candidate.call_result ? (
                <Badge variant="accent">{candidate.call_result.name}</Badge>
              ) : (
                <Badge variant="neutral">Chưa cập nhật</Badge>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1.5 text-slate-500">
                <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={2} />
                Số lần ghi nhận
              </span>
              <span className="font-medium text-slate-800">{visibleNotes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                Xử lý gần nhất
              </span>
              <span className="font-medium text-slate-800">
                {candidate.last_activity_at ? formatDateTime(candidate.last_activity_at) : "—"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-800">Lịch sử ghi chú/cuộc gọi</p>
          {canUpdate && (
            <Button type="button" size="sm" onClick={() => setIsNoteModalOpen(true)}>
              <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={2} />
              Thêm ghi chú
            </Button>
          )}
        </div>

        {visibleNotes.length === 0 ? (
          <EmptyState title="Chưa có ghi chú nào" icon={<Phone className="h-5 w-5" strokeWidth={1.75} />} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...visibleNotes].reverse().map((note) => (
              <li key={note.id} className="flex flex-col gap-1.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{note.created_by.name}</span>
                    <span>·</span>
                    <span>{formatDateTime(note.created_at)}</span>
                    {note.call_status && <Badge variant="info">{note.call_status.name}</Badge>}
                    {note.call_result && <Badge variant="accent">{note.call_result.name}</Badge>}
                  </div>
                  {canDeleteNote(note) && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={pendingNoteId === note.id}
                      onClick={() => void handleDeleteNote(note)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Xóa
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-line text-slate-800">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isCallModalOpen && (
        <CallUpdateModal
          candidate={candidate}
          callStatuses={callStatuses}
          callResults={callResults}
          onClose={() => setIsCallModalOpen(false)}
          onUpdated={(updated) => {
            setCandidate(updated);
            setIsCallModalOpen(false);
            router.refresh();
            setBanner({ type: "success", text: "Đã cập nhật tiến trình cuộc gọi" });
          }}
        />
      )}

      {isNoteModalOpen && (
        <AddNoteModal
          candidateId={candidate.id}
          onClose={() => setIsNoteModalOpen(false)}
          onCreated={async () => {
            setIsNoteModalOpen(false);
            await refreshNotes();
            setBanner({ type: "success", text: "Đã thêm ghi chú" });
          }}
        />
      )}
    </div>
  );
}

function CallUpdateModal({
  candidate,
  callStatuses,
  callResults,
  onClose,
  onUpdated,
}: {
  candidate: Candidate;
  callStatuses: StatusCatalogItem[];
  callResults: StatusCatalogItem[];
  onClose: () => void;
  onUpdated: (updated: Candidate) => void;
}) {
  const [callStatusId, setCallStatusId] = useState(candidate.call_status?.id ?? "");
  const [callResultId, setCallResultId] = useState(candidate.call_result?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      let updated = candidate;
      if (callStatusId && callStatusId !== candidate.call_status?.id) {
        updated = await clientApi<Candidate>(`/candidate/${candidate.id}/call-status`, {
          method: "PUT",
          body: JSON.stringify({ call_status_id: callStatusId }),
        });
      }
      if (callResultId && callResultId !== candidate.call_result?.id) {
        updated = await clientApi<Candidate>(`/candidate/${candidate.id}/call-result`, {
          method: "PUT",
          body: JSON.stringify({ call_result_id: callResultId }),
        });
      }
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Cập nhật tiến trình cuộc gọi"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Cập nhật"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Tình trạng cuộc gọi">
          <Select value={callStatusId} onChange={(event) => setCallStatusId(event.target.value)}>
            <option value="">— Chưa cập nhật —</option>
            {callStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Kết quả cuộc gọi">
          <Select value={callResultId} onChange={(event) => setCallResultId(event.target.value)}>
            <option value="">— Chưa cập nhật —</option>
            {callResults.map((result) => (
              <option key={result.id} value={result.id}>
                {result.name}
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

function AddNoteModal({
  candidateId,
  onClose,
  onCreated,
}: {
  candidateId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) {
      setError("Vui lòng nhập nội dung ghi chú");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/candidate/${candidateId}/note`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Thêm ghi chú"
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
      <div className="flex flex-col gap-3">
        <Field label="Nội dung">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            placeholder="Kết quả cuộc gọi, thông tin trao đổi với ứng viên..."
            autoFocus
          />
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
