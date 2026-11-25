-- Trợ lý AI: mặc định 30 câu hỏi/ngày cho mọi tài khoản trừ Admin (user 2026-11-25).
-- Chỉ đặt cho tài khoản chưa có giới hạn riêng; Admin sửa lại từng người ở Sửa tài khoản.
UPDATE "accounts" SET "ai_daily_limit" = 30 WHERE "role" <> 'admin' AND "ai_daily_limit" IS NULL;
