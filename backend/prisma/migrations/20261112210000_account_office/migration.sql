-- Chấm công theo văn phòng (2026-11-12): hanoi | bac_ninh | bac_giang.
-- Chỉ THÊM cột có giá trị mặc định 'hanoi' — mọi tài khoản và cấu hình vị trí công ty
-- hiện có tự thuộc VP Hà Nội, không sửa/xoá dữ liệu nào đang có.
ALTER TABLE "accounts" ADD COLUMN "office" VARCHAR(20) NOT NULL DEFAULT 'hanoi';

CREATE INDEX "accounts_office_idx" ON "accounts"("office");

ALTER TABLE "company_location_configs" ADD COLUMN "office" VARCHAR(20) NOT NULL DEFAULT 'hanoi';

CREATE INDEX "company_location_configs_office_idx" ON "company_location_configs"("office");
