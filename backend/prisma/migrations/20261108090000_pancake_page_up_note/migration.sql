-- Cột "Ghi chú khi up số" ở bảng Pancake theo page (yêu cầu người dùng 2026-11-08): data up tự động từ page này mang sẵn Ghi chú MKT này; để trống = không ghi chú.
ALTER TABLE "pancake_pages" ADD COLUMN "up_note" VARCHAR(500);
