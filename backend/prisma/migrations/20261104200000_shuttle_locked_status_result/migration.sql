-- Đưa đón: khoá các lựa chọn Dashboard đếm theo (Tình trạng "Đã đón"/"Chưa đón được", Kết quả "Đỗ PV"/"Trượt PV").
-- Đổi tên lựa chọn cũ "Đỗ phỏng vấn"/"Trượt phỏng vấn" (nếu còn) sang tên chuẩn, đổi luôn các dòng đã nhập,
-- rồi thêm lựa chọn còn thiếu.

UPDATE "shuttle_options" SET "value" = 'Đỗ PV'
WHERE "field" = 'interview_result' AND "value" = 'Đỗ phỏng vấn'
  AND NOT EXISTS (SELECT 1 FROM "shuttle_options" WHERE "field" = 'interview_result' AND "value" = 'Đỗ PV');

UPDATE "shuttle_options" SET "value" = 'Trượt PV'
WHERE "field" = 'interview_result' AND "value" = 'Trượt phỏng vấn'
  AND NOT EXISTS (SELECT 1 FROM "shuttle_options" WHERE "field" = 'interview_result' AND "value" = 'Trượt PV');

UPDATE "shuttle_records" SET "interview_result" = 'Đỗ PV' WHERE "interview_result" = 'Đỗ phỏng vấn';
UPDATE "shuttle_records" SET "interview_result" = 'Trượt PV' WHERE "interview_result" = 'Trượt phỏng vấn';

INSERT INTO "shuttle_options" ("id", "field", "value", "color_key", "created_at")
VALUES
  (gen_random_uuid(), 'status', 'Đã đón', 'green-4', now()),
  (gen_random_uuid(), 'status', 'Chưa đón được', 'red-base', now()),
  (gen_random_uuid(), 'interview_result', 'Đỗ PV', 'green-4', now()),
  (gen_random_uuid(), 'interview_result', 'Trượt PV', 'red-3', now())
ON CONFLICT ("field", "value") DO NOTHING;
