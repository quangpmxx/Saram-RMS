"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Sheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TemplatePreview } from "@/components/payroll/template-preview";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast-context";
import { ACCOUNT_ROLE_LABEL, type AccountRole } from "@/lib/types";
import {
  NATURE_LABEL,
  formatMoney,
  parseMoney,
  payrollApi,
  type CommissionRate,
  type PayrollAccountSetting,
  type PayrollComponent,
  type PayrollNature,
  type PayrollTemplate,
  type PayrollTemplateItem,
  type PayrollVariable,
} from "@/lib/payroll-api";

/** Tiền lương (2026-11-13): 4 tab cấu hình — Thành phần lương, Mẫu bảng lương, Mức lương nhân viên, Hoa hồng công ty. */

const errText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;
const thClass =
  "border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap";
const tdClass = "border-b border-slate-100 px-3 py-2 text-sm text-slate-700";

/** [cú pháp, giải thích, đoạn chèn vào ô công thức] */
const FORMULA_FUNCTIONS: [string, string, string][] = [
  [
    "IF(điều kiện, nếu đúng, nếu sai)",
    "Rẽ nhánh. vd IF(SO_LAO_DONG >= 10, 500000, 0)",
    "IF( , , )",
  ],
  ["SUM(a, b, …)", "Cộng các giá trị", "SUM( , )"],
  ["MIN(a, b, …)", "Lấy số nhỏ nhất — dùng để đặt mức trần", "MIN( , )"],
  ["MAX(a, b, …)", "Lấy số lớn nhất — dùng để đặt mức sàn", "MAX( , )"],
  ["ROUND(x, n)", "Làm tròn; n = -3 là tròn tới nghìn đồng", "ROUND( , -3)"],
  ["ABS(x)", "Giá trị tuyệt đối", "ABS( )"],
  ["+  −  *  /  ( )", "Cộng, trừ, nhân, chia, ngoặc", " "],
  [">  <  >=  <=  =  <>", "So sánh, dùng trong điều kiện của IF", " >= "],
];

