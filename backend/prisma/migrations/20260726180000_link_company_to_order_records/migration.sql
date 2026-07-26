-- Yêu cầu trực tiếp người dùng (2026-07-26): "Cột công ty ở danh sách đưa
-- đón và cột công ty làm ở module nhập doanh số sẽ lấy dữ liệu đơn hàng
-- được tạo ở đây. Hiểu đơn giản công ty chính là đơn hàng." Chuyển cả 2 cột
-- "Công ty" (đưa đón, đưa đón hiện là chuỗi tự do) và "công_ty_làm" (nhập
-- doanh số, đã là companyId nhưng chưa gắn FK) sang cùng tham chiếu thật
-- vào order_records. Không mất dữ liệu cũ: mỗi giá trị công ty đã nhập
-- trước đây (ở shuttle_options field='company' và/hoặc chuỗi tự do trong
-- shuttle_records.company) được tự động tạo thành 1 đơn hàng tương ứng.
-- gen_random_uuid() là hàm CORE của Postgres 13+ (giống cách Prisma tự sinh
-- uuid ở @default(uuid())), không cần cài thêm extension pgcrypto.

-- 1) Cột company_id mới trên shuttle_records (song song tồn tại tạm với
--    company cũ trong lúc backfill, xóa company ở bước sau).
ALTER TABLE "shuttle_records" ADD COLUMN "company_id" UUID;

-- 2) Tạo order_records cho mỗi giá trị công ty CHƯA từng tồn tại trong
--    order_records (so khớp theo tên) — gộp cả 2 nguồn cũ:
--      a. shuttle_options field='company' (có màu, ưu tiên giữ màu)
--      b. các giá trị company tự do trong shuttle_records chưa từng được
--         thêm vào shuttle_options (không có màu)
INSERT INTO "order_records" ("id", "name", "color_key", "text_color_key", "created_at")
SELECT gen_random_uuid(), src.name, src.color_key, src.text_color_key, now()
FROM (
  SELECT DISTINCT ON (name) name, color_key, text_color_key
  FROM (
    SELECT "value" AS name, "color_key", "text_color_key"
    FROM "shuttle_options"
    WHERE "field" = 'company'
    UNION ALL
    SELECT DISTINCT "company" AS name, CAST(NULL AS VARCHAR(20)), CAST(NULL AS VARCHAR(20))
    FROM "shuttle_records"
    WHERE "company" IS NOT NULL AND "company" <> ''
  ) combined
  ORDER BY name, (color_key IS NULL)
) src
WHERE NOT EXISTS (SELECT 1 FROM "order_records" o WHERE o."name" = src.name);

-- 3) Gán lại company_id cho từng dòng đưa đón theo tên công ty đã nhập trước đó.
UPDATE "shuttle_records" sr
SET "company_id" = o."id"
FROM "order_records" o
WHERE sr."company" = o."name" AND sr."company" IS NOT NULL;

-- 4) Bỏ cột chuỗi tự do cũ, chỉ còn company_id.
ALTER TABLE "shuttle_records" DROP COLUMN "company";

-- 5) Khóa ngoại thật — ON DELETE SET NULL: xóa 1 đơn hàng ở Quản lý đơn
--    hàng không xóa mất dòng đưa đón đã nhập, chỉ gỡ liên kết (khớp nguyên
--    tắc "Chỉnh sửa"/"Xóa" của ShuttleOption cũ: không đụng dữ liệu đã nhập).
ALTER TABLE "shuttle_records"
  ADD CONSTRAINT "shuttle_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "order_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "shuttle_records_company_id_idx" ON "shuttle_records"("company_id");

-- 6) "Công ty" không còn là 1 trường quản lý trong shuttle_options nữa —
--    quản lý duy nhất qua trang Quản lý đơn hàng.
DELETE FROM "shuttle_options" WHERE "field" = 'company';

-- 7) sales_entry_records.company_id đã tồn tại từ trước nhưng CHƯA có FK
--    (để trống chờ đúng bảng này ra đời — xem doc-comment schema.prisma).
--    Dọn phòng hờ mọi giá trị mồ côi trước khi khóa FK (không có UI nào
--    từng ghi được company_id thật trước đây nên dự kiến không có dòng nào
--    bị ảnh hưởng, nhưng vẫn xử lý an toàn để migration không bao giờ vỡ).
UPDATE "sales_entry_records"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "order_records");

ALTER TABLE "sales_entry_records"
  ADD CONSTRAINT "sales_entry_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "order_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
