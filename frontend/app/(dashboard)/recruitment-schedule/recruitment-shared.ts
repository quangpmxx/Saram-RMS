import type { RecruitmentPosting, RecruitmentStatus } from "@/lib/types";

/** Nhãn nhanh — khớp RECRUITMENT_TAGS ở backend (dto/recruitment-posting.dto.ts). */
export const RECRUITMENT_TAGS: { code: string; label: string }[] = [
  { code: "sitting", label: "Làm ngồi" },
  { code: "no_gate", label: "Không cửa từ" },
  { code: "bonus", label: "Có thưởng" },
  { code: "dorm", label: "Có KTX" },
  { code: "bus", label: "Có xe đưa đón" },
  { code: "tattoo_ok", label: "Nhận xăm" },
  { code: "phone_ok", label: "Được mang điện thoại" },
];
export const TAG_LABEL: Record<string, string> = Object.fromEntries(RECRUITMENT_TAGS.map((t) => [t.code, t.label]));

/**
 * Danh sách nhãn cho bộ lọc "Muốn" và popup sửa: các nhãn có sẵn + mọi nhãn người
 * sửa lịch tự gõ thêm đang được ít nhất 1 công ty dùng (tự hiện, không cần cài đặt).
 */
export function collectTags(postings: RecruitmentPosting[]): { code: string; label: string }[] {
  const custom = [...new Set(postings.flatMap((p) => p.tags))].filter((tag) => !(tag in TAG_LABEL)).sort((a, b) => a.localeCompare(b, "vi"));
  return [...RECRUITMENT_TAGS, ...custom.map((tag) => ({ code: tag, label: tag }))];
}

export const STATUS_META: Record<RecruitmentStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  open: { label: "Đang tuyển", variant: "success" },
  limited: { label: "Hạn chế", variant: "warning" },
  paused: { label: "Tạm dừng", variant: "danger" },
};

export const lines = (text: string | null): string[] =>
  (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** 5700000 → "5,7 triệu". */
export function formatMillions(dong: number): string {
  return `${(dong / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} triệu`;
}

export const formatDong = (dong: number): string => dong.toLocaleString("vi-VN");

/** Lương cơ bản + phụ cấp (đồng); null nếu chưa nhập lương cơ bản. */
export function totalPay(p: RecruitmentPosting): number | null {
  return p.base_salary == null ? null : p.base_salary + (p.allowance ?? 0);
}

export function genderLabel(p: RecruitmentPosting): string {
  if (p.accept_male && p.accept_female) return "Nam, Nữ";
  if (p.accept_female) return "Chỉ Nữ";
  if (p.accept_male) return "Chỉ Nam";
  return "Chưa rõ";
}

export function ageLabel(p: RecruitmentPosting, year: number): string {
  const { age_min: min, age_max: max } = p;
  if (min == null && max == null) return "";
  if (min != null && max != null) return `${min} – ${max} tuổi (sinh ${year - max} – ${year - min})`;
  if (max != null) return `đến ${max} tuổi (sinh từ ${year - max})`;
  return `từ ${min} tuổi`;
}

export interface WorkerFilter {
  gender: "" | "male" | "female";
  birthYear: string;
  wants: string[];
}

/**
 * Năm sinh Sale gõ → năm đầy đủ; null nếu chưa gõ xong/không hợp lệ (khi đó KHÔNG lọc theo tuổi).
 * Nhận 4 số ("1990") hoặc 2 số cuối ("90" → 1990, "05" → 2005).
 */
export function resolveBirthYear(text: string, year: number): number | null {
  if (!/^[0-9]+$/.test(text)) return null;
  let value: number;
  if (text.length === 4) value = Number(text);
  else if (text.length === 2) value = Number(text) <= year % 100 ? 2000 + Number(text) : 1900 + Number(text);
  else return null;
  const age = year - value;
  return age >= 10 && age <= 80 ? value : null;
}

/** Lý do công ty KHÔNG nhận được lao động đang tư vấn; chuỗi rỗng = nhận được. */
export function mismatchReason(p: RecruitmentPosting, filter: WorkerFilter, year: number): string {
  const reasons: string[] = [];
  if (filter.gender === "male" && !p.accept_male) reasons.push("Chỉ nhận nữ");
  if (filter.gender === "female" && !p.accept_female) reasons.push("Chỉ nhận nam");
  const birthYear = resolveBirthYear(filter.birthYear, year);
  if (birthYear != null) {
    const age = year - birthYear;
    if (p.age_max != null && age > p.age_max) reasons.push(`${age} tuổi là quá tuổi, chỉ nhận đến ${p.age_max} tuổi (sinh từ ${year - p.age_max})`);
    if (p.age_min != null && age < p.age_min) reasons.push(`${age} tuổi là chưa đủ tuổi, nhận từ ${p.age_min} tuổi`);
  }
  const missing = filter.wants.filter((w) => !p.tags.includes(w)).map((w) => (TAG_LABEL[w] ?? w).toLowerCase());
  if (missing.length > 0) reasons.push(`Không đáp ứng: ${missing.join(", ")}`);
  return reasons.join(" · ");
}

/** Đoạn tin tư vấn soạn sẵn để dán vào Zalo. */
export function buildZaloMessage(p: RecruitmentPosting, year: number): string {
  const out: string[] = [`CÔNG TY ${p.company_name}${p.area ? ` - ${p.area}` : ""}`];
  const age = ageLabel(p, year);
  out.push(`- Nhận: ${genderLabel(p)}${age ? `, ${age}` : ""}`);
  const push = (label: string, text: string | null) => {
    const items = lines(text);
    if (items.length > 0) out.push(`- ${label}: ${items.join("; ")}`);
  };
  push("Công việc", p.work);
  const total = totalPay(p);
  if (total != null) {
    out.push(
      `- Lương cơ bản ${formatDong(p.base_salary ?? 0)}đ${p.allowance ? ` + phụ cấp ${formatDong(p.allowance)}đ` : ""}`,
    );
  }
  push("Chi tiết lương", p.salary_note);
  if (p.bonus_summary) out.push(`- Thưởng: ${p.bonus_summary}`);
  push("Các mốc thưởng", p.bonus);
  push("Lịch phỏng vấn", p.interview_slot);
  push("Mang theo", p.documents);
  push("Trọ, đi lại", p.housing);
  return out.join("\n");
}
