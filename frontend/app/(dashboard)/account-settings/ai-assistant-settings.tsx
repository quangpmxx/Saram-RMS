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
  /** Trần chi phí AI mỗi tháng (USD); null = không giới hạn. */
  monthly_budget_usd?: number | null;
  /** Chi phí ước tính đã dùng tháng này (USD). */
  used_this_month_usd?: number;
}

export function AiAssistantSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  useEffect(() => {
    clientApi<AiConfig>("/ai-assistant/config")
      .then((c) => {
        setCfg(c);
        setModel(c.model);
        setBudget(c.monthly_budget_usd != null ? String(c.monthly_budget_usd) : "");
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

  async function saveBudget() {
    const value = budget.trim() === "" ? null : Number(budget.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError("Ngân sách phải là số (USD), vd 9");
      return;
    }
    setSavingBudget(true);
    setError(null);
    try {
      const c = await clientApi<AiConfig>("/ai-assistant/budget", {
        method: "PUT",
        body: JSON.stringify({ monthly_budget_usd: value }),
      });
      setCfg(c);
      toast.success(value === null ? "Đã bỏ giới hạn ngân sách AI" : `Đã đặt ngân sách AI ${value} USD / tháng`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được ngân sách");
    } finally {
      setSavingBudget(false);
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
      {cfg?.connected && (
        <div className="rounded-lg border border-slate-200 p-3">
          <Field
            label="Ngân sách AI mỗi tháng (USD)"
            hint="Chạm 85%: tự tắt giọng Gemini (dùng giọng của máy). Chạm 100%: khoá ô hỏi tới ngày 1 tháng sau. Để trống = không giới hạn. Nên đặt thấp hơn tín dụng Google một chút (vd tín dụng 10 → đặt 9)."
          >
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Không giới hạn"
              />
              <Button type="button" variant="outline" onClick={saveBudget} disabled={savingBudget}>
                {savingBudget ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </Field>
          <UsageBar used={cfg.used_this_month_usd ?? 0} budget={cfg.monthly_budget_usd ?? null} />
        </div>
      )}
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

/** Đã dùng tháng này / ngân sách — ước tính theo giá cao hơn giá Google một chút. */
function UsageBar({ used, budget }: { used: number; budget: number | null }) {
  const pct = budget ? Math.min(100, (used / budget) * 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-600">
        Đã dùng tháng này (ước tính): <b>{used.toFixed(2)} USD</b>
        {budget ? ` / ${budget} USD (${Math.round(pct)}%)` : " — chưa đặt giới hạn"}
      </p>
      {budget ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
