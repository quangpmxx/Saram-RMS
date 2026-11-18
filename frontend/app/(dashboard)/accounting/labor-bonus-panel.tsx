"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ApiError, clientApi, clientApiBlob } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/payroll-api";
import { useToast } from "@/lib/toast-context";
import { BONUS_GROUP_LABEL, type BonusGroup, type DsSaleRow } from "@/lib/types";

/**
 * Kế toán › Thưởng lao động (2026-11-15): danh sách "Nhập thưởng lao động" của 4 bộ phận
 * (tab Sale / Media / Tuyển dụng / Đưa đón) và tab Chung gộp tất cả. Tải Excel theo đúng
 * tab + bộ lọc; tick "Đã chi" từng dòng hoặc cả danh sách chưa chi (chọn ngày chi), bỏ
 * đánh dấu khi tick nhầm. Dòng đã chi bị khoá bên trang Nhập thưởng lao động.
 */

type GroupTab = "all" | BonusGroup;
const GROUP_TABS: { key: GroupTab; label: string }[] = [
  { key: "all", label: "Chung" },
  { key: "sale", label: "Sale" },
  { key: "media", label: "Media" },
  { key: "recruitment", label: "Tuyển dụng" },
  { key: "shuttle", label: "Đưa đón" },
];

interface LaborBonusList {
  items: DsSaleRow[];
  groups: Record<BonusGroup, { count: number; amount: number }>;
  summary: {
    count: number;
    amount: number;
    paid_count: number;
    paid_amount: number;
    unpaid_count: number;
    unpaid_amount: number;
  };
}

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap";
const tdClass = "border-b border-slate-100 px-3 py-2 text-sm text-slate-700 whitespace-nowrap";
const ddmmyyyy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

function vnTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function queryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}

