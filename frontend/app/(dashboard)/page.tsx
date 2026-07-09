import { getCurrentUser } from "@/lib/session";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";

/**
 * Phase 0 chỉ có nghiệp vụ Tài khoản & Nhóm (Admin). Các vai trò khác đăng
 * nhập được nhưng chưa có màn hình nghiệp vụ riêng — sẽ có ở các Phase sau
 * theo docs/14-roadmap.md, nên trang chủ chỉ hiển thị lời chào, không tạo
 * liên kết tới tính năng chưa tồn tại.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-zinc-900">
          Xin chào, {user?.full_name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Vai trò: {user ? ACCOUNT_ROLE_LABEL[user.role] : ""}
          {user?.team_name ? ` · Nhóm: ${user.team_name}` : ""}
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          Đây là Phase 0 (Nền tảng hệ thống &amp; Tài khoản). Các màn hình nghiệp vụ tuyển
          dụng (ứng viên, phân chia, chăm sóc, dashboard...) sẽ có ở các giai đoạn phát
          triển tiếp theo.
        </p>
      </div>
    </div>
  );
}
