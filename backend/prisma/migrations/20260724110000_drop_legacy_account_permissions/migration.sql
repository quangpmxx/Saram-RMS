-- Xóa hệ thống phân quyền CŨ (5 hành động cụ thể — ADD_EMPLOYEE/
-- DEACTIVATE_EMPLOYEE/RESET_PASSWORD/DELETE_LEAD/EDIT_SYSTEM_CONFIG) —
-- yêu cầu trực tiếp người dùng ("gộp luôn" vào hệ thống Phân quyền mới
-- theo module, UserModulePermission). Đã xác nhận backend CHƯA BAO GIỜ
-- thực sự dùng account_permissions.is_granted để chặn bất kỳ hành động
-- nào (chỉ lưu/hiển thị) — an toàn để xóa hẳn, không có nghiệp vụ nào phụ
-- thuộc vào dữ liệu này. Thứ tự: xóa "account_permissions" trước (có khóa
-- ngoài trỏ tới "permissions") rồi mới xóa "permissions".

-- DropTable
DROP TABLE IF EXISTS "account_permissions";

-- DropTable
DROP TABLE IF EXISTS "permissions";
