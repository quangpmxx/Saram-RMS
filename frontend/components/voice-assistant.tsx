"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AudioLines, Mic, MicOff, RotateCcw, SendHorizontal, Sparkles, Volume2, X } from "lucide-react";
import { ApiError, clientApi, clientApiPostBlob, clientApiUpload } from "@/lib/api-client";
import { useCan } from "@/lib/capability-context";
import { cn } from "@/lib/cn";

/**
 * Trợ lý AI (2026-11-25): nghe bằng nhận giọng nói có sẵn của trình duyệt, hỏi Google Gemini qua
 * backend (/ai-assistant/ask — backend tự giới hạn số liệu theo quyền người hỏi), đọc to bằng giọng
 * của máy. Chưa liên kết Gemini → "AI chưa sẵn sàng"; hết lượt → khoá ô hỏi, không báo gì.
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
  abort?: () => void;
};

function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Máy ghi âm được (để gửi Gemini chép lời) — dùng khi trình duyệt không có nhận giọng nói. */
function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

/**
 * iPhone/iPad (2026-11-26): mọi trình duyệt (kể cả Chrome) và app cài trên màn hình chính đều chạy lõi
 * Safari — nhận giọng nói của trình duyệt chập chờn / bị chặn → luôn ghi âm + Gemini chép lời.
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Đọc to câu trả lời. Chia theo câu (Chrome tự ngắt khi 1 lượt đọc dài quá ~15 giây), gọi onEnd khi
 * đọc xong câu cuối — dùng cho chế độ nói chuyện (đọc xong tự nghe tiếp).
 */
function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  // Danh sách giọng nạp chậm (Chrome trả [] lần đầu) → chờ tối đa 1,5 giây rồi mới đọc,
  // tránh rơi về giọng mặc định (nam, tiếng Anh) đọc chữ Việt.
  void loadVoices().then(() => speakNow(text, onEnd));
}

/** Giọng tiếng Việt tốt nhất trên máy, ưu tiên giọng nữ tự nhiên (2026-11-25). */
let viVoice: SpeechSynthesisVoice | null | undefined;
function pickViVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vi = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("vi"));
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    if (n.includes("hoaimy")) return 0; // Edge: Microsoft HoaiMy Online (Natural) — nữ, rất tự nhiên
    if (n.includes("google")) return 1; // Chrome: Google Tiếng Việt — nữ
    if (n.includes("natural") || n.includes("online")) return 2;
    if (n.includes("linh") || n.includes("female") || n.includes("nữ")) return 3;
    if (n.includes("namminh") || n.includes(" an")) return 5; // giọng nam
    return 4;
  };
  return vi.sort((a, b) => score(a) - score(b))[0] ?? null;
}

function loadVoices(): Promise<void> {
  const synth = window.speechSynthesis;
  if (viVoice !== undefined) return Promise.resolve();
  const now = synth.getVoices();
  if (now.length) {
    viVoice = pickViVoice(now);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      const list = synth.getVoices();
      // Hết giờ chờ mà vẫn chưa có danh sách → lần sau thử lại.
      viVoice = list.length ? pickViVoice(list) : undefined;
      resolve();
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1500);
  });
}

/** Máy không có giọng tiếng Việt nào (để báo người dùng). */
function hasViVoice(): boolean {
  return Boolean(viVoice);
}

function speakNow(text: string, onEnd?: () => void) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = viVoice ?? null;
  const chunks = text.split(/(?<=[.!?])\s+|\n+/).map((c) => c.trim()).filter(Boolean);
  if (chunks.length === 0) {
    onEnd?.();
    return;
  }
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = "vi-VN";
    if (voice) u.voice = voice;
    // Giọng nữ miền Bắc nhẹ nhàng (2026-11-25): HoaiMy / Google Tiếng Việt đều giọng Hà Nội; đọc chậm, cao nhẹ.
    u.rate = 1.1;
    u.pitch = 1.15;
    if (i === chunks.length - 1 && onEnd) {
      u.onend = () => onEnd();
      u.onerror = () => onEnd();
    }
    synth.speak(u);
  });
}

