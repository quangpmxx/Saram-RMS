"use client";

import { useEffect, useState } from "react";
import { MessageCircleQuestion, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { SlipDetail } from "@/components/payroll/slip-detail";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { payrollApi, type MySlip } from "@/lib/payroll-api";
import { useToast } from "@/lib/toast-context";

/**
 * Nút "Phiếu lương" ở trang Chấm công (user 2026-11-14) — bấm mở popup ngay trong trang,
 * không chuyển trang. Bình thường mờ; khi kế toán đã gửi phiếu mà mình chưa đồng ý → nền
 * đậm + chấm nhấp nháy. Không có quyền xem phiếu lương (Admin tắt ở Phân quyền) → ẩn.
 */
const isWaiting = (s: MySlip) => s.payroll_status === "sent" && s.confirm_status !== "confirmed";

export function PayslipButton() {
  const toast = useToast();
  const [slips, setSlips] = useState<MySlip[] | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    payrollApi.mySlips().then((list) => {
      setSlips(list);
      setAllowed(true);
    });

  useEffect(() => {
    load().catch(() => setAllowed(false));
  }, []);

  if (!allowed || !slips) return null;
  const waiting = slips.find(isWaiting);
  // Mở popup: ưu tiên phiếu đang chờ xác nhận, không thì phiếu mới nhất.
  const current = slips.find((s) => s.id === selectedId) ?? waiting ?? slips[0];

  async function respond(slip: MySlip, action: "confirm" | "question", question?: string) {
    setBusy(true);
    try {
      await payrollApi.respondMySlip(slip.id, action, question);
      toast.success(action === "confirm" ? "Đã xác nhận phiếu lương" : "Đã gửi thắc mắc cho kế toán");
      setAsking(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không gửi được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedId(null);
          setAsking(null);
          setOpen(true);
        }}
        title={waiting ? `Kế toán đã gửi phiếu lương tháng ${waiting.month}/${waiting.year}, bấm để kiểm tra và xác nhận` : "Xem phiếu lương"}
        className={cn(
          "relative ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
          waiting
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700"
            : "bg-white text-slate-400 opacity-60 ring-1 ring-slate-200 hover:text-slate-600 hover:opacity-100",
        )}
      >
        <Wallet className="size-3.5" />
        Phiếu lương
        {waiting && (
          <>
            <span className="rounded bg-white/20 px-1 font-medium">T{waiting.month}</span>
            <span className="absolute -top-1 -right-1 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
            </span>
          </>
        )}
      </button>

      {open && (
        <Modal
          title="Phiếu lương của tôi"
          maxWidth="max-w-xl"
          footer={
            current?.payroll_status === "sent" && asking === null ? (
              <>
                <Button variant="outline" onClick={() => setAsking(current.question ?? "")} disabled={busy}>
                  <MessageCircleQuestion className="size-4" /> Tôi có thắc mắc
                </Button>
                {current.confirm_status !== "confirmed" && (
                  <Button onClick={() => respond(current, "confirm")} disabled={busy}>
                    Đồng ý phiếu lương
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setOpen(false)}>Đóng</Button>
              </>
            ) : asking !== null && current ? (
              <>
                <Button variant="outline" onClick={() => setAsking(null)}>Huỷ</Button>
                <Button disabled={busy || !asking.trim()} onClick={() => respond(current, "question", asking)}>Gửi kế toán</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            )
          }
        >
          {!current ? (
            <p className="py-16 text-center text-sm text-slate-400">Chưa có phiếu lương nào. Khi kế toán gửi, phiếu lương sẽ hiện ở đây.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Chọn tháng khi có nhiều phiếu. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {slips.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id);
                      setAsking(null);
                    }}
                    className={cn(
                      "relative rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      s.id === current.id ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    Tháng {s.month}/{s.year}
                    {isWaiting(s) && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-white" />}
                  </button>
                ))}
                <div className="grow" />
                {current.payroll_status === "completed" ? <Badge variant="success">Đã chi lương</Badge>
                  : current.confirm_status === "confirmed" ? <Badge variant="success">Bạn đã đồng ý</Badge>
                  : current.confirm_status === "question" ? <Badge variant="warning">Đang chờ kế toán trả lời</Badge>
                  : <Badge variant="info">Chờ bạn xác nhận</Badge>}
              </div>

              <SlipDetail slip={current} year={current.year} month={current.month} compact />

              {current.confirm_status === "question" && current.question && asking === null && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Bạn đã thắc mắc: {current.question}</p>
              )}
              {asking !== null && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Thắc mắc gửi kế toán</div>
                  <Textarea rows={3} maxLength={1000} autoFocus placeholder="Ghi rõ khoản nào chưa đúng…" value={asking} onChange={(e) => setAsking(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
