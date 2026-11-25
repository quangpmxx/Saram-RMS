"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, X } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { useCan } from "@/lib/capability-context";
import { cn } from "@/lib/cn";
import type { CareProgressResult } from "@/lib/care-warehouse";
import type { DashboardSummary, KpiBreakdown, SalePerformance, TeamSummary } from "@/lib/types";
import { findNamed, foldVi, parseIntent, VOICE_EXAMPLES, type VoiceIntent, type VoicePeriod } from "@/lib/voice-intent";

/**
 * Trợ lý giọng nói — bản miễn phí (2026-11-25): nghe bằng nhận giọng nói có sẵn của trình duyệt
 * (Chrome/Edge/Android/Safari), hiểu câu hỏi bằng từ khoá (lib/voice-intent.ts), lấy số từ API
 * Dashboard (backend tự giới hạn theo quyền) rồi đọc to bằng giọng đọc của máy. Không gọi AI ngoài.
 * Không nhận giọng được (trình duyệt không hỗ trợ / chặn micro) thì vẫn gõ câu hỏi được.
 */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "vi-VN";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi"));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

const num = (n: number) => Math.round(n).toLocaleString("vi-VN");
const money = (n: number | null | undefined) => (n == null ? "chưa có" : `${num(n)} đồng`);
const pct = (n: number) => `${n.toLocaleString("vi-VN")} phần trăm`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Cùng cách gửi khoảng ngày như DashboardClient để số khớp Dashboard. */
function dashboardQuery(p: VoicePeriod, extra?: Record<string, string>) {
  const q = new URLSearchParams({
    date_from: new Date(p.from).toISOString(),
    date_to: new Date(`${p.to}T23:59:59.999`).toISOString(),
    ...extra,
  });
  if (p.byPerson) q.set("count_by", "person");
  return q.toString();
}

function describeKpi(intent: VoiceIntent, k: KpiBreakdown, who: string): string {
  const unit = intent.period.byPerson ? "người" : "lượt";
  const when = intent.period.label;
  if (intent.rate) {
    if (intent.metric === "attended") return `Tỷ lệ đến phỏng vấn ${when} của ${who} là ${pct(k.attend_rate)}.`;
    if (intent.metric === "interview_scheduled") return `Tỷ lệ hẹn phỏng vấn ${when} của ${who} là ${pct(k.schedule_rate)}.`;
    return `Tỷ lệ đỗ phỏng vấn ${when} của ${who} là ${pct(k.pass_rate)}, trên ${num(k.attended)} ${unit} đến.`;
  }
  switch (intent.metric) {
    case "new_leads":
      return `${cap(when)} ${who} có ${num(k.new_leads)} data mới.`;
    case "interview_scheduled":
      return `${cap(when)} ${who} hẹn được ${num(k.interview_scheduled)} ${unit} phỏng vấn.`;
    case "attended":
      return `${cap(when)} ${who} có ${num(k.attended)} ${unit} đến phỏng vấn, trên ${num(k.interview_scheduled)} ${unit} hẹn.`;
    case "no_show":
      return `${cap(when)} ${who} có ${num(k.no_show)} ${unit} bùng phỏng vấn.`;
    case "passed":
      return `${cap(when)} ${who} có ${num(k.passed)} ${unit} đỗ phỏng vấn, tỷ lệ đỗ ${pct(k.pass_rate)}.`;
    case "failed":
      return `${cap(when)} ${who} có ${num(k.failed)} ${unit} trượt phỏng vấn.`;
    default:
      return (
        `${cap(when)} ${who}: ${num(k.new_leads)} data mới, hẹn ${num(k.interview_scheduled)}, ` +
        `đến ${num(k.attended)}, bùng ${num(k.no_show)}, đỗ ${num(k.passed)}, trượt ${num(k.failed)} ${unit} phỏng vấn.`
      );
  }
}