type ChatMessage = { id: number; role: "user" | "bot"; text: string };

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
/** Tách câu đầu (đủ dài ≥ 25 ký tự) khỏi phần còn lại để tạo giọng song song. Câu ngắn → 1 phần. */
function splitFirstSentence(text: string): string[] {
  const t = text.trim();
  const re = /[.!?](?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index + 1 >= 25) {
      const first = t.slice(0, m.index + 1).trim();
      const rest = t.slice(m.index + 1).trim();
      return rest.length >= 15 ? [first, rest] : [t];
    }
  }
  return [t];
}

/** Tốc độ phát giọng Gemini (giữ nguyên cao độ) — người dùng muốn phản hồi nhanh, không phải đọc nhanh. */
const VOICE_PLAYBACK_RATE = 1;

const THINKING_STEPS = ["Đang hiểu câu hỏi", "Đang tra cứu dữ liệu", "Đang phân tích", "Đang soạn câu trả lời"];

/** "Đang suy nghĩ" (2026-11-25): các bước chạy lần lượt, chữ ánh sáng lướt; bước cuối = chuẩn bị giọng đọc. */
function ThinkingIndicator({ phase }: { phase: "thinking" | "voice" }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 1600);
    return () => clearInterval(t);
  }, [phase]);
  const label = phase === "voice" ? "Đang chuẩn bị giọng đọc" : THINKING_STEPS[step];
  const Icon = phase === "voice" ? AudioLines : Sparkles;
  return (
    <span className="flex items-center gap-2 py-0.5">
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-300 opacity-40" />
        <Icon className="relative h-4 w-4 animate-pulse text-brand-600" />
      </span>
      <span
        key={label}
        className="animate-[auto-on-shimmer_2.2s_linear_infinite] bg-gradient-to-r from-slate-400 via-brand-600 to-slate-400 bg-[length:200%_100%] bg-clip-text text-[13px] font-medium text-transparent"
      >
        {label}…
      </span>
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

/**
 * Kéo nút AI sang góc khác (2026-11-26): thả ra thì tự hút về góc gần nhất, nhớ theo máy.
 * Class viết sẵn đủ chữ để Tailwind sinh được CSS.
 */
type Corner = "br" | "bl" | "tr" | "tl";
const CORNER_KEY = "ai-fab-corner";
const FAB_POS: Record<Corner, string> = {
  br: "right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6",
  bl: "left-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:left-6 sm:bottom-6 md:left-24",
  tr: "right-4 top-[calc(4.5rem+env(safe-area-inset-top))] sm:right-6 sm:top-20",
  tl: "left-4 top-[calc(4.5rem+env(safe-area-inset-top))] sm:left-6 sm:top-20 md:left-24",
};
// Khung chat (máy tính) mở cạnh nút; điện thoại vẫn toàn màn hình.
const PANEL_POS: Record<Corner, string> = {
  br: "sm:right-6 sm:bottom-24",
  bl: "sm:left-6 sm:bottom-24 md:left-24",
  tr: "sm:right-6 sm:top-[8.75rem]",
  tl: "sm:left-6 sm:top-[8.75rem] md:left-24",
};

function readCorner(): Corner {
  try {
    const v = localStorage.getItem(CORNER_KEY);
    if (v === "br" || v === "bl" || v === "tr" || v === "tl") return v;
  } catch {
    /* không có bộ nhớ trình duyệt → góc phải dưới */
  }
  return "br";
}
function subscribeCorner(cb: () => void) {
  window.addEventListener(CORNER_KEY, cb);
  return () => window.removeEventListener(CORNER_KEY, cb);
}
function saveCorner(v: Corner) {
  try {
    localStorage.setItem(CORNER_KEY, v);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event(CORNER_KEY));
}

/** Đường dẫn trang chat riêng — điện thoại mở trang này thay cho popup (2026-11-26). */
export const AI_CHAT_PATH = "/tro-ly-ai";

/**
 * page = true: chạy như 1 trang chat riêng toàn màn hình (không có trang nào nằm phía sau → bàn phím
 * iPhone trong suốt không lộ nền như khi là popup đè lên Dashboard).
 */
export function VoiceAssistant({ userName, enabled = true, page = false }: { userName?: string; enabled?: boolean; page?: boolean }) {
  const router = useRouter();
  const can = useCan();
  const [open, setOpen] = useState(page);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typed, setTyped] = useState("");
  // Khung trả lời chỉ hiện sau khi bấm nút (ở trình duyệt) nên đọc thẳng lúc khởi tạo không lệch SSR.
  const [supported, setSupported] = useState(() => typeof window === "undefined" || createRecognition() !== null || canRecord());
  // Ghi âm → Gemini chép lời (iPhone / trình duyệt không nhận giọng nói).
  const recorderRef = useRef<{ abort: () => void } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const forceRecorderRef = useRef(false);
  // Tin đang được bấm loa nghe lại (bấm lần nữa = dừng).
  const [playingId, setPlayingId] = useState<number | null>(null);
  // Chế độ nói chuyện (2026-11-25): bấm micro → hỏi bằng giọng → AI đọc to câu trả lời → tự nghe tiếp.
  // Bấm micro lần nữa / im lặng / đóng khung → dừng. Câu gõ tay chỉ hiện chữ.
  const convRef = useRef(false);
  // Bản sao của convRef để vẽ nút micro (đang trong cuộc nói chuyện → bấm là dừng hẳn).
  const [convOn, setConvOn] = useState(false);
  const setConv = (v: boolean) => {
    convRef.current = v;
    setConvOn(v);
  };
  const [speaking, setSpeaking] = useState(false);
  const [phase, setPhase] = useState<"thinking" | "voice">("thinking");
  const warnedVoiceRef = useRef(false);
  // Giọng Gemini (2026-11-25): giọng nữ miền Bắc giống nhau mọi máy. Hết lượt → dùng giọng của máy.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsOffRef = useRef(false);
  const speakIdRef = useRef(0);
  const recRef = useRef<Recognition | null>(null);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const corner = useSyncExternalStore(subscribeCorner, readCorner, () => "br" as Corner);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);
  const canUse = enabled && can("voice.assistant");
  // Admin đã liên kết Gemini mới dùng được.
  const [aiEnabled, setAiEnabled] = useState(false);
  // Chưa kiểm tra xong / chưa liên kết Gemini → báo "AI chưa sẵn sàng", không tự trả lời (2026-11-25).
  const [aiChecked, setAiChecked] = useState(false);
  // Hết lượt AI → khoá ô hỏi (không báo gì — yêu cầu người dùng 2026-11-25). Mở lại khung là kiểm lại.
  const [exhausted, setExhausted] = useState(false);
  const ready = aiEnabled && !exhausted;
  const [assistantName, setAssistantName] = useState("Trợ lý Đại Việt");
  const historyRef = useRef<{ role: "user" | "model"; text: string }[]>([]);

  useEffect(() => {
    if (!open || !canUse) return;
    let cancelled = false;
    clientApi<{ ai_enabled: boolean; assistant_name?: string; remaining_today?: number | null; budget_exhausted?: boolean }>("/ai-assistant/status")
      .then((s) => {
        if (cancelled) return;
        setAiEnabled(s.ai_enabled);
        setAiChecked(true);
        // Hết số câu hỏi hôm nay của tài khoản (Admin đặt ở Sửa tài khoản) → khoá như hết lượt.
        // Hết ngân sách AI tháng này (Admin đặt ở Cài đặt) → khoá như hết lượt.
        setExhausted(s.remaining_today === 0 || s.budget_exhausted === true);
        if (s.assistant_name) setAssistantName(s.assistant_name);
      })
      .catch(() => {
        if (cancelled) return;
        setAiEnabled(false);
        setAiChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canUse]);

  useEffect(() => {
    // Một số máy chỉ nạp danh sách giọng đọc sau lần gọi đầu.
    if (typeof window !== "undefined" && "speechSynthesis" in window) void loadVoices();
    return () => {
      recRef.current?.stop();
      recorderRef.current?.abort();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Điện thoại (2026-11-26): khung chat bám đúng phần màn hình còn thấy khi bàn phím bật (như Zalo/Messenger)
  // + khoá cuộn trang phía sau → không lộ nền khi gõ.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || window.matchMedia("(min-width: 640px)").matches) return;
    const vv = window.visualViewport;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const fit = () => {
      const el = panelRef.current;
      if (!el || !vv) return;
      el.style.top = `${vv.offsetTop}px`;
      el.style.height = `${vv.height}px`;
      el.style.bottom = "auto";
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      [html.style.overflow, document.body.style.overflow] = prev;
    };
  }, [open]);

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

  /** Thoát chế độ nói chuyện: ngừng nghe + ngừng đọc. */
  function stopAudio() {
    speakIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
  }

  function stopConversation() {
    setConv(false);
    // Điện thoại (Chrome Android) hay không kết thúc khi gọi stop() → abort() + tắt trạng thái nghe ngay.
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      if (rec.abort) rec.abort();
      else rec.stop();
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    recorder?.abort();
    setListening(false);
    setPlayingId(null);
    setInterim("");
    stopAudio();
    setSpeaking(false);
  }

  /** Phát 1 đoạn âm thanh, xong (hoặc lỗi / bị dừng) thì resolve. */
  function playBlob(blob: Blob, id: number): Promise<void> {
    return new Promise((resolve) => {
      if (id !== speakIdRef.current) return resolve();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = VOICE_PLAYBACK_RATE;
      audioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.onpause = () => {
        if (id !== speakIdRef.current) done();
      };
      audio.play().catch(done);
    });
  }

  /**
   * Đọc bằng giọng Gemini; lỗi / hết lượt thì đọc bằng giọng có sẵn của máy.
   * onReady: gọi đúng lúc bắt đầu phát tiếng (để hiện chữ cùng lúc với giọng). */
  async function speakVoice(text: string, onEnd?: () => void, onReady?: () => void) {
    stopAudio();
    const id = speakIdRef.current;
    if (!ttsOffRef.current) {
      // Đọc nhanh hơn (2026-11-25): tách câu đầu + phần còn lại, tạo giọng SONG SONG — câu đầu ngắn
      // nên có tiếng sớm, phần sau tạo xong trong lúc đang đọc câu đầu.
      const parts = splitFirstSentence(text.slice(0, 2000));
      const blobs = parts.map((t) => clientApiPostBlob("/ai-assistant/speak", { text: t }));
      blobs.forEach((b) => b.catch(() => undefined)); // tránh lỗi "unhandled" khi phần sau hỏng
      try {
        const first = await blobs[0];
        if (id !== speakIdRef.current) return; // đã bị dừng / có câu mới
        onReady?.();
        await playBlob(first, id);
        for (let i = 1; i < parts.length; i++) {
          let blob: Blob;
          try {
            blob = await blobs[i];
          } catch {
            if (id !== speakIdRef.current) return;
            speak(parts.slice(i).join(" "), onEnd); // phần sau lỗi → giọng của máy đọc nốt
            return;
          }
          if (id !== speakIdRef.current) return;
          await playBlob(blob, id);
        }
        if (id === speakIdRef.current) onEnd?.();
        return;
      } catch (e) {
        if (id !== speakIdRef.current) return;
        if (e instanceof ApiError && e.status === 429) ttsOffRef.current = true;
      }
    }
    await loadVoices();
    if (id !== speakIdRef.current) return;
    if (!hasViVoice() && !warnedVoiceRef.current) {
      warnedVoiceRef.current = true;
      push("bot", "Giọng AI tạm hết lượt, máy này lại chưa có giọng tiếng Việt nên nghe sẽ lơ lớ. Dùng Microsoft Edge để nghe rõ hơn.");
    }
    onReady?.();
    speak(text, onEnd);
  }

  /**
   * Trả lời trong chế độ nói chuyện (2026-11-25): giữ "đang suy nghĩ" tới khi giọng đọc sẵn sàng,
   * rồi hiện chữ + đọc cùng lúc; đọc xong tự nghe câu tiếp theo. Gõ tay → hiện chữ ngay.
   */
  function reply(text: string): Promise<void> {
    if (!convRef.current) {
      push("bot", text);
      return Promise.resolve();
    }
    setPhase("voice");
    return new Promise((resolve) => {
      let shown = false;
      const show = () => {
        if (shown) return;
        shown = true;
        push("bot", text);
        setSpeaking(true);
        resolve();
      };
      void speakVoice(
        text,
        () => {
          setSpeaking(false);
          if (convRef.current) startListening();
        },
        show,
      ).finally(() => {
        // Bị dừng giữa chừng / lỗi → vẫn hiện chữ.
        if (shown) return;
        shown = true;
        push("bot", text);
        setSpeaking(false);
        resolve();
      });
    });
  }

  function close() {
    stopConversation();
    if (page) {
      // Mở từ trong phần mềm → quay lại trang trước; mở thẳng link → về trang chủ.
      if (window.history.length > 1) router.back();
      else router.push("/");
      return;
    }
    setOpen(false);
  }

  function reset() {
    stopConversation();
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

  async function ask(text: string, viaVoice = false) {
    if (!viaVoice) stopConversation();
    const question = text.trim();
    if (!question || busy || !ready) return;
    push("user", question);
    setInterim("");
    setBusy(true);
    setPhase("thinking");
    try {
      await reply(await askAi(question));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        stopConversation();
        setExhausted(true);
        return;
      }
      await reply("AI đang bận, anh/chị thử lại sau nhé.");
    } finally {
      setBusy(false);
    }
  }

  /** Nút micro: đang nghe → dừng hẳn; đang đọc → ngắt lời và nghe; còn lại → bắt đầu nói chuyện. */
  function onMicClick() {
    if (listening || convOn) {
      stopConversation();
      return;
    }
    stopAudio();
    setSpeaking(false);
    setConv(true);
    // Tạo bộ đo âm lượng ngay lúc bấm (iPhone chỉ cho chạy âm thanh khi người dùng vừa chạm).
    try {
      if (!audioCtxRef.current && typeof AudioContext !== "undefined") audioCtxRef.current = new AudioContext();
      void audioCtxRef.current?.resume();
    } catch {
      audioCtxRef.current = null;
    }
    startListening();
  }

  function startListening() {
    if ((forceRecorderRef.current || isIOS() || !createRecognition()) && canRecord()) {
      void startRecording();
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
    let partialText = "";
    // Điện thoại (Chrome Android) nhiều khi không tự kết thúc dù đã ngừng nói (2026-11-26, user báo
    // "nghe mãi không dừng") → tự dừng sau 1,5 giây im lặng kể từ chữ cuối, và tối đa 20 giây.
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    const stopSoon = (ms: number) => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try {
          rec.stop();
        } catch {
          /* đã dừng */
        }
      }, ms);
    };
    const maxTimer = setTimeout(() => stopSoon(0), 20000);
    rec.onresult = (e) => {
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = r[0].transcript;
        else partial += r[0].transcript;
      }
      partialText = partial;
      setInterim(finalText || partial);
      if (finalText || partial) stopSoon(1500);
    };
    rec.onerror = (e) => {
      // Tách từng lỗi (2026-11-25): "service-not-allowed" = trình duyệt không có dịch vụ nhận giọng nói
      // (Cốc Cốc, Brave, Opera…), KHÔNG phải do chặn micro.
      if (e.error === "not-allowed") {
        push(
          "bot",
          window.isSecureContext
            ? "Micro đang bị chặn cho trang này. Bấm biểu tượng ổ khoá cạnh địa chỉ web → Micro → Cho phép, rồi tải lại trang."
            : "Trang đang mở bằng http nên trình duyệt không cho dùng micro. Hãy mở bằng địa chỉ https (hoặc localhost).",
        );
      } else if (e.error === "service-not-allowed" && canRecord() && convRef.current) {
        // Trình duyệt không có dịch vụ nhận giọng nói → chuyển sang ghi âm + Gemini chép lời.
        forceRecorderRef.current = true;
        recRef.current = null; // onend của lượt này bỏ qua
        setListening(false);
        void startRecording();
        return;
      } else if (e.error === "service-not-allowed") {
        push("bot", "Trình duyệt này không hỗ trợ nhận giọng nói. Hãy dùng Google Chrome hoặc Microsoft Edge, hoặc gõ câu hỏi.");
      } else if (e.error === "audio-capture") {
        push("bot", "Không tìm thấy micro trên máy. Kiểm tra lại micro / tai nghe rồi thử lại.");
      } else if (e.error === "network") {
        push("bot", "Không kết nối được dịch vụ nhận giọng nói. Kiểm tra mạng, hoặc dùng Google Chrome / Microsoft Edge.");
      } else if (e.error === "no-speech" && !convRef.current) {
        push("bot", "Em chưa nghe thấy gì, anh/chị bấm micro và nói lại nhé.");
      }
      // Lỗi bất kỳ / im lặng → kết thúc chế độ nói chuyện (không tự nghe lại mãi).
      setConv(false);
    };
    rec.onend = () => {
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
      // Đã bấm dừng (recRef bị xoá) → không gửi câu dở.
      const mine = recRef.current === rec;
      if (!mine) return;
      setListening(false);
      setInterim("");
      recRef.current = null;
      const text = (finalText || partialText).trim();
      if (text && convRef.current) void ask(text, true);
      else setConv(false);
    };
    recRef.current = rec;
    setInterim("");
    setListening(true);
    rec.start();
  }

  /**
   * Nghe bằng ghi âm (2026-11-26): ghi tới khi im lặng 1,5 giây (tối đa 20 giây; 8 giây không nói gì
   * thì thôi) → gửi Gemini chép lời → hỏi như nói bình thường. Bấm micro lúc đang ghi = dừng hẳn.
   */
  async function startRecording() {
    window.speechSynthesis?.cancel();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      push("bot", "Micro đang bị chặn. Vào Cài đặt tài khoản, bấm biểu tượng micro để bật lại (hoặc gõ câu hỏi).");
      setConv(false);
      return;
    }
    if (!convRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t));
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      push("bot", "Máy này chưa ghi âm được, anh/chị gõ câu hỏi nhé.");
      setConv(false);
      return;
    }
    const chunks: Blob[] = [];
    let heard = false;
    let aborted = false;
    // Đếm thời gian theo nhịp 100ms (không dùng Date.now — luật React của dự án).
    let elapsed = 0;
    let lastLoud = 0;
    const ctx = audioCtxRef.current;
    let src: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      if (ctx) {
        void ctx.resume();
        src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
      }
    } catch {
      analyser = null;
    }
    const buf = new Float32Array(1024);
    const finish = () => {
      if (mr.state !== "inactive") mr.stop();
    };
    const tick = setInterval(() => {
      elapsed += 100;
      const now = elapsed;
      if (analyser && ctx?.state === "running") {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        if (Math.sqrt(sum / buf.length) > 0.02) {
          heard = true;
          lastLoud = now;
        }
        if ((heard && now - lastLoud > 1500) || (!heard && now > 8000)) finish();
      } else if (now > 8000) {
        // Không đo được âm lượng → ghi 8 giây rồi gửi.
        heard = true;
        finish();
      }
      if (now > 20000) finish();
    }, 100);
    const session = {
      abort: () => {
        aborted = true;
        finish();
      },
    };
    recorderRef.current = session;
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    mr.onstop = () => {
      clearInterval(tick);
      src?.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      if (aborted || recorderRef.current !== session) return;
      recorderRef.current = null;
      setListening(false);
      if (!heard || !chunks.length) {
        setConv(false);
        return;
      }
      void transcribeAndAsk(new Blob(chunks, { type: mr.mimeType || type || "audio/mp4" }));
    };
    setInterim("");
    setListening(true);
    mr.start(250);
  }

  async function transcribeAndAsk(blob: Blob) {
    setBusy(true);
    setPhase("thinking");
    let text = "";
    try {
      const fd = new FormData();
      fd.append("audio", blob, blob.type.includes("webm") ? "giong-noi.webm" : "giong-noi.m4a");
      text = (await clientApiUpload<{ text: string }>("/ai-assistant/transcribe", fd)).text.trim();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 429) {
        stopConversation();
        setExhausted(true);
        return;
      }
      push("bot", "Em chưa nghe được, anh/chị nói lại hoặc gõ câu hỏi nhé.");
      setConv(false);
      return;
    }
    setBusy(false);
    if (!convRef.current) return;
    if (!text) {
      push("bot", "Em chưa nghe rõ, anh/chị bấm micro và nói lại nhé.");
      setConv(false);
      return;
    }
    void ask(text, true);
  }

  const headerBtn ="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white sm:p-1.5";

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={assistantName}
          className={cn(
            "fixed inset-0 z-50 flex flex-col overflow-hidden bg-white",
            page
              ? "sm:mx-auto sm:max-w-2xl sm:border-x sm:border-slate-200"
              : cn(
                  "sm:inset-auto sm:h-[min(600px,calc(100dvh-10rem))] sm:w-[390px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-brand-900/20",
                  PANEL_POS[corner],
                ),
          )}
        >
          {/* Đầu khung: logo công ty + tên trợ lý + trạng thái AI */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-white sm:pt-2">
            <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-accent-500/30 blur-2xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-2">
              <BrandMark size={28} className="shadow ring-1 ring-white/40" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm leading-tight font-semibold">{assistantName}</p>
              </div>
              <div className="flex items-center gap-0.5">
                {messages.length > 0 && (
                  <button type="button" onClick={reset} title="Cuộc trò chuyện mới" className={headerBtn}>
                    <RotateCcw className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                )}
                <button type="button" onClick={close} title="Đóng" className={headerBtn}>
                  <X className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Nội dung trò chuyện */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-3 pt-3 pb-3">
            {/* Tối giản (2026-11-25): chỉ lời chào, không chú thích / câu hỏi mẫu. */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-end gap-2">
                  <BrandMark size={26} className="shadow-sm ring-1 ring-slate-200" />
                  <p className="max-w-[85%] sm:max-w-[82%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
                    {!aiChecked
                      ? "…"
                      : aiEnabled
                        ? `Xin chào${firstName ? ` ${firstName}` : ""} 👋 Em là ${assistantName}, anh/chị cần em giúp gì ạ?`
                        : "AI chưa sẵn sàng"}
                  </p>
                </div>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] sm:max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-indigo-600 px-3 py-2 text-sm text-white shadow-sm">
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-end gap-2">
                      <BrandMark size={26} className="mb-5 shadow-sm ring-1 ring-slate-200" />
                      <div className="max-w-[85%] sm:max-w-[82%]">
                        <p className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm whitespace-pre-line text-slate-800 shadow-sm">
                          {m.text}
                        </p>
                        {/* Nút loa to (2026-11-26, yêu cầu người dùng): bấm để nghe, bấm lần nữa để dừng. */}
                        <button
                          type="button"
                          onClick={() => {
                            if (playingId === m.id) {
                              stopAudio();
                              setPlayingId(null);
                              return;
                            }
                            setPlayingId(m.id);
                            void speakVoice(m.text, () => setPlayingId((p) => (p === m.id ? null : p)));
                          }}
                          title={playingId === m.id ? "Dừng đọc" : "Bấm để nghe"}
                          aria-label={playingId === m.id ? "Dừng đọc" : "Nghe câu trả lời"}
                          className={cn(
                            "mt-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            playingId === m.id
                              ? "border-brand-300 bg-brand-50 text-brand-700"
                              : "border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600",
                          )}
                        >
                          <Volume2 className={cn("h-4.5 w-4.5", playingId === m.id && "animate-pulse")} />
                          {playingId === m.id ? "Dừng" : "Nghe"}
                        </button>
                      </div>
                    </div>
                  ),
                )}
                {interim && (
                  <div className="flex justify-end">
                    <p className="max-w-[85%] sm:max-w-[82%] rounded-2xl rounded-br-md border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-700 italic">
                      {interim}…
                    </p>
                  </div>
                )}
                {busy && (
                  <div className="flex items-end gap-2">
                    <BrandMark size={26} className="shadow-sm ring-1 ring-slate-200" />
                    <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                      <ThinkingIndicator phase={phase} />
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* Ô nhập + micro */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
            {listening && (
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-medium text-red-600">
                <ListeningWave />
              </div>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (busy || !ready || !typed.trim()) return;
                void ask(typed);
                setTyped("");
              }}
            >
              <div className="flex min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-slate-50 pr-1 pl-4 transition-colors focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={ready ? "Nhập câu hỏi…" : aiEnabled ? "" : "AI chưa sẵn sàng"}
                  disabled={!ready}
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 sm:py-2 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !ready || !typed.trim()}
                  title="Gửi"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 sm:h-9 sm:w-9"
                >
                  <SendHorizontal className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={onMicClick}
                disabled={!supported || !ready || (busy && !convOn)}
                title={!supported ? "Trình duyệt này không nhận giọng nói" : listening || convOn ? "Dừng nói chuyện" : "Bấm để nói chuyện"}
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all disabled:opacity-40 sm:h-11 sm:w-11",
                  listening
                    ? "bg-red-500 ring-4 ring-red-200"
                    : speaking
                      ? "bg-brand-600 ring-4 ring-brand-200"
                      : "bg-gradient-to-br from-accent-500 to-accent-600 hover:scale-105 hover:shadow-lg",
                )}
              >
                {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />}
                {speaking && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-40" />}
                {!supported ? (
                  <MicOff className="h-5 w-5" />
                ) : speaking ? (
                  <Volume2 className="relative h-5 w-5 animate-pulse" />
                ) : (
                  <Mic className="relative h-5 w-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Nút nổi: logo công ty + nhãn AI (không có ở trang chat riêng) */}
      {!page && (
      <button
        type="button"
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý AI"}
        title={open ? "Đóng trợ lý" : "Trợ lý AI Đại Việt"}
        onClick={() => {
          // Vừa kéo thả xong thì không tính là bấm.
          if (justDraggedRef.current) {
            justDraggedRef.current = false;
            return;
          }
          if (open) close();
          // Điện thoại: mở trang chat riêng thay cho popup.
          else if (!window.matchMedia("(min-width: 640px)").matches) router.push(AI_CHAT_PATH);
          else setOpen(true);
        }}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
          d.moved = true;
          setDragPos({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          dragRef.current = null;
          if (!d?.moved) return;
          justDraggedRef.current = true;
          const next: Corner = `${e.clientY < window.innerHeight / 2 ? "t" : "b"}${e.clientX < window.innerWidth / 2 ? "l" : "r"}` as Corner;
          setDragPos(null);
          saveCorner(next);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragPos(null);
        }}
        style={dragPos ? { left: dragPos.x - 24, top: dragPos.y - 24, right: "auto", bottom: "auto" } : undefined}
        className={cn(
          "fixed z-40 h-12 w-12 touch-none items-center justify-center rounded-full bg-gradient-to-br from-brand-500 via-indigo-500 to-accent-500 p-[3px] shadow-lg shadow-brand-900/25 select-none hover:scale-105 active:scale-95",
          dragPos ? "cursor-grabbing" : "transition-transform",
          FAB_POS[corner],
          // Điện thoại: khung chat toàn màn hình đã có nút đóng → ẩn nút nổi cho khỏi che ô nhập.
          open ? "hidden sm:flex" : "flex",
        )}
      >
        {!open && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-20 [animation-duration:2.5s]" />}
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-white">
          {open ? (
            <X className="h-5 w-5 text-slate-600" />
          ) : (
            <Image src="/dai-viet-mark.png" alt="Đại Việt" width={32} height={32} draggable={false} className="h-7 w-7 object-contain" />
          )}
        </span>
        {!open && (
          <span className="absolute -top-1 -right-1.5 rounded-full bg-gradient-to-r from-accent-500 to-pink-500 px-1 py-px text-[9px] leading-3.5 font-bold text-white shadow ring-2 ring-white">
            AI
          </span>
        )}
      </button>
      )}
    </>
  );
}
