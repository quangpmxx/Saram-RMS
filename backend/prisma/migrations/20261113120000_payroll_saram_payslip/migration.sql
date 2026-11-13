-- Phiếu lương Saram (2026-11-13): thêm ngày chính thức, ngân hàng, chủ tài khoản; khoản nhập tay.
ALTER TABLE "payroll_account_settings" ADD COLUMN "official_date" DATE;
ALTER TABLE "payroll_account_settings" ADD COLUMN "bank_name" VARCHAR(100);
ALTER TABLE "payroll_account_settings" ADD COLUMN "bank_account_holder" VARCHAR(150);
ALTER TABLE "payroll_slips" ADD COLUMN "manual_values" JSONB NOT NULL DEFAULT '{}';

-- Bỏ bộ thành phần + mẫu bảng lương thử nghiệm (user duyệt 2026-11-13: dùng mẫu phiếu lương
-- Saram thay cho các mẫu theo vị trí). Mở trang Kế toán lần tới hệ thống tự tạo lại bộ
-- thành phần + mẫu "Phiếu lương Saram". Phiếu lương đã lập giữ nguyên (mỗi phiếu tự lưu
-- bản chụp các khoản). Trên máy chủ thật 2 bảng này đang trống nên không mất gì.
UPDATE "payroll_account_settings" SET "template_id" = NULL;
DELETE FROM "payroll_templates";
DELETE FROM "payroll_components";
