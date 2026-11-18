/** Tin việc làm + tin tức/album lấy từ CRM (2026-11-18). Lỗi/mất kết nối → rỗng, trang không sập theo backend. */
export const CONTENT_TAG = "website-content";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export type Job = {
  id: string;
  slug: string;
  title: string;
  company: string | null;
  area: string | null;
  salary: string | null;
  shift: string | null;
  description: string | null;
  image: string | null;
  urgent: boolean;
  published: boolean;
  sort_order: number;
  updated_at: string;
};

export type PostKind = "news" | "album";
export type Post = {
  id: string;
  slug: string;
  kind: PostKind;
  title: string;
  summary: string | null;
  body: string | null;
  cover: string | null;
  images: string[];
  published: boolean;
  published_at: string | null;
  updated_at: string;
};

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { tags: [CONTENT_TAG], revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** Đường dẫn trong URL chỉ gồm chữ thường, số, gạch ngang (tránh gửi ký tự lạ sang CRM). */
const safeSlug = (s: string) => /^[a-z0-9-]{1,160}$/.test(s);

export const getJobs = () => get<Job[]>("/website/jobs", []);
export const getJob = (slug: string) => (safeSlug(slug) ? get<Job | null>(`/website/jobs/${slug}`, null) : Promise.resolve(null));
export const getPosts = (kind?: PostKind) => get<Post[]>(`/website/posts${kind ? `?kind=${kind}` : ""}`, []);
export const getPost = (slug: string) => (safeSlug(slug) ? get<Post | null>(`/website/posts/${slug}`, null) : Promise.resolve(null));

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
