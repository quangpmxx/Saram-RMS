-- Thứ tự dòng trong 1 ngày (kéo thả sắp xếp ở Danh sách đưa đón, 2026-11-10). NULL = chưa sắp, hiện trên cùng ngày như cũ.
ALTER TABLE "shuttle_records" ADD COLUMN "sort_order" INTEGER;
