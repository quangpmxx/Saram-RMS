"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Lock,
  MessageSquarePlus,
  Pencil,
  Phone,
  Save,
  Trash2,
} from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { NOTE_COLORS, noteColorBgHex } from "@/lib/note-colors";
import { useToast } from "@/lib/toast-context";
import type { AccountRole, Candidate, Note, StatusCatalogItem } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { InlineEditField } from "./inline-edit-field";
import { InlineNoteComposer } from "./inline-note-composer";
import { NoteTimeline } from "../note-timeline";

/**
 * Mục 8, docs/09 + Mục 6, docs/13: ai được cập nhật cuộc gọi/thêm ghi chú
 * (KHÔNG gồm MKT).
 * Dự án phụ — nâng cấp toàn diện: Sale khác trong cùng nhóm xử lý được lead
 * KHÔNG phải của mình, NHƯNG chỉ khi lead đã được xử lý ít nhất 1 lần
 * (last_activity_at khác null) — khớp loadLeadForUpdate() ở backend.
 */
function canUpdatePipeline(
  candidate: Candidate,
  currentUserId: string,
  currentUserRole: AccountRole,
  currentUserTeamId: string | null,
): boolean {
  if (currentUserRole === "admin" || currentUserRole === "manager") return true;
  if (currentUserRole === "sale") {
    if (candidate.assigned_to?.id === currentUserId) return true;
    return candidate.assigned_team_id === currentUserTeamId && candidate.last_activity_at !== null;
  }
  if (currentUserRole === "leader") return candidate.assigned_team_id === currentUserTeamId;
  return false;
}

/**
 * Mục 4, docs/13 (PUT /candidate/:id) — dùng để hiện/ẩn khả năng sửa Số
 * điện thoại trên trang Chi tiết ứng viên, khớp đúng phạm vi quyền của
 * assertCanModify() ở backend (candidates.service.ts): Admin/Quản lý
 * không giới hạn; MKT chỉ data do mình upload (giữ nguyên, không mở rộng);
 * Leader chỉ nhóm mình.
 * Dự án phụ — nâng cấp toàn diện: Sale khác trong cùng nhóm sửa được lead
 * KHÔNG phải của mình, NHƯNG chỉ khi lead đã được xử lý ít nhất 1 lần
 * (last_activity_at khác null).
 */
