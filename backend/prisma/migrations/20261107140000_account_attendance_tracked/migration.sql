-- Ô "Chấm công" ở Sửa tài khoản (yêu cầu người dùng 2026-11-07): bỏ tick = không có dòng trong bảng chấm công, không cộng phép.
ALTER TABLE "accounts" ADD COLUMN "attendance_tracked" BOOLEAN NOT NULL DEFAULT true;
