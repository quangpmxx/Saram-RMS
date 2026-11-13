"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { SlipDetail } from "@/components/payroll/slip-detail";
import { ApiError, clientApiBlob } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast-context";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import {
  PAYROLL_STATUS_LABEL,
  formatMoney,
  parseMoney,
  payrollApi,
  type PayrollDetail,
  type PayrollSlip,
  type PayrollStatus,
  type PayrollSummary,
  type SlipLine,
} from "@/lib/payroll-api";

/** Tiền lương (2026-11-13): tab "Tính lương" — danh sách bảng lương tháng và chi tiết 1 bảng (tính, chốt, gửi, tải Excel, hoàn thành). */

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap";
const tdClass = "border-b border-slate-100 px-3 py-2 text-sm text-slate-700 whitespace-nowrap";
const STATUS_VARIANT: Record<PayrollStatus, "neutral" | "warning" | "info" | "success"> = {
  draft: "neutral",
  locked: "warning",
  sent: "info",
  completed: "success",
};
const STEPS: PayrollStatus[] = ["draft", "locked", "sent", "completed"];

export function PayrollPanel({ canEdit, initialYear, initialMonth }: { canEdit: boolean; initialYear: number; initialMonth: number }) {
  const toast = useToast();
  const [list, setList] = useState<PayrollSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [busy, setBusy] = useState(false);

  const loadList = () => payrollApi.periods().then(setList).catch((e) => toast.error(errText(e, "Không tải được danh sách bảng lương")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void loadList(), []);

  async function create() {
    setBusy(true);
    try {
      const { id } = await payrollApi.createPeriod(year, month);
      await loadList();
      setOpenId(id);
    } catch (e) {
      toast.error(errText(e, "Không tạo được bảng lương"));
    } finally {
      setBusy(false);
    }
  }

  if (openId) {
    return (
      <PayrollDetailView
        id={openId}
        canEdit={canEdit}
        onBack={() => {
          setOpenId(null);
          void loadList();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tháng" uiSize="sm" className="w-24">
            <Select uiSize="sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
            </Select>
          </Field>
          <Field label="Năm" uiSize="sm" className="w-24">
            <Select uiSize="sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[initialYear - 1, initialYear, initialYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </Field>
          <Button size="sm" onClick={create} disabled={busy}>+ Lập bảng lương</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <th className={thClass}>Bảng lương</th>
              <th className={thClass}>Trạng thái</th>
              <th className={`${thClass} text-right`}>Số người</th>
              <th className={`${thClass} text-right`}>Tổng thực lĩnh</th>
              <th className={thClass}>Nhân viên xác nhận</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(p.id)}>
                <td className={`${tdClass} font-medium text-slate-900`}>Tháng {p.month}/{p.year}</td>
                <td className={tdClass}><Badge variant={STATUS_VARIANT[p.status]}>{PAYROLL_STATUS_LABEL[p.status]}</Badge></td>
                <td className={`${tdClass} text-right tabular-nums`}>{p.slip_count}</td>
                <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatMoney(p.total_net_pay)}</td>
                <td className={tdClass}>
                  {p.status === "draft" || p.status === "locked" ? "—" : `${p.confirmed_count}/${p.slip_count} đồng ý`}
                  {p.question_count > 0 && <Badge variant="danger" className="ml-1">{p.question_count} thắc mắc</Badge>}
                </td>
                <td className={`${tdClass} text-right text-brand-700`}>Mở ›</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td className={`${tdClass} py-8 text-center text-slate-400`} colSpan={6}>Chưa có bảng lương nào. Chọn tháng rồi bấm “Lập bảng lương”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayrollDetailView({ id, canEdit, onBack }: { id: string; canEdit: boolean; onBack: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<PayrollDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [viewing, setViewing] = useState<PayrollSlip | null>(null);
  const [explain, setExplain] = useState<{ slip: PayrollSlip; line: SlipLine } | null>(null);
  const [editing, setEditing] = useState<{ slip: PayrollSlip; values: Record<string, string>; note: string } | null>(null);

  const [variableLabels, setVariableLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    payrollApi.variables().then((v) => setVariableLabels(Object.fromEntries(v.map((x) => [x.code, x.label])))).catch(() => {});
  }, []);

  const load = () => payrollApi.period(id).then(setData).catch((e) => toast.error(errText(e, "Không tải được bảng lương")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [id]);

  async function run(action: () => Promise<unknown>, done: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await load();
    } catch (e) {
      toast.error(errText(e, "Không thực hiện được"));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!data) return;
    try {
      const blob = await clientApiBlob(payrollApi.exportPath(id));
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

  if (!data) return <p className="py-8 text-center text-sm text-slate-400">Đang tải…</p>;

  const isDraft = data.status === "draft";
  const period = `tháng ${data.month}/${data.year}`;
  const kw = keyword.trim().toLowerCase();
  const slips = kw ? data.slips.filter((s) => s.full_name.toLowerCase().includes(kw)) : data.slips;
  const columns: { code: string; name: string }[] = [];
  for (const s of data.slips) for (const l of s.lines) if (!columns.some((c) => c.code === l.code)) columns.push({ code: l.code, name: l.name });
  const total = data.slips.reduce((t, s) => t + s.net_pay, 0);
  const stepIndex = STEPS.indexOf(data.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>‹ Quay lại</Button>
        <h2 className="text-base font-semibold text-slate-900">Bảng lương {period}</h2>
        <div className="flex items-center gap-1 text-xs">
          {STEPS.map((s, i) => (
            <span key={s} className={`rounded-full px-2 py-0.5 ${i === stepIndex ? "bg-brand-700 text-white" : i < stepIndex ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
              {i + 1}. {PAYROLL_STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input uiSize="sm" className="w-48" placeholder="Tìm theo tên" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <div className="grow" />
        <Button size="sm" variant="outline" onClick={download}>Tải Excel</Button>
        {canEdit && isDraft && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => payrollApi.recompute(id), "Đã tính lại theo chấm công và doanh số mới nhất")}>Tính lại</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => run(async () => { await payrollApi.deletePeriod(id); onBack(); }, "Đã xoá bảng lương", `Xoá bảng lương ${period}?`)}>Xoá</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => payrollApi.changeStatus(id, "lock"), "Đã chốt bảng lương", `Chốt bảng lương ${period}? Sau khi chốt không sửa số được nữa (có thể mở chốt).`)}>Chốt bảng lương</Button>
          </>
        )}
        {canEdit && (data.status === "locked" || data.status === "sent") && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => payrollApi.changeStatus(id, "unlock"), "Đã mở chốt, có thể sửa lại", "Mở chốt để sửa lại bảng lương?")}>Mở chốt để sửa</Button>
        )}
        {canEdit && data.status === "locked" && (
          <Button size="sm" disabled={busy} onClick={() => run(() => payrollApi.changeStatus(id, "send"), "Đã gửi phiếu lương cho nhân viên", `Gửi phiếu lương ${period} cho ${data.slips.length} nhân viên kiểm tra?`)}>Gửi nhân viên kiểm tra</Button>
        )}
        {canEdit && data.status === "sent" && (
          <Button size="sm" disabled={busy} onClick={() => run(() => payrollApi.changeStatus(id, "complete"), "Đã hoàn thành bảng lương", `Đã đi lệnh ngân hàng xong? Bấm OK để hoàn thành bảng lương ${period}.`)}>Hoàn thành</Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thClass}>STT</th>
              <th className={thClass}>Họ và tên</th>
              <th className={thClass}>Vị trí</th>
              <th className={`${thClass} text-right`}>Công</th>
              {columns.map((c) => <th key={c.code} className={`${thClass} text-right`}>{c.name}</th>)}
              <th className={`${thClass} text-right`}>Thực lĩnh</th>
              <th className={thClass}>Xác nhận</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {slips.map((s, i) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={tdClass}>{i + 1}</td>
                <td className={`${tdClass} font-medium text-slate-900`}>
                  <button type="button" className="hover:underline" onClick={() => setViewing(s)}>{s.full_name}</button>
                </td>
                <td className={tdClass}>{s.position || ACCOUNT_ROLE_LABEL[s.role]}</td>
                <td className={`${tdClass} text-right tabular-nums`} title="Công hưởng lương / công chuẩn">{s.inputs.CONG_HUONG_LUONG ?? 0}/{s.inputs.CONG_CHUAN ?? 0}</td>
                {columns.map((c) => {
                  const line = s.lines.find((l) => l.code === c.code);
                  return (
                    <td key={c.code} className={`${tdClass} p-0 text-right tabular-nums ${line?.error ? "bg-red-50 text-red-600" : ""}`}>
                      {line ? (
                        <button type="button" title={line.error ? `Lỗi: ${line.error}` : `= ${line.formula} (bấm để xem giải thích)`} onClick={() => setExplain({ slip: s, line })} className="w-full px-3 py-2 text-right hover:bg-brand-50 hover:text-brand-700">
                          {formatMoney(line.value)}
                        </button>
                      ) : (
                        <span className="px-3 text-slate-300" title="Không có trong mẫu của người này">—</span>
                      )}
                    </td>
                  );
                })}
                <td className={`${tdClass} text-right font-semibold text-emerald-700 tabular-nums`}>{formatMoney(s.net_pay)}</td>
                <td className={tdClass}>
                  {data.status === "sent" || data.status === "completed" ? (
                    s.confirm_status === "confirmed" ? <Badge variant="success">Đã đồng ý</Badge>
                    : s.confirm_status === "question" ? <Badge variant="danger" title={s.question ?? ""}>Thắc mắc</Badge>
                    : <Badge>Chưa xác nhận</Badge>
                  ) : s.confirm_status === "question" ? <Badge variant="danger" title={s.question ?? ""}>Thắc mắc</Badge> : "—"}
                </td>
                <td className={`${tdClass} text-right`}>
                  {canEdit && isDraft && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setEditing({ slip: s, values: Object.fromEntries(Object.entries(s.manual_values).map(([k, v]) => [k, v ? formatMoney(v) : ""])), note: s.note ?? "" })
                      }
                    >
                      Nhập tay
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className={tdClass} colSpan={4 + columns.length}>Tổng cộng ({data.slips.length} người)</td>
              <td className={`${tdClass} text-right text-emerald-700 tabular-nums`}>{formatMoney(total)}</td>
              <td className={tdClass} colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Bấm vào ô tiền để xem giải thích công thức. Bấm tên để xem phiếu lương chi tiết.</p>

      {explain && (
        <Modal title={`${explain.line.name} — ${explain.slip.full_name}`} maxWidth="max-w-md" footer={<Button variant="outline" onClick={() => setExplain(null)}>Đóng</Button>}>
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg bg-brand-50 px-3 py-2 font-mono text-xs text-brand-800">= {explain.line.formula}</div>
            {explain.line.error && <p className="text-red-600">Lỗi công thức: {explain.line.error}</p>}
            <table className="w-full">
              <tbody>
                {/* Các số liệu / khoản khác mà công thức này dùng tới, kèm giá trị của đúng người này. */}
                {[...new Set(explain.line.formula.toUpperCase().match(/[A-Z_][A-Z0-9_]*/g) ?? [])]
                  .filter((code) => code in explain.slip.inputs || explain.slip.lines.some((l) => l.code === code))
                  .map((code) => {
                    const other = explain.slip.lines.find((l) => l.code === code);
                    return (
                      <tr key={code} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">
                          <div className="text-slate-700">{other?.name ?? variableLabels[code] ?? code}</div>
                          <div className="font-mono text-[11px] text-slate-400">{code}</div>
                        </td>
                        <td className="py-1.5 text-right font-medium text-slate-800 tabular-nums">{(other?.value ?? explain.slip.inputs[code] ?? 0).toLocaleString("vi-VN")}</td>
                      </tr>
                    );
                  })}
                <tr>
                  <td className="pt-2 font-semibold text-slate-900">Kết quả</td>
                  <td className="pt-2 text-right text-base font-bold text-emerald-700 tabular-nums">{formatMoney(explain.line.value)} đ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Phiếu lương ${period} — ${viewing.full_name}`} description={viewing.template_name ? `Mẫu: ${viewing.template_name}` : undefined} maxWidth="max-w-xl" footer={<Button variant="outline" onClick={() => setViewing(null)}>Đóng</Button>}>
          <SlipDetail slip={viewing} year={data.year} month={data.month} compact />
          {viewing.confirm_status === "question" && viewing.question && (
            <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">Nhân viên thắc mắc: {viewing.question}</p>
          )}
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Nhập tay — ${editing.slip.full_name}`}
          description="Các khoản không có công thức (ứng lương, phạt, lương ngày lễ…). Lưu xong hệ thống tính lại ngay."
          maxWidth="max-w-lg"
          footer={
            <>
              <Button variant="outline" onClick={() => setEditing(null)}>Huỷ</Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await payrollApi.updateSlip(editing.slip.id, {
                      manual_values: Object.fromEntries(Object.entries(editing.values).map(([k, v]) => [k, parseMoney(v)])),
                      note: editing.note,
                    });
                    setEditing(null);
                  }, "Đã lưu và tính lại")
                }
              >
                Lưu
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Khoản nhập tay = khoản không có công thức trong mẫu của người này. */}
            {!editing.slip.lines.some((l) => l.manual) && <p className="text-sm text-slate-500">Mẫu của người này không có khoản nhập tay nào.</p>}
            {(["income", "allowance", "deduction"] as const).map((nature) => {
              const items = editing.slip.lines.filter((l) => l.manual && l.nature === nature);
              if (items.length === 0) return null;
              return (
                <div key={nature}>
                  <div className={cn("mb-1.5 text-xs font-semibold uppercase", nature === "deduction" ? "text-rose-700" : "text-brand-700")}>
                    {nature === "deduction" ? "Giảm trừ" : nature === "allowance" ? "Phụ cấp" : "Thu nhập"}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map((l) => (
                      <Field key={l.code} label={l.name}>
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          className="text-right tabular-nums"
                          value={editing.values[l.code] ?? ""}
                          onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [l.code]: e.target.value ? formatMoney(parseMoney(e.target.value)) : "" } })}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              );
            })}
            <Field label="Ghi chú (hiện trên phiếu lương)">
              <Input value={editing.note} maxLength={500} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
