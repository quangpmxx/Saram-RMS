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
/**
 * Chỉ 3 lựa chọn dễ hiểu (người dùng 2026-11-25: danh sách đầy đủ của Google quá dài, không biết chọn).
 * Dùng tên "-latest" → Google tự trỏ tới bản mới nhất, không phải sửa khi Google ra bản mới.
 */
const MODEL_CHOICES = [
  { id: "gemini-flash-lite-latest", label: "Nhanh & tiết kiệm — khuyên dùng", hint: "Trả lời nhanh nhất, rẻ nhất. Đủ cho hỏi số liệu, tra cứu hằng ngày." },
  { id: "gemini-flash-latest", label: "Thông minh hơn", hint: "Hiểu câu hỏi phức tạp tốt hơn, chậm và tốn hơn một chút. Gói miễn phí rất ít lượt." },
  { id: "gemini-pro-latest", label: "Thông minh nhất (tốn nhiều)", hint: "Chỉ dùng khi đã bật thanh toán. Chậm nhất, tốn nhất." },
];

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
  useEffect(() => {
    clientApi<AiConfig>("/ai-assistant/config")
      .then((c) => {
        setCfg(c);
        setModel(c.model);
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
    if (!window.confirm("Gỡ liên kết AI? Khung chat Trợ lý sẽ báo AI chưa sẵn sàng cho tới khi liên kết lại.")) return;
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
          Đang liên kết — khoá kết thúc bằng <b>…{cfg.key_hint}</b>, mô hình <b>{MODEL_CHOICES.find((m) => m.id === cfg.model)?.label ?? cfg.model}</b>
          {cfg.updated_by_name ? ` · ${cfg.updated_by_name}` : ""}
          {cfg.updated_at ? ` · ${new Date(cfg.updated_at).toLocaleString("vi-VN")}` : ""}
        </p>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Chưa liên kết — khung chat Trợ lý đang báo “AI chưa sẵn sàng”. Lấy khoá tại{" "}
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
          placeholder="AIza…"
          autoComplete="off"
        />
      </Field>
      <Field label="Mô hình" hint={MODEL_CHOICES.find((m) => m.id === model)?.hint}>
        <Select value={model} onChange={(e) => setModel(e.target.value)}>
          {MODEL_CHOICES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          {/* Mô hình cũ đã lưu không nằm trong 3 lựa chọn → vẫn hiện để không tự đổi. */}
          {model && !MODEL_CHOICES.some((m) => m.id === model) && <option value={model}>{model}</option>}
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
