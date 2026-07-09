import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "./api-error";
import type { ApiErrorBody } from "./types";

const SERVER_API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
 * Gọi API từ Server Component — tiến trình server không tự có cookie của
 * trình duyệt, phải tự đọc và forward thủ công.
 */
export async function serverApi<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStore.toString(),
      ...init?.headers,
    },
  });
  return parseResponse<T>(res);
}

export { ApiError };
