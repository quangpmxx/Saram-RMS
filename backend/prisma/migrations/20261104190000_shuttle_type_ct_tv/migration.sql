-- Đưa đón: cột "Loại hình" có 2 giá trị cố định CT (chính thức) / TV (thời vụ) — Dashboard tách số theo 2 giá trị này.
-- Đổi tên lựa chọn cũ "Chính thức"/"Thời vụ" sang CT/TV (giữ màu), rồi đổi luôn các dòng đã nhập.

UPDATE "shuttle_options" SET "value" = 'CT'
WHERE "field" = 'type' AND "value" = 'Chính thức'
  AND NOT EXISTS (SELECT 1 FROM "shuttle_options" WHERE "field" = 'type' AND "value" = 'CT');

UPDATE "shuttle_options" SET "value" = 'TV'
WHERE "field" = 'type' AND "value" = 'Thời vụ'
  AND NOT EXISTS (SELECT 1 FROM "shuttle_options" WHERE "field" = 'type' AND "value" = 'TV');

INSERT INTO "shuttle_options" ("id", "field", "value", "color_key", "created_at")
VALUES
  (gen_random_uuid(), 'type', 'CT', 'blue-base', now()),
  (gen_random_uuid(), 'type', 'TV', 'orange-base', now())
ON CONFLICT ("field", "value") DO NOTHING;

UPDATE "shuttle_records" SET "type" = 'CT' WHERE "type" = 'Chính thức';
UPDATE "shuttle_records" SET "type" = 'TV' WHERE "type" = 'Thời vụ';
