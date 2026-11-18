-- Trang web: đưa lại 6 tin việc làm mẫu (trước đây viết cứng trong website/lib/content.ts)
-- vào bảng website_jobs để sửa/xoá được ở /quan-ly (2026-11-18). Trùng đường dẫn thì bỏ qua.
INSERT INTO "website_jobs" ("id", "slug", "title", "company", "area", "salary", "urgent", "published", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'cong-nhan-goertek-bac-ninh', 'Công nhân tại Goertek (Bắc Ninh)', 'GOERTEK', 'Bắc Ninh', '13 - 16 triệu/tháng', true, true, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cong-nhan-foxconn-bac-giang', 'Công nhân sản xuất tại Foxconn Bắc Giang', 'FOXCONN', 'Bắc Giang', '12 - 15 triệu/tháng', true, true, 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cong-nhan-luxshare-ict', 'Công nhân lắp ráp tại Luxshare ICT', 'LUXSHARE ICT', 'Bắc Ninh, Bắc Giang', '12 - 15 triệu/tháng', true, true, 3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cong-nhan-biel-crystal-bac-ninh', 'Công nhân tại Biel Crystal Bắc Ninh', 'BIEL CRYSTAL', 'Bắc Ninh', '12 - 15 triệu/tháng', false, true, 4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cong-nhan-lens-technology', 'Công nhân kiểm tra kính tại Lens Technology', 'LENS TECHNOLOGY', 'Bắc Ninh', '11 - 14 triệu/tháng', false, true, 5, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cong-nhan-van-hanh-may-goertek', 'Công nhân vận hành máy tại Goertek', 'GOERTEK', 'Bắc Ninh', '13 - 15 triệu/tháng', false, true, 6, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
