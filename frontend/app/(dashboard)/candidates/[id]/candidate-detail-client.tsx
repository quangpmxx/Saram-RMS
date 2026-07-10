"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Clock,
  Lock,
  MessageSquarePlus,
  Phone,
  PhoneCall,
  Trash2,
} from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { AccountRole, Candidate, Interview, Note, StatusCatalogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { InlineEditField } from "./inline-edit-field";
import { InlineNoteComposer } from "./inline-note-composer";

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

/**
 * Mục 4, docs/13 (PUT /candidate/:id) — dùng để hiện/ẩn khả năng sửa Số
 * điện thoại trên trang Chi tiết ứng viên, khớp đúng phạm vi quyền của
 * assertCanModify() ở backend (candidates.service.ts): Admin/Quản lý
 * không giới hạn; MKT chỉ data do mình upload (giữ nguyên, không mở rộng);
 * Sale chỉ lead đang phụ trách; Leader chỉ nhóm mình.
 */
function canEditCandidate(
  candidate: Candidate,
  currentUserId: string,
  currentUserRole: AccountRole,
  currentUserTeamId: string | null,
): boolean {
  if (currentUserRole === "admin" || currentUserRole === "manager") return true;
  if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
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
  initialInterviews,
  callStatuses,
  callResults,
  interviewStatuses,
  employmentStatuses,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
}: {
  initialCandidate: Candidate;
  initialNotes: Note[];
  initialInterviews: Interview[];
  callStatuses: StatusCatalogItem[];
  callResults: StatusCatalogItem[];
  interviewStatuses: StatusCatalogItem[];
  employmentStatuses: StatusCatalogItem[];
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserTeamId: string | null;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState(initialCandidate);
  const [notes, setNotes] = useState(initialNotes);
  const [interviews, setInterviews] = useState(initialInterviews);
  const [banner, setBanner] = useState<{ type: "error" | "success" | "warning"; text: string } | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  const [updatingInterview, setUpdatingInterview] = useState<Interview | null>(null);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isHoldSubmitting, setIsHoldSubmitting] = useState(false);

  const canUpdate = canUpdatePipeline(candidate, currentUserId, currentUserRole, currentUserTeamId);
  const canEditPhone = canEditCandidate(candidate, currentUserId, currentUserRole, currentUserTeamId);
  // Mục 2.2, docs/12: "Đánh dấu/Bỏ đánh dấu giữ số" — hiện với Sale (lead của
  // mình); Admin/Quản lý kế thừa quyền này không giới hạn (yêu cầu bổ sung
  // "Admin và Quản lý phải có toàn bộ quyền của các vai trò cấp dưới").
  const canToggleHold =
    currentUserRole === "admin" ||
    currentUserRole === "manager" ||
    (currentUserRole === "sale" && candidate.assigned_to?.id === currentUserId);
  const visibleNotes = notes.filter((note) => !note.is_deleted);
  // Sale: chỉ ghi chú của chính mình; Admin/Quản lý kế thừa quyền này, xóa được ghi chú bất kỳ.
  const canDeleteNote = (note: Note) =>
    currentUserRole === "admin" ||
    currentUserRole === "manager" ||
    (currentUserRole === "sale" && note.created_by.id === currentUserId);
  const sortedInterviews = [...interviews].sort((a, b) => b.attempt_no - a.attempt_no);

  async function refreshNotes() {
    const result = await clientApi<Note[]>(`/candidate/${candidate.id}/note`);
    setNotes(result);
  }

  async function refreshInterviews() {
    const result = await clientApi<Interview[]>(`/candidate/${candidate.id}/interview`);
    setInterviews(result);
  }

  async function refreshCandidate() {
    const result = await clientApi<Candidate>(`/candidate/${candidate.id}`);
    setCandidate(result);
  }

  /**
   * Mục 5, docs/13 + Mục 3, docs/12: Sale mở 1 lead đang ở Cột chăm sóc (không
   * phải lead của mình) → tự động chiếm khóa xử lý, tránh 2 Sale cùng sửa 1
   * lúc. Lead của chính Sale đó thì không cần khóa (đã có đường quyền riêng
   * qua sở hữu lead — Mục "extend assertInScope/loadLeadForUpdate" ở backend).
   */
  useEffect(() => {
    if (currentUserRole !== "sale") return;
    if (!candidate.entered_care_pool_at) return;
    if (candidate.assigned_to?.id === currentUserId) return;
    let cancelled = false;
    clientApi<Candidate>(`/care-pool/${candidate.id}/lock`, { method: "POST" })
      .then((updated) => {
        if (!cancelled) setCandidate(updated);
      })
      .catch((error) => {
        if (cancelled) return;
        setBanner({
          type: "error",
          text: error instanceof ApiError ? error.message : "Không thể mở khóa xử lý ứng viên này",
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id]);

  async function handleToggleHold() {
    if (!candidate.is_held) {
      if (!window.confirm("Đánh dấu giữ số ứng viên này? Ứng viên sẽ không tự động chuyển vào cột chăm sóc khi bạn đang giữ số.")) return;
    }
    setIsHoldSubmitting(true);
    setBanner(null);
    try {
      const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/hold`, {
        method: candidate.is_held ? "DELETE" : "POST",
      });
      setCandidate(updated);
      setBanner({ type: "success", text: updated.is_held ? "Đã đánh dấu giữ số" : "Đã bỏ đánh dấu giữ số" });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setIsHoldSubmitting(false);
    }
  }

  async function handleAddNote(content: string) {
    await clientApi(`/candidate/${candidate.id}/note`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    await refreshNotes();
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
          canUpdate || canToggleHold ? (
            <div className="flex flex-wrap gap-2">
              {canToggleHold && (
                <Button
                  type="button"
                  variant={candidate.is_held ? "outline" : "secondary"}
                  disabled={isHoldSubmitting}
                  onClick={() => void handleToggleHold()}
                >
                  <Lock className="h-4 w-4" strokeWidth={2} />
                  {isHoldSubmitting ? "Đang lưu..." : candidate.is_held ? "Bỏ giữ số" : "Giữ số"}
                </Button>
              )}
              {canUpdate && (
                <Button type="button" onClick={() => setIsCallModalOpen(true)}>
                  <PhoneCall className="h-4 w-4" strokeWidth={2} />
                  Gọi ngay
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {banner && <Banner type={banner.type} text={banner.text} />}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Thông tin ứng viên</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {canEditPhone ? (
              <InlineEditField
                label="Số điện thoại"
                displayValue={candidate.phone_number}
                editValue={candidate.phone_number}
                onSave={async (value) => {
                  const trimmed = value.trim();
                  if (!trimmed) {
                    throw new Error("Số điện thoại không được để trống");
                  }
                  const updated = await clientApi<Candidate>(`/candidate/${candidate.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ phone_number: trimmed }),
                  });
                  setCandidate(updated);
                  setBanner(
                    updated.is_duplicate_flagged
                      ? {
                          type: "warning",
                          text: "Đã cập nhật số điện thoại — số này đang trùng với (các) ứng viên khác trong hệ thống",
                        }
                      : { type: "success", text: "Đã cập nhật số điện thoại" },
                  );
                }}
              />
            ) : (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Số điện thoại</dt>
                <dd className="text-slate-800">{candidate.phone_number}</dd>
              </div>
            )}
            <InlineEditField
              label="Năm sinh"
              displayValue={candidate.birth_year?.toString() ?? "—"}
              editValue={candidate.birth_year?.toString() ?? ""}
              inputType="number"
              onSave={async (value) => {
                const trimmed = value.trim();
                let birthYear: number | null = null;
                if (trimmed) {
                  birthYear = Number(trimmed);
                  const currentYear = new Date().getFullYear();
                  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
                    throw new Error("Năm sinh không hợp lệ (1900 – năm hiện tại)");
                  }
                }
                const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/quick-edit`, {
                  method: "PUT",
                  body: JSON.stringify({ birth_year: birthYear }),
                });
                setCandidate(updated);
                setBanner({ type: "success", text: "Đã cập nhật năm sinh" });
              }}
            />
            <InlineEditField
              label="Địa chỉ"
              displayValue={candidate.address ?? "—"}
              editValue={candidate.address ?? ""}
              onSave={async (value) => {
                const address = value.trim() || null;
                const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/quick-edit`, {
                  method: "PUT",
                  body: JSON.stringify({ address }),
                });
                setCandidate(updated);
                setBanner({ type: "success", text: "Đã cập nhật địa chỉ" });
              }}
            />
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
            {candidate.is_held && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Giữ số</dt>
                <dd>
                  <Badge variant="warning">
                    Đang giữ số{candidate.held_by ? ` — ${candidate.held_by.name}` : ""}
                  </Badge>
                </dd>
              </div>
            )}
            {candidate.entered_care_pool_at && candidate.care_pool_locked_by && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Cột chăm sóc</dt>
                <dd>
                  <Badge variant="info">
                    Đang xử lý — {candidate.care_pool_locked_by.id === currentUserId ? "Bạn" : candidate.care_pool_locked_by.name}
                  </Badge>
                </dd>
              </div>
            )}
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

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Phỏng vấn & đi làm</p>
          {canUpdate && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setIsCallbackModalOpen(true)}>
                <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                Đặt lịch gọi lại
              </Button>
              <Button type="button" size="sm" onClick={() => setIsInterviewModalOpen(true)}>
                <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
                Đặt lịch PV
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Trạng thái PV hiện tại</span>
            {candidate.current_interview_status ? (
              <Badge variant="info">{candidate.current_interview_status.name}</Badge>
            ) : (
              <Badge variant="neutral">Chưa hẹn PV</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Trạng thái đi làm</span>
            {candidate.current_employment_status ? (
              <Badge variant="accent">{candidate.current_employment_status.name}</Badge>
            ) : (
              <Badge variant="neutral">Chưa có</Badge>
            )}
          </div>
          {candidate.current_partner_company_name && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Công ty đối tác gần nhất</span>
              <span className="font-medium text-slate-800">{candidate.current_partner_company_name}</span>
            </div>
          )}
        </div>

        {sortedInterviews.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
            {sortedInterviews.map((interview) => (
              <li
                key={interview.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-slate-700">Lần {interview.attempt_no}</span>
                  <span className="text-slate-500">{interview.partner_company_name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{formatDateTime(interview.scheduled_at)}</span>
                  <Badge variant="info">{interview.status.name}</Badge>
                  {interview.employment_status && (
                    <Badge variant="accent">{interview.employment_status.name}</Badge>
                  )}
                  {interview.employment_reason && (
                    <span className="text-slate-500 italic">— {interview.employment_reason}</span>
                  )}
                </div>
                {canUpdate && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setUpdatingInterview(interview)}>
                    Cập nhật kết quả
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-800">Lịch sử ghi chú/cuộc gọi</p>
        </div>

        {canUpdate && <InlineNoteComposer onSubmit={handleAddNote} />}

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

      {isInterviewModalOpen && (
        <ScheduleInterviewModal
          candidateId={candidate.id}
          onClose={() => setIsInterviewModalOpen(false)}
          onCreated={async () => {
            setIsInterviewModalOpen(false);
            await Promise.all([refreshInterviews(), refreshCandidate()]);
            router.refresh();
            setBanner({ type: "success", text: "Đã đặt lịch hẹn phỏng vấn" });
          }}
        />
      )}

      {updatingInterview && (
        <UpdateInterviewModal
          interview={updatingInterview}
          interviewStatuses={interviewStatuses}
          employmentStatuses={employmentStatuses}
          onClose={() => setUpdatingInterview(null)}
          onUpdated={async () => {
            setUpdatingInterview(null);
            await Promise.all([refreshInterviews(), refreshCandidate()]);
            router.refresh();
            setBanner({ type: "success", text: "Đã cập nhật kết quả phỏng vấn" });
          }}
        />
      )}

      {isCallbackModalOpen && (
        <ScheduleCallbackModal
          candidateId={candidate.id}
          onClose={() => setIsCallbackModalOpen(false)}
          onCreated={() => {
            setIsCallbackModalOpen(false);
            setBanner({ type: "success", text: "Đã đặt lịch gọi lại" });
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

function ScheduleInterviewModal({
  candidateId,
  onClose,
  onCreated,
}: {
  candidateId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [partnerCompanyName, setPartnerCompanyName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!partnerCompanyName.trim() || !scheduledAt) {
      setError("Vui lòng nhập đầy đủ công ty đối tác và ngày giờ hẹn");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/candidate/${candidateId}/interview`, {
        method: "POST",
        body: JSON.stringify({
          partner_company_name: partnerCompanyName,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
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
      title="Đặt lịch hẹn phỏng vấn"
      description="Hẹn PV mới — kể cả trường hợp hẹn lại sau khi bùng PV, hệ thống tự lưu lại lịch sử các lần hẹn."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Đặt lịch"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Công ty đối tác (nhà máy) hẹn PV">
          <Input
            value={partnerCompanyName}
            onChange={(event) => setPartnerCompanyName(event.target.value)}
            placeholder="Nhập tên công ty đối tác"
            autoFocus
          />
        </Field>

        <Field label="Ngày giờ hẹn">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
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

function UpdateInterviewModal({
  interview,
  interviewStatuses,
  employmentStatuses,
  onClose,
  onUpdated,
}: {
  interview: Interview;
  interviewStatuses: StatusCatalogItem[];
  employmentStatuses: StatusCatalogItem[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [statusId, setStatusId] = useState(interview.status.id);
  const [employmentStatusId, setEmploymentStatusId] = useState(interview.employment_status?.id ?? "");
  const [employmentReason, setEmploymentReason] = useState(interview.employment_reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedStatus = interviewStatuses.find((status) => status.id === statusId);
  const isPassed = selectedStatus?.code === "PASSED";
  const selectedEmploymentStatus = employmentStatuses.find((status) => status.id === employmentStatusId);
  const isNotEmployed = selectedEmploymentStatus?.code === "NOT_EMPLOYED";

  async function handleSubmit() {
    if (isNotEmployed && !employmentReason.trim()) {
      setError('Bắt buộc nhập lý do khi ghi nhận "Không đi làm"');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/interview/${interview.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status_id: statusId,
          employment_status_id: isPassed && employmentStatusId ? employmentStatusId : undefined,
          employment_reason: isPassed && employmentStatusId ? employmentReason || undefined : undefined,
        }),
      });
      await onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Cập nhật kết quả PV — Lần ${interview.attempt_no}`}
      description={`${interview.partner_company_name} · ${formatDateTime(interview.scheduled_at)}`}
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
        <Field label="Trạng thái phỏng vấn">
          <Select
            value={statusId}
            onChange={(event) => {
              setStatusId(event.target.value);
              setEmploymentStatusId("");
              setEmploymentReason("");
            }}
          >
            {interviewStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </Select>
        </Field>

        {isPassed && (
          <>
            <Field label="Kết quả đi làm" hint="Chỉ áp dụng khi trạng thái là Đỗ PV">
              <Select value={employmentStatusId} onChange={(event) => setEmploymentStatusId(event.target.value)}>
                <option value="">— Chưa cập nhật —</option>
                {employmentStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </Field>

            {isNotEmployed && (
              <Field label="Lý do không đi làm">
                <Textarea
                  value={employmentReason}
                  onChange={(event) => setEmploymentReason(event.target.value)}
                  rows={3}
                  placeholder="Nhập lý do ứng viên không đi làm dù đã đỗ phỏng vấn"
                />
              </Field>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ScheduleCallbackModal({
  candidateId,
  onClose,
  onCreated,
}: {
  candidateId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!scheduledAt) {
      setError("Vui lòng chọn thời điểm cần gọi lại");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/candidate/${candidateId}/callback`, {
        method: "POST",
        body: JSON.stringify({ scheduled_at: new Date(scheduledAt).toISOString() }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Đặt lịch gọi lại"
      description="Lịch gọi lại sẽ xuất hiện trên màn hình Lịch hẹn."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Đặt lịch"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Thời điểm cần gọi lại">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
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
