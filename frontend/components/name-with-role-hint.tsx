import { ACCOUNT_ROLE_LABEL, type NamedRefWithRole } from "@/lib/types";
import { roleAccentTextStyle } from "@/lib/role-accent";

/**
 * Dự án phụ — nâng cấp toàn diện: mở ngoặc vai trò cạnh tên cho Admin/Quản
 * lý/Leader ở MỌI nơi tài khoản đó xuất hiện dưới dạng "người thực hiện"
 * (uploaded_by/assigned_to/held_by/care_pool_locked_by của Candidate,
 * created_by của Note/Interview/Callback) — yêu cầu trực tiếp người dùng:
 * "Các vai trò như admin, quản lý, leader thì thao tác ở đâu cũng phải mở
 * ngoặc vai trò cạnh tên". Sale/MKT không hiện ngoặc (đã là mặc định/hiển
 * nhiên trong nghiệp vụ, tránh rối mắt). Mỗi vai trò tô màu riêng (yêu cầu
 * trực tiếp người dùng): Admin vàng gold, Quản lý đỏ thẫm, Leader tím — xem
 * lib/role-accent.ts.
 */
const ROLE_HINT_ROLES = new Set(["admin", "manager", "leader"]);

export function NameWithRoleHint({ account, className }: { account: NamedRefWithRole; className?: string }) {
  const showHint = ROLE_HINT_ROLES.has(account.role);
  return (
    <span className={className}>
      {account.name}
      {showHint && (
        <>
          {" ("}
          <span style={roleAccentTextStyle(account.role)}>{ACCOUNT_ROLE_LABEL[account.role]}</span>
          {")"}
        </>
      )}
    </span>
  );
}
