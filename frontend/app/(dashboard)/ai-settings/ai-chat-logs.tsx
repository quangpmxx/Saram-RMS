"use client";

import { useEffect, useState } from "react";
import { Keyboard, Mic, Search } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type AccountRole } from "@/lib/types";
import { computeDateRange, type DateRangeValue } from "@/lib/date-range";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/cn";

interface ByAccount {
  account_id: string;
  name: string;
  role: AccountRole | null;
  count: number;
  days: number;
  last_at: string;
}
interface LogItem {
  id: string;
  at: string;
  account_id: string;
  name: string;
  role: AccountRole | null;
  question: string;
  answer: string;
  via_voice: boolean;
}
interface LogsResponse {
  total: number;
  page: number;
  page_size: number;
  people: { account_id: string; name: string }[];
  by_account: ByAccount[];
  by_day: { date: string; count: number }[];
  items: LogItem[];
}

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}
function fmtDay(v: string) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Trang Lịch sử chat AI (2026-11-27, yêu cầu người dùng): bộ lọc ngày / nhân viên / gõ-nói / từ khoá;
 * tổng hợp theo nhân viên + theo ngày; bảng chi tiết từng câu (bấm để xem đủ câu trả lời).
 * Lịch sử giữ 1 năm.
 */
export function AiChatLogs() {
  const [range, setRange] = useState<DateRangeValue>(() => ({ preset: "7d", ...computeDateRange("7d") }));
  const [accountId, setAccountId] = useState("");
  const [via, setVia] = useState<"" | "voice" | "text">("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    const q = new URLSearchParams({ date_from: range.from, date_to: range.to, page: String(page) });
    if (accountId) q.set("account_id", accountId);
    if (via) q.set("via", via);
    if (keyword) q.set("q", keyword);
    clientApi<LogsResponse>(`/ai-assistant/logs?${q.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Không tải được lịch sử chat");
      });
    return () => {
      cancelled = true;
    };
  }, [range, accountId, via, keyword, page]);

  // Đổi bộ lọc → về trang 1.
  function filter<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const dayCount = data?.by_day.length ?? 0;

  return (
    <div>

      {/* Bộ lọc — 1 dòng gọn (2026-11-27, yêu cầu người dùng); màn hẹp thì vuốt ngang. */}
      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <DateRangePicker value={range} onChange={filter(setRange)} className="w-44! shrink-0" />
        <Select uiSize="sm" aria-label="Nhân viên" value={accountId} onChange={(e) => filter(setAccountId)(e.target.value)} className="w-40! shrink-0">
          <option value="">Tất cả nhân viên</option>
          {data?.people.map((p) => (
            <option key={p.account_id} value={p.account_id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select uiSize="sm" aria-label="Cách hỏi" value={via} onChange={(e) => filter(setVia)(e.target.value as "" | "voice" | "text")} className="w-28! shrink-0">
          <option value="">Gõ + nói</option>
          <option value="text">Gõ chữ</option>
          <option value="voice">Nói</option>
        </Select>
        <form
          className="relative w-52 shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            filter(setKeyword)(keywordDraft.trim());
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <Input
            uiSize="sm"
            placeholder="Tìm nội dung (Enter)"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onBlur={() => keywordDraft.trim() !== keyword && filter(setKeyword)(keywordDraft.trim())}
            className="w-full pl-8"
          />
        </form>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Tổng quan */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Theo nhân viên</span>
            <span className="text-xs text-slate-500">
              Tổng <b className="text-slate-800">{data?.total ?? 0}</b> lượt
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Nhân viên</th>
                  <th className="px-4 py-2 font-medium">Vai trò</th>
                  <th className="px-4 py-2 text-right font-medium">Số lượt</th>
                  <th className="px-4 py-2 text-right font-medium">Số ngày dùng</th>
                  <th className="px-4 py-2 text-right font-medium">TB / ngày dùng</th>
                  <th className="px-4 py-2 text-right font-medium">Lần cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.by_account.map((a) => (
                  <tr
                    key={a.account_id}
                    onClick={() => filter(setAccountId)(a.account_id)}
                    className={cn("cursor-pointer hover:bg-slate-50", accountId === a.account_id && "bg-brand-50")}
                    title="Bấm để lọc theo người này"
                  >
                    <td className="px-4 py-2 font-medium text-brand-700">{a.name}</td>
                    <td className="px-4 py-2 text-slate-500">{a.role ? ACCOUNT_ROLE_LABEL[a.role] : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{a.count}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{a.days}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{(a.count / a.days).toFixed(1)}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{fmtDateTime(a.last_at)}</td>
                  </tr>
                ))}
                {data && data.by_account.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      Không có lượt chat nào khớp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Theo ngày {dayCount > 0 && <span className="font-normal normal-case">({dayCount} ngày)</span>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data?.by_day.map((d) => (
                  <tr key={d.date}>
                    <td className="px-4 py-1.5 text-slate-600">{fmtDay(d.date)}</td>
                    <td className="px-4 py-1.5 text-right font-semibold text-slate-800">{d.count} lượt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Chi tiết từng câu */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Chi tiết từng câu <span className="font-normal normal-case">(bấm 1 dòng để xem đủ câu trả lời)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <colgroup>
              <col className="w-[110px]" />
              <col className="w-[160px]" />
              <col className="w-[60px]" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Lúc</th>
                <th className="px-4 py-2 font-medium">Nhân viên</th>
                <th className="px-2 py-2 font-medium">Cách</th>
                <th className="px-4 py-2 font-medium">Câu hỏi</th>
                <th className="px-4 py-2 font-medium">AI trả lời</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((m) => {
                const open = openId === m.id;
                return (
                  <tr key={m.id} onClick={() => setOpenId(open ? null : m.id)} className="cursor-pointer align-top hover:bg-slate-50">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{fmtDateTime(m.at)}</td>
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-800">{m.name}</span>
                      <span className="block text-xs text-slate-400">{m.role ? ACCOUNT_ROLE_LABEL[m.role] : ""}</span>
                    </td>
                    <td className="px-2 py-2" title={m.via_voice ? "Hỏi bằng giọng nói" : "Gõ chữ"}>
                      {m.via_voice ? <Mic className="h-4 w-4 text-amber-600" /> : <Keyboard className="h-4 w-4 text-slate-400" />}
                    </td>
                    <td className={cn("px-4 py-2 text-slate-800", !open && "truncate")}>{m.question}</td>
                    <td className={cn("px-4 py-2 text-slate-600", open ? "whitespace-pre-line" : "truncate")}>{m.answer}</td>
                  </tr>
                );
              })}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Không có câu nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2 text-sm">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Trước
            </Button>
            <span className="text-slate-500">
              Trang {page}/{pages}
            </span>
            <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Sau
            </Button>
          </div>
        )}
      </Card>
      <p className="mt-2 text-xs text-slate-400">Lịch sử lưu 1 năm (bắt đầu lưu từ 27/11/2026), quá 1 năm tự xoá.</p>
    </div>
  );
}
