"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Blocks,
  ChevronRight,
  Database,
  Handshake,
  MessageCircleQuestion,
  Send,
  Sheet,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { BarList, ColumnChart, SegmentedBar } from "@/components/payroll/charts";
import { SlipDetail } from "@/components/payroll/slip-detail";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast-context";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import {
  NATURE_LABEL,
  PAYROLL_STATUS_LABEL,
  formatMoney,
  isIncome,
  payrollApi,
  type MySlip,
  type PayrollAccountSetting,
  type PayrollReportRow,
} from "@/lib/payroll-api";

/** Tiền lương (2026-11-13): mục "Tổng quan" (Báo cáo + Quy trình nghiệp vụ) và mục "Báo cáo". */

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap";
const tdClass = "border-b border-slate-100 px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap";
const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03]";

function useReport() {
  const toast = useToast();
  const [rows, setRows] = useState<PayrollReportRow[] | null>(null);
  useEffect(() => {
    payrollApi.reportOverview().then(setRows).catch((e) => toast.error(errText(e, "Không tải được báo cáo")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return rows;
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn(cardClass, className)}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ── Tổng quan ─────────────────────────────────────────────────────────────────

/** Nút tạo / xoá dữ liệu demo — chỉ hiện trên máy dev (backend báo available). */
function DemoButtons({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    payrollApi.demoAvailable().then((r) => setAvailable(r.available)).catch(() => {});
  }, []);
  if (!available) return null;

  async function run(action: () => Promise<unknown>, done: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await action();
      toast.success(done);
      onDone();
    } catch (e) {
      toast.error(errText(e, "Không thực hiện được"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 ml-auto flex items-center gap-2">
      <span className="text-[11px] text-slate-400">Máy dev:</span>
      <Button size="xs" variant="outline" disabled={busy} onClick={() => run(payrollApi.seedDemo, "Đã tạo dữ liệu demo 6 tháng", "Tạo dữ liệu demo: mức lương cho người chưa có, mức hoa hồng cho công ty chưa có, và bảng lương 6 tháng gần nhất (tháng nào đã có thì bỏ qua)?")}>
        Tạo dữ liệu demo
      </Button>
      <Button size="xs" variant="danger" disabled={busy} onClick={() => run(payrollApi.clearDemo, "Đã xoá dữ liệu tiền lương", "Xoá TOÀN BỘ bảng lương, mức lương nhân viên và mức hoa hồng công ty? (Giữ thành phần lương và mẫu)")}>
        Xoá hết
      </Button>
    </div>
  );
}

export function OverviewPanel({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const [view, setView] = useState<"report" | "flow">("report");
  const [version, setVersion] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-5 border-b border-slate-200">
        {(
          [
            ["report", "Báo cáo"],
            ["flow", "Quy trình nghiệp vụ"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn("-mb-px border-b-2 pb-2 text-sm font-medium transition-colors", view === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {label}
          </button>
        ))}
        <DemoButtons onDone={() => setVersion((v) => v + 1)} />
      </div>
      {view === "report" ? <OverviewReport key={version} onGoTab={onGoTab} /> : <ProcessFlow onGoTab={onGoTab} />}
    </div>
  );
}

const BANDS: [string, number, number][] = [
  ["Từ 30 triệu", 30e6, Infinity],
  ["20 – dưới 30 triệu", 20e6, 30e6],
  ["10 – dưới 20 triệu", 10e6, 20e6],
  ["Dưới 10 triệu", -Infinity, 10e6],
];

function OverviewReport({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const rows = useReport();
  if (!rows) return <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p>;
  const latest = rows[0];
  if (!latest) {
    return (
      <div className={cn(cardClass, "flex flex-col items-center gap-3 py-12 text-center")}>
        <Sheet className="size-10 text-slate-300" />
        <p className="text-sm text-slate-500">Chưa có bảng lương nào. Xem “Quy trình nghiệp vụ” để bắt đầu, hoặc lập bảng lương đầu tiên.</p>
        <Button size="sm" onClick={() => onGoTab("payroll")}>Lập bảng lương</Button>
      </div>
    );
  }
  const period = `tháng ${latest.month}/${latest.year}`;
  const income = latest.by_component.filter((c) => isIncome(c.nature));
  const sum = (nature: string) => latest.by_component.filter((c) => (nature === "income" ? isIncome(c.nature) : c.nature === nature)).reduce((t, c) => t + c.total, 0);
  const months = rows.slice(0, 12).reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <section className={cn(cardClass, "bg-gradient-to-br from-brand-50 to-white")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Tổng hợp lương</h3>
              <p className="text-xs text-slate-500">Bảng lương {period} · {latest.slip_count} người</p>
            </div>
            <Badge variant={latest.status === "completed" ? "success" : latest.status === "draft" ? "neutral" : "info"}>{PAYROLL_STATUS_LABEL[latest.status]}</Badge>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {(
              [
                ["Tổng thực lĩnh", latest.total_net_pay],
                ["Tổng thu nhập", sum("income")],
                ["Tổng khấu trừ", sum("deduction")],
              ] as const
            ).map(([label, value], i) => (
              <div key={label}>
                <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</div>
                <div className={cn("mt-1 font-bold text-slate-900 tabular-nums", i === 0 ? "text-3xl" : "text-2xl")}>
                  {formatMoney(value)} <span className="text-sm font-normal text-slate-400">đ</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Phản hồi phiếu lương</h3>
            <span className="text-xs text-slate-500">{latest.confirmed_count}/{latest.slip_count} đồng ý</span>
          </div>
          {latest.questions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <MessageCircleQuestion className="size-8 text-slate-300" />
              <p className="text-xs text-slate-400">Không có thắc mắc nào</p>
            </div>
          ) : (
            <ul className="mt-3 flex max-h-40 flex-col gap-2 overflow-y-auto">
              {latest.questions.map((q) => (
                <li key={q.full_name} className="rounded-lg bg-amber-50 p-2 text-xs">
                  <div className="font-semibold text-amber-900">{q.full_name}</div>
                  <div className="text-amber-800">{q.question}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Phân tích mức lương nhân viên" subtitle={`Số người theo mức thực lĩnh · ${period}`}>
          <BarList unit=" người" rows={BANDS.map(([label, min, max]) => ({ label, value: latest.net_pays.filter((n) => n >= min && n < max).length }))} />
        </ChartCard>
        <ChartCard title="Cơ cấu thu nhập" subtitle={`Các khoản thu nhập · ${period}`}>
          <SegmentedBar parts={income.map((c) => ({ label: c.name, value: c.total }))} />
        </ChartCard>
        <ChartCard title="Chi lương theo thời gian" subtitle="Tổng thực lĩnh từng tháng (đồng)">
          <ColumnChart points={months.map((r) => ({ label: `T${r.month}/${String(r.year).slice(2)}`, value: r.total_net_pay }))} />
        </ChartCard>
        <ChartCard title="Lương theo vị trí" subtitle={`Tổng thực lĩnh · ${period}`}>
          <BarList
            format={formatMoney}
            rows={latest.by_role.map((r) => ({ label: ACCOUNT_ROLE_LABEL[r.role] ?? r.role, value: r.total, hint: `${r.count} người` }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function FlowNode({ icon: Icon, title, text, onClick }: { icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-36 shrink-0 flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-brand-50">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 transition-shadow group-hover:shadow-md group-hover:ring-brand-300">
        <Icon className="size-7" strokeWidth={1.6} />
      </span>
      <span className="text-sm font-semibold text-slate-800">{title}</span>
      <span className="text-[11px] leading-snug text-slate-500">{text}</span>
    </button>
  );
}
const FlowArrow = () => <ArrowRight className="mt-6 size-5 shrink-0 text-slate-300" />;

function ProcessFlow({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const sources: [string, string][] = [
    ["Chấm công", "data-attendance"],
    ["Doanh số", "data-sales"],
    ["Hoa hồng công ty", "commission"],
    ["Thu nhập khác", "payroll"],
    ["Khấu trừ khác", "payroll"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className={cn(cardClass, "overflow-x-auto")}>
        <div className="flex min-w-max items-start justify-center gap-3 py-6">
          <FlowNode icon={Blocks} title="Thành phần lương" text="Khai báo các khoản và công thức" onClick={() => onGoTab("components")} />
          <FlowArrow />
          <FlowNode icon={Sheet} title="Mẫu bảng lương" text="Cách tính cho từng vị trí" onClick={() => onGoTab("templates")} />
          <FlowArrow />
          <div className="w-52 shrink-0 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Database className="size-5 text-brand-700" strokeWidth={1.6} />
              Dữ liệu tính lương
            </div>
            <ul className="mt-2 flex flex-col">
              {sources.map(([label, tab]) => (
                <li key={label}>
                  <button type="button" onClick={() => onGoTab(tab)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-slate-600 hover:bg-white hover:text-brand-700">
                    <span className="size-1.5 rounded-full ring-1 ring-brand-500" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <FlowArrow />
          <FlowNode icon={BarChart3} title="Lập bảng lương" text="Tính, nhập thêm rồi chốt" onClick={() => onGoTab("payroll")} />
          <FlowArrow />
          <FlowNode icon={Send} title="Xác nhận lương" text="Gửi phiếu, nhân viên đồng ý hoặc thắc mắc" onClick={() => onGoTab("payroll")} />
          <FlowArrow />
          <FlowNode icon={Banknote} title="Chi trả" text="Tải Excel đi lệnh ngân hàng, bấm Hoàn thành" onClick={() => onGoTab("payout")} />
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            [Users, "Thiết lập mức lương nhân viên", "accounts"],
            [Handshake, "Thiết lập hoa hồng công ty", "commission"],
            [BarChart3, "Xem báo cáo lương", "reports"],
          ] as const
        ).map(([Icon, label, tab]) => (
          <button key={label} type="button" onClick={() => onGoTab(tab)} className={cn(cardClass, "flex items-center gap-3 p-4 text-left text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700")}>
            <Icon className="size-5 text-brand-600" strokeWidth={1.6} />
            {label}
            <ChevronRight className="ml-auto size-4 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Báo cáo ───────────────────────────────────────────────────────────────────

const REPORTS = [
  { key: "months", label: "Thống kê lương theo thời gian", hint: "Tổng thực lĩnh, số người, bình quân từng tháng" },
  { key: "components", label: "Phân tích cơ cấu thu nhập", hint: "Tổng từng khoản thu nhập, khấu trừ của một bảng lương" },
  { key: "roles", label: "Tổng hợp chi phí lương theo vị trí", hint: "Số người, tổng và bình quân theo vị trí" },
  { key: "payout", label: "Tổng hợp chi trả lương", hint: "Trạng thái chi trả và xác nhận của từng bảng lương" },
  { key: "history", label: "Lịch sử lương của nhân viên", hint: "Phiếu lương qua các tháng của một người" },
] as const;
type ReportKey = (typeof REPORTS)[number]["key"];
const STAR_KEY = "payroll-report-stars";

export function ReportsPanel() {
  const toast = useToast();
  const rows = useReport();
  const [report, setReport] = useState<ReportKey | null>(null);
  // Mục Báo cáo chỉ mở sau khi bấm menu (không render phía server) nên đọc localStorage ngay lúc khởi tạo được.
  const [stars, setStars] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(STAR_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [payrollId, setPayrollId] = useState("");
  const [accounts, setAccounts] = useState<PayrollAccountSetting[]>([]);
  const [accountId, setAccountId] = useState("");
  const [history, setHistory] = useState<MySlip[] | null>(null);

  function toggleStar(key: string) {
    const next = stars.includes(key) ? stars.filter((s) => s !== key) : [...stars, key];
    setStars(next);
    try {
      localStorage.setItem(STAR_KEY, JSON.stringify(next));
    } catch {
      // Trình duyệt chặn lưu thì chỉ giữ trong phiên này.
    }
  }

  useEffect(() => {
    if (report === "history" && accounts.length === 0) {
      payrollApi.accountSettings().then(setAccounts).catch(() => {});
    }
  }, [report, accounts.length]);

  useEffect(() => {
    if (!accountId) return;
    let stale = false;
    payrollApi
      .reportAccountHistory(accountId)
      .then((h) => !stale && setHistory(h))
      .catch((e) => toast.error(errText(e, "Không tải được lịch sử lương")));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  if (!report) {
    const sorted = [...REPORTS].sort((a, b) => Number(stars.includes(b.key)) - Number(stars.includes(a.key)));
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <div className={cn(thClass, "pl-12")}>Tên báo cáo</div>
        {sorted.map((r) => (
          <div key={r.key} className="flex items-center border-b border-slate-100 last:border-0 hover:bg-brand-50/50">
            <button type="button" title={stars.includes(r.key) ? "Bỏ đánh dấu" : "Đánh dấu hay dùng"} onClick={() => toggleStar(r.key)} className="p-3">
              <Star className={cn("size-4", stars.includes(r.key) ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-slate-500")} />
            </button>
            <button type="button" onClick={() => setReport(r.key)} className="flex grow items-center gap-3 py-3 pr-4 text-left">
              <span className="text-sm font-medium text-slate-800">{r.label}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">{r.hint}</span>
              <ChevronRight className="ml-auto size-4 text-slate-300" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  const meta = REPORTS.find((r) => r.key === report)!;
  const selected = rows?.find((r) => r.id === payrollId) ?? rows?.[0];
  const needsPeriod = report === "components" || report === "roles";
  const empty = <p className="py-10 text-center text-sm text-slate-400">Chưa có bảng lương nào.</p>;
  const tableWrap = "overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button size="sm" variant="ghost" onClick={() => setReport(null)}>‹ Tất cả báo cáo</Button>
        <h2 className="grow pb-1 text-base font-semibold text-slate-900">{meta.label}</h2>
        {needsPeriod && rows && rows.length > 0 && (
          <Field label="Bảng lương" uiSize="sm" hideLabel className="w-40">
            <Select uiSize="sm" value={selected?.id ?? ""} onChange={(e) => setPayrollId(e.target.value)}>
              {rows.map((r) => <option key={r.id} value={r.id}>Tháng {r.month}/{r.year}</option>)}
            </Select>
          </Field>
        )}
        {report === "history" && (
          <Field label="Nhân viên" uiSize="sm" hideLabel className="w-64">
            <Select
              uiSize="sm"
              value={accountId}
              onChange={(e) => {
                setHistory(null);
                setAccountId(e.target.value);
              }}
            >
              <option value="">— Chọn nhân viên —</option>
              {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.full_name}</option>)}
            </Select>
          </Field>
        )}
      </div>

      {!rows ? <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p> : null}

      {rows && (report === "months" || report === "payout") && (rows.length === 0 ? empty : (
        <>
          {report === "months" && (
            <ChartCard title="Tổng thực lĩnh từng tháng" subtitle="Đơn vị: đồng">
              <ColumnChart points={rows.slice(0, 12).reverse().map((r) => ({ label: `T${r.month}/${String(r.year).slice(2)}`, value: r.total_net_pay }))} />
            </ChartCard>
          )}
          <div className={tableWrap}>
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className={thClass}>Tháng</th>
                  <th className={thClass}>Trạng thái</th>
                  <th className={`${thClass} text-right`}>Số người</th>
                  <th className={`${thClass} text-right`}>Tổng thực lĩnh</th>
                  <th className={`${thClass} text-right`}>{report === "months" ? "Bình quân / người" : "Đã đồng ý"}</th>
                  {report === "payout" && <th className={`${thClass} text-right`}>Thắc mắc</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={`${tdClass} font-medium text-slate-900`}>Tháng {r.month}/{r.year}</td>
                    <td className={tdClass}>
                      <Badge variant={r.status === "completed" ? "success" : r.status === "draft" ? "neutral" : "info"}>{PAYROLL_STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.slip_count}</td>
                    <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatMoney(r.total_net_pay)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {report === "months" ? (r.slip_count ? formatMoney(r.total_net_pay / r.slip_count) : "—") : `${r.confirmed_count}/${r.slip_count}`}
                    </td>
                    {report === "payout" && <td className={`${tdClass} text-right tabular-nums`}>{r.question_count}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ))}

      {rows && report === "components" && (!selected ? empty : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Cơ cấu thu nhập" subtitle={`Tháng ${selected.month}/${selected.year}`}>
            <SegmentedBar parts={selected.by_component.filter((c) => isIncome(c.nature)).map((c) => ({ label: c.name, value: c.total }))} />
          </ChartCard>
          <div className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={thClass}>Khoản</th>
                  <th className={thClass}>Tính chất</th>
                  <th className={`${thClass} text-right`}>Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {selected.by_component.map((c) => (
                  <tr key={c.code}>
                    <td className={tdClass}>{c.name}</td>
                    <td className={tdClass}>{NATURE_LABEL[c.nature]}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(c.total)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className={tdClass} colSpan={2}>Tổng thực lĩnh</td>
                  <td className={`${tdClass} text-right text-emerald-700 tabular-nums`}>{formatMoney(selected.total_net_pay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {rows && report === "roles" && (!selected ? empty : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Tổng thực lĩnh theo vị trí" subtitle={`Tháng ${selected.month}/${selected.year}`}>
            <BarList format={formatMoney} rows={selected.by_role.map((r) => ({ label: ACCOUNT_ROLE_LABEL[r.role] ?? r.role, value: r.total, hint: `${r.count} người` }))} />
          </ChartCard>
          <div className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={thClass}>Vị trí</th>
                  <th className={`${thClass} text-right`}>Số người</th>
                  <th className={`${thClass} text-right`}>Tổng thực lĩnh</th>
                  <th className={`${thClass} text-right`}>Bình quân</th>
                </tr>
              </thead>
              <tbody>
                {selected.by_role.map((r) => (
                  <tr key={r.role}>
                    <td className={tdClass}>{ACCOUNT_ROLE_LABEL[r.role] ?? r.role}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.count}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(r.total)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(r.total / r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {report === "history" && (
        !accountId ? <p className="py-10 text-center text-sm text-slate-400">Chọn nhân viên để xem lịch sử lương.</p>
        : history === null ? <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p>
        : history.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">Người này chưa có phiếu lương nào.</p>
        : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            {history.map((slip) => (
              <div key={slip.id} className={cardClass}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Tháng {slip.month}/{slip.year}</h3>
                  <Badge>{PAYROLL_STATUS_LABEL[slip.payroll_status]}</Badge>
                </div>
                <SlipDetail slip={slip} year={slip.year} month={slip.month} compact />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
