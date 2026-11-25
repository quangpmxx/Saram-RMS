"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Mic, MicOff, RotateCcw, SendHorizontal, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
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

type ChatMessage = { id: number; role: "user" | "bot"; text: string };

const MUTE_KEY = "voice-assistant-muted";

/** Logo công ty trong khung tròn trắng — dùng cho đầu khung và tin nhắn trợ lý. */
function BrandMark({ size, className }: { size: number; className?: string }) {
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/dai-viet-mark.png" alt="Đại Việt" width={size} height={size} className="object-contain p-[12%]" />
    </span>
  );
}

/** 3 chấm nhảy — đang tìm câu trả lời. */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

/** Sóng âm khi đang nghe. */
function ListeningWave() {
  return (
    <span className="flex h-4 items-center gap-[3px]">
      {[40, 75, 100, 75, 40].map((h, i) => (
        <span
          key={i}
          className="w-[3px] animate-pulse rounded-full bg-red-500"
          style={{ height: `${h}%`, animationDelay: `${i * 120}ms`, animationDuration: "700ms" }}
        />
      ))}
    </span>
  );
}

export function VoiceAssistant({ userName }: { userName?: string }) {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typed, setTyped] = useState("");
  // Khung trả lời chỉ hiện sau khi bấm nút (ở trình duyệt) nên đọc thẳng lúc khởi tạo không lệch SSR.
  const [supported, setSupported] = useState(() => typeof window === "undefined" || createRecognition() !== null);
  const [muted, setMuted] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const recRef = useRef<Recognition | null>(null);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canMktCost = can("dashboard.mkt_cost");
  const canUse = can("voice.assistant");
  // Admin đã liên kết Gemini → hỏi AI; chưa thì hiểu theo từ khoá như cũ.
  const [aiEnabled, setAiEnabled] = useState(false);
  const historyRef = useRef<{ role: "user" | "model"; text: string }[]>([]);

  useEffect(() => {
    if (!open || !canUse) return;
    let cancelled = false;
    clientApi<{ ai_enabled: boolean }>("/ai-assistant/status")
      .then((s) => !cancelled && setAiEnabled(s.ai_enabled))
      .catch(() => !cancelled && setAiEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [open, canUse]);

  useEffect(() => {
    // Một số máy chỉ nạp danh sách giọng đọc sau lần gọi đầu.
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => recRef.current?.stop();
  }, []);

  // Tin mới → cuộn xuống cuối.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, interim]);

  if (!canUse) return null;

  const firstName = userName?.trim().split(/\s+/).pop() ?? "";

  function push(role: ChatMessage["role"], text: string) {
    idRef.current += 1;
    const msg = { id: idRef.current, role, text };
    setMessages((m) => [...m, msg].slice(-40));
  }

  function say(text: string) {
    if (!muted) speak(text);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (next) window.speechSynthesis?.cancel();
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* bỏ qua: chế độ riêng tư */
    }
  }

  function close() {
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
    setOpen(false);
  }

  function reset() {
    window.speechSynthesis?.cancel();
    setMessages([]);
    historyRef.current = [];
  }

  async function askAi(question: string): Promise<string> {
    const r = await clientApi<{ answer: string }>("/ai-assistant/ask", {
      method: "POST",
      body: JSON.stringify({ question, history: historyRef.current.slice(-8) }),
    });
    historyRef.current = [...historyRef.current, { role: "user" as const, text: question }, { role: "model" as const, text: r.answer }].slice(-12);
    return r.answer;
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    push("user", question);
    setInterim("");
    setBusy(true);
    try {
      let reply: string;
      if (aiEnabled) {
        try {
          reply = await askAi(question);
        } catch (e) {
          // AI hết lượt miễn phí / lỗi mạng → vẫn trả lời bằng cách hiểu từ khoá.
          const note = e instanceof ApiError ? e.message : "AI đang bận.";
          reply = `${note} Trả lời nhanh: ${await answerQuestion(question, canMktCost)}`;
        }
      } else {
        reply = await answerQuestion(question, canMktCost);
      }
      push("bot", reply);
      say(reply);
    } catch {
      const msg = "Xin lỗi, chưa lấy được số liệu. Bạn thử lại sau nhé.";
      push("bot", msg);
      say(msg);
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
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = r[0].transcript;
        else partial += r[0].transcript;
      }
      setInterim(finalText || partial);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        push("bot", "Trình duyệt đang chặn micro. Bạn cho phép micro cho trang này, hoặc gõ câu hỏi bên dưới nhé.");
      } else if (e.error === "no-speech") {
        push("bot", "Mình chưa nghe thấy gì, bạn bấm micro và nói lại nhé.");
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
      if (finalText) void ask(finalText);
    };
    recRef.current = rec;
    setInterim("");
    setListening(true);
    rec.start();
  }

  const headerBtn = "rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white";

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <div className="flex h-[min(600px,calc(100dvh-6rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-brand-900/20 sm:w-[390px]">
          {/* Đầu khung: logo công ty + tên trợ lý + trạng thái AI */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-4 pt-4 pb-6 text-white">
            <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-accent-500/30 blur-2xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <BrandMark size={42} className="shadow-md ring-2 ring-white/40" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-tight font-semibold">Trợ lý Đại Việt</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/80">
                  <span className={cn("h-1.5 w-1.5 rounded-full", aiEnabled ? "bg-emerald-300" : "bg-amber-300")} />
                  {aiEnabled ? "AI Gemini · hỏi tự nhiên" : "Chế độ nhanh · số liệu Dashboard"}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={toggleMute} title={muted ? "Bật đọc to câu trả lời" : "Tắt đọc to"} className={headerBtn}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                {messages.length > 0 && (
                  <button type="button" onClick={reset} title="Cuộc trò chuyện mới" className={headerBtn}>
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={close} title="Đóng" className={headerBtn}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Nội dung trò chuyện */}
          <div ref={scrollRef} className="-mt-3 flex-1 overflow-y-auto rounded-t-2xl bg-slate-50 px-3 pt-4 pb-3">
            {messages.length === 0 && !interim ? (
              <div className="flex flex-col items-center px-2 pt-2 text-center">
                <span className="relative">
                  <span aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-tr from-brand-500 to-accent-500 opacity-30 blur-md" />
                  <BrandMark size={64} className="relative shadow-lg ring-4 ring-white" />
                </span>
                <p className="mt-3 text-base font-semibold text-slate-800">Xin chào{firstName ? ` ${firstName}` : ""} 👋</p>
                <p className="mt-1 text-xs text-slate-500">Bấm micro rồi nói, hoặc gõ câu hỏi. Mình trả lời theo đúng số liệu bạn được xem.</p>
                <div className="mt-4 grid w-full grid-cols-1 gap-1.5">
                  {VOICE_EXAMPLES.slice(0, 5).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => void ask(ex)}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[13px] text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-brand-300 hover:text-brand-700 hover:shadow"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-500" />
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-indigo-600 px-3 py-2 text-sm text-white shadow-sm">
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-end gap-2">
                      <BrandMark size={26} className="mb-5 shadow-sm ring-1 ring-slate-200" />
                      <div className="max-w-[82%]">
                        <p className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm whitespace-pre-line text-slate-800 shadow-sm">
                          {m.text}
                        </p>
                        <button
                          type="button"
                          onClick={() => speak(m.text)}
                          className="mt-0.5 ml-1 flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-brand-600"
                        >
                          <Volume2 className="h-3 w-3" /> Nghe lại
                        </button>
                      </div>
                    </div>
                  ),
                )}
                {interim && (
                  <div className="flex justify-end">
                    <p className="max-w-[82%] rounded-2xl rounded-br-md border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-700 italic">
                      {interim}…
                    </p>
                  </div>
                )}
                {busy && (
                  <div className="flex items-end gap-2">
                    <BrandMark size={26} className="shadow-sm ring-1 ring-slate-200" />
                    <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ô nhập + micro */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-3">
            {listening && (
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-medium text-red-600">
                <ListeningWave /> Đang nghe… bấm micro để dừng
              </div>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(typed);
                setTyped("");
              }}
            >
              <div className="flex min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-slate-50 pr-1 pl-4 transition-colors focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={supported ? "Hỏi gì đó… hoặc bấm micro" : "Gõ câu hỏi…"}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={busy || !typed.trim()}
                  title="Gửi"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={startListening}
                disabled={!supported || busy}
                title={!supported ? "Trình duyệt này không nhận giọng nói" : listening ? "Dừng nghe" : "Bấm rồi nói câu hỏi"}
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all disabled:opacity-40",
                  listening ? "bg-red-500 ring-4 ring-red-200" : "bg-gradient-to-br from-accent-500 to-accent-600 hover:scale-105 hover:shadow-lg",
                )}
              >
                {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />}
                {supported ? <Mic className="relative h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Nút nổi: logo công ty + nhãn AI */}
      <button
        type="button"
        title={open ? "Đóng trợ lý" : "Trợ lý AI Đại Việt"}
        onClick={() => (open ? close() : setOpen(true))}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 via-indigo-500 to-accent-500 p-[3px] shadow-lg shadow-brand-900/25 transition-transform hover:scale-105 active:scale-95"
      >
        {!open && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-20 [animation-duration:2.5s]" />}
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-white">
          {open ? (
            <X className="h-6 w-6 text-slate-600" />
          ) : (
            <Image src="/dai-viet-mark.png" alt="Đại Việt" width={40} height={40} className="h-9 w-9 object-contain" />
          )}
        </span>
        {!open && (
          <span className="absolute -top-1 -right-1.5 rounded-full bg-gradient-to-r from-accent-500 to-pink-500 px-1.5 py-px text-[10px] leading-4 font-bold text-white shadow ring-2 ring-white">
            AI
          </span>
        )}
      </button>
    </div>
  );
}
