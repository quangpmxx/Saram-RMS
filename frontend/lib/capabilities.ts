/**
 * Phân quyền chi tiết (2026-11-07): kiểm 1 quyền nhỏ phía giao diện — danh
 * sách quyền hiệu lực lấy từ GET /me (backend `capability-catalog.ts` là
 * nguồn sự thật và lớp chặn thật; ở đây chỉ để ẩn/hiện nút cho đúng).
 * Dùng được cả ở Server Component (truyền `user`) lẫn client (xem useCan()).
 */
export function hasCap(user: { capabilities?: string[] } | null | undefined, code: string): boolean {
  return user?.capabilities?.includes(code) ?? false;
}