async function answerQuestion(text: string, canMktCost: boolean): Promise<string> {
  const q = foldVi(text);
  if (/ (giup|huong dan|hoi gi|lam duoc gi|biet gi) /.test(q)) {
    return `Bạn có thể hỏi, ví dụ: ${VOICE_EXAMPLES.slice(0, 5).join(" ")}`;
  }
  const intent = parseIntent(text);
  const p = intent.period;

  if (intent.metric === "care") {
    const r = await clientApi<CareProgressResult>(`/care-progress?month=${p.month}`);
    const team = findNamed(text, r.target.by_team ?? [], (t) => [t.team_name, `nhóm ${t.team_name}`]);
    if (team) {
      const rate = team.eligible > 0 ? Math.round((team.cared / team.eligible) * 1000) / 10 : 0;
      return `Tiến độ chăm sóc kho data của nhóm ${team.team_name}: đã chăm sóc ${num(team.cared)} trên ${num(team.eligible)} data, đạt ${pct(rate)}.`;
    }
    return `Tiến độ chăm sóc kho data: đã chăm sóc ${num(r.target.cared)} trên ${num(r.target.eligible)} data, còn ${num(r.target.not_cared)} data chưa chăm sóc${r.target.rate == null ? "" : `, đạt ${pct(r.target.rate)}`}.`;
  }

  if (intent.metric === "spend") {
    if (!canMktCost) return "Tài khoản của bạn chưa được xem chi phí marketing.";
    const mq = new URLSearchParams({ from: p.from, to: p.to });
    if (p.byPerson) mq.set("count_by", "person");
    const m = await clientApi<{ spend: number; data_count: number; cost_per_data: number | null; cost_per_interview: number | null }>(
      `/marketing-hub/today?${mq.toString()}`,
    );
    return `Chi phí quảng cáo ${p.label} là ${money(m.spend)}, được ${num(m.data_count)} data, chi phí mỗi data ${money(m.cost_per_data)}, chi phí mỗi lượt hẹn phỏng vấn ${money(m.cost_per_interview)}.`;
  }

  const query = dashboardQuery(p);
  const [summary, teams, people] = await Promise.all([
    clientApi<DashboardSummary>(`/dashboard/summary?${query}`),
    clientApi<TeamSummary[]>(`/dashboard/by-team?${query}`).catch(() => [] as TeamSummary[]),
    clientApi<SalePerformance[]>(`/dashboard/performance?${query}`).catch(() => [] as SalePerformance[]),
  ]);
  const unit = p.byPerson ? "người" : "lượt";
  const pick = (k: KpiBreakdown) =>
    intent.metric === "passed" ? k.passed : intent.metric === "new_leads" ? k.new_leads : intent.metric === "attended" ? k.attended : k.interview_scheduled;
  const metricWord =
    intent.metric === "passed" ? "đỗ" : intent.metric === "new_leads" ? "data mới" : intent.metric === "attended" ? "đến phỏng vấn" : "hẹn phỏng vấn";

  if (intent.top) {
    if (/ nhom nao /.test(q) || / doi nao /.test(q)) {
      const best = [...teams].sort((a, b) => pick(b.kpi) - pick(a.kpi)).filter((t) => pick(t.kpi) > 0).slice(0, 3);
      if (best.length === 0) return `${cap(p.label)} chưa có nhóm nào có số ${metricWord}.`;
      return `${cap(p.label)} nhóm ${metricWord} nhiều nhất là ${best.map((t) => `${t.team_name} ${num(pick(t.kpi))}`).join(", ")}.`;
    }
    const ranking = await clientApi<SalePerformance[]>(`/dashboard/ranking?${query}`);
    const key = (r: SalePerformance) => (intent.metric === "passed" ? r.kpi.passed : r.kpi.interview_scheduled);
    const best = [...ranking].sort((a, b) => key(b) - key(a)).filter((r) => key(r) > 0).slice(0, 3);
    const word = intent.metric === "passed" ? "đỗ phỏng vấn" : "hẹn phỏng vấn";
    if (best.length === 0) return `${cap(p.label)} chưa có ai ${word}.`;
    return `${cap(p.label)} ${word} nhiều nhất là ${best.map((r) => `${r.full_name} ${num(key(r))} ${unit}`).join(", ")}.`;
  }

  const team = findNamed(text, teams, (t) => [t.team_name, `nhóm ${t.team_name}`]);
  if (team) return describeKpi(intent, team.kpi, `nhóm ${team.team_name}`);
  const person = findNamed(text, people, (r) => {
    const words = r.full_name.trim().split(/\s+/);
    return [r.full_name, words.slice(-2).join(" "), words[words.length - 1]];
  });
  if (person) return describeKpi(intent, person.kpi, person.full_name);
  return describeKpi(intent, summary.kpi, "toàn công ty");
}

