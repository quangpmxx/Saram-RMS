import type { CSSProperties } from "react";

/**
 * Kiểu chữ / ảnh / bố cục sửa tại chỗ (2026-11-17). Lưu chung bảng website_texts, mỗi thứ một mã:
 *   <mã chữ>.__style  → JSON TextStyle      <mã ảnh>.__style → JSON ImageStyle
 *   <mã chữ nút>.__href → đường dẫn nút     layout.<trang>   → JSON { order, hidden }
 * Giá trị đến từ CSDL nên luôn kiểm lại ở đây trước khi đưa vào trang (không tin dữ liệu lưu).
 */
export const STYLE_SUFFIX = ".__style";
export const HREF_SUFFIX = ".__href";

export type TextAlign = "left" | "center" | "right";
export type TextStyle = { size?: number; color?: string; b?: boolean; i?: boolean; u?: boolean; align?: TextAlign; hidden?: boolean };
export type ImageStyle = { fit?: "cover" | "contain"; x?: number; y?: number; zoom?: number };
export type Layout = { order: string[]; hidden: string[] };

/** Các nấc cỡ chữ (so với cỡ gốc). */
export const SIZE_STEPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

function parseObject(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

export function parseTextStyle(raw: string | undefined): TextStyle {
  const o = parseObject(raw);
  const s: TextStyle = {};
  const size = num(o.size, 0.5, 3);
  if (size !== undefined && size !== 1) s.size = size;
  if (isHex(o.color)) s.color = o.color;
  for (const k of ["b", "i", "u", "hidden"] as const) {
    const v = bool(o[k]);
    if (v !== undefined) s[k] = v;
  }
  if (o.align === "left" || o.align === "center" || o.align === "right") s.align = o.align;
  if (!s.hidden) delete s.hidden;
  return s;
}

export function textStyleCss(s: TextStyle): CSSProperties {
  const css: CSSProperties = {};
  if (s.size) css.fontSize = `${s.size}em`;
  if (s.color) css.color = s.color;
  if (s.b !== undefined) css.fontWeight = s.b ? 700 : 400;
  if (s.i !== undefined) css.fontStyle = s.i ? "italic" : "normal";
  if (s.u !== undefined) css.textDecoration = s.u ? "underline" : "none";
  if (s.align) {
    css.display = "block";
    css.textAlign = s.align;
  }
  return css;
}

export function parseImageStyle(raw: string | undefined): ImageStyle {
  const o = parseObject(raw);
  const s: ImageStyle = {};
  if (o.fit === "cover" || o.fit === "contain") s.fit = o.fit;
  const x = num(o.x, 0, 100);
  const y = num(o.y, 0, 100);
  if (x !== undefined) s.x = x;
  if (y !== undefined) s.y = y;
  const zoom = num(o.zoom, 1, 3);
  if (zoom !== undefined && zoom !== 1) s.zoom = zoom;
  return s;
}

/** Chỉ các thuộc tính ảnh do chế độ sửa điều khiển ("" = trả về mặc định). */
export function imageStyleCss(s: ImageStyle): Record<"objectFit" | "objectPosition" | "transform" | "transformOrigin", string> {
  const pos = s.x !== undefined || s.y !== undefined ? `${s.x ?? 50}% ${s.y ?? 50}%` : "";
  return {
    objectFit: s.fit ?? "",
    objectPosition: pos,
    transform: s.zoom ? `scale(${s.zoom})` : "",
    transformOrigin: s.zoom ? pos || "50% 50%" : "",
  };
}

const SAFE_HREF = /^(\/[^\s"'<>]*|#[\w-]*|https?:\/\/[^\s"'<>]+|tel:\+?[\d .-]{6,20}|mailto:[^\s@"'<>]+@[^\s@"'<>]+)$/i;
/** Đường dẫn nút được phép: trang trong web (/...), https://, tel:, mailto:. Chặn javascript: v.v. */
export const isSafeHref = (v: unknown): v is string => typeof v === "string" && v.length <= 500 && SAFE_HREF.test(v.trim());

export function parseLayout(raw: string | undefined): Layout {
  const o = parseObject(raw);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)) : []);
  return { order: ids(o.order), hidden: ids(o.hidden) };
}

/** Số điện thoại chỉ gồm chữ số (có thể có + đầu). */
export const isPhone = (v: unknown): v is string => typeof v === "string" && /^\+?\d{8,15}$/.test(v);
export const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 120 && /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(v);

/** 0971242250 → 0971 242 250 */
export function formatPhone(d: string): string {
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d;
}

/** Cỡ chữ toàn trang (%). */
export const SCALE_MIN = 85;
export const SCALE_MAX = 125;