export function LaborBonusPanel({
  canEdit,
  initialYear,
  initialMonth,
}: {
  canEdit: boolean;
  initialYear: number;
  initialMonth: number;
}) {
  const toast = useToast();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [group, setGroup] = useState<GroupTab>("all");
  const [paid, setPaid] = useState<"" | "yes" | "no">("");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<LaborBonusList | null>(null);
  /** Bộ lọc của lần tải gần nhất đã xong — khác bộ lọc hiện tại = đang tải. */
  const [loadedKey, setLoadedKey] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Hộp xác nhận: đánh dấu đã chi / bỏ đánh dấu. */
  const [confirm, setConfirm] = useState<{ action: "pay" | "unpay"; rows: DsSaleRow[] } | null>(null);
  const [paidDate, setPaidDate] = useState(vnTodayIso);
  const [busy, setBusy] = useState(false);

  // Gõ tìm kiếm: chờ ngừng gõ 350ms rồi lọc.
  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 350);
    return () => clearTimeout(t);
  }, [keyword]);

  const params = useMemo(
    () => ({ year, month, group: group === "all" ? undefined : group, paid: paid || undefined, keyword: search || undefined }),
    [year, month, group, paid, search],
  );

  const qs = queryString(params);
  const loading = loadedKey !== qs;
  const load = useCallback(() => {
    return clientApi<LaborBonusList>(`/labor-bonus?${qs}`)
      .then((res) => {
        setData(res);
        // Bỏ chọn các dòng không còn trong danh sách.
        setSelected((prev) => new Set([...prev].filter((id) => res.items.some((r) => r.id === id))));
      })
      .catch((e) => toast.error(errText(e, "Không tải được danh sách thưởng")))
      .finally(() => setLoadedKey(qs));
  }, [qs, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const unpaidRows = items.filter((r) => !r.paid_date);
  const selectedRows = items.filter((r) => selected.has(r.id));
  const selectedUnpaid = selectedRows.filter((r) => !r.paid_date);
  const selectedPaid = selectedRows.filter((r) => r.paid_date);
  const allSelected = items.length > 0 && items.every((r) => selected.has(r.id));
  const sum = (rows: DsSaleRow[]) => rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadExcel() {
    try {
      const blob = await clientApiBlob(`/labor-bonus/export?${qs}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thuong-lao-dong-${group === "all" ? "chung" : group}-${year}-${String(month).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errText(e, "Không tải được file Excel"));
    }
  }

  async function submit() {
    if (!confirm) return;
    setBusy(true);
    try {
      const ids = confirm.rows.map((r) => r.id);
      const res =
        confirm.action === "pay"
          ? await clientApi<{ updated: number }>("/labor-bonus/mark-paid", {
              method: "POST",
              body: JSON.stringify({ ids, paid_date: paidDate }),
            })
          : await clientApi<{ updated: number }>("/labor-bonus/unmark-paid", {
              method: "POST",
              body: JSON.stringify({ ids }),
            });
      toast.success(
        confirm.action === "pay" ? `Đã đánh dấu chi ${res.updated} khoản thưởng` : `Đã bỏ đánh dấu ${res.updated} khoản`,
      );
      setConfirm(null);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(errText(e, "Không lưu được"));
    } finally {
      setBusy(false);
    }
  }

  const missingBank = confirm?.rows.filter((r) => !r.bank_account_number?.trim()) ?? [];
  const years = [initialYear - 1, initialYear, initialYear + 1];

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bộ phận — kèm số khoản của từng tab. */}
      <div className="flex flex-wrap gap-1.5">
        {GROUP_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? Object.values(data?.groups ?? {}).reduce((s, g) => s + g.count, 0)
              : (data?.groups[tab.key]?.count ?? 0);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setGroup(tab.key);
                setSelected(new Set());
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                group === tab.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100",
              )}
            >
              {tab.label}
              {data ? <span className="ml-1 opacity-75">({count})</span> : null}
            </button>
          );
        })}
      </div>

      {/* Bộ lọc + thao tác */}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Tháng" uiSize="xs" className="w-24">
          <Select uiSize="xs" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Năm" uiSize="xs" className="w-20">
          <Select uiSize="xs" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trạng thái" uiSize="xs" className="w-28">
          <Select uiSize="xs" value={paid} onChange={(e) => setPaid(e.target.value as "" | "yes" | "no")}>
            <option value="">Tất cả</option>
            <option value="no">Chưa chi</option>
            <option value="yes">Đã chi</option>
          </Select>
        </Field>
        <Field label="Tìm" uiSize="xs" className="w-56">
          <Input uiSize="xs" placeholder="ID, tên, STK, người giới thiệu…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </Field>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadExcel} disabled={!items.length}>
            <Download className="h-4 w-4" /> Tải Excel
          </Button>
          {canEdit && selectedPaid.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setConfirm({ action: "unpay", rows: selectedPaid })}>
              Bỏ đánh dấu ({selectedPaid.length})
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              disabled={selectedUnpaid.length === 0}
              onClick={() => {
                setPaidDate(vnTodayIso());
                setConfirm({ action: "pay", rows: selectedUnpaid });
              }}
            >
              Đã chi dòng chọn{selectedUnpaid.length ? ` (${selectedUnpaid.length})` : ""}
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              disabled={unpaidRows.length === 0}
              onClick={() => {
                setPaidDate(vnTodayIso());
                setConfirm({ action: "pay", rows: unpaidRows });
              }}
            >
              Đã chi toàn bộ ({unpaidRows.length})
            </Button>
          )}
        </div>
      </div>

      {/* Tổng */}
      {data && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">
            Tổng: <b>{data.summary.count}</b> khoản · <b className="tabular-nums">{formatMoney(data.summary.amount)}</b>đ
          </span>
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-200">
            Chưa chi: <b>{data.summary.unpaid_count}</b> · <b className="tabular-nums">{formatMoney(data.summary.unpaid_amount)}</b>đ
          </span>
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800 ring-1 ring-emerald-200">
            Đã chi: <b>{data.summary.paid_count}</b> · <b className="tabular-nums">{formatMoney(data.summary.paid_amount)}</b>đ
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <table className="w-full">
          <thead>
            <tr>
              <th className={`${thClass} w-8`}>
                {canEdit && (
                  <Checkbox
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((r) => r.id)))}
                  />
                )}
              </th>
              <th className={thClass}>STT</th>
              {group === "all" && <th className={thClass}>Bộ phận</th>}
              <th className={thClass}>ID</th>
              <th className={thClass}>Tên</th>
              <th className={thClass}>Công ty</th>
              <th className={thClass}>Ngày vào</th>
              <th className={`${thClass} text-right`}>Số tiền</th>
              <th className={thClass}>STK</th>
              <th className={thClass}>Tên TK</th>
              <th className={thClass}>Ngân hàng</th>
              <th className={thClass}>Người giới thiệu</th>
              <th className={thClass}>{group === "sale" ? "Sale" : group === "all" ? "Sale / Người tuyển" : "Người tuyển"}</th>
              <th className={thClass}>Ghi chú</th>
              <th className={thClass}>Trạng thái</th>
            </tr>
          </thead>
          <tbody className={cn(loading && "opacity-60")}>
            {items.map((r, i) => (
              <tr key={r.id} className={cn(r.paid_date && "bg-emerald-50/40", selected.has(r.id) && "bg-brand-50")}>
                <td className={tdClass}>{canEdit && <Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}</td>
                <td className={`${tdClass} text-slate-400`}>{i + 1}</td>
                {group === "all" && <td className={tdClass}>{BONUS_GROUP_LABEL[r.bonus_group ?? "sale"]}</td>}
                <td className={tdClass}>{r.employee_code}</td>
                <td className={`${tdClass} font-medium text-slate-900`}>{r.full_name}</td>
                <td className={tdClass}>{r.company?.name}</td>
                <td className={tdClass}>{ddmmyyyy(r.join_date)}</td>
                <td className={`${tdClass} text-right font-medium tabular-nums`}>{r.amount ? formatMoney(r.amount) : ""}</td>
                <td className={cn(tdClass, !r.bank_account_number && "text-red-500")}>{r.bank_account_number || "Thiếu STK"}</td>
                <td className={tdClass}>{r.bank_account_name}</td>
                <td className={tdClass}>{r.bank_name}</td>
                <td className={tdClass}>{r.referrer_name}</td>
                <td className={tdClass}>{r.sale ? r.sale.nickname || r.sale.full_name : ""}</td>
                <td className={`${tdClass} max-w-64 truncate`} title={r.note ?? undefined}>
                  {r.note}
                </td>
                <td className={tdClass}>
                  {r.paid_date ? (
                    <Badge variant="success" title={r.paid_by ? `Người chi: ${r.paid_by.name}` : undefined}>
                      Đã chi {ddmmyyyy(r.paid_date)}
                    </Badge>
                  ) : (
                    <Badge variant="warning">Chưa chi</Badge>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td className={`${tdClass} text-center text-slate-400`} colSpan={15}>
                  Chưa có khoản thưởng nào trong tháng {month}/{year}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <Modal
          title={confirm.action === "pay" ? "Xác nhận đã chi thưởng" : "Bỏ đánh dấu đã chi"}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                Huỷ
              </Button>
              <Button onClick={submit} disabled={busy || (confirm.action === "pay" && !paidDate)}>
                {confirm.action === "pay" ? "Xác nhận đã chi" : "Bỏ đánh dấu"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-slate-700">
            <p>
              {confirm.rows.length} khoản · tổng <b className="tabular-nums">{formatMoney(sum(confirm.rows))}</b>đ
            </p>
            {confirm.action === "pay" ? (
              <>
                <Field label="Ngày chi" uiSize="sm">
                  <Input type="date" uiSize="sm" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                </Field>
                {missingBank.length > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                    Có {missingBank.length} khoản chưa có số tài khoản — kiểm tra lại trước khi xác nhận.
                  </p>
                )}
                <p className="text-slate-500">
                  Sau khi xác nhận, các dòng này bị khoá bên trang Nhập thưởng lao động và người nhập được báo chuông.
                </p>
              </>
            ) : (
              <p className="text-slate-500">Các dòng trở lại “Chưa chi” và người nhập sửa được như cũ.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
