-- CreateEnum (Check in GPS — Phase 2: HỢP_LỆ / NGOÀI_CÔNG_TY / CẦN_XÁC_MINH)
CREATE TYPE "checkin_status" AS ENUM ('valid', 'outside_company', 'needs_verification');

-- CreateTable (cấu hình vị trí công ty — singleton, chỉ Admin xem/sửa)
CREATE TABLE "company_location_configs" (
    "id" UUID NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "allowed_radius_meters" INTEGER NOT NULL DEFAULT 100,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_location_configs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "company_location_configs" ADD CONSTRAINT "company_location_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable checkin_records: thêm GPS + khoảng cách + trạng thái (Phase 2).
-- Backfill giá trị mặc định cho (các) bản ghi Phase 1 đã tồn tại (chỉ là dữ
-- liệu smoke-test, không phải nghiệp vụ thật), sau đó DROP DEFAULT để mọi
-- bản ghi TẠO MỚI từ đây bắt buộc phải có giá trị thật do service tính.
ALTER TABLE "checkin_records" ADD COLUMN "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "checkin_records" ADD COLUMN "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "checkin_records" ADD COLUMN "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "checkin_records" ADD COLUMN "resolved_address" VARCHAR(500);
ALTER TABLE "checkin_records" ADD COLUMN "company_latitude" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "checkin_records" ADD COLUMN "company_longitude" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "checkin_records" ADD COLUMN "allowed_radius_meters" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "checkin_records" ADD COLUMN "distance_from_company_meters" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "checkin_records" ADD COLUMN "status" "checkin_status" NOT NULL DEFAULT 'needs_verification';

ALTER TABLE "checkin_records" ALTER COLUMN "latitude" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "longitude" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "accuracy" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "company_latitude" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "company_longitude" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "allowed_radius_meters" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "distance_from_company_meters" DROP DEFAULT;
ALTER TABLE "checkin_records" ALTER COLUMN "status" DROP DEFAULT;
