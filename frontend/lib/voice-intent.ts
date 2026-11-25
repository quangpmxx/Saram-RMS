import { computeDateRange, type DatePreset } from "@/lib/date-range";

/**
 * Trợ lý giọng nói — bản miễn phí (2026-11-25, yêu cầu người dùng): KHÔNG dùng AI, chỉ nhận
 * từ khoá trong câu hỏi (tiếng Việt, có/không dấu) để biết hỏi chỉ số nào, kỳ nào, nhóm/người nào.
 * Số liệu lấy từ đúng các API Dashboard (backend tự giới hạn theo quyền người hỏi).
 */

export type VoiceMetric =
  | "new_leads"
  | "interview_scheduled"
  | "attended"
  | "no_show"
  | "passed"
  | "failed"
  | "spend"
  | "care"
  | "overview";

export interface VoicePeriod {
  from: string;
  to: string;
  /** Lọc theo tháng → số PV gộp trùng người (như Dashboard). */
  byPerson: boolean;
  /** Đọc lên: "hôm nay", "tháng 11"… */
  label: string;
  /** YYYY-MM của kỳ (dùng cho Tiến độ chăm sóc). */
  month: string;
}

export interface VoiceIntent {
  metric: VoiceMetric;
  /** Hỏi tỷ lệ (vd tỷ lệ đỗ). */
  rate: boolean;
  /** Hỏi ai/nhóm nào nhiều nhất. */
  top: boolean;
  period: VoicePeriod;
}

/** Bỏ dấu, chữ thường, gộp khoảng trắng — để so khớp không phụ thuộc cách nhận giọng. */
export function foldVi(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** q đã qua foldVi (có dấu cách 2 đầu) → so nguyên từ, không khớp nửa từ ("do" ≠ "don"). */
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(` ${w} `));

const PRESET_WORDS: Array<[DatePreset, string[], string]> = [
  ["yesterday", ["hom qua"], "hôm qua"],
  ["last_week", ["tuan truoc", "tuan roi"], "tuần trước"],
  ["this_week", ["tuan nay"], "tuần này"],
  ["last_month", ["thang truoc", "thang roi"], "tháng trước"],
  ["this_month", ["thang nay"], "tháng này"],
  ["7d", ["7 ngay", "bay ngay", "1 tuan qua", "mot tuan qua"], "7 ngày qua"],
  ["30d", ["30 ngay", "ba muoi ngay"], "30 ngày qua"],
  ["today", ["hom nay", "nay"], "hôm nay"],
];

const pad = (n: number) => String(n).padStart(2, "0");

export function parsePeriod(q: string, now = new Date()): VoicePeriod {
  // "tháng 10", "tháng 10 năm 2026"
  const m = q.match(/ thang (\d{1,2})(?: nam (\d{4}))? /);
  if (m) {
    const month = Number(m[1]);
    if (month >= 1 && month <= 12) {
      let year = m[2] ? Number(m[2]) : now.getFullYear();
      if (!m[2] && month > now.getMonth() + 1) year -= 1; // "tháng 12" khi đang tháng 11 → năm ngoái
      const last = new Date(year, month, 0).getDate();
      return {
        from: `${year}-${pad(month)}-01`,
        to: `${year}-${pad(month)}-${pad(last)}`,
        byPerson: true,
        label: `tháng ${month}`,
        month: `${year}-${pad(month)}`,
      };
    }
  }
  for (const [preset, words, label] of PRESET_WORDS) {
    if (has(q, ...words)) {
      const r = computeDateRange(preset);
      return {
        ...r,
        byPerson: preset === "this_month" || preset === "last_month",
        label,
        month: r.to.slice(0, 7),
      };
    }
  }
  const r = computeDateRange("today");
  return { ...r, byPerson: false, label: "hôm nay", month: r.to.slice(0, 7) };
}

export function parseMetric(q: string): VoiceMetric {
  if (has(q, "kho cham soc", "tien do cham soc", "cham soc kho", "cham soc data")) return "care";
  if (has(q, "chi phi", "tien quang cao", "quang cao", "ngan sach", "tieu het", "tieu bao nhieu", "tieu"))
    return "spend";
  if (has(q, "bung", "khong den", "khong don duoc", "chua don duoc")) return "no_show";
  if (has(q, "truot")) return "failed";
  if (has(q, "do", "dau", "trung tuyen", "pass")) return "passed";
  if (has(q, "den phong van", "den pv", "da don", "don duoc", "di phong van", "den")) return "attended";
  if (has(q, "hen")) return "interview_scheduled";
  if (has(q, "data", "so moi", "len so", "chay duoc", "chay", "so dien thoai", "bao nhieu so", "lead"))
    return "new_leads";
  return "overview";
}

export function parseIntent(text: string, now = new Date()): VoiceIntent {
  const q = foldVi(text);
  return {
    metric: parseMetric(q),
    rate: has(q, "ty le", "ti le", "phan tram"),
    top: has(q, "nhieu nhat", "cao nhat", "dan dau", "gioi nhat", "top", "dung dau", "ai nhieu"),
    period: parsePeriod(q, now),
  };
}

/** Tìm tên (nhóm / nhân viên) xuất hiện trong câu hỏi; ưu tiên tên dài nhất khớp. */
export function findNamed<T>(text: string, items: T[], names: (item: T) => string[]): T | null {
  const q = foldVi(text);
  let best: { item: T; len: number } | null = null;
  for (const item of items) {
    for (const raw of names(item)) {
      const n = foldVi(raw).trim();
      if (n.length < 2) continue;
      if (q.includes(` ${n} `) && (!best || n.length > best.len)) best = { item, len: n.length };
    }
  }
  return best?.item ?? null;
}

export const METRIC_LABEL: Record<Exclude<VoiceMetric, "spend" | "care" | "overview">, string> = {
  new_leads: "data mới",
  interview_scheduled: "lượt hẹn phỏng vấn",
  attended: "lượt đến phỏng vấn",
  no_show: "lượt bùng phỏng vấn",
  passed: "lượt đỗ phỏng vấn",
  failed: "lượt trượt phỏng vấn",
};

export const VOICE_EXAMPLES = [
  "Hôm nay chạy được bao nhiêu số?",
  "Tháng này hẹn được bao nhiêu phỏng vấn?",
  "Hôm qua đỗ bao nhiêu?",
  "Tỷ lệ đỗ tuần này?",
  "Nhóm A tháng này đỗ bao nhiêu?",
  "Ai đỗ nhiều nhất tháng này?",
  "Chi phí quảng cáo hôm nay?",
  "Tiến độ chăm sóc kho data?",
  "Tình hình hôm nay thế nào?",
];
