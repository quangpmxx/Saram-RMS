"use client";

import { useState } from "react";
import { History, UploadCloud } from "lucide-react";
import { ApiError, clientApiUpload } from "@/lib/api-client";
import type { Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

interface RowError {
  row: number;
  message: string;
}

interface PreviewResult {
  sheets: string[];
  sheet?: string;
  team?: { id: string; name: string };
  members?: { id: string; name: string; role: string }[];
  missing_columns?: string[];
  rows_read?: number;
  will_create?: number;
  merged_in_file?: number;
  existing_in_system?: number;
  errors?: RowError[];
  staff?: {
    label: string;
    count: number;
    suggested_account_id: string | null;
  }[];
}

interface CommitResult {
  sheet: string;
  team: string;
  created: number;
  unassigned: number;
  notes: number;
  merged_in_file: number;
  skipped_existing: { row: number; phone: string; full_name: string }[];
  errors: RowError[];
}

const COLUMN_LABEL: Record<string, string> = {
  staff: "Nhân viên",
  fullName: "Họ tên ứng viên",
  callNotes: "Tình trạng cuộc gọi",
};

/**
 * "Tải data cũ" (yêu cầu người dùng 2026-10-30) — chuyển kho data trên
 * Google Sheet "DATA MKT" vào hệ thống, giữ người phụ trách + toàn bộ ghi
 * chú cũ (gộp 1 ghi chú "Hệ thống"). 3 bước: chọn file → chọn sheet/nhóm,
 * xem trước + ghép tên nhân viên với tài khoản → tải lên. Chỉ Admin.
 */
export function LegacyImportModal({
  teams,
  onClose,
  onFinished,
}: {
  teams: Team[];
  onClose: () => void;
  onFinished: (result: CommitResult) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState("");
  const [teamId, setTeamId] = useState("");
  const [limit, setLimit] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function formData(extra: Record<string, string>) {
    const data = new FormData();
    data.append("file", file!);
    for (const [key, value] of Object.entries(extra))
      if (value) data.append(key, value);
    return data;
  }

  async function run<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    setError(null);
    setBusy(label);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handlePickFile(picked: File | null) {
    setFile(picked);
    setSheets(null);
    setPreview(null);
    if (!picked) return;
    const data = new FormData();
    data.append("file", picked);
    const res = await run("Đang đọc file...", () =>
      clientApiUpload<PreviewResult>("/candidate/legacy-import/preview", data),
    );
    if (res) {
      setSheets(res.sheets);
      setSheet(res.sheets[0] ?? "");
    }
  }

  async function handlePreview() {
    const res = await run("Đang xem trước...", () =>
      clientApiUpload<PreviewResult>(
        "/candidate/legacy-import/preview",
        formData({ sheet, team_id: teamId, limit }),
      ),
    );
    if (!res) return;
    setPreview(res);
    setMapping(
      Object.fromEntries(
        (res.staff ?? []).map((s) => [s.label, s.suggested_account_id ?? ""]),
      ),
    );
  }

  async function handleCommit() {
    const payload = Object.fromEntries(
      Object.entries(mapping).map(([label, id]) => [label, id || null]),
    );
    const res = await run("Đang tải lên...", () =>
      clientApiUpload<CommitResult>(
        "/candidate/legacy-import/commit",
        formData({
          sheet,
          team_id: teamId,
          limit,
          mapping: JSON.stringify(payload),
        }),
      ),
    );
    if (!res) return;
    setResult(res);
    await onFinished(res);
  }

  const unmappedCount = (preview?.staff ?? [])
    .filter((s) => !mapping[s.label])
    .reduce((n, s) => n + s.count, 0);

  return (
    <Modal
      title="Tải data cũ"
      description="Chuyển kho data đang quản lý trên Google Sheet vào hệ thống: giữ Sale phụ trách, gộp cột Tình trạng cuộc gọi thành 1 ghi chú của Hệ thống. SĐT đã có trong hệ thống sẽ được bỏ qua."
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {result ? "Đóng" : "Hủy"}
          </Button>
          {!result && sheets && !preview && (
            <Button
              type="button"
              disabled={!!busy || !sheet || !teamId}
              onClick={() => void handlePreview()}
            >
              {busy ?? "Xem trước"}
            </Button>
          )}
          {!result && preview && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!!busy}
                onClick={() => setPreview(null)}
              >
                Quay lại
              </Button>
              <Button
                type="button"
                disabled={!!busy || !preview.will_create}
                onClick={() => void handleCommit()}
              >
                <UploadCloud className="h-4 w-4" strokeWidth={2} />
                {busy ?? `Tải lên ${preview.will_create ?? 0} data`}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {!result && !preview && (
          <>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
              <History className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
              <span className="font-medium text-slate-600">
                {file
                  ? file.name
                  : "Chọn file .xlsx tải từ Google Sheet (Tệp → Tải xuống → Microsoft Excel)"}
              </span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) =>
                  void handlePickFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            {busy && !sheets && <p className="text-slate-500">{busy}</p>}
            {sheets && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Sheet">
                  <Select
                    value={sheet}
                    onChange={(event) => setSheet(event.target.value)}
                  >
                    {sheets.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nhóm nhận data">
                  <Select
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                  >
                    <option value="">— Chọn nhóm —</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Số dòng đầu tiên" hint="Bỏ trống = cả sheet">
                  <Input
                    type="number"
                    min={1}
                    value={limit}
                    placeholder="Tất cả"
                    onChange={(event) => setLimit(event.target.value)}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {!result && preview && (
          <>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              Sheet <b>{preview.sheet}</b> → <b>{preview.team?.name}</b>: đọc{" "}
              {preview.rows_read} dòng, sẽ tạo{" "}
              <b className="text-brand-700">{preview.will_create}</b> data.
              {!!preview.merged_in_file && (
                <>
                  {" "}
                  {preview.merged_in_file} dòng trùng SĐT trong file được gộp
                  ghi chú.
                </>
              )}
              {!!preview.existing_in_system && (
                <>
                  {" "}
                  {preview.existing_in_system} SĐT đã có trong hệ thống → bỏ
                  qua.
                </>
              )}
              {!!preview.errors?.length && (
                <> {preview.errors.length} dòng lỗi → bỏ qua.</>
              )}
            </div>
            {!!preview.missing_columns?.length && (
              <p className="text-amber-700">
                Sheet thiếu cột:{" "}
                {preview.missing_columns
                  .map((c) => COLUMN_LABEL[c] ?? c)
                  .join(", ")}
                .
              </p>
            )}
            <div>
              <p className="mb-1 font-medium text-slate-700">
                Ghép tên ở cột Nhân viên với tài khoản
              </p>
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {preview.staff?.map((s) => (
                      <tr key={s.label}>
                        <td className="px-2 py-1.5 font-medium text-slate-700">
                          {s.label || "(trống)"}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {s.count} data
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            uiSize="xs"
                            value={mapping[s.label] ?? ""}
                            onChange={(event) =>
                              setMapping((m) => ({
                                ...m,
                                [s.label]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Chờ phân chia</option>
                            {preview.members?.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                                {m.role === "leader" ? " (Leader)" : ""}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {unmappedCount > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  {unmappedCount} data chưa ghép tài khoản sẽ vào &quot;Chờ phân
                  chia&quot; của {preview.team?.name}.
                </p>
              )}
            </div>
            {!!preview.errors?.length && <ErrorList errors={preview.errors} />}
          </>
        )}

        {result && (
          <>
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
              Đã tạo <b>{result.created}</b> data cho {result.team} (
              {result.notes} có ghi chú cũ
              {result.unassigned ? `, ${result.unassigned} chờ phân chia` : ""}
              ).
            </div>
            {result.skipped_existing.length > 0 && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer">
                  {result.skipped_existing.length} SĐT đã có trong hệ thống — bỏ
                  qua
                </summary>
                <ul className="mt-1 max-h-40 overflow-auto">
                  {result.skipped_existing.map((s) => (
                    <li key={s.row}>
                      Dòng {s.row}: {s.phone} {s.full_name}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {result.errors.length > 0 && <ErrorList errors={result.errors} />}
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  return (
    <details className="text-xs text-amber-800">
      <summary className="cursor-pointer">
        {errors.length} dòng lỗi (bỏ qua)
      </summary>
      <ul className="mt-1 max-h-40 overflow-auto">
        {errors.map((e) => (
          <li key={e.row}>
            Dòng {e.row}: {e.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
