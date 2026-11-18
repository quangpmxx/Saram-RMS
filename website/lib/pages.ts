/**
 * Trang tự thêm + khối thêm từ mẫu (2026-11-18). Lưu trong website_texts:
 *   pages            → JSON [{ slug, title, menu }]           trang mới, đường dẫn /<slug>
 *   custom.<trang>   → JSON [{ id: "c-xxxxx", type, ...cấu hình }]  khối thêm vào trang
 * Chữ trong khối mới sửa tại chỗ như mọi chỗ khác (mã cb.<id>.<trường>).
 * File dùng chung cho máy chủ và thanh sửa — không import gì của máy chủ.
 */

export type CustomPage = { slug: string; title: string; menu: boolean };

/** Đường dẫn đã có trang/tính năng — không cho đặt trùng. */
const RESERVED = new Set([
  "viec-lam",
  "nguoi-lao-dong",
  "doanh-nghiep",
  "ve-chung-toi",
  "lien-he",
  "tin-tuc",
  "dang-nhap",
  "fix",
  "lam-moi-noi-dung",
  "quan-ly",
  "api",
  "uploads",
  "images",
  "logos",
]);

export const isPageSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(v) && !RESERVED.has(v);

export function parsePages(raw: string | undefined): CustomPage[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    return v
      .filter((p): p is CustomPage => !!p && typeof p === "object" && isPageSlug((p as CustomPage).slug))
      .filter((p) => !seen.has(p.slug) && seen.add(p.slug))
      .slice(0, 30)
      .map((p) => ({ slug: p.slug, title: String(p.title ?? "").slice(0, 120) || p.slug, menu: p.menu === true }));
  } catch {
    return [];
  }
}

/** "Tuyển dụng Foxconn" → "tuyen-dung-foxconn" */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "trang-moi"
  );
}

/* ---------- Khối thêm từ mẫu ---------- */

export const BLOCK_TYPES = {
  text: { label: "Tiêu đề + đoạn chữ" },
  "text-image": { label: "Chữ + ảnh" },
  image: { label: "Ảnh lớn + chú thích" },
  faq: { label: "Câu hỏi thường gặp" },
  video: { label: "Video YouTube" },
  cta: { label: "Kêu gọi (nút bấm)" },
  jobs: { label: "Việc làm mới nhất" },
  posts: { label: "Tin tức mới nhất" },
  form: { label: "Form đăng ký" },
} as const;
export type BlockType = keyof typeof BLOCK_TYPES;

export type CustomBlock = {
  id: string;
  type: BlockType;
  /** text-image: ảnh nằm bên phải (mặc định bên trái). */
  right?: boolean;
  /** faq: số câu hỏi. */
  n?: number;
  /** video: mã video YouTube (11 ký tự). */
  video?: string;
  /** form: "worker" | "business". */
  form?: "worker" | "business";
};

export const isBlockType = (v: unknown): v is BlockType => typeof v === "string" && v in BLOCK_TYPES;
export const isYoutubeId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{11}$/.test(v);

/** Lấy mã video từ link YouTube (youtu.be/…, watch?v=…, shorts/…) hoặc chính mã. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function parseCustomBlocks(raw: string | undefined): CustomBlock[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(v)) return [];
    return v
      .filter((b): b is CustomBlock => !!b && typeof b === "object" && /^c-[a-z0-9]{4,10}$/.test((b as CustomBlock).id) && isBlockType((b as CustomBlock).type))
      .slice(0, 40)
      .map((b) => ({
        id: b.id,
        type: b.type,
        ...(b.right === true ? { right: true } : {}),
        ...(Number.isInteger(b.n) && b.n! >= 1 && b.n! <= 20 ? { n: b.n } : {}),
        ...(isYoutubeId(b.video) ? { video: b.video } : {}),
        ...(b.form === "business" ? { form: "business" as const } : {}),
      }));
  } catch {
    return [];
  }
}

export const newBlockId = () => `c-${Math.random().toString(36).slice(2, 8)}`;
