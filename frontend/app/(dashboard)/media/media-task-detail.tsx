"use client";

import { useCallback, useEffect, useState } from "react";
import { AlarmClock, Check, Download, ExternalLink, Link2, Loader2, MessageSquare, Paperclip, Pencil, Send, Trash2, Undo2, X } from "lucide-react";
import { clientApi, clientApiBlob, clientApiUpload } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import {
  AvatarStack,
  Chip,
  PersonChip,
  PlatformChip,
  PriorityBadge,
  ProgressBar,
  REVIEW_META,
  STATUS_META,
  STATUS_ORDER,
  StatusBadge,
  TYPE_EMOJI,
  TYPE_LABEL,
  fmtDeadline,
  relativeDeadline,
  type MediaOptions,
  type MediaTaskDetail,
  type Submission,
  type TaskStatus,
} from "./media-shared";
import { TaskFormModal } from "./media-task-form";

const ACTIVITY_ICON: Record<string, string> = {
  comment: "💬",
  created: "✨",
  updated: "✏️",
  status: "🔁",
  progress: "📈",
  submit: "📤",
  review: "✅",
};

export async function downloadSubmissionFile(s: { id: string; file_name: string | null }) {
  const blob = await clientApiBlob(`/media/submissions/${s.id}/file`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = s.file_name ?? "san-pham";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Popup chi tiết công việc: tiến độ, nộp sản phẩm, duyệt, lịch sử + trao đổi. */
export function TaskDetailModal({
  taskId,
  options,
  canEdit,
  onClose,
  onChanged,
}: {
  taskId: string;
  options: MediaOptions;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [task, setTask] = useState<MediaTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState(0);
  const [submitLink, setSubmitLink] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [reviewing, setReviewing] = useState<{ submission: Submission; decision: "approved" | "revision" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(() => {
    clientApi<MediaTaskDetail>(`/media/tasks/${taskId}`)
      .then((t) => {
        setTask(t);
        setProgress(t.progress);
      })
      .catch((e: Error) => setError(e.message));
  }, [taskId]);

  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
      onChanged();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Modal title="Không mở được công việc" footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}>
        <p className="text-sm text-red-600">{error}</p>
      </Modal>
    );
  }
  if (!task) {
    return (
      <Modal>
        <div className="grid place-items-center py-10 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>
      </Modal>
    );
  }

  if (editing) {
    return (
      <TaskFormModal
        options={options}
        task={task}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          load();
          onChanged();
        }}
      />
    );
  }

  const work = canEdit && task.can.work;
  const review = canEdit && task.can.review;
  const manage = canEdit && task.can.edit;
  const rel = relativeDeadline(task.deadline);
  const latest = task.submissions[0];

  // Trạng thái người làm được tự đổi; người giao việc đổi tự do.
  const statusChoices: TaskStatus[] = manage
    ? STATUS_ORDER.filter((s) => s !== task.status)
    : work
      ? task.status === "todo" || task.status === "revision"
        ? ["in_progress"]
        : task.status === "in_progress"
          ? ["todo"]
          : []
      : [];

  const submit = () => {
    if (!submitLink.trim() && !submitFile) {
      toast.error("Nhập link sản phẩm hoặc chọn file");
      return;
    }
    const fd = new FormData();
    if (submitLink.trim()) fd.append("link", submitLink.trim());
    if (submitNote.trim()) fd.append("note", submitNote.trim());
    if (submitFile) fd.append("file", submitFile);
    void run(() => clientApiUpload(`/media/tasks/${task.id}/submissions`, fd), "Đã nộp sản phẩm, chờ duyệt").then((ok) => {
      if (ok) {
        setSubmitLink("");
        setSubmitNote("");
        setSubmitFile(null);
      }
    });
  };

  const confirmReview = () => {
    if (!reviewing) return;
    if (reviewing.decision === "revision" && !reviewNote.trim()) {
      toast.error("Ghi lý do cần chỉnh sửa");
      return;
    }
    void run(
      () => clientApi(`/media/submissions/${reviewing.submission.id}/review`, { method: "POST", body: JSON.stringify({ decision: reviewing.decision, note: reviewNote.trim() || undefined }) }),
      reviewing.decision === "approved" ? "Đã duyệt — công việc hoàn thành" : "Đã yêu cầu chỉnh sửa",
    ).then((ok) => {
      if (ok) {
        setReviewing(null);
        setReviewNote("");
      }
    });
  };

  const remove = () => {
    if (!confirm(`Xoá ${task.code}? Toàn bộ lịch sử và sản phẩm nộp sẽ mất.`)) return;
    void run(() => clientApi(`/media/tasks/${task.id}`, { method: "DELETE" }), "Đã xoá công việc").then((ok) => ok && onClose());
  };

  return (
    <Modal maxWidth="max-w-4xl" footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}>
      {/* Header */}
      <div className={cn("-mx-4 -mt-4 mb-4 bg-gradient-to-r px-4 pt-4 pb-4 text-white sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6", STATUS_META[task.status].column)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-white/80">{task.code} · {TYPE_EMOJI[task.type]} {TYPE_LABEL[task.type] ?? task.type}</p>
            <h2 className="mt-1 text-lg font-extrabold break-words">{task.title}</h2>
          </div>
          <div className="flex shrink-0 gap-1">
            {manage && (
              <>
                <button type="button" title="Sửa" onClick={() => setEditing(true)} className="rounded-lg bg-white/20 p-2 hover:bg-white/30"><Pencil className="size-4" /></button>
                <button type="button" title="Xoá" onClick={remove} className="rounded-lg bg-white/20 p-2 hover:bg-white/30"><Trash2 className="size-4" /></button>
              </>
            )}
            <button type="button" title="Đóng" onClick={onClose} className="rounded-lg bg-white/20 p-2 hover:bg-white/30"><X className="size-4" /></button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} className="bg-white/95" />
          <PriorityBadge priority={task.priority} />
          <PlatformChip platform={task.platform} />
          {rel && (
            <Chip className={cn("bg-white/95", rel.tone === "late" ? "text-rose-600" : rel.tone === "soon" ? "text-orange-600" : "text-slate-600")}>
              <AlarmClock className="size-3" /> {fmtDeadline(task.deadline)} · {rel.text}
            </Chip>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {task.description && <p className="text-sm whitespace-pre-wrap text-slate-700">{task.description}</p>}

          {/* Tiến độ */}
          <section>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Tiến độ</span>
              <span className="font-bold text-violet-700 tabular-nums">{task.progress}%</span>
            </div>
            <ProgressBar value={task.progress} className="h-2.5" />
            {work && task.status !== "done" && (
              <div className="mt-2 flex items-center gap-3">
                <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 accent-violet-600" />
                <Button size="sm" variant="outline" disabled={busy || progress === task.progress} onClick={() => run(() => clientApi(`/media/tasks/${task.id}/progress`, { method: "PATCH", body: JSON.stringify({ progress }) }), "Đã cập nhật tiến độ")}>
                  Lưu {progress}%
                </Button>
              </div>
            )}
            {statusChoices.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {statusChoices.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => clientApi(`/media/tasks/${task.id}/status`, { method: "PATCH", body: JSON.stringify({ status: s }) }), `Đã chuyển sang ${STATUS_META[s].label}`)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
                  >
                    → {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Nộp sản phẩm */}
          {work && task.status !== "done" && (
            <section className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-3">
              <p className="mb-2 text-sm font-bold text-violet-800">📤 Nộp sản phẩm {latest ? `(phiên bản ${latest.version + 1})` : ""}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-violet-500" />
                  <Input uiSize="sm" placeholder="https://drive.google.com/..." value={submitLink} onChange={(e) => setSubmitLink(e.target.value)} />
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:border-violet-300">
                  <Paperclip className="size-4 shrink-0 text-violet-500" />
                  <span className="truncate">{submitFile ? submitFile.name : "Đính kèm file (tối đa 100MB)"}</span>
                  <input type="file" className="hidden" onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)} />
                </label>
                <Textarea rows={2} placeholder="Ghi chú cho người duyệt" value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} className="sm:col-span-2" />
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" disabled={busy} onClick={submit} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90">
                  <Send className="mr-1 inline size-3.5" />Gửi duyệt
                </Button>
              </div>
            </section>
          )}

          {/* Phiên bản */}
          <section>
            <p className="mb-2 text-sm font-semibold text-slate-700">Phiên bản đã nộp ({task.submissions.length})</p>
            {task.submissions.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa nộp sản phẩm nào.</p>
            ) : (
              <ul className="space-y-2">
                {task.submissions.map((s) => {
                  const meta = REVIEW_META[s.review_status] ?? REVIEW_META.pending;
                  return (
                    <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">v{s.version}</span>
                        <Chip className={meta.chip}>{meta.label}</Chip>
                        <span className="text-xs text-slate-500">{s.submitted_by?.name} · {fmtDeadline(s.submitted_at)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {s.link && (
                          <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100">
                            <ExternalLink className="size-3" /> Mở link
                          </a>
                        )}
                        {s.has_file && (
                          <button type="button" onClick={() => downloadSubmissionFile(s).catch((e: Error) => toast.error(e.message))} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
                            <Download className="size-3" /> {s.file_name}
                          </button>
                        )}
                      </div>
                      {s.note && <p className="mt-2 text-xs whitespace-pre-wrap text-slate-600">{s.note}</p>}
                      {s.review_note && (
                        <p className={cn("mt-2 rounded-lg px-2 py-1.5 text-xs", s.review_status === "revision" ? "bg-orange-50 text-orange-800" : "bg-emerald-50 text-emerald-800")}>
                          <b>{s.reviewed_by?.name}:</b> {s.review_note}
                        </p>
                      )}
                      {!s.review_note && s.reviewed_by && <p className="mt-1 text-[11px] text-slate-400">Duyệt bởi {s.reviewed_by.name} · {fmtDeadline(s.reviewed_at)}</p>}
                      {review && s.review_status === "pending" && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => setReviewing({ submission: s, decision: "approved" })} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90">
                            <Check className="mr-1 inline size-3.5" />Duyệt
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReviewing({ submission: s, decision: "revision" })}>
                            <Undo2 className="mr-1 inline size-3.5" />Yêu cầu chỉnh sửa
                          </Button>
                        </div>
                      )}
                      {reviewing?.submission.id === s.id && (
                        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                          <Textarea rows={2} placeholder={reviewing.decision === "revision" ? "Lý do cần chỉnh sửa *" : "Nhận xét (không bắt buộc)"} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setReviewing(null)}>Huỷ</Button>
                            <Button size="sm" disabled={busy} onClick={confirmReview}>{reviewing.decision === "approved" ? "Xác nhận duyệt" : "Gửi yêu cầu sửa"}</Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Trao đổi + lịch sử */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><MessageSquare className="size-4" /> Trao đổi & lịch sử</p>
            {canEdit && (
              <div className="mb-3 flex gap-2">
                <Input uiSize="sm" placeholder="Viết trao đổi..." value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) {
                    void run(() => clientApi(`/media/tasks/${task.id}/comments`, { method: "POST", body: JSON.stringify({ content: comment }) }), "Đã gửi").then((ok) => ok && setComment(""));
                  }
                }} />
                <Button size="sm" disabled={busy || !comment.trim()} onClick={() => run(() => clientApi(`/media/tasks/${task.id}/comments`, { method: "POST", body: JSON.stringify({ content: comment }) }), "Đã gửi").then((ok) => ok && setComment(""))}>
                  Gửi
                </Button>
              </div>
            )}
            <ol className="relative space-y-3 border-l-2 border-violet-100 pl-4">
              {task.activities.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute top-0 -left-[1.45rem] grid size-5 place-items-center rounded-full bg-white text-xs ring-2 ring-violet-100">{ACTIVITY_ICON[a.kind] ?? "•"}</span>
                  <p className="text-xs text-slate-500"><b className="text-slate-700">{a.account?.name ?? "—"}</b> · {fmtDeadline(a.created_at)}</p>
                  <p className={cn("text-sm whitespace-pre-wrap", a.kind === "comment" ? "mt-0.5 rounded-xl rounded-tl-none bg-slate-50 px-3 py-2 text-slate-800" : "text-slate-600")}>{a.content}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Cột thông tin */}
        <aside className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          <Info label="Phụ trách"><PersonChip person={task.assignee} /></Info>
          {task.editor && <Info label="Người dựng"><PersonChip person={task.editor} /></Info>}
          {(task.raw_link || task.done_link) && (
            <Info label="Video">
              <span className="flex gap-2 text-xs">
                {task.raw_link && <a href={task.raw_link} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">Video thô</a>}
                {task.done_link && <a href={task.done_link} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">Video xong</a>}
              </span>
            </Info>
          )}
          <Info label="Cùng tham gia">{task.members.length ? <AvatarStack people={task.members} max={6} /> : <span className="text-xs text-slate-400">—</span>}</Info>
          <Info label="Người giao"><PersonChip person={task.created_by} /></Info>
          <Info label="Kế hoạch">{task.plan?.title ?? "—"}</Info>
          <Info label="Chiến dịch">{task.campaign?.name ?? "—"}</Info>
          <Info label="Công ty / nhà máy">{[task.company_name, task.factory].filter(Boolean).join(" · ") || "—"}</Info>
          <Info label="Ý tưởng gốc">{task.idea?.title ?? "—"}</Info>
          <Info label="Hoàn thành lúc">{task.completed_at ? fmtDeadline(task.completed_at) : "—"}</Info>
        </aside>
      </div>
    </Modal>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <div className="mt-0.5 text-slate-700">{children}</div>
    </div>
  );
}