export const THEME_DEFAULTS = { brand: "#f26b1d", royal: "#1f4fd8", ink: "#0b1733", scale: 100, font: "roboto" as string };
export type Theme = typeof THEME_DEFAULTS;

/** Biến màu suy ra từ 3 màu chính — dùng chung cho máy chủ và thanh sửa (đổi màu xem ngay). */
export function themeVars(th: Pick<Theme, "brand" | "royal" | "ink">): Record<string, string> {
  return {
    "--color-brand": th.brand,
    "--color-brand-dark": `color-mix(in srgb, ${th.brand} 85%, black)`,
    "--color-brand-soft": `color-mix(in srgb, ${th.brand} 8%, white)`,
    "--color-royal": th.royal,
    "--color-royal-dark": `color-mix(in srgb, ${th.royal} 82%, black)`,
    "--color-ink": th.ink,
    "--color-ink-2": `color-mix(in srgb, ${th.ink} 88%, white)`,
  };
}

/* ---------- Đợt 1 sửa nâng cao (2026-11-18) ---------- */

/** Ảnh đã tải lên CRM (đường dẫn hợp lệ duy nhất cho ảnh tuỳ chỉnh). */
export const isUploadUrl = (v: unknown): v is string => typeof v === "string" && /^\/uploads\/website\/[\w-]+\.(jpg|png|webp)$/.test(v);

/** Kiểu nút: mã `<mã chữ nút>.__btn`. */
export const BTN_SUFFIX = ".__btn";
export const BUTTON_VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-lg shadow-orange-900/20",
  light: "bg-white text-ink hover:bg-slate-100",
  outline: "border border-slate-300 text-ink hover:border-ink",
} as const;
export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export const isButtonVariant = (v: unknown): v is ButtonVariant => typeof v === "string" && v in BUTTON_VARIANTS;

/** Nền + khoảng cách của một khối: mã `block.<trang>.<khối>`. */
export type BlockPad = "sm" | "lg" | "xl";
export type BlockStyle = { bg?: string; img?: string; dim?: boolean; pad?: BlockPad };
export const BLOCK_PAD: Record<BlockPad, string> = { sm: "2.5rem", lg: "6.5rem", xl: "9rem" };

export function parseBlockStyle(raw: string | undefined): BlockStyle {
  const o = parseObject(raw);
  const s: BlockStyle = {};
  if (isHex(o.bg)) s.bg = o.bg;
  if (isUploadUrl(o.img)) s.img = o.img;
  if (o.dim === true && s.img) s.dim = true;
  if (o.pad === "sm" || o.pad === "lg" || o.pad === "xl") s.pad = o.pad;
  return s;
}

/** Biến CSS đặt trên thẻ bọc khối (globals.css áp vào <section> bên trong). */
export function blockStyleVars(s: BlockStyle): Record<string, string> {
  const v: Record<string, string> = {};
  if (s.img) {
    const dim = s.dim ? "linear-gradient(rgb(11 23 51 / 0.65), rgb(11 23 51 / 0.65)), " : "";
    v["--sec-bg"] = `${dim}url("/api${s.img}") center / cover no-repeat`;
  } else if (s.bg) v["--sec-bg"] = s.bg;
  if (s.pad) v["--sec-pad"] = BLOCK_PAD[s.pad];
  return v;
}

/** Font chữ chọn được (đều có dấu tiếng Việt). `var` khớp biến khai báo ở app/layout.tsx. */
export const FONTS = [
  { key: "roboto", label: "Roboto (gốc)", cssVar: "--font-body" },
  { key: "be-vietnam", label: "Be Vietnam Pro", cssVar: "--font-bevn" },
  { key: "inter", label: "Inter", cssVar: "--font-inter" },
  { key: "montserrat", label: "Montserrat", cssVar: "--font-montserrat" },
  { key: "lexend", label: "Lexend", cssVar: "--font-lexend" },
  { key: "nunito", label: "Nunito", cssVar: "--font-nunito" },
  { key: "open-sans", label: "Open Sans", cssVar: "--font-opensans" },
] as const;
export type FontKey = (typeof FONTS)[number]["key"];
export const isFontKey = (v: unknown): v is FontKey => FONTS.some((f) => f.key === v);
export const fontVar = (k: FontKey) => FONTS.find((f) => f.key === k)!.cssVar;

/** Mã theo dõi: chỉ nhận đúng dạng mã số, không cho dán đoạn code tuỳ ý (tránh chèn mã độc). */
export const isPixelId = (v: unknown): v is string => typeof v === "string" && /^\d{10,20}$/.test(v);
export const isGa4Id = (v: unknown): v is string => typeof v === "string" && /^G-[A-Z0-9]{4,15}$/.test(v);
export const isZaloOaId = (v: unknown): v is string => typeof v === "string" && /^\d{8,25}$/.test(v);
