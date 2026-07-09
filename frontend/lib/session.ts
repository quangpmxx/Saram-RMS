import { ApiError, serverApi } from "./api-server";
import type { Account } from "./types";

/** Trả về null nếu chưa đăng nhập/phiên hết hạn, không ném lỗi ra ngoài. */
export async function getCurrentUser(): Promise<Account | null> {
  try {
    return await serverApi<Account>("/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
