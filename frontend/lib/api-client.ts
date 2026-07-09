import { ApiError } from "./api-error";
import type { ApiErrorBody } from "./types";

// KHÔNG import "next/headers" ở file này — nó được bundle vào Client
// Component (login-form.tsx...), và next/headers chỉ chạy được ở server.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function parseResponse<T>(res: Response): Promise<T> {
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
  return parseResponse<T>(res);
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
  return parseResponse<T>(res);
}

export { ApiError };
