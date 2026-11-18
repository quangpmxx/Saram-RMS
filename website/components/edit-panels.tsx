"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, History, ImageUp, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { LISTS, newItemId, type ListName } from "@/lib/lists";
import { errorMessage } from "@/lib/editor";

/* ---------- Sửa danh sách (thêm / xoá / sắp xếp mục) ---------- */

type Row = { id: string; _label?: string } & Record<string, string>;

/**
 * Bảng sửa một danh sách (lib/lists.ts). Chữ của từng mục vẫn gõ thẳng trên trang;
 * ở đây chỉ thêm, xoá, đổi thứ tự và sửa trường không gõ được trên trang (con số, logo, tên đối tác).
 * onApply nhận JSON lưu vào mã list.<tên>.
 */
export function ListEditor({
  name,
  initial,
  upload,
  onClose,
  onApply,
}: {
  name: ListName;
  initial: Row[];
  upload: (file: File) => Promise<string | null>;
  onClose: () => void;
  onApply: (json: string) => void;
}) {
  const def = LISTS[name];
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState(false);
  const extra = def.fields.filter((f) => !f.inline);

  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const n = [...r];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const set = (i: number, key: string, value: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  function add() {
    const row: Row = { id: newItemId(), _label: "(mục mới — gõ chữ trên trang sau khi lưu)" };
    for (const f of def.fields) row[f.key] = f.placeholder;
    setRows((r) => [...r, row]);
  }

  function apply() {
    // Lưu: id + mọi trường (mục mới cần chữ mặc định; mục gốc lưu thêm cũng không sao).
    const out = rows.map((r) => ({ id: r.id, f: Object.fromEntries(def.fields.map((f) => [f.key, r[f.key] ?? ""])) }));
    onApply(JSON.stringify(out));
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-bold">Sửa danh sách: {def.label}</p>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Thêm, xoá, đổi thứ tự mục ở đây. Chữ của từng mục thì bấm thẳng vào chữ trên trang để gõ (mục mới hiện chữ mẫu sau khi lưu).
        </p>
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r._label ?? r.id}</span>
                <button type="button" className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} title="Lên">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Xuống">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                  onClick={() => window.confirm("Xoá mục này khỏi danh sách?") && setRows((x) => x.filter((_, j) => j !== i))}
                  title="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {extra.length > 0 && (
                <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
                  {extra.map((f) =>
                    f.kind === "image" ? (
                      <div key={f.key} className="flex items-center gap-2 text-xs">
                        {r[f.key] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r[f.key].startsWith("/uploads/") ? `/api${r[f.key]}` : r[f.key]} alt="" className="h-10 w-16 rounded border object-contain" />
                        )}
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 font-semibold hover:border-ink">
                          <ImageUp className="h-3.5 w-3.5" /> {f.label}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={busy}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              setBusy(true);
                              const url = await upload(file);
                              setBusy(false);
                              if (url) set(i, f.key, url);
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <label key={f.key} className="text-xs">
                        {f.label}
                        <input
                          value={r[f.key] ?? ""}
                          inputMode={f.kind === "number" ? "numeric" : undefined}
                          onChange={(e) => set(i, f.key, f.kind === "number" ? e.target.value.replace(/\D/g, "").slice(0, 9) : e.target.value.slice(0, 200))}
                          className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                      </label>
                    ),
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-ink disabled:opacity-40"
            disabled={rows.length >= def.max}
            onClick={add}
          >
            <Plus className="h-4 w-4" /> Thêm mục {rows.length >= def.max ? `(tối đa ${def.max})` : ""}
          </button>
          <button type="button" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50" disabled={busy} onClick={apply}>
            Lưu danh sách
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Lịch sử sửa ---------- */

type HistoryRow = { id: string; key: string; old_value: string | null; new_value: string | null; account_name: string | null; created_at: string };

/** Tên dễ hiểu cho mã nội dung. */
function describeKey(key: string): string {
  if (key.startsWith("theme.")) return "Màu / font / cỡ chữ cả trang";
  if (key.startsWith("site.")) return "Cài đặt chung (liên hệ, mã theo dõi, ảnh chia sẻ)";
  if (key.startsWith("seo.")) return "Tiêu đề / mô tả Google";
  if (key.startsWith("layout.")) return "Thứ tự / ẩn khối";
  if (key.startsWith("block.")) return "Nền / khoảng cách khối";
  if (key.startsWith("custom.")) return "Thêm / xoá khối";
  if (key.startsWith("list.")) return `Danh sách: ${LISTS[key.slice(5) as ListName]?.label ?? key.slice(5)}`;
  if (key === "pages") return "Trang tự thêm";
  if (key.endsWith(".__style")) return "Kiểu chữ / ảnh";
  if (key.endsWith(".__href")) return "Đường dẫn nút";
  if (key.endsWith(".__btn")) return "Kiểu nút";
  return "Chữ / ảnh";
}

const short = (v: string | null) => (v === null ? "(bản gốc)" : v.startsWith("/uploads/") ? "(ảnh)" : v.length > 60 ? `${v.slice(0, 60)}…` : v);

export function HistoryPanel({ onRestored }: { onRestored: () => void }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/website/manage/history?limit=150")
      .then(async (res) => (res.ok ? setRows((await res.json()) as HistoryRow[]) : setMsg(await errorMessage(res, "Không tải được lịch sử"))))
      .catch(() => setMsg("Không kết nối được máy chủ"));
  }, []);

  async function restore(r: HistoryRow) {
    if (!window.confirm(`Quay về giá trị trước lần sửa này?\n${describeKey(r.key)}: ${short(r.old_value)}\n\nChỗ chưa lưu (nếu có) sẽ bị bỏ.`)) return;
    setBusy(true);
    const res = await fetch(`/api/website/manage/history/${r.id}/restore`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setMsg(res ? await errorMessage(res, "Không quay lại được") : "Không kết nối được máy chủ");
      return;
    }
    onRestored();
  }

  return (
    <div className="mb-2 space-y-2 rounded-xl bg-white/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        <History className="h-4 w-4" /> Lịch sử sửa (mới nhất trước)
      </p>
      {msg && <p className="text-xs text-red-300">{msg}</p>}
      {!rows && !msg && <p className="text-xs text-slate-400">Đang tải…</p>}
      {rows?.length === 0 && <p className="text-xs text-slate-400">Chưa có lần sửa nào.</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {rows?.map((r) => (
          <li key={r.id} className="flex items-start gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="text-slate-300">
                {new Date(r.created_at).toLocaleString("vi-VN")} · {r.account_name ?? "?"} · <span className="text-orange-300">{describeKey(r.key)}</span>
              </p>
              <p className="truncate text-slate-400">
                {short(r.old_value)} → {short(r.new_value)}
              </p>
            </div>
            <button type="button" disabled={busy} title="Quay về giá trị trước lần sửa này" className="shrink-0 rounded-lg p-1.5 hover:bg-white/20" onClick={() => void restore(r)}>
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
