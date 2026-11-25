"use client";

import { useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";

/**
 * Liên kết AI Gemini cho Trợ lý giọng nói (2026-11-25, yêu cầu người dùng) — chỉ người có quyền
 * voice.ai_config (mặc định Admin). Khoá lưu mã hoá trên máy chủ, không bao giờ hiện lại.
 */
interface AiConfig {
  connected: boolean;
  model: string;
  key_hint?: string;
  updated_at?: string;
  updated_by_name?: string | null;
}

export function AiAssistantSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  /** Lấy danh sách mô hình từ Google theo khoá vừa nhập (hoặc khoá đang lưu). */
  async function loadModels(key?: string) {
    setLoadingModels(true);
    try {
      const list = await clientApi<{ id: string; label: string }[]>("/ai-assistant/models", {
        method: "POST",
        body: JSON.stringify({ api_key: key?.trim() || undefined }),
      });
      setModels(list);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lấy được danh sách mô hình");
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    clientApi<AiConfig>("/ai-assistant/config")
      .then((c) => {
        setCfg(c);
        setModel(c.model);
        if (c.connected) void loadModels();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được cài đặt AI"));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const c = await clientApi<AiConfig>("/ai-assistant/config", {
        method: "PUT",
        body: JSON.stringify({ api_key: apiKey.trim() || undefined, model: model.trim() || undefined }),
      });
      setCfg(c);
      setModel(c.model);
      setApiKey("");
      toast.success("Đã liên kết AI Gemini");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Gỡ liên kết AI? Trợ lý sẽ quay về chế độ hiểu theo từ khoá.")) return;
    setSaving(true);
    try {
      const c = await clientApi<AiConfig>("/ai-assistant/config", { method: "DELETE" });
      setCfg(c);
      toast.success("Đã gỡ liên kết AI");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không gỡ được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {cfg?.connected ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Đang liên kết — khoá kết thúc bằng <b>…{cfg.key_hint}</b>, mô hình <b>{cfg.model}</b>
          {cfg.updated_by_name ? ` · ${cfg.updated_by_name}` : ""}
          {cfg.updated_at ? ` · ${new Date(cfg.updated_at).toLocaleString("vi-VN")}` : ""}
        </p>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Chưa liên kết — Trợ lý đang hiểu câu hỏi theo từ khoá. Lấy khoá miễn phí tại{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline">
            aistudio.google.com/apikey
          </a>
          .
        </p>
      )}
      <Field label={cfg?.connected ? "Khoá API mới (bỏ trống = giữ khoá cũ)" : "Khoá API Gemini"}>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={() => apiKey.trim() && void loadModels(apiKey)}
          placeholder="AIza…"
          autoComplete="off"
        />
      </Field>
      <Field
        label="Mô hình"
        hint={
          loadingModels
            ? "Đang lấy danh sách từ Google…"
            : models.length
              ? "Miễn phí: Flash-Lite ~500 lượt/ngày, Flash chỉ ~20, Pro không có. Mỗi câu hỏi số liệu tốn 2–3 lượt."
              : "Nhập khoá ở trên để hiện đủ danh sách mô hình."
        }
      >
        <Select value={model} onChange={(e) => setModel(e.target.value)} disabled={loadingModels}>
          {/* Luôn có mô hình mặc định + mô hình đang dùng, kể cả khi chưa tải được danh sách. */}
          {[
            { id: "gemini-flash-lite-latest", label: "Gemini Flash-Lite (mới nhất) — khuyên dùng gói miễn phí" },
            ...(model && model !== "gemini-flash-lite-latest" && !models.some((m) => m.id === model)
              ? [{ id: model, label: model }]
              : []),
            ...models.filter((m) => m.id !== "gemini-flash-lite-latest"),
          ].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.label !== m.id ? ` (${m.id})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={saving || (!cfg?.connected && !apiKey.trim())}>
          {saving ? "Đang kiểm tra…" : cfg?.connected ? "Lưu" : "Liên kết"}
        </Button>
        {cfg?.connected && (
          <Button type="button" variant="outline" onClick={remove} disabled={saving}>
            Gỡ liên kết
          </Button>
        )}
      </div>
    </div>
  );
}
