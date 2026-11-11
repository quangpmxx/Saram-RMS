-- Data lao động: dòng "Công ty" ở trang Chi tiết — chọn từ danh sách Đơn hàng (2026-11-11).
ALTER TABLE "leads" ADD COLUMN "company_id" UUID;

CREATE INDEX "leads_company_id_idx" ON "leads"("company_id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "order_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
