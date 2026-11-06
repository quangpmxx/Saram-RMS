-- Năm sinh nhập tự do (yêu cầu người dùng 2026-11-06): đổi cột từ số (SMALLINT)
-- sang chữ (VARCHAR 50). Dữ liệu cũ giữ nguyên, chỉ chuyển "1995" (số) -> "1995" (chữ).
ALTER TABLE "leads" ALTER COLUMN "birth_year" TYPE VARCHAR(50) USING "birth_year"::text;
