"use client";

import { useState } from "react";
import { ApiError, clientApiUpload } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface SheetReport {
  name: string;
  header_found: boolean;
  columns: string[];
  rows: number;
  will_create: number;
  bad_date: number;
}

interface PreviewResult {
  sheets: SheetReport[];
  /** Tên cột → các giá trị không đối chiếu được (sẽ để trống). */
  unmatched: Record<string, { value: string; count: number }[]>;
  bad_dates: { sheet: string; row: number; value: string }[];
  /** Tên NV đưa đón trong sheet + tài khoản gợi ý (exact = khớp chính xác 100%). */
  drivers: { value: string; count: number; exact: boolean; suggested_account_id: string | null }[];
  driver_accounts: { id: string; name: string }[];
}

const num = (n: number) => n.toLocaleString("vi-VN");

/**
 * Nhập danh sách đưa đón cũ từ Excel (chỉ Admin, yêu cầu người dùng 2026-11-08): chọn file →
 * xem trước từng sheet + các giá trị không đối chiếu được (sẽ để trống) → chọn sheet → nhập.
 */
export function ShuttleImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** Tên NV đưa đón trong sheet → id tài khoản ("" = để trống). */
  const [driverMap, setDriverMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview(f: File) {
    setFile(f);
    setPreview(null);
    setError(null);
    setBusy("Đang đọc file…");
    try {
      const data = new FormData();
      data.append("file", f);
      const res = await clientApiUpload<PreviewResult>("/shuttle/import/preview", data);
      setPreview(res);
      setDriverMap(
        Object.fromEntries(res.drivers.map((d) => [d.value, d.suggested_account_id ?? ""])),
      );
      setPicked(
        new Set(res.sheets.filter((s) => s.will_create > 0).map((s) => s.name)),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setError(null);
    setBusy("Đang nhập…");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("sheets", JSON.stringify([...picked]));
      data.append(
        "drivers",
        JSON.stringify(Object.fromEntries(Object.entries(driverMap).map(([k, v]) => [k, v || null]))),
      );
      const res = await clientApiUpload<{ created: number }>("/shuttle/import/commit", data);
      toast.success(`Đã nhập ${num(res.created)} dòng đưa đón`);
      onImported();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  const willCreate = (preview?.sheets ?? [])
    .filter((s) => picked.has(s.name))
    .reduce((sum, s) => sum + s.will_create, 0);
  const unmatched = Object.entries(preview?.unmatched ?? {}).filter(
    ([, values]) => values.length > 0,
  );

  return (
    <Modal
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled={!!busy || !preview || willCreate === 0}
            onClick={() => void handleCommit()}
          >
            {busy === "Đang nhập…" ? busy : `Nhập ${num(willCreate)} dòng`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <input
            type="file"
            accept=".xlsx"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePreview(f);
            }}
          />
        </div>

        {busy && <p className="text-slate-500">{busy}</p>}
        {error && <p className="text-red-600">{error}</p>}

        {preview && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5" />
                    <th className="px-2 py-1.5 text-left">Sheet</th>
                    <th className="px-2 py-1.5 text-left">Cột nhận được</th>
                    <th className="px-2 py-1.5">Số dòng</th>
                    <th className="px-2 py-1.5">Sẽ nhập</th>
                    <th className="px-2 py-1.5">Sai ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sheets.map((s) => (
                    <tr key={s.name} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          className="size-4"
                          disabled={s.will_create === 0}
                          checked={picked.has(s.name)}
                          onChange={() =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.name)) next.delete(s.name);
                              else next.add(s.name);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 font-medium">{s.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {s.header_found ? (
                          s.columns.join(", ")
                        ) : (
                          <span className="text-amber-600">
                            Không thấy dòng tiêu đề (cần cột Ngày + Họ tên/SĐT)
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">{num(s.rows)}</td>
                      <td className="px-2 py-1.5 text-center font-semibold text-emerald-700">
                        {num(s.will_create)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-center ${s.bad_date ? "text-red-600" : ""}`}
                      >
                        {num(s.bad_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {unmatched.length > 0 && (
              <div>
                <p className="mb-1 font-semibold text-slate-700">
                  Giá trị không đối chiếu được — sẽ để trống
                </p>
                <p className="mb-2 text-xs text-slate-500">
                  Muốn nhận đúng thì sửa trong sheet cho khớp tên trong phần mềm (hoặc thêm lựa chọn
                  / đơn hàng / tài khoản) rồi chọn lại file.
                </p>
                <div className="space-y-2">
                  {unmatched.map(([column, values]) => (
                    <div key={column} className="text-xs">
                      <span className="font-medium text-slate-700">{column}: </span>
                      <span className="text-slate-600">
                        {values.map((v) => `${v.value} (${num(v.count)})`).join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.drivers.length > 0 && (
              <div>
                <p className="mb-1 font-semibold text-slate-700">NV đưa đón — kiểm tra trước khi nhập</p>
                <p className="mb-2 text-xs text-slate-500">
                  Tên không khớp chính xác đã được gợi ý người giống nhất — sửa lại nếu sai, hoặc chọn
                  “Để trống”.
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Tên trong sheet</th>
                        <th className="px-2 py-1.5">Số dòng</th>
                        <th className="px-2 py-1.5 text-left">Tài khoản trong phần mềm</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {preview.drivers.map((d) => (
                        <tr
                          key={d.value}
                          className={`border-t border-slate-100 ${d.exact ? "" : "bg-amber-50"}`}
                        >
                          <td className="px-2 py-1.5 font-medium">{d.value}</td>
                          <td className="px-2 py-1.5 text-center">{num(d.count)}</td>
                          <td className="px-2 py-1.5">
                            <select
                              className="w-full rounded border border-slate-300 bg-white px-1.5 py-1"
                              value={driverMap[d.value] ?? ""}
                              onChange={(e) =>
                                setDriverMap((prev) => ({ ...prev, [d.value]: e.target.value }))
                              }
                            >
                              <option value="">— Để trống —</option>
                              {preview.driver_accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {d.exact ? (
                              <span className="text-emerald-700">Khớp chính xác</span>
                            ) : (
                              <span className="font-medium text-amber-700">Cần xác nhận</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.bad_dates.length > 0 && (
              <div>
                <p className="mb-1 font-semibold text-red-600">
                  Dòng không đọc được ngày — sẽ bỏ qua
                </p>
                <ul className="space-y-0.5 text-xs text-slate-600">
                  {preview.bad_dates.map((b) => (
                    <li key={`${b.sheet}-${b.row}`}>
                      Sheet “{b.sheet}”, dòng {b.row}: “{b.value || "(trống)"}”
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
