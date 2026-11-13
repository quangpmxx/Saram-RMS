"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { ApiError, clientApiBlob } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import {
  PAYROLL_STATUS_LABEL,
  formatMoney,
  payrollApi,
  type PayrollDetail,
  type PayrollSummary,
} from "@/lib/payroll-api";

/**
 * Tiền lương (2026-11-13): "Dữ liệu tính lương" (Chấm công, Doanh số — đúng số liệu bảng
 * lương đã dùng để tính) và "Chi trả" (danh sách chuyển khoản, tải Excel, hoàn thành).
 */

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap";
const tdClass = "border-b border-slate-100 px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap";
const tableWrap = "overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]";
const numCell = `${tdClass} text-right tabular-nums`;

/** Chọn 1 bảng lương (mặc định mới nhất) rồi tải chi tiết. */
function usePayrollPicker(filter?: (p: PayrollSummary) => boolean) {
  const toast = useToast();
  const [list, setList] = useState<PayrollSummary[] | null>(null);
  const [id, setId] = useState("");
  const [data, setData] = useState<PayrollDetail | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    payrollApi
      .periods()
      .then((all) => setList(filter ? all.filter(filter) : all))
      .catch((e) => toast.error(errText(e, "Không tải được danh sách bảng lương")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const activeId = id || list?.[0]?.id || "";
  useEffect(() => {
    if (!activeId) return;
    let stale = false;
    payrollApi
      .period(activeId)
      .then((d) => !stale && setData(d))
      .catch((e) => toast.error(errText(e, "Không tải được bảng lương")));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, version]);

  const picker = list && list.length > 0 && (
    <Field label="Bảng lương" uiSize="sm" hideLabel className="w-56">
      <Select uiSize="sm" value={activeId} onChange={(e) => setId(e.target.value)}>
        {list.map((p) => <option key={p.id} value={p.id}>Tháng {p.month}/{p.year} — {PAYROLL_STATUS_LABEL[p.status]}</option>)}
      </Select>
    </Field>
  );
  return { list, data: data && data.id === activeId ? data : null, picker, reload: () => setVersion((v) => v + 1) };
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      {action}
    </div>
  );
}

export function DataPanel({ kind, onGoTab }: { kind: "attendance" | "sales"; onGoTab: (tab: string) => void }) {
  const { list, data, picker } = usePayrollPicker();
  const [keyword, setKeyword] = useState("");

  if (!list) return <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p>;
  if (list.length === 0) {
    return <Empty text="Số liệu hiện theo từng bảng lương. Lập bảng lương trước để hệ thống tổng hợp chấm công và doanh số." action={<Button size="sm" onClick={() => onGoTab("payroll")}>Lập bảng lương</Button>} />;
  }
  const kw = keyword.trim().toLowerCase();
  const slips = (data?.slips ?? []).filter((s) => !kw || s.full_name.toLowerCase().includes(kw));
  const total = (key: string) => slips.reduce((t, s) => t + (s.inputs[key] ?? 0), 0);
  const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("vi-VN");
  const columns: [string, string, boolean?][] =
    kind === "attendance"
      ? [
          ["Công chuẩn", "CONG_CHUAN"],
          ["Công thực tế", "CONG_THUC_TE"],
          ["Nghỉ phép", "NGAY_NGHI_PHEP"],
          ["Nghỉ lễ", "NGAY_LE"],
          ["Nghỉ không phép", "NGAY_NGHI_KHONG_PHEP"],
          ["Nghỉ bù", "NGAY_NGHI_BU"],
          ["Công hưởng lương", "CONG_HUONG_LUONG", true],
        ]
      : [
          ["Số lao động", "SO_LAO_DONG"],
          ["Tổng giờ", "TONG_GIO_DS"],
          ["Hoa hồng theo giờ", "HOA_HONG_GIO", true],
          ["Mức hoa hồng riêng", "MUC_HOA_HONG"],
        ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input uiSize="sm" className="w-56" placeholder="Tìm theo tên" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        {picker}
        <p className="grow text-right text-xs text-slate-400">
          {kind === "attendance" ? "Lấy từ bảng Chấm công thủ công" : "Lấy từ trang Nhập doanh số (cột Sale / Người tuyển)"}
          {data?.status === "draft" ? " · bấm “Tính lại” ở bảng lương để cập nhật" : " · đã khoá theo bảng lương"}
        </p>
      </div>
      <div className={tableWrap}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thClass}>STT</th>
              <th className={thClass}>Họ và tên</th>
              <th className={thClass}>Vị trí</th>
              <th className={thClass}>Nhóm</th>
              {columns.map(([label]) => <th key={label} className={`${thClass} text-right`}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {!data && (
              <tr><td className={`${tdClass} py-8 text-center text-slate-400`} colSpan={4 + columns.length}>Đang tải…</td></tr>
            )}
            {slips.map((s, i) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={tdClass}>{i + 1}</td>
                <td className={`${tdClass} font-medium text-slate-900`}>{s.full_name}</td>
                <td className={tdClass}>{s.position || ACCOUNT_ROLE_LABEL[s.role]}</td>
                <td className={tdClass}>{s.team_name ?? "—"}</td>
                {columns.map(([label, key, strong]) => (
                  <td key={label} className={`${numCell} ${strong ? "font-semibold text-slate-900" : ""} ${!s.inputs[key] ? "text-slate-300" : ""}`}>{fmt(s.inputs[key])}</td>
                ))}
              </tr>
            ))}
            {data && (
              <tr className="bg-slate-50 font-semibold">
                <td className={tdClass} colSpan={4}>Tổng cộng ({slips.length} người)</td>
                {columns.map(([label, key]) => <td key={label} className={numCell}>{key === "CONG_CHUAN" || key === "MUC_HOA_HONG" ? "" : fmt(total(key))}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PayoutPanel({ canEdit, onGoTab }: { canEdit: boolean; onGoTab: (tab: string) => void }) {
  const toast = useToast();
  const { list, data, picker, reload } = usePayrollPicker((p) => p.status !== "draft");
  const [busy, setBusy] = useState(false);

  if (!list) return <p className="py-10 text-center text-sm text-slate-400">Đang tải…</p>;
  if (list.length === 0) {
    return <Empty text="Chưa có bảng lương nào đã chốt. Chốt bảng lương và gửi nhân viên kiểm tra trước khi chi trả." action={<Button size="sm" onClick={() => onGoTab("payroll")}>Tới Tính lương</Button>} />;
  }

  async function download() {
    if (!data) return;
    try {
      const blob = await clientApiBlob(payrollApi.exportPath(data.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bang-luong-${data.year}-${String(data.month).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errText(e, "Không tải được file Excel"));
    }
  }

  async function complete() {
    if (!data || !window.confirm(`Đã đi lệnh ngân hàng xong? Bấm OK để hoàn thành bảng lương tháng ${data.month}/${data.year}.`)) return;
    setBusy(true);
    try {
      await payrollApi.changeStatus(data.id, "complete");
      toast.success("Đã hoàn thành bảng lương");
      reload();
    } catch (e) {
      toast.error(errText(e, "Không hoàn thành được"));
    } finally {
      setBusy(false);
    }
  }

  const slips = data?.slips ?? [];
  const total = slips.reduce((t, s) => t + s.net_pay, 0);
  const missingBank = slips.filter((s) => !s.bank_account_number).length;
  const questions = slips.filter((s) => s.confirm_status === "question").length;
  const confirmed = slips.filter((s) => s.confirm_status === "confirmed").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {picker}
        {data && <Badge variant={data.status === "completed" ? "success" : data.status === "sent" ? "info" : "warning"}>{PAYROLL_STATUS_LABEL[data.status]}</Badge>}
        <div className="grow" />
        <Button size="sm" variant="outline" onClick={download} disabled={!data}>Tải Excel đi lệnh ngân hàng</Button>
        {canEdit && data?.status === "sent" && <Button size="sm" onClick={complete} disabled={busy}>Hoàn thành chi trả</Button>}
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              ["Tổng cần chi", `${formatMoney(total)} đ`, ""],
              ["Số người nhận", String(slips.length), ""],
              ["Đã đồng ý phiếu lương", `${confirmed}/${slips.length}`, questions ? `${questions} người đang thắc mắc` : ""],
              ["Thiếu số tài khoản", String(missingBank), missingBank ? "Bổ sung ở Quản lý tài khoản" : ""],
            ] as const
          ).map(([label, value, note]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{value}</div>
              {note && <div className="mt-0.5 text-xs text-amber-700">{note}</div>}
            </div>
          ))}
        </div>
      )}
      {data?.status === "locked" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Bảng lương đã chốt nhưng chưa gửi nhân viên kiểm tra — vào “Tính lương” để gửi trước khi chi.</p>}

      <div className={tableWrap}>
        <table className="w-full min-w-[680px]">
          <thead>
            <tr>
              <th className={thClass}>STT</th>
              <th className={thClass}>Họ và tên</th>
              <th className={thClass}>Số tài khoản</th>
              <th className={thClass}>Ngân hàng</th>
              <th className={thClass}>Chủ TK</th>
              <th className={`${thClass} text-right`}>Số tiền chuyển</th>
              <th className={thClass}>Xác nhận lương</th>
              <th className={thClass}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {!data && (
              <tr><td className={`${tdClass} py-8 text-center text-slate-400`} colSpan={8}>Đang tải…</td></tr>
            )}
            {slips.map((s, i) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={tdClass}>{i + 1}</td>
                <td className={`${tdClass} font-medium text-slate-900`}>{s.full_name}</td>
                <td className={`${tdClass} font-mono text-xs`}>{s.bank_account_number ?? <span className="font-sans text-amber-700">Chưa có</span>}</td>
                <td className={tdClass}>{s.profile?.bank_name ?? "—"}</td>
                <td className={tdClass}>{s.profile?.bank_account_holder ?? "—"}</td>
                <td className={`${numCell} font-semibold text-emerald-700`}>{formatMoney(s.net_pay)}</td>
                <td className={tdClass}>
                  {s.confirm_status === "confirmed" ? <Badge variant="success">Đã đồng ý</Badge>
                    : s.confirm_status === "question" ? <Badge variant="danger" title={s.question ?? ""}>Thắc mắc</Badge>
                    : <Badge>Chưa xác nhận</Badge>}
                </td>
                <td className={`${tdClass} max-w-xs truncate`}>{s.note ?? ""}</td>
              </tr>
            ))}
            {data && (
              <tr className="bg-slate-50 font-semibold">
                <td className={tdClass} colSpan={5}>Tổng cộng</td>
                <td className={`${numCell} text-emerald-700`}>{formatMoney(total)}</td>
                <td className={tdClass} colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
