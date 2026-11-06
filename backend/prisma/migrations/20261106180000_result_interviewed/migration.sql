-- Cột "Kết quả" (category zalo_status) thêm lựa chọn "Đã phỏng vấn" — yêu cầu người dùng 2026-11-06.
-- Chỉ chèn dữ liệu danh mục, không đổi cấu trúc bảng; đã có thì bỏ qua.
INSERT INTO "status_catalog" ("id", "category", "code", "name", "sort_order")
VALUES (gen_random_uuid(), 'zalo_status', 'INTERVIEWED', 'Đã phỏng vấn', 2)
ON CONFLICT ("category", "code") DO NOTHING;
