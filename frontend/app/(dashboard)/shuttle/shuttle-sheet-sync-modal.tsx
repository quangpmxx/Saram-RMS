"use client";

import { useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface SheetConfig {
  configured: boolean;
  spreadsheet_url: string | null;
  client_email: string | null;
}

interface PreviewResult {
  tabs: string[];
  /** null = không tự tìm được tab của tháng này → người dùng chọn. */
  tab: string | null;
  sheets?: { name: string; header_found: boolean; columns: string[]; rows: number; bad_date: number }[];
  will_create?: number;
  will_update?: number;
  unchanged?: number;
}

const num = (n: number) => n.toLocaleString("vi-VN");
const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Có lỗi xảy ra");

/**
 * Đồng bộ Danh sách đưa đón từ Google Sheet (yêu cầu người dùng 2026-11-10): mở ra là đọc sheet
 * + xem trước (thêm mới / cập nhật) → bấm Đồng bộ. Admin có thêm phần Cài đặt (link sheet + chìa
 * khoá robot). Dòng đã có: chỉ cập nhật cột thông tin, giữ Tình trạng đón + Kết quả PV. Ô nào
 * không đối chiếu được (công ty, Sale, NV đưa đón…) thì để trống, không hỏi (người dùng 2026-11-10).
 */
export function ShuttleSheetSyncModal({
  isAdmin,
  onClose,
  onSynced,
}: {
  isAdmin: boolean;
  onClose: () => void;
  onSynced: () => void;
}) {
  const toast = useToast();
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [url, setUrl] = useState("");
  const [keyJson, setKeyJson] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<string | null>("Đang kiểm tra…");
  const [error, setError] = useState<string | null>(null);

  async function loadPreview(tab?: string) {
    setError(null);
    setPreview(null);
    setBusy("Đang đọc Google Sheet…");
    try {
      const res = await clientApi<PreviewResult>("/shuttle/sheet-sync/preview", {
        method: "POST",
        body: JSON.stringify(tab ? { tab } : {}),
      });
      setPreview(res);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await clientApi<SheetConfig>("/shuttle/sheet-sync/config");
        if (cancelled) return;
        setConfig(cfg);
        setUrl(cfg.spreadsheet_url ?? "");
        if (cfg.configured) {
          await loadPreview();
        } else {
          setShowSettings(isAdmin);
          setBusy(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(errorText(e));
        setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy 1 lần khi mở cửa sổ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveConfig() {
    setError(null);
    setBusy("Đang lưu và thử đọc sheet…");
    try {
      const cfg = await clientApi<SheetConfig & { tabs: string[] }>("/shuttle/sheet-sync/config", {
        method: "PUT",
        body: JSON.stringify({
          spreadsheet_url: url,
          ...(keyJson.trim() ? { service_account_json: keyJson } : {}),
        }),
      });
      setConfig(cfg);
      setKeyJson("");
      setShowSettings(false);
      toast.success(`Đã kết nối Google Sheet (${num(cfg.tabs.length)} tab)`);
      await loadPreview();
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!preview?.tab) return;
    setError(null);
    setBusy("Đang đồng bộ…");
    try {
      const res = await clientApi<{ created: number; updated: number }>("/shuttle/sheet-sync/commit", {
        method: "POST",
        body: JSON.stringify({ tab: preview.tab }),
      });
      toast.success(`Đã đồng bộ: thêm ${num(res.created)} dòng, cập nhật ${num(res.updated)} dòng`);
      onSynced();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  const sheet = preview?.sheets?.[0];
  const willCreate = preview?.will_create ?? 0;
  const willUpdate = preview?.will_update ?? 0;

  return (
    <Modal
      title="Đồng bộ từ Google Sheet"
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {!showSettings && (
            <Button
              type="button"
              disabled={!!busy || !preview?.tab || willCreate + willUpdate === 0}
              onClick={() => void handleCommit()}
            >
              {busy === "Đang đồng bộ…"
                ? busy
                : `Đồng bộ (thêm ${num(willCreate)}, cập nhật ${num(willUpdate)})`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {config && !config.configured && !isAdmin && (
          <p className="text-slate-600">
            Chưa cài đặt Google Sheet — nhờ Admin mở cửa sổ này để dán link sheet và chìa khoá robot.
          </p>
        )}

        {isAdmin && config && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-slate-600">
                {config.configured ? (
                  <>
                    Sheet đang dùng:{" "}
                    <a
                      className="text-blue-600 underline"
                      href={config.spreadsheet_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      mở Google Sheet
                    </a>
                    <span className="block break-all">Email robot: {config.client_email}</span>
                  </>
                ) : (
                  "Chưa kết nối Google Sheet."
                )}
              </div>
              {config.configured && (
                <Button type="button" size="xs" variant="outline" onClick={() => setShowSettings((v) => !v)}>
                  {showSettings ? "Ẩn cài đặt" : "Cài đặt"}
                </Button>
              )}
            </div>
            {showSettings && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Link Google Sheet
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Chìa khoá robot
                  <textarea
                    className="mt-1 h-24 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs font-normal"
                    value={keyJson}
                    onChange={(e) => setKeyJson(e.target.value)}
                    placeholder={config.configured ? "Để trống = giữ chìa khoá đang dùng" : '{ "type": "service_account", … }'}
                  />
                </label>
                <Button type="button" size="xs" disabled={!!busy || !url.trim()} onClick={() => void handleSaveConfig()}>
                  Lưu và thử kết nối
                </Button>
              </div>
            )}
          </div>
        )}

        {busy && <p className="text-slate-500">{busy}</p>}
        {error && <p className="text-red-600">{error}</p>}

        {preview && !showSettings && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-700">Tab:</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1"
                value={preview.tab ?? ""}
                disabled={!!busy}
                onChange={(e) => {
                  if (e.target.value) void loadPreview(e.target.value);
                }}
              >
                {!preview.tab && <option value="">— Chọn tab —</option>}
                {preview.tabs.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!!busy || !preview.tab}
                onClick={() => void loadPreview(preview.tab ?? undefined)}
              >
                Đọc lại sheet
              </Button>
            </div>

            {!preview.tab && (
              <p className="text-amber-700">
                Không thấy tab của tháng này (dạng “T11.2026”) — chọn tab cần đồng bộ ở trên.
              </p>
            )}

            {sheet && !sheet.header_found && (
              <p className="text-amber-700">
                Không thấy dòng tiêu đề trong 10 dòng đầu của tab (cần cột Ngày + Họ tên/SĐT).
              </p>
            )}

            {sheet?.header_found && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Thêm mới", willCreate, "text-emerald-700"],
                    ["Cập nhật", willUpdate, "text-blue-700"],
                    ["Không đổi", preview.unchanged ?? 0, "text-slate-600"],
                    ["Sai ngày (bỏ qua)", sheet.bad_date, sheet.bad_date ? "text-red-600" : "text-slate-600"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-lg border border-slate-200 px-3 py-2 text-center">
                      <div className={`text-lg font-semibold ${color}`}>{num(value as number)}</div>
                      <div className="text-xs text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

          </>
        )}
      </div>
    </Modal>
  );
}
