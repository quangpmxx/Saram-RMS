-- Đưa đón: thêm cột "Nguồn" (Data / GT)
ALTER TABLE "shuttle_records" ADD COLUMN "lead_source" VARCHAR(50);

-- 2 lựa chọn mặc định, mỗi cái 1 màu (đổi màu được ở menu quản lý lựa chọn)
INSERT INTO "shuttle_options" ("id", "field", "value", "color_key", "created_at")
VALUES
  (gen_random_uuid(), 'lead_source', 'Data', 'cornflower-base', now()),
  (gen_random_uuid(), 'lead_source', 'GT', 'orange-base', now())
ON CONFLICT ("field", "value") DO NOTHING;