function canEditCandidate(
  candidate: Candidate,
  currentUserId: string,
  currentUserRole: AccountRole,
  currentUserTeamId: string | null,
): boolean {
  if (currentUserRole === "admin" || currentUserRole === "manager") return true;
  if (currentUserRole === "mkt") return candidate.uploaded_by.id === currentUserId;
  if (currentUserRole === "sale") {
    if (candidate.assigned_to?.id === currentUserId) return true;
    return candidate.assigned_team_id === currentUserTeamId && candidate.last_activity_at !== null;
  }
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
  zaloStatuses,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
}: {
  initialCandidate: Candidate;
  initialNotes: Note[];
  callStatuses: StatusCatalogItem[];
  callResults: StatusCatalogItem[];
  zaloStatuses: StatusCatalogItem[];
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserTeamId: string | null;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState(initialCandidate);
  const [notes, setNotes] = useState(initialNotes);
  const toast = useToast();
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  // UI Polish — "Tình trạng cuộc gọi"/"Kết quả cuộc gọi" đổi từ popup sang
  // chọn ngay tại trang (vẫn 1 giá trị mỗi ô như cũ, không đổi database) —
  // nút "Gọi ngay" đổi thành "Lưu thông tin" để lưu 2 lựa chọn này.
  const [callStatusId, setCallStatusId] = useState(initialCandidate.call_status?.id ?? "");
  const [callResultId, setCallResultId] = useState(initialCandidate.call_result?.id ?? "");
  const [zaloStatusId, setZaloStatusId] = useState(initialCandidate.zalo_status?.id ?? "");
  const [isSavingCallInfo, setIsSavingCallInfo] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isHoldSubmitting, setIsHoldSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingNoteColor, setIsSavingNoteColor] = useState(false);

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
  // Sửa ghi chú — khớp đúng phạm vi quyền của updateNote() ở backend
  // (lead-pipeline.service.ts): Sale (ghi chú của mình), Leader (ghi chú
  // trên lead thuộc nhóm mình), Quản lý/Admin (không giới hạn), MKT không có quyền.
  const canEditNote = (note: Note) =>
    currentUserRole === "admin" ||
    currentUserRole === "manager" ||
    (currentUserRole === "sale" && note.created_by.id === currentUserId) ||
    (currentUserRole === "leader" && candidate.assigned_team_id === currentUserTeamId);

  async function refreshNotes() {
    const result = await clientApi<Note[]>(`/candidate/${candidate.id}/note`);
    setNotes(result);
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
        toast.error(error instanceof ApiError ? error.message : "Không thể mở khóa xử lý lao động này");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id]);

  async function handleToggleHold() {
    if (!candidate.is_held) {
      if (!window.confirm("Đánh dấu giữ số lao động này? Các sale khác sẽ thấy cảnh báo bạn đang giữ số lao động này.")) return;
    }
    setIsHoldSubmitting(true);
    try {
      const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/hold`, {
        method: candidate.is_held ? "DELETE" : "POST",
      });
      setCandidate(updated);
      toast.success(updated.is_held ? "Đã đánh dấu giữ số" : "Đã bỏ đánh dấu giữ số");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsHoldSubmitting(false);
    }
  }

  /** Bấm màu đang chọn để bỏ chọn (quay về mặc định); bấm màu khác để đổi. */
  async function handleSetNoteColor(color: "yellow" | "green" | "red") {
    const next = candidate.note_color === color ? null : color;
    setIsSavingNoteColor(true);
    try {
      const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/note-color`, {
        method: "PUT",
        body: JSON.stringify({ note_color: next }),
      });
      setCandidate(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsSavingNoteColor(false);
    }
  }

  /**
   * Lưu 3 lựa chọn "Tình trạng cuộc gọi"/"Kết quả cuộc gọi"/"Tình trạng Zalo"
   * — chỉ gọi API cho ô nào thực sự đổi giá trị.
   * Dự án phụ — nâng cấp toàn diện: sau khi lưu, đóng ngay trang chi tiết và
   * quay lại danh sách ứng viên (không ở lại trang để xem kết quả).
   */
  async function handleSaveCallInfo() {
    setIsSavingCallInfo(true);
    try {
      if (callStatusId && callStatusId !== candidate.call_status?.id) {
        await clientApi<Candidate>(`/candidate/${candidate.id}/call-status`, {
          method: "PUT",
          body: JSON.stringify({ call_status_id: callStatusId }),
        });
      }
      if (callResultId && callResultId !== candidate.call_result?.id) {
        await clientApi<Candidate>(`/candidate/${candidate.id}/call-result`, {
          method: "PUT",
          body: JSON.stringify({ call_result_id: callResultId }),
        });
      }
      if (zaloStatusId && zaloStatusId !== candidate.zalo_status?.id) {
        await clientApi<Candidate>(`/candidate/${candidate.id}/zalo-status`, {
          method: "PUT",
          body: JSON.stringify({ zalo_status_id: zaloStatusId }),
        });
      }
      router.push("/candidates");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
      setIsSavingCallInfo(false);
    }
  }

  async function handleAddNote(content: string) {
    await clientApi(`/candidate/${candidate.id}/note`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    await refreshNotes();
  }

  function handleStartEdit(note: Note) {
    setEditingNoteId(note.id);
    setEditDraft(note.content);
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setEditDraft("");
    setEditError(null);
  }

  async function handleSaveEdit(note: Note) {
    const trimmed = editDraft.trim();
    if (!trimmed) {
      setEditError("Nội dung ghi chú không được để trống");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await clientApi(`/candidate/${candidate.id}/note/${note.id}`, {
        method: "PUT",
        body: JSON.stringify({ content: trimmed }),
      });
      await refreshNotes();
      setEditingNoteId(null);
      setEditDraft("");
    } catch (error) {
      setEditError(error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteNote(note: Note) {
    if (!window.confirm("Xóa ghi chú này? Vẫn được lưu trong lịch sử hệ thống.")) return;
    setPendingNoteId(note.id);
    try {
      await clientApi(`/candidate/${candidate.id}/note/${note.id}`, { method: "DELETE" });
      await refreshNotes();
      toast.success("Đã xóa ghi chú");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setPendingNoteId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/candidates" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Quay lại danh sách lao động
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
                <Button type="button" variant="outline" onClick={() => setIsCallbackModalOpen(true)}>
                  <CalendarClock className="h-4 w-4" strokeWidth={2} />
                  Đặt lịch gọi lại
                </Button>
              )}
              {canUpdate && (
                <Button type="button" disabled={isSavingCallInfo} onClick={() => void handleSaveCallInfo()}>
                  <Save className="h-4 w-4" strokeWidth={2} />
                  {isSavingCallInfo ? "Đang lưu..." : "Lưu thông tin"}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Thông tin lao động</p>
            {candidate.is_held && (
              <Badge variant="warning">
                Số được giữ lại bởi sale {candidate.held_by?.name ?? "—"}
              </Badge>
            )}
          </div>
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
                  if (updated.is_duplicate_flagged) {
                    toast.warning("Đã cập nhật số điện thoại — số này đang trùng với (các) lao động khác trong hệ thống");
                  } else {
                    toast.success("Đã cập nhật số điện thoại");
                  }
                }}
              />
            ) : (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Số điện thoại</dt>
                <dd className="text-slate-800">{candidate.phone_number}</dd>
              </div>
            )}
            <InlineEditField
              key={`birth-year-${candidate.birth_year ?? ""}`}
              label="Năm sinh"
              displayValue={candidate.birth_year?.toString() ?? "—"}
              editValue={candidate.birth_year?.toString() ?? ""}
              inputType="number"
              alwaysEditable
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
                toast.success("Đã cập nhật năm sinh");
              }}
            />
            <InlineEditField
              key={`address-${candidate.address ?? ""}`}
              label="Địa chỉ"
              displayValue={candidate.address ?? "—"}
              editValue={candidate.address ?? ""}
              alwaysEditable
              onSave={async (value) => {
                const address = value.trim() || null;
                const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/quick-edit`, {
                  method: "PUT",
                  body: JSON.stringify({ address }),
                });
                setCandidate(updated);
                toast.success("Đã cập nhật địa chỉ");
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
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-slate-500">Tình trạng cuộc gọi</span>
              <Select
                uiSize="sm"
                className="w-40"
                value={callStatusId}
                onChange={(event) => setCallStatusId(event.target.value)}
                disabled={!canUpdate}
              >
                <option value="">Chưa cập nhật</option>
                {callStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-slate-500">Kết quả cuộc gọi</span>
              <Select
                uiSize="sm"
                className="w-40"
                value={callResultId}
                onChange={(event) => setCallResultId(event.target.value)}
                disabled={!canUpdate}
              >
                <option value="">Chưa cập nhật</option>
                {callResults.map((result) => (
                  <option key={result.id} value={result.id}>
                    {result.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-slate-500">Tình trạng Zalo</span>
              <Select
                uiSize="sm"
                className="w-40"
                value={zaloStatusId}
                onChange={(event) => setZaloStatusId(event.target.value)}
                disabled={!canUpdate}
              >
                <option value="">Chưa cập nhật</option>
                {zaloStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-slate-500">Đánh dấu màu</span>
              <div className="flex items-center gap-2">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    disabled={!canUpdate || isSavingNoteColor}
                    onClick={() => void handleSetNoteColor(c.value)}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform disabled:cursor-not-allowed disabled:opacity-50",
                      c.swatch,
                      candidate.note_color === c.value
                        ? "ring-2 ring-slate-500 ring-offset-2"
                        : "hover:scale-110",
                    )}
                  />
                ))}
              </div>
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

      <Card
        className="overflow-hidden"
        style={{
          backgroundColor: noteColorBgHex(candidate.note_color),
        }}
      >
        <div className="border-b border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-800">Lịch sử ghi chú/cuộc gọi</p>
        </div>

        {canUpdate && <InlineNoteComposer onSubmit={handleAddNote} />}

        {visibleNotes.length === 0 ? (
          <EmptyState title="Chưa có ghi chú nào" icon={<Phone className="h-5 w-5" strokeWidth={1.75} />} />
        ) : (
          <div className="p-4">
            <NoteTimeline
              notes={visibleNotes}
              renderNote={(note) => {
                const isEditing = editingNoteId === note.id;
                return (
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar fullName={note.created_by.name} className="h-6 w-6 text-[10px]" />
                        <span className="text-xs font-medium text-slate-700">{note.created_by.name}</span>
                        <span className="text-xs text-slate-400">{formatDateTime(note.created_at)}</span>
                        {note.call_status && <Badge variant="info">{note.call_status.name}</Badge>}
                        {note.call_result && <Badge variant="accent">{note.call_result.name}</Badge>}
                      </div>
                      {!isEditing && (canEditNote(note) || canDeleteNote(note)) && (
                        <div className="flex items-center gap-1">
                          {canEditNote(note) && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleStartEdit(note)}>
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                              Chỉnh sửa
                            </Button>
                          )}
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
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <Textarea
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                          rows={3}
                          autoFocus
                          disabled={isSavingEdit}
                        />
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" disabled={isSavingEdit} onClick={() => void handleSaveEdit(note)}>
                            {isSavingEdit ? "Đang lưu..." : "Lưu"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" disabled={isSavingEdit} onClick={handleCancelEdit}>
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-sm whitespace-pre-line text-slate-800">{note.content}</p>
                    )}
                  </div>
                );
              }}
            />
          </div>
        )}
      </Card>

      {isCallbackModalOpen && (
        <ScheduleCallbackModal
          candidateId={candidate.id}
          onClose={() => setIsCallbackModalOpen(false)}
          onCreated={() => {
            setIsCallbackModalOpen(false);
            toast.success("Đã đặt lịch gọi lại");
          }}
        />
      )}
    </div>
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
