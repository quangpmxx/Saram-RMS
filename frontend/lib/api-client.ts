import { ApiError } from "./api-error";
import type { ApiErrorBody } from "./types";

// KHÔNG import "next/headers" ở file này — nó được bundle vào Client
// Component (login-form.tsx...), và next/headers chỉ chạy được ở server.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Phiên hết hạn/bị thu hồi (401) khi đang dùng app → chuyển thẳng về trang
 * đăng nhập thay vì để màn hình báo lỗi (yêu cầu người dùng 2026-10-29).
 * Trừ chính lệnh đăng nhập (sai mật khẩu cũng là 401) và khi đang ở /login.
 */
function redirectToLoginIfSessionEnded(res: Response, path: string): boolean {
  if (res.status !== 401 || path === "/login" || typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/login")) return false;
  window.location.replace("/login");
  return true;
}

async function parseResponse<T>(res: Response, path: string): Promise<T> {
  // Không trả kết quả cũng không ném lỗi — trang sắp được thay bằng /login,
  // tránh nơi gọi kịp hiện thông báo lỗi trong lúc chuyển trang.
  if (redirectToLoginIfSessionEnded(res, path)) return new Promise<T>(() => {});
  const contentType = res.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    const errorBody = body as ApiErrorBody | undefined;
    throw new ApiError(res.status, errorBody?.error_code ?? "UNKNOWN", errorBody?.message ?? "Đã có lỗi xảy ra");
  }

  return body as T;
}

/**
 * Gọi API từ Client Component ("use client") — trình duyệt tự đính kèm
 * cookie phiên đăng nhập (credentials: "include").
 */
export async function clientApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  return parseResponse<T>(res, path);
}

/**
 * Gọi API kèm file (multipart/form-data) — KHÔNG tự đặt Content-Type để
 * trình duyệt tự sinh boundary đúng, khác với clientApi() ở trên.
 */
export async function clientApiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return parseResponse<T>(res, path);
}

/**
 * Tải 1 file (vd ảnh cần đăng nhập mới xem được) về dạng Blob — gửi kèm
 * cookie phiên, dùng với URL.createObjectURL() để hiện trong <img>.
 */
export async function clientApiBlob(path: string): Promise<Blob> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, { credentials: "include" });
  if (!res.ok) await parseResponse<unknown>(res, path);
  return res.blob();
}

export { ApiError };
