"use client";

import { useEffect, useRef, useState } from "react";
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
import { callStatusVariant } from "@/lib/call-status-variant";
import { NOTE_COLORS, noteColorBgHex } from "@/lib/note-colors";
import { useToast } from "@/lib/toast-context";
import { zaloFriendStatusStyle } from "@/lib/zalo-friend-status";
import type { AccountRole, Candidate, LeadRealtimeEvent, Note, StatusCatalogItem } from "@/lib/types";
import { useLeadRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { Avatar } from "@/components/ui/avatar";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
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
  zaloFriendStatuses,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
}: {
  initialCandidate: Candidate;
  initialNotes: Note[];
  callStatuses: StatusCatalogItem[];
  callResults: StatusCatalogItem[];
  zaloStatuses: StatusCatalogItem[];
  zaloFriendStatuses: StatusCatalogItem[];
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
  const [zaloFriendStatusId, setZaloFriendStatusId] = useState(
    initialCandidate.zalo_friend_status?.id ?? "",
  );
  /**
   * Dự án phụ — nâng cấp toàn diện: tự động lưu "Tình trạng cuộc gọi/Kết quả
   * cuộc gọi/Kết quả" khi rời trang mà QUÊN bấm "Lưu thông tin" (yêu cầu
   * trực tiếp người dùng). `savedCallInfoRef` là MỐC đã lưu gần nhất (cập
   * nhật lại sau mỗi lần bấm "Lưu thông tin" thành công) — so với mốc này
   * thay vì `candidate.call_status?.id` vì handleSaveCallInfo() không cập
   * nhật lại `candidate` sau khi lưu (điều hướng đi luôn), so với candidate
   * cũ sẽ luôn thấy "còn thay đổi" và tự lưu thừa 1 lần nữa mỗi khi rời
   * trang ngay sau khi vừa bấm lưu thủ công.
   */
  const savedCallInfoRef = useRef({
    callStatusId: initialCandidate.call_status?.id ?? "",
    callResultId: initialCandidate.call_result?.id ?? "",
    zaloStatusId: initialCandidate.zalo_status?.id ?? "",
  });
  const liveCallInfoRef = useRef({ candidateId: candidate.id, callStatusId, callResultId, zaloStatusId });
  useEffect(() => {
    liveCallInfoRef.current = { candidateId: candidate.id, callStatusId, callResultId, zaloStatusId };
  });
  const [isSavingZaloFriendStatus, setIsSavingZaloFriendStatus] = useState(false);
  const [isSavingCallInfo, setIsSavingCallInfo] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isHoldSubmitting, setIsHoldSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingNoteColor, setIsSavingNoteColor] = useState(false);
  /**
   * Yêu cầu người dùng (Mục 5) — "không tự ghi đè nội dung người dùng đang
   * nhập dở trong ô note; nếu record đang được chỉnh sửa và có người khác
   * cập nhật, hiển thị cảnh báo nhỏ ... và cho phép tải lại". Ghi chú đang
   * mở ô sửa (editingNoteId) vẫn được cập nhật NGẦM trong mảng `notes` (để
   * "Tải lại" có sẵn dữ liệu mới nhất), nhưng KHÔNG đụng vào `editDraft` —
   * chỉ đánh dấu conflictNoteId để hiện cảnh báo, người dùng tự quyết định
   * tải lại (mất bản đang gõ) hay tiếp tục lưu đè.
   */
  const [conflictNoteId, setConflictNoteId] = useState<string | null>(null);

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
   * Yêu cầu người dùng — đồng bộ realtime cho trang Chi tiết ứng viên (Mục
   * 4: "nếu đang mở chi tiết/modal của record cũng phải cập nhật"). Chỉ xử
   * lý sự kiện đúng lead đang mở; vá trực tiếp `candidate`/`notes` trong
   * state, không gọi lại toàn bộ trang.
   */
  function handleRealtimeEvent(event: LeadRealtimeEvent) {
    if (event.lead_id !== candidate.id) return;
    const isSelf = event.actor?.id === currentUserId;

    if (event.note) {
      const note = event.note;
      setNotes((prev) => {
        const existingIndex = prev.findIndex((n) => n.id === note.id);
        return existingIndex === -1 ? [...prev, note] : prev.map((n, i) => (i === existingIndex ? note : n));
      });
      if (!isSelf && editingNoteId === note.id) {
        setConflictNoteId(note.id);
      }
    }

    if (event.candidate) {
      setCandidate(event.candidate);
    }
  }

  useLeadRealtime(handleRealtimeEvent);
  useRealtimeReconnect(() => {
    void refreshNotes();
    clientApi<Candidate>(`/candidate/${candidate.id}`)
      .then(setCandidate)
      .catch(() => {
        // Bỏ qua lỗi tải nền — dữ liệu cũ vẫn hiển thị.
      });
  });

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
   * Dự án phụ — nâng cấp toàn diện: "Tình trạng Zalo" — lưu ngay khi đổi lựa
   * chọn (khác với Tình trạng cuộc gọi/Kết quả cuộc gọi/Kết quả, gộp vào nút
   * "Lưu thông tin" ở handleSaveCallInfo) vì đặt ở đầu khối lịch sử ghi
   * chú/cuộc gọi, tách biệt khỏi khối "Tiến trình cuộc gọi".
   */
  async function handleSetZaloFriendStatus(value: string) {
    setZaloFriendStatusId(value);
    setIsSavingZaloFriendStatus(true);
    try {
      const updated = await clientApi<Candidate>(`/candidate/${candidate.id}/zalo-friend-status`, {
        method: "PUT",
        body: JSON.stringify({ zalo_friend_status_id: value || null }),
      });
      setCandidate(updated);
    } catch (error) {
      setZaloFriendStatusId(candidate.zalo_friend_status?.id ?? "");
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsSavingZaloFriendStatus(false);
    }
  }

  /**
   * Lưu 3 lựa chọn "Tình trạng cuộc gọi"/"Kết quả cuộc gọi"/"Kết quả" (đổi ý
   * từ "Tình trạng Zalo" — vẫn dùng chung field zalo_status kỹ thuật cũ)
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
      savedCallInfoRef.current = { callStatusId, callResultId, zaloStatusId };
      router.push("/candidates");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
      setIsSavingCallInfo(false);
    }
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: tự động lưu "Tình trạng cuộc gọi/Kết quả
   * cuộc gọi/Kết quả" nếu người dùng rời trang mà quên bấm "Lưu thông tin"
   * (yêu cầu trực tiếp người dùng) — cả khi điều hướng trong app (bấm "Quay
   * lại danh sách lao động", cleanup của effect chạy lúc unmount) lẫn khi
   * đóng hẳn tab/tải lại trang (sự kiện beforeunload, dùng fetch keepalive
   * để trình duyệt vẫn cố gắng gửi xong request dù trang đã rời đi — không
   * đảm bảo 100% như sendBeacon nhưng sendBeacon chỉ hỗ trợ POST, không hợp
   * với PUT hiện có). Dùng ref thay vì đọc thẳng state trong closure vì
   * effect cleanup chỉ chạy 1 lần lúc mount (deps rỗng), cần đọc GIÁ TRỊ MỚI
   * NHẤT tại thời điểm rời trang, không phải giá trị lúc mount.
   */
  useEffect(() => {
    function collectUnsavedCallInfo() {
      const live = liveCallInfoRef.current;
      const saved = savedCallInfoRef.current;
      const changes: Array<() => Promise<unknown>> = [];
      if (live.callStatusId && live.callStatusId !== saved.callStatusId) {
        changes.push(() =>
          clientApi(`/candidate/${live.candidateId}/call-status`, {
            method: "PUT",
            body: JSON.stringify({ call_status_id: live.callStatusId }),
            keepalive: true,
          }),
        );
      }
      if (live.callResultId && live.callResultId !== saved.callResultId) {
        changes.push(() =>
          clientApi(`/candidate/${live.candidateId}/call-result`, {
            method: "PUT",
            body: JSON.stringify({ call_result_id: live.callResultId }),
            keepalive: true,
          }),
        );
      }
      if (live.zaloStatusId && live.zaloStatusId !== saved.zaloStatusId) {
        changes.push(() =>
          clientApi(`/candidate/${live.candidateId}/zalo-status`, {
            method: "PUT",
            body: JSON.stringify({ zalo_status_id: live.zaloStatusId }),
            keepalive: true,
          }),
        );
      }
      return changes;
    }

    function handleBeforeUnload() {
      for (const save of collectUnsavedCallInfo()) void save();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      for (const save of collectUnsavedCallInfo()) {
        save().catch(() => {
          // Đã rời trang, không còn UI để báo lỗi — im lặng bỏ qua, ưu tiên
          // cố gắng lưu hơn là chắc chắn mất hẳn thay đổi.
        });
      }
    };
  }, []);

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
    setConflictNoteId(null);
  }

  /** Mục 5 — "cho phép tải lại": bỏ bản đang gõ dở, lấy đúng nội dung mới nhất đã có sẵn trong `notes`. */
  function handleReloadConflictedNote(note: Note) {
    setEditDraft(note.content);
    setConflictNoteId(null);
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
                Số được giữ lại bởi{" "}
                {candidate.held_by ? <NameWithRoleHint account={candidate.held_by} /> : "—"}
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
              <dd className="text-slate-800">
                <NameWithRoleHint account={candidate.uploaded_by} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Ngày up</dt>
              <dd className="text-slate-800">{formatDateTime(candidate.uploaded_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Sale phụ trách</dt>
              <dd className="text-slate-800">
                {candidate.assigned_to ? <NameWithRoleHint account={candidate.assigned_to} /> : "Chờ phân chia"}
              </dd>
            </div>
            {candidate.entered_care_pool_at && candidate.care_pool_locked_by && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Cột chăm sóc</dt>
                <dd>
                  <Badge variant="info">
                    Đang xử lý —{" "}
                    {candidate.care_pool_locked_by.id === currentUserId ? (
                      "Bạn"
                    ) : (
                      <NameWithRoleHint account={candidate.care_pool_locked_by} />
                    )}
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
              {/* UI Polish — Select mặc định có sẵn class "w-full" trong
                  fieldBaseClass; ghi đè bằng 1 class w-* khác trên chính
                  Select không đáng tin cậy (cn() không dedup, thứ tự CSS
                  Tailwind sinh ra quyết định class nào thắng chứ không phải
                  thứ tự trong chuỗi className) — nên bọc trong 1 div
                  shrink-0 có độ rộng cố định để cả 3 ô bằng nhau, thẳng hàng. */}
              <div className="w-36 shrink-0">
                <Select
                  uiSize="sm"
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
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-slate-500">Kết quả cuộc gọi</span>
              <div className="w-36 shrink-0">
                <Select
                  uiSize="sm"
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
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-slate-500">Kết quả</span>
              <div className="w-36 shrink-0">
                <Select
                  uiSize="sm"
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
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-800">Lịch sử ghi chú/cuộc gọi</p>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-slate-500">Tình trạng Zalo</span>
            <Select
              uiSize="sm"
              className="w-44"
              value={zaloFriendStatusId}
              onChange={(event) => void handleSetZaloFriendStatus(event.target.value)}
              disabled={!canUpdate || isSavingZaloFriendStatus}
            >
              <option value="">Chưa cập nhật</option>
              {zaloFriendStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </Select>
          </div>
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
                        <Avatar
                          fullName={note.created_by.name}
                          avatarUrl={note.created_by.avatar_url}
                          className="h-6 w-6 text-[10px]"
                        />
                        <NameWithRoleHint account={note.created_by} className="text-xs font-medium text-slate-700" />
                        <span className="text-xs text-slate-400">{formatDateTime(note.created_at)}</span>
                        {note.call_status && (
                          <Badge variant={callStatusVariant(note.call_status.name)}>{note.call_status.name}</Badge>
                        )}
                        {note.call_result && <Badge variant="accent">{note.call_result.name}</Badge>}
                        {note.zalo_friend_status && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ring-black/10"
                            style={zaloFriendStatusStyle(note.zalo_friend_status.name)}
                          >
                            {note.zalo_friend_status.name}
                          </span>
                        )}
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
                        {conflictNoteId === note.id && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                            <span>Dữ liệu này vừa được cập nhật bởi người khác</span>
                            <button
                              type="button"
                              className="font-medium underline hover:text-amber-900"
                              onClick={() => handleReloadConflictedNote(note)}
                            >
                              Tải lại
                            </button>
                          </div>
                        )}
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
