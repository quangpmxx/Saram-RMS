"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Calculator, Loader2, Send } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { OFFICE_LABEL, type AttendanceStatus, type Office } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";

/** Bảng công tháng gửi nhân viên xác nhận (2026-11-14). API: backend attendance-sheet.controller.ts. */

type SheetStatus = "pending" | "confirmed" | "disputed";

interface SheetSummary {
  standard: number;
  worked: number;
  paid_leave: number;
  unpaid_leave: number;
  holiday: number;
  compensatory_leave: number;
  paid_total: number;
}

interface DisputedDay {
  date: string;
  expected: AttendanceStatus | null;
}

interface MySheetResponse {
  months: { year: number; month: number; status: SheetStatus }[];
  sheet: {
    year: number;
    month: number;
    full_name: string;
    office: Office | null;
    remaining_leave_days: number | null;
    status: SheetStatus;
    sent_at: string;
    responded_at: string | null;
    note: string | null;
    disputed_days: DisputedDay[];
    days_in_month: number;
    records: { date: string; status: AttendanceStatus; note: string | null }[];
    summary: SheetSummary;
  } | null;
}

interface ManagerRow {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  office: Office | null;
  team_name: string | null;
  summary: SheetSummary;
  sheet: {
    status: SheetStatus;
    sent_at: string;
    responded_at: string | null;
    note: string | null;
    disputed_days: DisputedDay[];
    edited_after_send: boolean;
  } | null;
}

interface ManagerResponse {
  year: number;
  month: number;
  rows: ManagerRow[];
  counts: { total: number; unsent: number; pending: number; confirmed: number; disputed: number };
}

const STATUS_META: Record<AttendanceStatus, { symbol: string; label: string; cls: string }> = {
  present: { symbol: "✓", label: "1 công", cls: "bg-emerald-50 text-emerald-700" },
  half: { symbol: "½", label: "Nửa công", cls: "bg-amber-50 text-amber-700" },
  paid_leave: { symbol: "NP", label: "Nghỉ phép", cls: "bg-sky-50 text-sky-700" },
  unpaid_leave: { symbol: "N", label: "Nghỉ không phép", cls: "bg-red-50 text-red-700" },
  holiday: { symbol: "L", label: "Nghỉ lễ", cls: "bg-purple-50 text-purple-700" },
  compensatory_leave: { symbol: "B", label: "Nghỉ bù", cls: "bg-indigo-50 text-indigo-700" },
};
const STATUS_ORDER = Object.keys(STATUS_META) as AttendanceStatus[];

