"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, ExternalLink, Loader2, Undo2 } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { Chip, PersonChip, PriorityBadge, REVIEW_META, SectionTitle, StudioCard, TYPE_EMOJI, fmtDeadline, type MediaOptions, type Priority, type Submission } from "./media-shared";
import { downloadSubmissionFile } from "./media-task-detail";

type ReviewRow = Submission & { task: { id: string; code: string; title: string; type: string; deadline: string | null; priority: Priority } };

/** Hàng chờ duyệt + lịch sử duyệt (phiên bản, người duyệt, lý do). */
export function MediaReviews({ options, canEdit, onOpenTask }: { options: MediaOptions; canEdit: boolean; onOpenTask: (id: string) => void }) {
  const toast = useToast();
  const [pending, setPending] = useState<ReviewRow[] | null>(null);
  const [history, setHistory] = useState<ReviewRow[]>([]);
  const [active, setActive] = useState<{ id: string; decision: "approved" | "revision" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canReview = canEdit && options.me.can_review;

  const load = useCallback(() => {
    Promise.all([clientApi<ReviewRow[]>("/media/reviews/pending"), clientApi<ReviewRow[]>("/media/reviews/history")])
      .then(([p, h]) => {
        setPending(p);
        setHistory(h);
      })
      .catch((e: Error) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const decide = async () => {
    if (!active) return;
    if (active.decision === "revision" && !note.trim()) {
      toast.error("Ghi lý do cần chỉnh sửa");
      return;
    }
    setBusy(true);
    try {
      await clientApi(`/media/submissions/${active.id}/review`, { method: "POST", body: JSON.stringify({ decision: active.decision, note: note.trim() || undefined }) });
      toast.success(active.decision === "approved" ? "Đã duyệt ✅" : "Đã gửi yêu cầu chỉnh sửa");
      setActive(null);
      setNote("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!pending) return <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div>
        <SectionTitle title={`Chờ duyệt (${pending.length})`} hint={canReview ? undefined : "Bạn chỉ xem — chưa có quyền duyệt"} />
        {pending.length === 0 ? (
          <StudioCard className="py-12 text-center text-sm text-slate-400">Không có sản phẩm nào chờ duyệt 🎉</StudioCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((r) => (
              <StudioCard key={r.id} className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400" />
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpenTask(r.task.id)} className="min-w-0 text-left">
                    <p className="text-[11px] font-bold text-slate-400">{TYPE_EMOJI[r.task.type]} {r.task.code} · v{r.version}</p>
                    <p className="line-clamp-2 font-semibold text-slate-800 hover:text-violet-700">{r.task.title}</p>
                  </button>
                  <PriorityBadge priority={r.task.priority} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <PersonChip person={r.submitted_by} size="xs" /> · {fmtDeadline(r.submitted_at)}
                </div>
                {r.note && <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs whitespace-pre-wrap text-slate-600">{r.note}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100">
                      <ExternalLink className="size-3" /> Xem sản phẩm
                    </a>
                  )}
                  {r.has_file && (
                    <button type="button" onClick={() => downloadSubmissionFile(r).catch((e: Error) => toast.error(e.message))} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
                      <Download className="size-3" /> {r.file_name}
                    </button>
                  )}
                </div>
                {canReview && active?.id !== r.id && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => setActive({ id: r.id, decision: "approved" })} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90">
                      <Check className="mr-1 inline size-3.5" />Duyệt
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActive({ id: r.id, decision: "revision" })}>
                      <Undo2 className="mr-1 inline size-3.5" />Cần sửa
                    </Button>
                  </div>
                )}
                {active?.id === r.id && (
                  <div className="mt-3 space-y-2">
                    <Textarea rows={2} autoFocus placeholder={active.decision === "revision" ? "Lý do cần chỉnh sửa *" : "Nhận xét (không bắt buộc)"} value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setActive(null)}>Huỷ</Button>
                      <Button size="sm" disabled={busy} onClick={decide}>{active.decision === "approved" ? "Xác nhận duyệt" : "Gửi yêu cầu sửa"}</Button>
                    </div>
                  </div>
                )}
              </StudioCard>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle title="Lịch sử duyệt" />
        <StudioCard className="p-0">
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Chưa có lượt duyệt.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((h) => {
                const meta = REVIEW_META[h.review_status] ?? REVIEW_META.pending;
                return (
                  <li key={h.id}>
                    <button type="button" onClick={() => onOpenTask(h.task.id)} className="w-full px-4 py-3 text-left transition-colors hover:bg-violet-50/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{h.task.code} · v{h.version}</span>
                        <Chip className={meta.chip}>{meta.label}</Chip>
                      </div>
                      <p className="truncate text-xs text-slate-500">{h.task.title}</p>
                      <p className={cn("mt-0.5 text-[11px]", h.review_status === "revision" ? "text-orange-700" : "text-slate-400")}>
                        {h.reviewed_by?.name} · {fmtDeadline(h.reviewed_at)}
                        {h.review_note ? ` — ${h.review_note}` : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StudioCard>
      </div>
    </div>
  );
}