/** Bảng gợi ý kiểu phần mềm tiền lương: tab Tham số (số liệu có sẵn + khoản đã tạo) và tab Công thức (các hàm). */
function VariablePicker({
  variables,
  components,
  onPick,
}: {
  variables: PayrollVariable[];
  components: PayrollComponent[];
  onPick: (code: string) => void;
}) {
  const [view, setView] = useState<"params" | "functions">("params");
  const rowClass =
    "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-brand-50";
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex gap-4 border-b border-slate-200 px-3 pt-2">
        {(
          [
            ["params", "Tham số"],
            ["functions", "Công thức"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 pb-1.5 text-xs font-medium ${view === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto pb-1.5 text-[11px] text-slate-400">
          Bấm để chèn vào công thức
        </span>
      </div>
      <div className="max-h-44 overflow-y-auto p-1">
        {view === "params" ? (
          <>
            {variables.map((v) => (
              <button
                key={v.code}
                type="button"
                onClick={() => onPick(v.code)}
                className={rowClass}
              >
                <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-700">
                  {v.code}
                </span>
                <span className="text-xs text-slate-500">{v.label}</span>
              </button>
            ))}
            {components.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => onPick(c.code)}
                className={rowClass}
              >
                <span className="shrink-0 font-mono text-[11px] font-semibold text-emerald-700">
                  {c.code}
                </span>
                <span className="text-xs text-slate-500">
                  Khoản “{c.name}” đã tính
                </span>
              </button>
            ))}
          </>
        ) : (
          FORMULA_FUNCTIONS.map(([syntax, text, insert]) => (
            <button
              key={syntax}
              type="button"
              onClick={() => onPick(insert)}
              className={rowClass}
            >
              <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-800">
                ƒ {syntax}
              </span>
              <span className="text-xs text-slate-500">{text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Thành phần lương ──────────────────────────────────────────────────────────

type ComponentDraft = {
  id: string | null;
  code: string;
  name: string;
  nature: PayrollNature;
  formula: string;
  show_on_payslip: boolean;
};

export function ComponentsPanel({
  canEdit,
  variables,
}: {
  canEdit: boolean;
  variables: PayrollVariable[];
}) {
  const toast = useToast();
  const [rows, setRows] = useState<PayrollComponent[]>([]);
  const [draft, setDraft] = useState<ComponentDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [natureFilter, setNatureFilter] = useState("");
  const kw = keyword.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!natureFilter || r.nature === natureFilter) &&
      (!kw ||
        r.name.toLowerCase().includes(kw) ||
        r.code.toLowerCase().includes(kw)),
  );

  const load = () =>
    payrollApi
      .components()
      .then(setRows)
      .catch((e) => toast.error(errText(e, "Không tải được thành phần lương")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await payrollApi.saveComponent(draft.id, {
        code: draft.code.trim().toUpperCase(),
        name: draft.name,
        nature: draft.nature,
        formula: draft.formula,
        show_on_payslip: draft.show_on_payslip,
      });
      toast.success("Đã lưu thành phần lương");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error(errText(e, "Không lưu được"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PayrollComponent) {
    if (!window.confirm(`Xoá thành phần "${row.name}"?`)) return;
    try {
      await payrollApi.deleteComponent(row.id);
      await load();
    } catch (e) {
      toast.error(errText(e, "Không xoá được"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            uiSize="sm"
            className="w-56"
            placeholder="Tìm theo tên hoặc mã"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            uiSize="sm"
            className="w-44"
            value={natureFilter}
            onChange={(e) => setNatureFilter(e.target.value)}
          >
            <option value="">Tính chất: Tất cả</option>
            <option value="income">Thu nhập</option>
            <option value="allowance">Phụ cấp</option>
            <option value="deduction">Giảm trừ</option>
            <option value="info">Chỉ để xem</option>
          </Select>
          <span className="text-xs text-slate-400">
            Tổng số: {shown.length}
          </span>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                id: null,
                code: "",
                name: "",
                nature: "income",
                formula: "",
                show_on_payslip: true,
              })
            }
          >
            + Thêm
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className={thClass}>Mã</th>
              <th className={thClass}>Tên thành phần</th>
              <th className={thClass}>Tính chất</th>
              <th className={thClass}>Công thức</th>
              <th className={thClass}>Trên phiếu lương</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className={`${tdClass} font-mono text-xs`}>{row.code}</td>
                <td className={tdClass}>{row.name}</td>
                <td className={tdClass}>
                  <Badge
                    variant={
                      row.nature === "income"
                        ? "success"
                        : row.nature === "allowance"
                          ? "info"
                          : row.nature === "deduction"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {NATURE_LABEL[row.nature]}
                  </Badge>
                </td>
                <td className={`${tdClass} font-mono text-xs text-brand-700`}>
                  {!row.formula ? (
                    <span className="font-sans text-slate-400 italic">
                      Nhập tay mỗi tháng
                    </span>
                  ) : row.formula === "0" ? (
                    <span className="font-sans text-slate-400 italic">
                      Đặt theo từng người
                    </span>
                  ) : (
                    `= ${row.formula}`
                  )}
                </td>
                <td className={tdClass}>
                  {row.show_on_payslip ? "Hiện" : "Ẩn"}
                </td>
                <td className={`${tdClass} text-right whitespace-nowrap`}>
                  {canEdit && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          setDraft({ ...row, formula: row.formula ?? "" })
                        }
                      >
                        Sửa
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => remove(row)}
                      >
                        Xoá
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <Modal
          title={draft.id ? "Sửa thành phần lương" : "Thêm thành phần lương"}
          maxWidth="max-w-xl"
          footer={
            <>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Huỷ
              </Button>
              <Button
                onClick={save}
                disabled={saving || !draft.code.trim() || !draft.name.trim()}
              >
                Lưu
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tên thành phần">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="vd Phụ cấp ăn trưa"
                />
              </Field>
              <Field
                label="Mã"
                hint={
                  draft.id
                    ? "Không đổi được mã sau khi tạo"
                    : "Chữ in hoa không dấu, gạch dưới"
                }
              >
                <Input
                  value={draft.code}
                  disabled={!!draft.id}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      code: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9_]/g, "_"),
                    })
                  }
                  placeholder="PHU_CAP_AN_TRUA"
                />
              </Field>
            </div>
            <Field label="Tính chất">
              <Select
                value={draft.nature}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    nature: e.target.value as PayrollNature,
                  })
                }
              >
                <option value="income">Chi tiết lương (cộng vào lương)</option>
                <option value="allowance">
                  Phụ cấp (cộng vào lương, in ở nhóm phụ cấp)
                </option>
                <option value="deduction">Giảm trừ (trừ khỏi lương)</option>
                <option value="info">Chỉ để xem (không cộng trừ)</option>
              </Select>
            </Field>
            <Field
              label="Công thức / giá trị"
              hint="Bỏ trống = nhập tay mỗi tháng · 0 = đặt riêng từng người ở mục Nhân viên · hoặc công thức (vd 30000 * CONG_THUC_TE)"
            >
              <Textarea
                rows={2}
                className="font-mono"
                value={draft.formula}
                onChange={(e) =>
                  setDraft({ ...draft, formula: e.target.value })
                }
              />
            </Field>
            <VariablePicker
              variables={variables}
              components={rows.filter((r) => r.id !== draft.id)}
              onPick={(code) =>
                setDraft({
                  ...draft,
                  formula: `${draft.formula}${draft.formula && !/[\s(*/+-]$/.test(draft.formula) ? " " : ""}${code}`,
                })
              }
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={draft.show_on_payslip}
                onChange={(e) =>
                  setDraft({ ...draft, show_on_payslip: e.target.checked })
                }
              />
              Hiện trên phiếu lương của nhân viên
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Mẫu bảng lương ────────────────────────────────────────────────────────────

type TemplateDraft = {
  id: string | null;
  name: string;
  roles: AccountRole[];
  is_default: boolean;
  items: PayrollTemplateItem[];
};
const ALL_ROLES = Object.keys(ACCOUNT_ROLE_LABEL) as AccountRole[];

export function TemplatesPanel({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<PayrollTemplate[]>([]);
  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<PayrollTemplate | null>(null);
  // Danh sách người để chọn "Xem với" ở khung xem trước.
  const [people, setPeople] = useState<
    { account_id: string; full_name: string }[]
  >([]);

  const load = () =>
    Promise.all([
      payrollApi.templates(),
      payrollApi.components(),
      payrollApi.accountSettings(),
    ])
      .then(([t, c, a]) => {
        setRows(t);
        setComponents(c);
        setPeople(
          a.map((x) => ({ account_id: x.account_id, full_name: x.full_name })),
        );
      })
      .catch((e) => toast.error(errText(e, "Không tải được mẫu bảng lương")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await payrollApi.saveTemplate(draft.id, {
        name: draft.name,
        roles: draft.roles,
        is_default: draft.is_default,
        items: draft.items,
      });
      toast.success("Đã lưu mẫu bảng lương");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error(errText(e, "Không lưu được"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PayrollTemplate) {
    if (!window.confirm(`Xoá mẫu "${row.name}"?`)) return;
    try {
      await payrollApi.deleteTemplate(row.id);
      await load();
    } catch (e) {
      toast.error(errText(e, "Không xoá được"));
    }
  }

  function toggleItem(code: string) {
    if (!draft) return;
    const has = draft.items.some((i) => i.code === code);
    // Giữ thứ tự theo danh mục thành phần — thành phần tính trước đứng trước.
    const next = has
      ? draft.items.filter((i) => i.code !== code)
      : [...draft.items, { code }];
    next.sort(
      (a, b) =>
        components.findIndex((c) => c.code === a.code) -
        components.findIndex((c) => c.code === b.code),
    );
    setDraft({ ...draft, items: next });
  }

  // Vị trí chưa nằm trong mẫu riêng nào → đang dùng mẫu mặc định.
  const assigned = new Set(rows.flatMap((r) => r.roles));
  const unassigned = ALL_ROLES.filter((r) => !assigned.has(r));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 grow flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{rows.length} mẫu</span>
          {unassigned.length > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span>Đang dùng mẫu mặc định:</span>
              {unassigned.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
                >
                  {ACCOUNT_ROLE_LABEL[r]}
                </span>
              ))}
            </>
          )}
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                id: null,
                name: "",
                roles: [],
                is_default: false,
                items: [],
              })
            }
          >
            + Thêm mẫu
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((row) => {
          const lines = row.items.map((item) => {
            const comp = components.find((c) => c.code === item.code);
            return {
              code: item.code,
              name: comp?.name ?? item.code,
              nature: comp?.nature ?? "info",
              formula: item.formula || comp?.formula || "",
              custom: !!item.formula,
            };
          });
          const count = (n: PayrollNature) =>
            lines.filter((l) => l.nature === n).length;
          return (
            <article
              key={row.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] transition-shadow hover:shadow-md"
            >
              <div
                className={cn(
                  "h-1",
                  row.is_default ? "bg-accent-500" : "bg-brand-600",
                )}
              />
              <div className="flex items-start gap-3 p-4 pb-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    row.is_default
                      ? "bg-accent-50 text-accent-600"
                      : "bg-brand-50 text-brand-700",
                  )}
                >
                  <Sheet className="size-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 grow">
                  <h3 className="truncate font-semibold text-slate-900">
                    {row.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {count("income")} khoản lương · {count("allowance")} phụ cấp
                    · {count("deduction")} giảm trừ
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Sửa"
                      onClick={() => setDraft({ ...row })}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Xoá"
                      onClick={() => remove(row)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 px-4">
                {row.is_default && <Badge variant="accent">Mẫu mặc định</Badge>}
                {row.roles.map((r) => (
                  <Badge key={r} variant="info">
                    {ACCOUNT_ROLE_LABEL[r] ?? r}
                  </Badge>
                ))}
                {!row.is_default && row.roles.length === 0 && (
                  <span className="text-xs text-slate-400 italic">
                    Chưa gán vị trí — gán riêng từng người ở mục Nhân viên
                  </span>
                )}
              </div>
              <div className="mt-3 flex grow flex-col gap-2 border-t border-slate-100 px-4 py-3">
                {(
                  [
                    ["income", "Chi tiết lương", "bg-emerald-500"],
                    ["allowance", "Các khoản phụ cấp", "bg-sky-500"],
                    ["deduction", "Các khoản giảm trừ", "bg-rose-500"],
                    ["info", "Chỉ để xem", "bg-slate-300"],
                  ] as const
                ).map(([nature, title, dot]) => {
                  const group = lines.filter((l) => l.nature === nature);
                  if (group.length === 0) return null;
                  return (
                    <div key={nature}>
                      <div className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        {title}
                      </div>
                      <ul>
                        {group.map((l) => (
                          <li
                            key={l.code}
                            className="flex items-center gap-2 py-0.5 text-sm"
                            title={
                              l.formula
                                ? `= ${l.formula}`
                                : "Nhập tay mỗi tháng"
                            }
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                dot,
                              )}
                            />
                            <span className="shrink-0 text-slate-700">
                              {l.name}
                            </span>
                            {l.custom && (
                              <span className="rounded bg-amber-50 px-1 text-[10px] text-amber-700">
                                riêng
                              </span>
                            )}
                            <span className="ml-auto min-w-0 truncate font-mono text-[11px] text-slate-400">
                              {!l.formula ? (
                                <span className="font-sans text-slate-400 italic">
                                  nhập tay
                                </span>
                              ) : l.formula === "0" ? (
                                <span className="font-sans italic">
                                  theo từng người
                                </span>
                              ) : (
                                l.formula
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setPreviewing(row)}
                className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                <Eye className="size-4" /> Xem trước phiếu lương
              </button>
            </article>
          );
        })}
      </div>

      {previewing && (
        <Modal
          title={`Xem trước — ${previewing.name}`}
          maxWidth="max-w-xl"
          footer={
            <Button variant="outline" onClick={() => setPreviewing(null)}>
              Đóng
            </Button>
          }
        >
          <TemplatePreview templateId={previewing.id} accounts={people} />
        </Modal>
      )}

      {draft && (
        <Modal
          title={draft.id ? "Sửa mẫu bảng lương" : "Thêm mẫu bảng lương"}
                    maxWidth="max-w-5xl"
          footer={
            <>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Huỷ
              </Button>
              <Button onClick={save} disabled={saving || !draft.name.trim()}>
                Lưu
              </Button>
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
            <div className="flex flex-col gap-3 lg:max-h-[62vh] lg:overflow-y-auto lg:pr-2">
              <Field label="Tên mẫu">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="vd Lương Sale"
                />
              </Field>
              <div>
                <div className="mb-1 text-sm font-medium text-slate-700">
                  Vị trí áp dụng
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {ALL_ROLES.map((role) => (
                    <label
                      key={role}
                      className="flex items-center gap-1.5 text-sm text-slate-700"
                    >
                      <Checkbox
                        checked={draft.roles.includes(role)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            roles: e.target.checked
                              ? [...draft.roles, role]
                              : draft.roles.filter((r) => r !== role),
                          })
                        }
                      />
                      {ACCOUNT_ROLE_LABEL[role]}
                    </label>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.is_default}
                    onChange={(e) =>
                      setDraft({ ...draft, is_default: e.target.checked })
                    }
                  />
                  Dùng làm mẫu mặc định cho vị trí chưa có mẫu riêng
                </label>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium text-slate-700">
                  Các khoản trong mẫu
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Tick khoản cần tính. Ô công thức bỏ trống = dùng công thức gốc
                  của khoản đó.
                </p>
                <div className="flex flex-col gap-3">
                  {(
                    [
                      ["income", "Chi tiết lương"],
                      ["allowance", "Các khoản phụ cấp"],
                      ["deduction", "Các khoản giảm trừ"],
                      ["info", "Chỉ để xem"],
                    ] as const
                  ).map(([nature, title]) => {
                    const group = components.filter((c) => c.nature === nature);
                    if (group.length === 0) return null;
                    return (
                      <div
                        key={nature}
                        className="rounded-xl border border-slate-200 p-2.5"
                      >
                        <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                          {title}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.map((comp) => {
                            const item = draft.items.find(
                              (i) => i.code === comp.code,
                            );
                            return (
                              <div
                                key={comp.code}
                                className="flex items-center gap-2"
                              >
                                <label className="flex w-40 shrink-0 items-center gap-1.5 text-sm text-slate-700">
                                  <Checkbox
                                    checked={!!item}
                                    onChange={() => toggleItem(comp.code)}
                                  />
                                  <span className="truncate">{comp.name}</span>
                                </label>
                                <Input
                                  uiSize="xs"
                                  className="font-mono"
                                  disabled={!item}
                                  placeholder={
                                    !comp.formula
                                      ? "nhập tay"
                                      : comp.formula === "0"
                                        ? "theo từng người"
                                        : comp.formula
                                  }
                                  value={item?.formula ?? ""}
                                  onChange={(e) =>
                                    setDraft({
                                      ...draft,
                                      items: draft.items.map((i) =>
                                        i.code === comp.code
                                          ? { ...i, formula: e.target.value }
                                          : i,
                                      ),
                                    })
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Xem trước ngay bên cạnh, dính khi cuộn danh sách khoản. */}
            <div className="lg:sticky lg:top-0 lg:self-start">
              <TemplatePreview
                items={draft.items}
                name={draft.name}
                accounts={people}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Mức lương nhân viên ───────────────────────────────────────────────────────

type SettingDraft = {
  row: PayrollAccountSetting;
  base: string;
  rate: string;
  template_id: string;
  overrides: Record<string, string>;
  official_date: string;
  bank_name: string;
  bank_account_holder: string;
};

export function AccountSettingsPanel({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<PayrollAccountSetting[]>([]);
  const [templates, setTemplates] = useState<PayrollTemplate[]>([]);
  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState<SettingDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([
      payrollApi.accountSettings(),
      payrollApi.templates(),
      payrollApi.components(),
    ])
      .then(([a, t, c]) => {
        setRows(a);
        setTemplates(t);
        setComponents(c);
      })
      .catch((e) => toast.error(errText(e, "Không tải được mức lương")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  const templateOf = (row: PayrollAccountSetting) =>
    templates.find((t) => t.id === row.template_id) ??
    templates.find((t) => t.roles.includes(row.role)) ??
    templates.find((t) => t.is_default);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await payrollApi.saveAccountSetting(draft.row.account_id, {
        base_salary: parseMoney(draft.base),
        commission_rate: parseMoney(draft.rate),
        template_id: draft.template_id || null,
        overrides: draft.overrides,
        official_date: draft.official_date || null,
        bank_name: draft.bank_name || null,
        bank_account_holder: draft.bank_account_holder || null,
      });
      toast.success("Đã lưu mức lương");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error(errText(e, "Không lưu được"));
    } finally {
      setSaving(false);
    }
  }

  const kw = keyword.trim().toLowerCase();
  const shown = kw
    ? rows.filter((r) => r.full_name.toLowerCase().includes(kw))
    : rows;
  const draftTemplate = draft
    ? (templates.find((t) => t.id === draft.template_id) ??
      templateOf({ ...draft.row, template_id: null }))
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          uiSize="sm"
          className="w-56"
          placeholder="Tìm theo tên"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className={thClass}>Họ và tên</th>
              <th className={thClass}>Vị trí</th>
              <th className={thClass}>Nhóm</th>
              <th className={`${thClass} text-right`}>Lương cơ bản</th>
              <th className={`${thClass} text-right`}>Mức hoa hồng</th>
              <th className={thClass}>Mẫu bảng lương</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.account_id}>
                <td className={tdClass}>{row.full_name}</td>
                <td className={tdClass}>
                  {row.position || ACCOUNT_ROLE_LABEL[row.role]}
                </td>
                <td className={tdClass}>{row.team_name ?? "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {row.base_salary ? (
                    formatMoney(row.base_salary)
                  ) : (
                    <span className="text-slate-300">chưa đặt</span>
                  )}
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {row.commission_rate ? formatMoney(row.commission_rate) : "—"}
                </td>
                <td className={tdClass}>
                  {templateOf(row)?.name ?? "—"}
                  {row.template_id && (
                    <Badge variant="accent" className="ml-1">
                      Riêng
                    </Badge>
                  )}
                  {Object.keys(row.overrides).length > 0 && (
                    <Badge variant="warning" className="ml-1">
                      Công thức riêng
                    </Badge>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>
                  {canEdit && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          row,
                          base: row.base_salary
                            ? formatMoney(row.base_salary)
                            : "",
                          rate: row.commission_rate
                            ? formatMoney(row.commission_rate)
                            : "",
                          template_id: row.template_id ?? "",
                          overrides: { ...row.overrides },
                          official_date: row.official_date ?? "",
                          bank_name: row.bank_name ?? "",
                          bank_account_holder: row.bank_account_holder ?? "",
                        })
                      }
                    >
                      Sửa
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <Modal
          title={`Mức lương — ${draft.row.full_name}`}
          maxWidth="max-w-xl"
          footer={
            <>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Huỷ
              </Button>
              <Button onClick={save} disabled={saving}>
                Lưu
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lương cơ bản (đ/tháng)">
                <Input
                  inputMode="numeric"
                  value={draft.base}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      base: e.target.value
                        ? formatMoney(parseMoney(e.target.value))
                        : "",
                    })
                  }
                />
              </Field>
              <Field
                label="Hoa hồng theo đầu người"
                hint="vd 50.000đ/người. Bỏ trống = Doanh số tính theo giờ × mức công ty"
              >
                <Input
                  inputMode="numeric"
                  value={draft.rate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rate: e.target.value
                        ? formatMoney(parseMoney(e.target.value))
                        : "",
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Ngày bắt đầu làm việc"
                hint="Sửa ở Quản lý tài khoản"
              >
                <Input
                  value={
                    draft.row.hire_date
                      ? draft.row.hire_date.split("-").reverse().join("/")
                      : "—"
                  }
                  disabled
                />
              </Field>
              <Field
                label="Ngày chính thức"
                hint="Công trước ngày này hưởng lương thử việc 85%"
              >
                <Input
                  type="date"
                  value={draft.official_date}
                  onChange={(e) =>
                    setDraft({ ...draft, official_date: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Số TK" hint="Sửa ở Quản lý tài khoản">
                <Input
                  value={draft.row.bank_account_number ?? "—"}
                  disabled
                  className="font-mono"
                />
              </Field>
              <Field label="Ngân hàng">
                <Input
                  value={draft.bank_name}
                  maxLength={100}
                  placeholder="VIETCOMBANK"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bank_name: e.target.value.toUpperCase(),
                    })
                  }
                />
              </Field>
              <Field label="Chủ TK">
                <Input
                  value={draft.bank_account_holder}
                  maxLength={150}
                  placeholder="PHAM MINH QUANG"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bank_account_holder: e.target.value.toUpperCase(),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Mẫu bảng lương">
              <Select
                value={draft.template_id}
                onChange={(e) =>
                  setDraft({ ...draft, template_id: e.target.value })
                }
              >
                <option value="">
                  Theo vị trí (
                  {templateOf({ ...draft.row, template_id: null })?.name ??
                    "chưa có mẫu"}
                  )
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Công thức riêng của người này
              </div>
              <p className="mb-2 text-xs text-slate-500">
                Phụ cấp, bảo hiểm cố định của người này điền ở đây (vd 1500000).
                Bỏ trống = tính như mẫu.
              </p>
              <div className="flex flex-col gap-1.5">
                {(draftTemplate?.items ?? []).map((item) => {
                  const comp = components.find((c) => c.code === item.code);
                  return (
                    <div key={item.code} className="flex items-center gap-2">
                      <span className="w-44 shrink-0 text-sm text-slate-700">
                        {comp?.name ?? item.code}
                      </span>
                      <Input
                        uiSize="sm"
                        className="font-mono"
                        placeholder={item.formula || comp?.formula || "0"}
                        value={draft.overrides[item.code] ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            overrides: {
                              ...draft.overrides,
                              [item.code]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Hoa hồng theo công ty ─────────────────────────────────────────────────────

export function CommissionRatesPanel({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<CommissionRate[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = () =>
    payrollApi
      .commissionRates()
      .then((r) => {
        setRows(r);
        setValues(
          Object.fromEntries(
            r.map((x) => [
              x.company_id,
              x.rate_per_hour ? formatMoney(x.rate_per_hour) : "",
            ]),
          ),
        );
      })
      .catch((e) => toast.error(errText(e, "Không tải được mức hoa hồng")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  const changed = rows.filter(
    (r) => parseMoney(values[r.company_id] ?? "") !== r.rate_per_hour,
  );

  async function save() {
    setSaving(true);
    try {
      await payrollApi.saveCommissionRates(
        changed.map((r) => ({
          company_id: r.company_id,
          rate_per_hour: parseMoney(values[r.company_id] ?? ""),
        })),
      );
      toast.success("Đã lưu mức hoa hồng");
      await load();
    } catch (e) {
      toast.error(errText(e, "Không lưu được"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        {canEdit && (
          <Button
            size="sm"
            onClick={save}
            disabled={saving || changed.length === 0}
          >
            Lưu{changed.length ? ` (${changed.length})` : ""}
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thClass}>Công ty</th>
              <th className={`${thClass} w-48 text-right`}>Hoa hồng (đ/giờ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.company_id}>
                <td className={tdClass}>{row.company_name}</td>
                <td className={`${tdClass} text-right`}>
                  <Input
                    uiSize="sm"
                    inputMode="numeric"
                    className="text-right tabular-nums"
                    disabled={!canEdit}
                    placeholder="0"
                    value={values[row.company_id] ?? ""}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [row.company_id]: e.target.value
                          ? formatMoney(parseMoney(e.target.value))
                          : "",
                      })
                    }
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  className={`${tdClass} text-center text-slate-400`}
                  colSpan={2}
                >
                  Chưa có công ty nào (thêm ở Quản lý đơn hàng)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