const SHEET_PILL: Record<SheetStatus | "unsent", { label: string; cls: string }> = {
  unsent: { label: "Chưa gửi", cls: "bg-slate-100 text-slate-600" },
  pending: { label: "Chờ xác nhận", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Đã đồng ý", cls: "bg-emerald-100 text-emerald-800" },
  disputed: { label: "Báo sai", cls: "bg-orange-100 text-orange-800" },
};

function num(n: number): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function dm(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : "Có lỗi, thử lại sau";
}

function Pill({ status }: { status: SheetStatus | "unsent" }) {
  const p = SHEET_PILL[status];
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", p.cls)}>{p.label}</span>;
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-xl border p-3", strong ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white")}>
      <span className={cn("text-xs", strong ? "text-white/80" : "text-slate-500")}>{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

// ================================================================ Nhân viên

export function MyAttendanceSheet() {
  const toast = useToast();
  const [data, setData] = useState<MySheetResponse | null>(null);
  const [reporting, setReporting] = useState(false);
  const [flags, setFlags] = useState<Record<string, AttendanceStatus | "">>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (year?: number, month?: number) => {
      const qs = year && month ? `?year=${year}&month=${month}` : "";
      clientApi<MySheetResponse>(`/attendance/my-sheet${qs}`)
        .then((res) => {
          setData(res);
          setReporting(false);
          setFlags({});
          setNote("");
        })
        .catch((e) => toast.error(errMsg(e)));
    },
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  const sheet = data?.sheet ?? null;
  const byDate = useMemo(() => new Map((sheet?.records ?? []).map((r) => [r.date, r])), [sheet]);
  const disputedSet = useMemo(() => new Set((sheet?.disputed_days ?? []).map((d) => d.date)), [sheet]);

  if (!data) return <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p>;
  if (!sheet) {
    return <Card className="p-8 text-center text-sm text-slate-500">Chưa có bảng công nào được gửi cho bạn.</Card>;
  }

  const { year, month } = sheet;
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Thứ 2 = 0
  const cells: ({ date: string; day: number; sunday: boolean } | null)[] = Array.from({ length: firstDow }, () => null);
  for (let d = 1; d <= sheet.days_in_month; d += 1) {
    cells.push({ date: `${prefix}${String(d).padStart(2, "0")}`, day: d, sunday: (firstDow + d - 1) % 7 === 6 });
  }
  const canRespond = sheet.status !== "confirmed";
  const flagged = Object.keys(flags).sort();

  async function respond(action: "confirm" | "dispute") {
    if (!sheet) return;
    setBusy(true);
    try {
      await clientApi("/attendance/my-sheet/respond", {
        method: "POST",
        body: JSON.stringify({
          year: sheet.year,
          month: sheet.month,
          action,
          ...(action === "dispute"
            ? { note, days: flagged.map((date) => ({ date, expected: flags[date] || null })) }
            : {}),
        }),
      });
      toast.success(action === "confirm" ? "Đã đồng ý bảng công" : "Đã gửi báo sai");
      load(sheet.year, sheet.month);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bảng công tháng {month}/{year}</h2>
          <p className="text-sm text-slate-500">
            {sheet.full_name}
            {sheet.office ? ` · ${OFFICE_LABEL[sheet.office]}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill status={sheet.status} />
          {data.months.length > 1 && (
            <Select
              uiSize="sm"
              aria-label="Chọn tháng"
              value={`${year}-${month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                load(y, m);
              }}
            >
              {data.months.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  Tháng {m.month}/{m.year}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        <Stat label="Công chuẩn" value={num(sheet.summary.standard)} />
        <Stat label="Đi làm" value={num(sheet.summary.worked)} />
        <Stat label="Nghỉ phép" value={num(sheet.summary.paid_leave)} />
        <Stat label="Nghỉ không phép" value={num(sheet.summary.unpaid_leave)} />
        <Stat label="Công hưởng lương" value={num(sheet.summary.paid_total)} strong />
        {sheet.remaining_leave_days !== null && <Stat label="Phép còn lại" value={num(sheet.remaining_leave_days)} />}
      </div>

      <Card className="flex flex-col gap-3 p-3">
        {reporting && <div className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">Bấm vào ngày bị sai</div>}
        <div className="grid grid-cols-7 gap-1.5">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => (
            <div key={w} className="py-1 text-center text-xs font-semibold text-slate-500">
              {w}
            </div>
          ))}
          {cells.map((c, i) => {
            if (!c) return <div key={`b${i}`} />;
            const rec = byDate.get(c.date);
            const meta = rec ? STATUS_META[rec.status] : null;
            const isFlag = c.date in flags;
            const wasDisputed = !reporting && disputedSet.has(c.date);
            return (
              <button
                key={c.date}
                type="button"
                disabled={!reporting}
                title={rec?.note ?? undefined}
                aria-label={`Ngày ${c.day}: ${meta?.label ?? (c.sunday ? "Chủ nhật" : "Chưa chấm")}`}
                onClick={() =>
                  setFlags((prev) => {
                    const next = { ...prev };
                    if (c.date in next) delete next[c.date];
                    else next[c.date] = "";
                    return next;
                  })
                }
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-transparent p-1",
                  meta ? meta.cls : c.sunday ? "bg-slate-50 text-slate-400" : "bg-white text-slate-300",
                  reporting && "cursor-pointer hover:border-orange-300",
                  (isFlag || wasDisputed) && "border-orange-500",
                )}
              >
                <span className="text-[11px] text-slate-500">{c.day}</span>
                <span className="text-sm font-bold">{meta?.symbol ?? (c.sunday ? "CN" : "–")}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          {STATUS_ORDER.map((s) => (
            <span key={s}>
              <b>{STATUS_META[s].symbol}</b> {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </Card>

      {reporting && (
        <Card className="flex flex-col gap-3 border-orange-300 p-3">
          <div className="font-semibold text-slate-900">Ngày cần sửa ({flagged.length})</div>
          {flagged.map((date) => {
            const rec = byDate.get(date);
            return (
              <div key={date} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-sm">
                <span className="w-14 font-semibold">{dm(date)}</span>
                <span className="text-slate-500">
                  Đang chấm: <b>{rec ? STATUS_META[rec.status].symbol : "trống"}</b>
                </span>
                <label className="flex items-center gap-2 text-slate-500">
                  Đúng ra là
                  <Select
                    uiSize="sm"
                    value={flags[date]}
                    onChange={(e) => setFlags((prev) => ({ ...prev, [date]: e.target.value as AttendanceStatus | "" }))}
                  >
                    <option value="">Chọn</option>
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].symbol} {STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            );
          })}
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Ghi chú cho quản lý
            <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="md" onClick={() => { setReporting(false); setFlags({}); }}>
              Huỷ
            </Button>
            <Button variant="primary" size="md" disabled={busy || flagged.length === 0} onClick={() => void respond("dispute")}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Gửi báo sai
            </Button>
          </div>
        </Card>
      )}

      {sheet.status === "disputed" && !reporting && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Bạn đã báo sai {sheet.disputed_days.length} ngày
          {sheet.disputed_days.length > 0 && `: ${sheet.disputed_days.map((d) => dm(d.date)).join(", ")}`}. Quản lý sửa xong sẽ gửi lại để bạn xác nhận.
        </div>
      )}
      {sheet.status === "confirmed" && sheet.responded_at && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Bạn đã đồng ý bảng công lúc {new Date(sheet.responded_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}.
        </div>
      )}

      {canRespond && !reporting && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="md" onClick={() => setReporting(true)}>
            Báo sai sót
          </Button>
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void respond("confirm")}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Đồng ý bảng công
          </Button>
        </div>
      )}
    </div>
  );
}

// ================================================================ Quản lý

function defaultMonth(): { year: number; month: number } {
  // Trước ngày 20: thường đang gửi bảng công tháng trước.
  const now = new Date();
  if (now.getDate() >= 20) return { year: now.getFullYear(), month: now.getMonth() + 1 };
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
}

export function AttendanceSheetManager({ office }: { office?: Office }) {
  const toast = useToast();
  const [{ year, month }, setPeriod] = useState(defaultMonth);
  const [data, setData] = useState<ManagerResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = `year=${year}&month=${month}${office ? `&office=${office}` : ""}`;
  const load = useCallback(() => {
    clientApi<ManagerResponse>(`/attendance/sheets?${query}`)
      .then(setData)
      .catch((e) => toast.error(errMsg(e)));
  }, [query, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(key: string, path: string, body: Record<string, unknown>, ok: (res: Record<string, number>) => string) {
    setBusy(key);
    try {
      const res = await clientApi<Record<string, number>>(path, {
        method: "POST",
        body: JSON.stringify({ year, month, ...(office ? { office } : {}), ...body }),
      });
      toast.success(ok(res));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const counts = data?.counts;
  const thisYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          uiSize="sm"
          aria-label="Tháng"
          value={month}
          onChange={(e) => setPeriod({ year, month: Number(e.target.value) })}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Tháng {i + 1}
            </option>
          ))}
        </Select>
        <Select uiSize="sm" aria-label="Năm" value={year} onChange={(e) => setPeriod({ year: Number(e.target.value), month })}>
          {[thisYear - 1, thisYear].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!counts?.unsent || !!busy}
            onClick={() => void post("send", "/attendance/sheets/send", {}, (r) => `Đã gửi bảng công cho ${r.sent} người`)}
          >
            {busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Gửi bảng công{counts?.unsent ? ` (${counts.unsent} người)` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!counts?.pending || !!busy}
            onClick={() => void post("remind", "/attendance/sheets/remind", {}, (r) => `Đã nhắc ${r.reminded} người`)}
          >
            <Bell className="h-3.5 w-3.5" />
            Nhắc người chưa xác nhận
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!counts?.total || !!busy}
            onClick={() => {
              const left = (counts?.total ?? 0) - (counts?.confirmed ?? 0);
              if (left > 0 && !window.confirm(`Còn ${left} người chưa đồng ý. Vẫn báo kế toán chốt lương?`)) return;
              void post("acc", "/attendance/sheets/notify-accounting", {}, () => "Đã báo kế toán");
            }}
          >
            <Calculator className="h-3.5 w-3.5" />
            Báo kế toán chốt lương
          </Button>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Đã đồng ý" value={`${counts.confirmed} / ${counts.total}`} />
          <Stat label="Báo sai" value={String(counts.disputed)} />
          <Stat label="Chờ xác nhận" value={String(counts.pending)} />
          <Stat label="Chưa gửi" value={String(counts.unsent)} />
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        {!data ? (
          <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p>
        ) : data.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Không có nhân viên nào.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-semibold">Nhân viên</th>
                <th className="px-3 py-2 font-semibold">Công hưởng lương</th>
                <th className="px-3 py-2 font-semibold">Trạng thái</th>
                <th className="px-3 py-2 font-semibold">Nhân viên báo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const s = r.sheet;
                const needResend = !!s && (s.status === "disputed" || s.edited_after_send);
                return (
                  <tr key={r.account_id} className={cn("border-b border-slate-100", s?.status === "disputed" && "bg-orange-50/50")}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar fullName={r.full_name} avatarUrl={r.avatar_url} className="h-7 w-7" />
                        <div>
                          <div className="font-medium text-slate-900">{r.full_name}</div>
                          {r.team_name && <div className="text-xs text-slate-500">{r.team_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {num(r.summary.paid_total)} / {num(r.summary.standard)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <Pill status={s?.status ?? "unsent"} />
                        {s?.edited_after_send && <span className="text-xs text-amber-700">Công đã sửa sau khi gửi</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {s?.status === "disputed" ? (
                        <div className="flex flex-col gap-0.5">
                          {s.disputed_days.length > 0 && (
                            <span>
                              {s.disputed_days
                                .map((d) => `${dm(d.date)}${d.expected ? ` → ${STATUS_META[d.expected].symbol}` : ""}`)
                                .join(", ")}
                            </span>
                          )}
                          {s.note && <span className="text-slate-500">{s.note}</span>}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(!s || needResend) && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={!!busy}
                          onClick={() =>
                            void post(r.account_id, "/attendance/sheets/send", { account_ids: [r.account_id] }, () =>
                              s ? `Đã gửi lại cho ${r.full_name}` : `Đã gửi cho ${r.full_name}`,
                            )
                          }
                        >
                          {busy === r.account_id && <Loader2 className="h-3 w-3 animate-spin" />}
                          {s ? "Gửi lại" : "Gửi"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