export function VoiceAssistant() {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [typed, setTyped] = useState("");
  // Khung trả lời chỉ hiện sau khi bấm nút (ở trình duyệt) nên đọc thẳng lúc khởi tạo không lệch SSR.
  const [supported, setSupported] = useState(() => typeof window === "undefined" || createRecognition() !== null);
  const recRef = useRef<Recognition | null>(null);
  const canMktCost = can("dashboard.mkt_cost");

  useEffect(() => {
    // Một số máy chỉ nạp danh sách giọng đọc sau lần gọi đầu.
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => recRef.current?.stop();
  }, []);

  if (!can("voice.assistant")) return null;

  async function ask(text: string) {
    const question = text.trim();
    if (!question) return;
    setHeard(question);
    setBusy(true);
    setAnswer("");
    try {
      const reply = await answerQuestion(question, canMktCost);
      setAnswer(reply);
      speak(reply);
    } catch {
      const msg = "Xin lỗi, chưa lấy được số liệu. Bạn thử lại sau nhé.";
      setAnswer(msg);
      speak(msg);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) {
      setSupported(false);
      return;
    }
    window.speechSynthesis?.cancel();
    rec.lang = "vi-VN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = r[0].transcript;
        else interim += r[0].transcript;
      }
      setHeard(finalText || interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setAnswer("Trình duyệt đang chặn micro. Bạn cho phép micro cho trang này, hoặc gõ câu hỏi bên dưới.");
      } else if (e.error === "no-speech") {
        setAnswer("Chưa nghe thấy gì, bạn bấm micro và nói lại nhé.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (finalText) void ask(finalText);
    };
    recRef.current = rec;
    setHeard("");
    setAnswer("");
    setListening(true);
    rec.start();
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Hỏi bằng giọng nói"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700",
          open && "bg-blue-50 text-blue-600",
        )}
      >
        <Mic className="h-4.5 w-4.5" strokeWidth={2} />
      </button>
      {open && (
        <div className="fixed top-12 right-2 left-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:top-10 sm:right-0 sm:left-auto sm:w-[380px]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Trợ lý giọng nói</p>
            <button
              type="button"
              onClick={() => {
                recRef.current?.stop();
                window.speechSynthesis?.cancel();
                setOpen(false);
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 py-2">
            <button
              type="button"
              onClick={startListening}
              disabled={!supported || busy}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-colors disabled:opacity-40",
                listening ? "animate-pulse bg-red-500" : "bg-blue-600 hover:bg-blue-700",
              )}
              title={listening ? "Dừng nghe" : "Bấm rồi nói câu hỏi"}
            >
              {supported ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </button>
            <p className="text-xs text-slate-500">
              {!supported
                ? "Trình duyệt này không nhận giọng nói — hãy gõ câu hỏi."
                : listening
                  ? "Đang nghe…"
                  : busy
                    ? "Đang tìm số liệu…"
                    : "Bấm micro rồi nói câu hỏi"}
            </p>
          </div>

          {heard && (
            <p className="mb-1 text-xs text-slate-500">
              Bạn hỏi: <span className="text-slate-700">{heard}</span>
            </p>
          )}
          {answer && <p className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-slate-800">{answer}</p>}

          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(typed);
              setTyped("");
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Hoặc gõ câu hỏi…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={busy || !typed.trim()}
              className="rounded-lg bg-blue-600 px-2.5 text-white disabled:opacity-40"
              title="Hỏi"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-2 flex flex-wrap gap-1">
            {VOICE_EXAMPLES.slice(0, 6).map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy}
                onClick={() => void ask(ex)}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
