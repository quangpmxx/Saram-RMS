"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Input } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { PLATFORM_META, PersonChip, SectionTitle, StudioCard, fmtCompact, fmtNumber, ymd, type MediaOptions, type Person } from "./media-shared";
import { METRICS, type MetricKey } from "./media-calendar";

type Totals = Record<MetricKey, number> & { posts: number; published: number };
interface ReportData {
  scope: "all" | "mine";
  total: Totals;
  by_publisher: (Totals & { person: Person })[];
  by_campaign: (Totals & { id: string | null; name: string })[];
  by_factory: (Totals & { company_id: string | null; company_name: string | null; factory: string | null })[];
  by_platform: (Totals & { platform: string })[];
  output_by_staff: { person: Person; done: number; video: number; post: number; livestream: number; other: number }[];
}

const FUNNEL: { key: MetricKey; label: string; grad: string }[] = [
  { key: "views", label: "Lượt xem", grad: "from-violet-500 to-indigo-500" },
  { key: "inbox", label: "Inbox", grad: "from-sky-400 to-blue-600" },
  { key: "candidates", label: "Ứng viên", grad: "from-fuchsia-500 to-pink-500" },
  { key: "interviews", label: "Phỏng vấn", grad: "from-orange-400 to-rose-500" },
  { key: "hired", label: "Nhận việc", grad: "from-emerald-400 to-teal-500" },
];

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.01 ? 2 : 1)}%` : "—");

/** Báo cáo hiệu quả: phễu lượt xem → nhận việc, theo nhân viên / chiến dịch / nhà máy / nền tảng. */
export function MediaReport({ options }: { options: MediaOptions }) {
  const toast = useToast();
  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    clientApi<ReportData>(`/media/report?from=${from}&to=${to}`).then(setData).catch((e: Error) => toast.error(e.message));
  }, [from, to, toast]);

  return (
    <div className="space-y-4">
      <StudioCard className="flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="font-semibold text-slate-600">Ngày đăng từ</span>
        <Input uiSize="sm" type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="font-semibold text-slate-600">đến</span>
        <Input uiSize="sm" type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        {!options.me.can_view_report && <span className="ml-auto text-xs text-slate-500">Bạn đang xem số liệu bài mình đăng.</span>}
      </StudioCard>

      {!data ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>
      ) : (
        <>
          {/* Phễu */}
          <StudioCard>
            <SectionTitle title="Phễu tuyển dụng từ nội dung" hint={`${data.total.posts} bài trong kỳ · ${data.total.published} đã đăng`} />
            <div className="grid gap-2 sm:grid-cols-5">
              {FUNNEL.map((f, i) => {
                const value = data.total[f.key];
                const prev = i > 0 ? data.total[FUNNEL[i - 1].key] : null;
                return (
                  <div key={f.key} className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md", f.grad)} style={{ marginTop: `${i * 6}px` }}>
                    <p className="text-xs font-medium text-white/85">{f.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums" title={fmtNumber(value)}>{fmtCompact(value)}</p>
                    {prev !== null && <p className="text-[11px] text-white/80">{pct(value, prev)} so với bước trước</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>❤️ Tương tác <b className="text-slate-700">{fmtNumber(data.total.interactions)}</b></span>
              <span>🔁 Chia sẻ <b className="text-slate-700">{fmtNumber(data.total.shares)}</b></span>
              <span>💬 Bình luận <b className="text-slate-700">{fmtNumber(data.total.comments)}</b></span>
              <span>Tỷ lệ xem → nhận việc <b className="text-emerald-600">{pct(data.total.hired, data.total.views)}</b></span>
            </div>
          </StudioCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Nền tảng */}
            <StudioCard>
              <SectionTitle title="Theo nền tảng" />
              <BarList rows={data.by_platform.map((r) => ({ key: r.platform, label: PLATFORM_META[r.platform]?.label ?? r.platform, value: r.views, sub: `${r.posts} bài · ${r.candidates} ứng viên · ${r.hired} nhận việc` }))} />
            </StudioCard>
            {/* Sản lượng */}
            <StudioCard>
              <SectionTitle title="Sản lượng theo nhân viên" />
              {data.output_by_staff.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có việc hoàn thành.</p>
              ) : (
                <ul className="space-y-2">
                  {data.output_by_staff.map((s) => (
                    <li key={s.person.id} className="flex items-center justify-between gap-2">
                      <PersonChip person={s.person} />
                      <span className="flex gap-1.5 text-[11px] font-semibold">
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{s.done} việc</span>
                        <span className="text-slate-500">🎬{s.video} 📝{s.post} 🔴{s.livestream} ✨{s.other}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </StudioCard>
          </div>

          <MetricTable title="Hiệu quả theo người đăng" rows={data.by_publisher.map((r) => ({ key: r.person.id || "none", label: <PersonChip person={r.person.id ? r.person : null} />, t: r }))} />
          <MetricTable title="Hiệu quả theo chiến dịch" rows={data.by_campaign.map((r) => ({ key: r.id ?? "none", label: r.name, t: r }))} />
          <MetricTable title="Hiệu quả theo công ty / nhà máy" rows={data.by_factory.map((r, i) => ({ key: `${r.company_id}-${r.factory}-${i}`, label: [r.company_name, r.factory].filter(Boolean).join(" · ") || "Chưa gắn", t: r }))} />
        </>
      )}
    </div>
  );
}

function BarList({ rows }: { rows: { key: string; label: string; value: number; sub: string }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700">{r.label}</span>
            <span className="font-bold text-slate-800 tabular-nums">{fmtNumber(r.value)} xem</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">{r.sub}</p>
        </li>
      ))}
    </ul>
  );
}

function MetricTable({ title, rows }: { title: string; rows: { key: string; label: React.ReactNode; t: Totals }[] }) {
  return (
    <StudioCard className="p-0">
      <div className="px-4 pt-4"><SectionTitle title={title} /></div>
      {rows.length === 0 ? (
        <p className="pb-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-gradient-to-r from-emerald-50 to-sky-50 text-right text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">Tên</th>
                <th className="px-3 py-2">Bài</th>
                {METRICS.map((m) => <th key={m.key} className="px-3 py-2">{m.label}</th>)}
                <th className="px-3 py-2">Xem→Nhận việc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-50 text-right tabular-nums hover:bg-slate-50/60">
                  <td className="max-w-64 truncate px-3 py-2 text-left font-medium text-slate-700">{r.label}</td>
                  <td className="px-3 py-2">{r.t.posts}</td>
                  {METRICS.map((m) => <td key={m.key} className={cn("px-3 py-2", m.key === "hired" && "font-bold text-emerald-600")}>{fmtNumber(r.t[m.key])}</td>)}
                  <td className="px-3 py-2 text-slate-500">{pct(r.t.hired, r.t.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StudioCard>
  );
}
