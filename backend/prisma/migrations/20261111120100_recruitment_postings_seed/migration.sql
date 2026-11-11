-- Lịch tuyển dụng (2026-11-11): nhập sẵn dữ liệu từ sheet "Lịch tuyển dụng" của công ty (94 thẻ).
-- Dòng ẩn trong sheet = đang dừng tuyển → trạng thái "paused". Số điện thoại cá nhân trong sheet đã được bỏ.
-- Người sửa gần nhất gán cho tài khoản Admin đầu tiên; DB chưa có Admin thì không chèn gì.

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '8d075d3e-1720-4970-8dca-3c3a0b47bd05', 'GOERTEK', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('GOERTEK') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 50, 'NAM - NỮ
18-48T', 5700000, 1250000, NULL, '14.000.000/ 4 tháng', 'T1: 2.000.000 (CTY)
T2: 2.000.000 (CTY)
T3: 3.000.000 (CTY)
T4: 3.000.000 (CTY)
NCU THƯỞNG 50K/NGÀY', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8- 10h -
Chiều 14h-16h', 'Làm Ngồi
Lắp ráp linh kiện điện tử (tai nghe, đồng hồ, loa,..)
Phòng Thường, có cửa từ', 'CCCD gốc/vneid b2 là đưọc
nghỉ 45 ngày mới quay lại lấy thưỏng đưọc, nghỉ ngang tối đa 3 lần', 'Tự Thôn( 2km)
Nam Sơn, Đa cấu( 4-6km)
Phố Và( 3 - 4km)', 'Công ty Lớn, chế độ tốt, đầy đủ
Tăng ca + thưởng nhiều=> Lương cao
Phỏng Vấn, Hồ sơ dễ', 'Đường đi làm khó khăn( đường đất, chưa hoàn thiện)
Áp lực sản lượng và Tổ trưởng( chửi mắng nhiều)
Nhiều quy định( quàn áo, dày dép, giờ giấc), đi ăn khó khăn( do quá đông)', 'Nhận 1976 - 2k9 tuổi
2k8-1978
xăm vào được, tay chân lamhf lặn, biết chữ, có đthoai thông minh
có phòng trọ 1 triệu /2,3 ngưòi, bao điẹn nưóc, có xe đưa đón
kí túc xá 3 Tháng free, có xe đưa đón
vietin, vietcom, bidv', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '32e66d97-4768-4c68-887a-a86a415525bd', 'SEGYUNG VINA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SEGYUNG VINA') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'CẶP NAM NỮ
18-40T', NULL, NULL, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Sản xuất màn hình điện thoại
phòng sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '4202f0be-7d15-4093-8361-c1541b0b2ca5', 'YUTO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUTO') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
18-45T', 5300000, 1250000, NULL, NULL, NULL, ARRAY['sitting', 'no_gate']::TEXT[], 'Sáng 8h', 'Làm Ngồi, Đứng
Gấp vỏ hộp, bìa carton
Phòng thường', '2 CCCD photo công chứng
Sơ Yếu Lí Lịch
Giấy khai sinh + Xác nhận cư trú', 'Mao(dộc, Yên, Trung)( 1km)
Đa cấu( 1-2km)
Làng Giang( 1 - 1,5km)', 'Việc dễ làm, phỏng vấn dễ
không cửa từ
Có thể linh động tuổi tác', 'Xưởng Carton nóng, không có điều hòa', 'Có thể bổ sung hồ sơ sau 7 ngày
không cửa từ', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9edb4484-45ba-47f7-a5a5-ec3e13f81a1a', 'DRAGONZET ( Chu Mẫu )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DRAGONZET ( Chu Mẫu )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 50, 'NAM-NỮ
18-49T
1976', 5400000, 700000, 'PC: 700.000 - 1.000.000đ', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'sáng trc 10h', 'Làm ngồi
Sản xuất linh kiện điện thoại, đồ chơi trẻ em
Phòng thường, không cửa từ, được mang điện thoại', 'CCCD gốc
1 CCCD photo
VNEID bậc 2', NULL, NULL, NULL, 'Không có điều hòa nên sẽ hơi nóng
tăng ca rất nhiều
mang theo dao dọc giấy', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '2d9c9a24-7ff7-425f-beea-6f86649a21b2', 'JAEYOUNG ( Làng Giang, Đa Cấu )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JAEYOUNG ( Làng Giang, Đa Cấu )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', false, true, 18, 42, 'NỮ
18-42T', 5500000, 1800000, 'LCB 5.500.000đ + 1.800.000đ', NULL, NULL, ARRAY['sitting', 'no_gate']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Sản xuất Camera điện thoại
phòng sạch', 'CCCD gốc
CCCD Photo Công chứng
Sơ Yếu Lí Lịch( không cần dấu)', NULL, 'chưa hồ sơ thì 7h đến', NULL, 'Không cửa từ
Việc bền, không cắt nghỉ
Chế độ tốt', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b58617c8-01a6-4fb8-a8c9-375601e9b8a0', 'CANON', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('CANON') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
18-45T', 6000000, 2300000, NULL, '16.200.000/ 6 tháng', 'T1: 4.000.000 (CTY)
T2: 4.000.000 (CTY)
T3: 4.000.000 (CTY)
T4: 1.000.000 (CTY)
T5: 1.000.000 (CTY)
T6: 2.200.000 (CTY)', ARRAY['sitting', 'dorm', 'bus', 'bonus']::TEXT[], NULL, 'Làm Đứng/NGỒI (70% đứng)
Kiểm tra lắp ráp linh kiện máy in, máy photocopy
Phòng Thường, có cửa từ', 'CCCD gốc', 'CÓ KÍ TÚC XÁ ở lãm làng, xe đưa đón
Gửi xe ở cty phải có bằng lái
1 tháng quay lại đc', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '8bec2efb-1da8-46e0-8472-298b41a30bd6', 'ASKEY ( Lãm Làng )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ASKEY ( Lãm Làng )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM - NỮ
18-40T', 5500000, 860000, NULL, '9TR300', 'Thưởng 4.500.000 đ/3 tháng (Mỗi quý 1tr, quý 4 thưỏng 1tr8)
T1: 1.500.000 ( CTY)
T2: 1.500.000 ( CTY)
T3: 1.500.000 ( CTY)', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 8h00', 'Làm Đứng, Ngồi
Sản xuất thiết bị thu phát sóng, router wifi
Phòng Thường, có cửa từ', '1 Sơ Yếu Lí Lịch + 1 ảnh 3*4
2 bản CCCD photo công chứng
CÓ HỒ SƠ ĐÀO TẠO LUÔN', 'Lãm Làng( 0,8 - 1km)
Sơn Đông( 1 - 1,2km)
Lãm Trại/Vân Trại( 1,2 - 2km)', 'Phỏng vấn dễ, Việc dễ làm, nhàn
Nhận lương sớm( chốt 25, thanh toán 5)
Dễ nhận thưởng', 'Làm đứng
Tháng 12 và tháng 4 ít việc', 'Làm Đứng, nhàn
Xăm mặc áo dài tay
đi pvan, cần cccd', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'abd0c94c-1c44-40d5-ba9a-79ab50c084fe', 'AAC ( Chu Mẫu )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AAC ( Chu Mẫu )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1200000, NULL, '14 triệu/4 tháng', 'T1: 4 triệu
T2: 4 triệu
T3: 3 triệu
T4: 3 triệu
(nhà máy 10, nhà thầu 4tr/4 tháng)', ARRAY['sitting', 'dorm', 'tattoo_ok', 'bonus']::TEXT[], 'Chiều 13h30', 'Làm ngồi
Lắp ráp linh kiện điện tử, tai nghe, loa
phòng thường', 'CCCD Gốc', 'Lãm Làng( 0,8 - 1km)
Chu Mẫu ( 0,8 - 1km)', NULL, NULL, 'từ ktx chu mẫu đi bộ ra được
Tăng ca cực nhiều, tăng ca chùa, cơm dở
CV sẽ hơi áp lực
Nhận xăm, bổ sung hồ sơ sau 1 tuần', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd607389e-7fc6-4997-875b-76a5bfa3cc0f', 'WOOJEON', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('WOOJEON') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM-NỮ
18-40T', 5200000, 700000, 'PC: 700.000 - 1.000.000đ', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h', 'Làm ngồi/đứng, làm đúc
Sản xuất vỏ điện thoại, tai nghe, lắp ráp
Phòng thường, kh cuẳ từ', 'CCCD gốc
1 CCCD photo
VNEID bậc 2', NULL, NULL, NULL, 'Không có điều hòa nên sẽ hơi nóng
tăng ca rất nhiều', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'c9c10f0a-3abb-4593-84f0-85b23817d8fd', 'BUJEON ( Mao Dộc )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BUJEON ( Mao Dộc )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, NULL, NULL, 'NAM NỮ LẺ
(nữ 45-nam 45 tuổi không xăm, nhuộm)', 5660000, 1600000, NULL, NULL, 'T1: 500.000 ( CTY)
T2: 500.000 ( CTY)
T3: 500.000 ( CTY)', ARRAY['sitting', 'no_gate', 'dorm', 'tattoo_ok', 'phone_ok', 'bonus']::TEXT[], 'Sáng 7h30', 'Làm ngồi, có KTX trong cty cho nữ
Lắp ráp linh kiện điện tử
Phòng thường, cửa từ xưởng có xưởng không, phòng thường, kh cửa từ, đc mang đthoại bỏ trong túi công ty cung cấp', 'chính thức bên Bujeon sẽ cần hồ suơ trưóc khi vào làm
1 vỏ hồ sơ
2 cccd công chứng
3 cccd photo
1 giấy khai sinh ( nếu có , không có thể bổ sung sau )
1 tờ khai thông tin ( liên hệ quản lý để lấy )
yêu cầu phải có tk ngân hàng vietcombak', 'Làng Giang( 0,5 - 1km)
Mao Dộc( 0,5 - 1km)
Đa Cấu( 1 - 2km)', 'Việc dễ làm
Tăng ca nhiều
không tóc màu', 'Đi ăn hơi xa
Yêu cầu phải có hồ sơ mới cho phỏng vấn', 'Đến trước 8h, biết chữ
Có hồ sơ mới được vào phỏng vấn
Không nhận xăm tay( từ khuỷu tay trở xuống)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'eea83ee5-79ca-412a-a5ce-bd064f3dd2a9', 'HỒNG HẢI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HỒNG HẢI') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 42, 'NAM - NỮ
18-42T', 5500000, 1800000, 'LCB 5.500.000đ + PC: 1.800.000đ + Thẻ ăn 1.176.000đ', '10.000.000đ/ 3 tháng', 'T1: 3.000.000( CTY) + 1.000.000( SR)
T2: 3.000.000( CTY)
T3: 4.000.000( CTY) + 1.000.000( SR)', ARRAY['sitting', 'dorm', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Làm Ngồi, Đứng
Model WF, Dây cáp kết nối sạc, Macbook', 'CCCD gốc', NULL, NULL, NULL, 'Thưởng thêm 2.000.000/2 tháng
Có kí túc xá ( vào ở trừ tiền trợ cấp nhà ở)
PV ở Quế Võ, làm việc ở Bắc Giang', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '50dcc160-33b0-47d4-8644-31e6882e201b', 'TALWAY', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TALWAY') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 42, 'NAM - NỮ
18-42T', 5200000, 1450000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm Ngồi
Lắp Ráp, Kiểm tra dây điện, ổ cắm
phòng thường', 'CCCD
CCCD Photo ( k cần dấu đỏ)
Xác nhận dân sự', 'Đa Cấu ( 1 -1,5km)
Mao ( 1 - 2km)', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '10452423-3e54-4b86-918f-dc37619b2cb0', 'HS TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HS TECH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM - NỮ
18-40T', 5600000, 1650000, 'CC 400, đi lại 100, sau 3 tháng 200-850', '6 triệu/3 tháng', 'T1: 1.500.000( CTY) + 1.000.000 (NCU)
T2: 1.500.000 (CTY) + 1.000.000 (NCU)
T3: 1.000.000( NCU)', ARRAY['sitting', 'dorm', 'bonus']::TEXT[], 'sáng 8h', 'Làm ngồi
Lắp ráp linh kiện điện tử, dán tape, khung ĐT
Phòng thường, có KTX trong cty cho nữ', 'CCCD / VNEID 2 CC
sơ yếu lí lịch CC
có hồ sơ mới vào pv', 'Chu Mẫu 0,5 - 1km
Do Nha 0,5 - 1km', 'Việc dễ
Đầu vào dễ', 'hay mất công, cần check công thường xuyên
Xưởng B chửi gắt nên cần lưu ý', '(chân cầu Do Nha, gần vp mình)
Không mặc quần hở thịt
Có cửa từ
Xưởng A Nhàn và ít áp lực hơn Xưởng B', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '2586dd27-f7a7-4af7-9aeb-1a4432733caa', 'KH VATEC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KH VATEC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 16, 45, 'cặp NAM NỮ
16-45T', 5140000, 750000, 'PC 1350', '3 triệu/3 tháng', 'T1: 1.000.000( CTY)
T2: 1.000.000( CTY)
T3: 1.000.000( CTY)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi
Lắp ráp linh kiện điện tử, dán tape, khung ĐT
Phòng thường', NULL, 'Chu Mẫu 0,5 - 1km
Do Nha 0,5 - 1km', NULL, NULL, '(Do Nha, gần vp mình)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'e752c51c-f9b8-414f-bb63-fae4dfadd949', 'YUZHAN QV1', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUZHAN QV1') LIMIT 1), 'official'::"recruitment_kind", 'limited'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 46, 'NAM NỮ
18-45T
(1980)', 5700000, 2100000, 'Mang giầy, dép quai hậu đi pv', 'Không thưởng', NULL, ARRAY['sitting', 'no_gate', 'tattoo_ok']::TEXT[], 'sáng 7h45
chiều 14h', 'Làm ngồi, đứng, biết ký tên, xăm, nhuộm ok
Bao bì, hộp quà, hộp carton
phòng thưòng, kh cửa từ', 'CCCD / VNEID 2 CC
mang giầy/quai hậu
TAY CHÂN TẬT, KHÔNG BT KÝ không nhận', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '600b1383-987e-4cc9-9e8d-9c4366a70d8f', 'HOÀNG KIM (sau công viên lãm làng)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOÀNG KIM (sau công viên lãm làng)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 38, 'NAM - NỮ TỪ 1988', 5100000, 500000, 'xăng xe 250k
chuyên cần 250k
thâm niên 3 tháng 50k', 'Không thưởng', NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], NULL, 'Làm ngồi, phòng thường, không cửa từ, được mang điện thoại
Chạy máy CNC, kiểm tra khung xương điện thoại', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9e8c3a2d-36a0-4e1c-b734-403f1d202b0e', 'LCE', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LCE') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 49, 'NAM - NỮ
18-49T', 5600000, 2400000, 'LCB tính tăng ca là 6tr4', NULL, 'T1: 2.000.000 ( CTY)
T2: 2.000.000( CTY)
T3: 2.000.000( CTY)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi
Lắp ráp, kiểm tra linh kiện camera oto, dễ làm
Phòng sạch nhưng không có cuẳ từ', 'CCCD', 'Nghiêm Xá
Việt Tân', NULL, NULL, 'Tăng ca đều, lương rất cao
có làmchủ nhật', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '20308444-2944-41ee-bd3d-98c2df51d305', 'ADTEK', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ADTEK') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NỮ-NAM lẻ
18-45T', 6000000, 2300000, 'LCB 6.000.000 + PC 2.300.000đ + Thâm niên 1tr-2tr6,CC TUẦN 200k
Nhà ở : 300.000 - Đi lại : 300.000 - Chuyên cần : 500.000 - Thâm niên : 1.000.000 - 2.600.000đ (60 tháng) - Thưởng hiệu suất : 600.000, Thưởng KPI: 300.000 - 600.000đ', '14 triệu/3 tháng', 'Tháng 1: Thưởng 2.000.000đ
Tháng 2: Thưởng 3.000.000đ
Tháng 3: Thưởng 6.000.000đ
HỖ TRỢ 3.000.000đ đối với lao động ở trọ ngoài (nhận sau 3 tháng)', ARRAY['sitting', 'bonus']::TEXT[], '8h', 'Làm ngồi, có chuyên ngày
Dây sạc điện thoại, nhìn đc con hàng', 'CCCD bản phôt công chứng
HỐ SƠ XIN VIỆC
GKSK bổ sung sau', 'Nghiêm Xá
Việt Tân', NULL, NULL, 'biết đọc, viết
đi tất', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '288a796b-28d4-41e4-b2fb-320d54678656', 'YUZHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUZHAN') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, false, 18, 46, 'NAM
(1980)', 5700000, 1300000, '3tr5 triệu/2 tháng', '3 tr/2 tháng', 'T1: 1.500.000( CTY)
T2: 2.000.000( CTY)
Mang giầy, dép quai hậu đi pv', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], NULL, 'Làm ngồi, đứng
Bao bì, hộp quà, hộp carton
phòng thưòng, kh cửa từ', 'CCCD / VNEID 2 CC
mang giầy/quai hậu', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'ea8db3a8-a845-401a-9694-c6760d039047', 'SUGA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SUGA') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', false, true, 18, 35, 'NỮ
18-35T', 5400000, 1700000, NULL, '4/3T', 'T1: 2.000.000 ( CTY)
T2: 2.000.000( CTY)
T3: 2.000.000( CTY)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm Ngồi
Lắp ráp linh kiện điện thoại, cửa từ
Phòng Thường', '2 CCCD photo( dấu đỏ)
GKSK', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '62618894-cde5-4445-924c-b1762a252359', 'TENMA TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TENMA TECH') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ 18-45', 5510000, 570000, NULL, '12 triệu/12 tháng', 'T1: 2.000.000 ( CTY)
T3+T4: 1.000.000 + 1.000.000
T6+T8+T10+T12: 2.000.000 + 2.000.000 + 2.000.000 + 2.000.000', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], NULL, 'Làm ngồi, phòng thường
Sản xuất, lắp ráp linh kiện máy in, nhựa tổng hợp, khuôn đúc
Không có cửa từ', NULL, NULL, NULL, NULL, '(Mao Dộc)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '08120791-2d72-435c-a648-a0a07f5b12f7', 'FUSHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUSHAN') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 800000, 'LCB 5.700.000đ, PC 800.000đ, thẻ ăn 1.178k', '10.000.000/4 tháng', 'Tháng đầu thưởng 2 triệu
Tháng thứ 2 thưởng 2 triệu
Tháng thứ 3 thưởng 3 triệu
Tháng thứ 4 thưởng 3 triệu
THƯỞNG GẮN BÓ CHO LAO ĐỘNG MỚI: 2,4 TRIỆU
THƯỞNG GIỚI THIỆU 8 TRIỆU', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng : 8h
Chiều: 2h', 'Làm Ngồi
Lắp ráp linh kiện điện tử, dây sạc
Phòng Thường', NULL, 'Phù Chẩn( 2,5 - 4km)
Đại Trung( 3 - 4km)
Đại Thượng( 3 - 4km)', 'Công ty to, nhiều chế độ
Việc tương đối dễ làm', 'Không có trọ gần
giờ nghỉ trưa ít, đi ăn xa', NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '57628386-3350-4696-b07f-b864e11eed7b', 'BIEL CRYSTAL', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BIEL CRYSTAL') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 45, 'NAM - NỮ
18-45T', 5900000, 1200000, NULL, '8.000.000/3 tháng', 'T1: 1.500.000 (CTY) + 1tr (ncu)
T2: 1.500.000 (CTY) + 1tr (ncu)
T3: 2.000.000 (CTY) + 1tr (ncu)', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng : 8h', 'Làm ngồi, Đứng
Lắp ráp linh kiện điện tử, sx màn hình đt
Phòng sạch', 'Sơ Yếu Lí Lịch( không cần dấu)
Đơn xin Việc', 'Đại Trung( 800 - 1,2km)
Đại Thượng( 1,5 - 2km)
Đại Vi( 2 - 2,5km)', 'Chế độ tốt, lương cao
Tuyển dụng quanh năm', 'Việc khó làm( Phòng sạch, làm đứng, soi kính)
hết việc => cắt nghỉ thời vụ', 'Cần đi giày pv
Kh biết chữ vào đc', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '159653a1-5527-4f68-b007-8a70baf3c8f0', 'DIAMOND (KCN ĐẠI ĐỒNG, TIÊN DU)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DIAMOND (KCN ĐẠI ĐỒNG, TIÊN DU)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 45, 'Nam nữ 18-45', 5330000, 800000, '(chuyên cần 450, đời sống 350)', NULL, '5tr/4 tháng
T1: 1,5 triệu
T2: 1,5 triệu
T3: 1 triệu
T4: 1 triệu', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], NULL, 'Làm ngồi, không cửa từ, phòng thường
Quấn dây đồng', 'Mang cccd + bút, yêu cầu thuận tay phải', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5efe7fb2-a762-4de5-bf24-928b2c033789', 'EMTECH (KCN YÊN PHONG)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('EMTECH (KCN YÊN PHONG)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'YÊN PHONG', false, true, 18, 45, 'nữ 18-45 tuổi
pv 7h30 sáng, mang bút ghi 10 tờ khai', 5500000, 2730000, NULL, '13 triệu/3 tháng', 'T1: 2.000.000 (NCU)
T2: 3.000.000 + 1.000.000 (NCU)
T3: 7.000.000 (NCU)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Phòng thường, làm ngồi
Sản xuất tai nghe, loa', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '11539afb-5092-495e-ae5f-39d6514d25f1', 'AMKOR (KCN YÊN PHONG 2)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AMKOR (KCN YÊN PHONG 2)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'YÊN PHONG', false, true, 18, 40, 'chỉ nữ 18-40 tuổi
có bằng cấp 3', 7400000, NULL, NULL, 'Không thưởng', NULL, ARRAY[]::TEXT[], NULL, 'Phòng sạch, soi kính
Sản xuất thiết bị bán dẫn
Đi pv mang cccd + bằng cấp 3', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0ebe9dce-2545-4b13-8a25-becf6eea5cea', 'AMPHENOL (KCN YÊN PHONG MỞ RỘNG)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AMPHENOL (KCN YÊN PHONG MỞ RỘNG)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'YÊN PHONG', true, true, 18, 43, 'nam - nữ 18-43 tuổi', 6500000, NULL, 'LCB: 6.500.000 + PC lên đến 5.000.000
(1 triệu + hiệu suất 1,4 triệu + soi kính 2,76 triệu)', '13.5 triệu/1 năm', '7 công: 500 nghìn (ncu)
T1: 2 triệu (ncu)
T2: 1 triệu (ncu)
T3: 4 triệu + 1 triệu (ncu)
T6: 2 triệu
1 năm: 3 triệu', ARRAY['bonus']::TEXT[], NULL, 'Phòng sạch, soi kính 70%
Sản xuất connector - đầu kết nối điện tử
thu nhập tháng 17-18 triệu', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '1310a655-6467-42fd-8bfa-8dfb144f94b2', 'LUXSHARE - ICT (QC1,2,3)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LUXSHARE - ICT (QC1,2,3)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ', '13.000.000đ/4 tháng', 'Tháng đầu 3.000.000
Tháng thứ 2 thưởng 3.000.000
Tháng thứ 3 thưởng 4.000.000
Tháng 4 thưởng 3.000.000', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h
đi muộn không pv đưọc', 'Làm Ngồi, Đứng, cuẳ từ, phòng thưòng
Dây cáp, dây sạc, máy tính, điện thoại', '1 Sơ Yếu Lí Lịch( không cần dấu), quét mã pv trước
2 Ảnh 3*4, 2 CCCD photo ( không cần dấu)
sau 3 tháng mới quay lại đưọc, phảo có cccd gốc', 'Tam Tầng ( 1 - 1,5km)
Núi Hiểu( 800 - 1,5km)
Trung Đồng/ My Điền ( 2 - 2,5km)', 'Công ty lớn, nhiều chế độ
Nhiều Xưởng, đa dạng lựa chọn
Việc tương đối dễ làm', 'Tương đối áp lực
ít tăng ca', 'Mức Thưởng tính từ ngày phỏng vấn +3 ngày (đào tạo)
2 ngón trỏ và cái phải lành lặn, biết đọc, viêt
Có kí túc xá 2 tháng ở vântrung , có xe đưa đón
xăm không lộ, kh xăm mặt', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9ba30e14-c516-40b0-96ea-510ec2291126', 'NEWWING VT HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('NEWWING VT HH') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.176.000đ
PC tổng 2.970.000
LCB+PC: 8.470.000', '13.000.000đ/ 4 tháng', 'T1: 3tr (cty) + 500k (ncu)
T2: 3tr (cty) + 500k (ncu)
T3: 2tr (cty) + 2tr (ncu)
T4: 2tr', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h ( không CN)', 'làm ngồi, phòng thưòng, có cửa từ
Dây cáp, dây sạc, máy tính, điện thoại', 'CCCD gốc
nhận săm', 'My Điền', 'Nhiều chế độ
Việc dễ làm
Nhận cả xăm', 'Áp Lực', '(đã có ktx và xe đưa đón của nhà máy)
Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'a691bdd9-7ae7-49de-b08f-a83a60399496', 'FUKANG QC HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUKANG QC HH') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5500000, 1800000, 'LCB 5.500.000đ + PC: 1.800.000đ + Thẻ ăn 1.176.000đ', '6.000.000đ/ 3 tháng', 'T1:3tr
T2: 1tr
T3: 2tr', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm Ngồi/Đứng
Linh kiện màn hình, tai nghe
Phòng sạch', 'CCCD gốc', NULL, 'nghỉ', NULL, 'Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0c30ef4f-4df8-46ef-9e18-f060a3cecd76', 'SHUNYUN QC HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SHUNYUN QC HH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, 'NAM 38
NỮ 42', 5800000, 2400000, 'LCB 5.800.000đ + PC: 2.400.000đ + Thẻ ăn 1.222.000đ', '16.000.000đ/ 6 tháng', 'T1:3tr T2: 4tr
T3:4tr T4: 2tr
T6: 3tr', ARRAY['bonus']::TEXT[], NULL, 'Làm Đứng
Linh kiện điện tử
Phòng sạch (chính)/phòng thưòng', 'CCCD gốc', 'Nhà ở: 600.000 Đi lại: 300.000 Chuyên cần:500.000
Thâm niên: 300.000-1.000.000
Trợ cấp vị trí: 250.000-1.900.000 Hiệu suất: 500.000-1.700.000', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'aed5f344-6229-4dbf-a568-9583771e821e', 'HỒNG HẢI QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HỒNG HẢI QC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 42, 'NAM - NỮ
18-42T', 5500000, 1800000, 'LCB 5.500.000đ + PC: 1.800.000đ + Thẻ ăn 1.176.000đ', '12.000.000đ/ 3 tháng', 'T1: 3.000.000( CTY)
T2: 3.000.000( CTY) + 1.000.000( SR)
T3: 4.000.000( CTY) + 1.000.000( SR)', ARRAY['sitting', 'dorm', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Làm Ngồi, Đứng
Model WF, Dây cáp kết nối sạc, Macbook', 'CCCD gốc', 'Trung Đồng/ My Điền ( 2 - 2,5km)', NULL, 'Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu', 'Thưởng thêm 2.000.000/2 tháng
Có kí túc xá ( vào ở trừ tiền trợ cấp nhà ở)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '03b46265-516a-41be-93a6-674dde9d9307', 'HUIMEI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HUIMEI') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 42, 'NAM - NỮ
18-42T', 5550000, 2000000, NULL, '10 triệu', 'làm liền 6 tháng thưởng 10tr', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], 'Sáng 8h', 'Làm Ngồi, Đứng
Lắp ráp Nhựa, mô hình đồ chơi
Phòng thường, kh cửa từ', 'CCCD gốc
3 bản CCCD photo công chứng
Sơ Yếu Lí Lịch( không cần dấu)', NULL, NULL, NULL, '2 ca', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '8a734dcc-e1bf-4ef4-87fa-69e0319846d2', 'LENS', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LENS') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1400000, NULL, '13.000.000đ/3 tháng', 'NHÀ MÁY 10TR 3 THÁNG
NCU 3 TRIỆU/3 THÁNG', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 8h', 'Làm Ngồi
Kiểm tra màn hình, camera điện thoại
Phòng sạch', '3 CCCD photo
Giấy khai sinh photo( k cần dấu đỏ)
1 ảnh 3*4', 'Tam Tầng ( 1 - 1,5km)
Núi Hiểu( 800 - 1,5km)
Trung Đồng/ My Điền ( 2 - 2,5km)', NULL, NULL, 'Có bộ phận soi kính
2007 - 2003 nhận thưởng 1 lần sau 3 tháng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '93b0670a-898e-47a1-8a80-a0ae94d37347', 'LUXSHARE ICT( VT)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LUXSHARE ICT( VT)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ', '11.500.000đ/4 tháng', 'Tháng đầu 3.000.000 + 500k nt
Tháng thứ 2 thưởng 3.000.000 + 500k nt
Tháng thứ 3 thưởng 2.000.000 + 500k nt
Tháng 4 thưởng 2.000.000', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h - Chiều 13h', 'Làm Ngồi, Đứng, cuẳ từ, phòng thưòng
Dây cáp, dây sạc, máy tính, điện thoại, dồng hồ', '1 Sơ Yếu Lí Lịch( không cần dấu), quét mã pv trước
2 Ảnh 3*4, 2 CCCD photo ( không cần dấu)
sau 3 tháng mới quay lại đưọc', 'Có kí túc ở Vân Trung
My Điền', 'Công ty lớn, nhiều chế độ
Nhiều Xưởng, đa dạng lựa chọn
Việc tương đối dễ làm', NULL, '2 ngón trỏ và cái phải lành lặn, biết đọc, viêt
Có kí túc xá 2 tháng ở vântrung , có xe đưa đón
xăm không lộ, kh xăm mặt', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'a2eab9e2-3011-455f-8702-62d39315d59b', 'ELENTEC (KCN QUANG MINH)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ELENTEC (KCN QUANG MINH)') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'HÀ NỘI', true, true, 18, 45, 'NAM - NỮ 18-45', 5682000, 1168000, NULL, '6,5 triệu/6 tháng', 'T1: 1 triệu + 500k ncu
T2: 1 triệu + 500k ncu
T3: 1 triệu + 500k ncu
T4: 500K
T5: 500K
T6: 1 triệu', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi, phòng thường
Sx linh kiện điện tử', '1. Sơ yếu lí lịch (1 ảnh 3*4 và điền thông tin đầy đủ)
2. Photo ảnh chụp thành phần gia đình trên ứng dụng vnid (1 bản)
3. Giấy khai sinh (1 bản)', NULL, NULL, NULL, 'ngày nào cũng phỏng vấn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'fc52a7f8-3e36-48a3-a93b-ada1555c5f3d', 'ORG VT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ORG VT') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, true, false, 25, 35, 'NAM
25-35T
>1m6', 6612500, NULL, 'LCB 6.612.500đ + PC_TC: 3.262.500đ
Tổng Lưong chưa tăng ca: 9.875.000đ', NULL, 'Thưỏng tuần: 20k/ngày, thanh toán theo tuần (t4-t5 tuần tới)', ARRAY['no_gate', 'bonus']::TEXT[], '15h', 'Làm Đứng, Chuyên ngày
Đứng máy in giấy, sx thảm, giấy
Không cửa tử, phòng thường, không điều hòa', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5b56a3be-5025-4a30-ba3b-004fd4f9218a', 'FUYU/FULIAN (FUHONG) QC HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUYU/FULIAN (FUHONG) QC HH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1900000, 'LCB 5.700.000đ + PC: 1.900.000đ + Thẻ ăn 1.170.000đ', '10.000.000đ/ 3 tháng', 'T1: 3.000.000( CTY)
T2: 3.000.000 (CTY)
T3: 4.000.000 (CTY)', ARRAY['sitting', 'dorm', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Dây cáp, dây sạc, máy tính, điện thoại
Làm Ngồi, Đứng, cuẳ từ, phòng thưòng', 'CCCD gốc, vneid bac 2 cungx đc
1 tháng quay lại, kh ktra sức khỏe
xăm 1 chút ok xăm kín, biết tính toán (bảng cửu chưong)', 'Xưỏng M,T,F, khu B Fulian
Đi bộ từ KTX thì sang Fulian
Không khám sức khỏe', 'phòng thường/ làm ngồi, fuyu có ktx cách 2 -3cây
linh kiện , dễ làm nhất hòng hải
46 47 thì chụp ảnh mặt nhìn trẻ trẻ là được', 'cao 1m45 mới đỗ pv đưọc', '(KTX nhà máy ở Đình Trám không có xe đưa đón)
Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu
kh áp lực như newwing, phòng thg. kh xăm
1 tháng ngày, 1 tháng đêm luân phiên', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd99e84ff-366b-44b8-96d2-27c1bcfd208a', 'COOLER MASTER', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('COOLER MASTER') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, true, true, 18, 52, 'NAM - NỮ
18-52T', 5500000, 2230000, NULL, '14.000.000', 'T1: 2.000.000 ( CTY) + 2.000.000 (SR)
T2: 2.000.000( CTY) + 2.000.000 (SR)
T3: 2.000.000( CTY) + 2.000.000 (SR)', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Làm ngồi
Lắp ráp, sản xuất quạt tản nhiệt máy tính, đt
Phòng thường', 'CCCD/VNEID 2', NULL, NULL, NULL, '2 ca ( Có chuyên ngày)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'df062c9c-f994-4cb4-9ea1-c7cb9a019bef', 'LENS QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LENS QC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, false, true, 18, 45, 'NAM - NỮ
18-45T', 5500000, 1400000, NULL, '15.000.000đ/ 3 tháng', '7 công 500k(Nóng) 14công 500k(Nóng) T1: 5.000.000 ( SR 1tr )
T2: 4.000.000 ( SR 1tr )
T3: 5.000.000 ( SR 2tr )', ARRAY['bonus']::TEXT[], 'Sáng 8h- chiều 2h', 'làm đứng
Kiểm tra màn hình, camera điện thoại
Phòng sạch', 'CCCD gốc/vneid b2 là đưọc', 'nhận lưong 15
Đứng phòng sạch', '100% phóng sạch ngồi, nam phòng thg có kn chạy máy cnc
xưởng mới nên tuyển phòng thường nhiều hơn
kkhôngbt chữ vào đc, phải đki pvan trưóc', 'đang tuyển vào LEn2 ko tuyển Len 1
nhận cả xăm, mất ngon tay, không biết chữ vẫn vào được hết', 'chỉ tuyển nữ
Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu
Phải đăng ký pv', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'bbb2878d-7f2f-4b77-abef-435828983b3c', 'LUXSHARE KCN VISIP HƯNG NGUYÊN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LUXSHARE KCN VISIP HƯNG NGUYÊN') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NGHỆ AN', true, true, 18, 45, '18-45T', 5400000, 1700000, 'LCB: 5.400K + PC: 1.700K + Thẻ ăn: 1.170k', '20,5 TRIỆU/ 6 tháng', 'Sau 7 công: 500k
T1: 4.000.000 (CTY) + 1.000.000 (SR)
T2: 4.000.000 (CTY) + 1.000.000 (SR)
T3: 2.000.000 (CTY) + 1.000.000 (SR)
T4: 2.000.000 (CTY) + 1.000.000 (SR)
T5: 1.000.000 (SR)
T6: 3.000.000 (SR)
1 tháng không nghỉ quá 3 phép', ARRAY['sitting', 'dorm', 'bus', 'bonus']::TEXT[], NULL, 'Làm ngồi, phòng thường
Kiểm tra dây sạc điện thoại máy tính, đồng hồ
CÓ KTX, xe đưa đón
PV ở vân trung BG, sau đó có xe đưa đón về NGHỆ AN
sáng pv trưóc 10h, lên xe xuống NA trong ngày
pv sau 10h, sáng sau mới lên xe đi NA
3 tháng đầu ký hợp đòng LUX NA
SAU 3 tháng sẽ bắt buộc về VÂn Trung và ký hợp đồng ở Vân Trung', NULL, 'tháng thứ 4 phải quay về lux vân trung BG làm sẽ đưọc nhận tiếp thưỏng tháng 4 của nhà máy và SR
3 tháng đầu ký hợp đòng LUX NA, SAU 3 tháng sẽ bắt buộc về VÂn Trung và ký hợp đồng ở Vân Trung', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9f459bb4-924d-4870-8f68-320b3bcaeb5d', 'WNC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('WNC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'HÀ NAM', true, true, NULL, NULL, NULL, 5600000, 2400000, NULL, NULL, 'Sau 7 công: 500k
T1: 4.000.000 (CTY) + 1.000.000 (SR)
T2: 3.000.000 (CTY) + 1.000.000 (SR)
T3: 2.000.000 (CTY) + 1.000.000 (SR)', ARRAY['dorm', 'bus', 'bonus']::TEXT[], NULL, 'Phòng thưòng, sạch
KTX 500k, xe đưa đón 100k', 'SƠ YẾU LÍ LỊCH, CCCD công chứng', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'ee0224ea-6f13-4eac-8631-af3d32871cdf', 'TALWAY', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TALWAY') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 15, 45, '15-45 tuổi
nam nữ vào hết
chỉ cần có ảnh cccd', NULL, NULL, 'N: 350K - Đ: 400K
CN: 550K - ĐCN: 638K', NULL, NULL, ARRAY['sitting', 'no_gate']::TEXT[], 'SÁNG 7H30', 'làm ngồi, phòng thường
kiểm tra, lắp ráp làm dây điện, gấp vỏ hộp điện thoại
không cửa từ', NULL, NULL, NULL, NULL, '(sau goertek Nam Sơn)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b3e69c33-0962-454d-8ba3-15391fc868bf', 'KH VATEC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KH VATEC') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 42, 'Cặp Nam Nữ, Nữ lẻ
16 - 42 Tuổi
CCCD GỐC', 5000000, 1000000, 'N:350 - Đ 400
CN: 500- ĐCN: 550', NULL, NULL, ARRAY['sitting', 'dorm', 'phone_ok']::TEXT[], 'Sáng 7h30
tối 14h
NGHĨA', 'Làm ngồi
Lắp ráp linh kiện điện tư
phòng thường, có cửa từ, có cúc sắt, khóa sắt đi được', 'CCCD
mang giấy/qai hậu mới đc vào pv', NULL, NULL, NULL, 'gần KTX chu mẫu (1km)
Phỏng vấn => Chia ca
nóng kh điều hòa, nhiều xưởng, khó xin vào làm cùng
đi giầy, dép sục, kh đc cầm đth vào trong', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '199fabe8-19c5-4fc0-98b7-3f7521e39bec', 'VDS chân cầu do nha', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('VDS chân cầu do nha') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 42, 'Nam Nữ lẻ
16 - 42 Tuổi
có xử lý cccd', 4800000, 1000000, 'N:350 - Đ400
CN: 550- ĐCN: 650', NULL, NULL, ARRAY['dorm', 'tattoo_ok']::TEXT[], 'Sáng 7h30', 'Làm đứng
Lắp ráp linh kiện điện tư
Bán phòng sạch, nhận xăm, nhuộm thiếu cccd', NULL, NULL, NULL, NULL, 'gần KTX chu mẫu (1km2)
vào dễ', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '83968ccc-7bd9-4bbd-bca1-4ebbc41fd73f', 'YUTO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUTO') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 50, 'Nam Nữ lẻ
16 - 50 Tuổi
(Yêu cầu đủ tuôi)', 4200000, 1000000, '400k chuyên cần, 400k nhà ở
200k thâm niên (sau 3 tháng)
N:350 - Đ380
CN: 430- ĐCN: 470', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'Sáng 7h30
tối 19h30', 'Làm ngồi
Gấp vỏ hộp, hộp quà, bao bì
phòng thường, không cửa từ', 'CCCD
mang giấy/qai hậu mới đc vào pv', NULL, NULL, NULL, '(mao dộc)
Phỏng vấn => Chia ca
nóng kh điều hòa, nhiều xưởng, khó xin vào làm cùng
đi giầy, dép sục, kh đc cầm đth vào trong', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'fbb8075c-6ceb-47e6-a8ce-037f53a9cc53', 'WOOJEON (giang liễu)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('WOOJEON (giang liễu)') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 40, 'NAM NỮ Cặp, Nữ lẻ
(Xử lý cccd)
16-40T
HIỆN CHỈ NHẬN NỮ- CẶP NAM NỮ', 4800000, 1100000, '300k chuyên cần, 300k nhà ở
200k thâm niên (sau 3 tháng), 300K bộ phận Đúc
phòng đúc N: 370 - Đ 420
CN: 500 - ĐCN: 550
lắp rap N 350 - Đ 420
N 480 - Đ530"', NULL, NULL, ARRAY['sitting', 'no_gate', 'tattoo_ok']::TEXT[], 'Sáng 8h00', 'Làm ngồi/đứng, làm đúc
Sản xuất vỏ điện thoại, tai nghe, lắp ráp, điện thoại
Phòng thường, kh cửa từ , phòng đúc sẽ không điêu hòa hơi nóng nhưng tăng ca nhiều', 'CCCD
1 CCCD Photo
Tất Chân', NULL, NULL, NULL, 'nhìn trẻ trẻ mới nhận
xăm vô tư, lưong tháng rất cao 10-13 triệu
tăng ca đều, phòng đúc làm chủ nhật luôn
Làm luôn
https://maps.app.goo.gl/t6gHP5eqDYBLPs797', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'e1cfce71-0dce-4ff0-9116-1a7fb8963449', 'HS TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HS TECH') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 40, 'Nam Nữ lẻ
18 - 40 Tuổi
( Xử Lý CCCD)', 4600000, 1000000, '400k chuyên cần, 400k nhà ở
200k thâm niên (sau 3 tháng)
N:350- Đ:400
CN: 500- ĐCN: 550', NULL, NULL, ARRAY['sitting']::TEXT[], '1 CCCD Photo
CCCD Gốc', 'Làm ngồi
Lắp ráp linh kiện tai nghe, dán tape,...
phòng thường', NULL, NULL, NULL, NULL, '(do nha)
Chiều 17h00', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'ffa62718-1e01-4c39-8604-bcee662d3f87', 'BUJEON', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BUJEON') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 45, '1NỮ: 1NAM, Nữ lẻ
18 - 45 Tuổi
( CCCD/VNEID 2)', 4500000, 850000, '500k chuyên cần, 150k nhà ở
200k thâm niên (sau 3 tháng)
N:370 - Đ: 420
CN: 550- ĐCN: 660', NULL, NULL, ARRAY['sitting']::TEXT[], 'CCCD
Tất chân + Ổ Khóa', 'Làm ngồi (nam không xăm, không nhuộm)
Lắp ráp linh kiện điện thoại
phòng thường, đthoai để trong túi zip', NULL, NULL, NULL, NULL, 'Sáng 7h30
Làm luôn
Không nhận xăm', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f3f4e473-ef07-4812-9a22-a67f0b7d0944', 'ALMUS TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ALMUS TECH') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 40, 'CẶP NAM NỮ
18 - 40 Tuổi', 4600000, 1000000, '400k chuyên cần, 400k nhà ở
200k thâm niên (sau 3 tháng)
N: 320 - Đ 370
CN: 450 - ĐCN: 500
có ảnh là vào đưọc', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30
Chiều 18h30', 'Làm Ngồi
tai nghe Bluetooth, đồng hồ thông minh
phòng thường, có cửa từ', 'CCCD
1 CCCD Photo
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'cty hàn
Làm luôn
Không Nhận xăm', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b73984a2-2ce3-4385-9ebf-6800f57dbce6', 'LAIRD', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LAIRD') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 45, 'có xử lý cccd
Nam Nữ
16 - 45 Tuổi', 5000000, 1000000, '400k chuyên cần, 400k nhà ở , 200k đi lại
200k thâm niên (sau 3 tháng)
N 320-360 - Đ 410
CN 450 - ĐCN 500
T7 không có lịch vào', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'sáng 7h30
tối trc 20h (19h30) hỏi trc lịch vào', 'Làm ngồi
Sản xuất thiết bị y tế, phụ tùng ô tô
Phòng thường, kh cửa từ', 'Không cccd vào được
cccd
Tiền đồ là 500k, 3 công mới được nhàmáy chốt', NULL, NULL, NULL, '3 tháng: thưỏng 1tr
6 tháng: thưỏng 3tr
12 tháng: thưỏng 10tr
mANG tất, vào đc phát giầy
đc mang điện thoại
1 xưởng, làm cùng nhau đc, dễ xin', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '44652ec0-9f57-4eea-b114-ab7c89bbcd43', 'JAEYOUNG', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JAEYOUNG') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', false, true, 16, 50, 'CHỈ NỮ
16 - 50 Tuổi
( Xử Lý CCCD)', 5500000, 1400000, 'LCB 5Tr5 , PC 1tr400k
300k chuyên cần, 400k nhà ở 250k-500k công đoạn
200k thâm niên (sau 3 tháng)
N 400 - Đ 460
CN 600- ĐCN 700
lưong tuần', NULL, NULL, ARRAY[]::TEXT[], 'Chiều 17h00', 'phòng thường, có cửa từ
Sản xuất camera ,Volume điện thoại
Phòng sạch, soi kính', '1 CCCD Photo
CCCD Gốc
Hỗ trợ mượn CCCD', NULL, NULL, NULL, 'không tóc lòe loẹt, quần rách
quần rách không nhận', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f8a34274-a362-4477-86f9-cac06c00c4a0', 'FINE MS', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FINE MS') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 50, 'Nữ NAM lẻ
18 - 50 Tuổi
cccd gốc', NULL, NULL, 'tháng hè 12-13tr /tháng
bình thưỏng 8-9 triệu
nữ phòng sạch, làm ngồi
N 400 - Đ 450
CN 550- ĐCN 600
Phòng sạch', NULL, NULL, ARRAY['no_gate']::TEXT[], '7h30
15h', 'Phòng thưòng làm đứng/Phòng sạch sản xuất
Dán tape, đóng gói, lau chuì màn hình, ktra linh kiện
Phòng sạch/ thưòng, không cửa từ', 'cần đi tất, giầy pv
ổ khóa
kh xăm, nhuộm', NULL, NULL, NULL, 'N 330 - Đ 380
CN 500- ĐCN 550
phòng thưòng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '13840f7a-4b95-4c10-be42-435c334eb955', 'HOÀNG KIM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOÀNG KIM') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 45, 'Nam Nữ lẻ
16 - 45 Tuổi
( Xử Lý CCCD)', 4200000, 1000000, '400k chuyên cần, 300k nhà ở
300k thâm niên (sau 3 tháng)
N:300 - Đ:350
CN: 440 - ĐCN: 480
lưong 3 ngày', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'Sáng 7h30
Tối 7h30', 'làm ngồi
Kiểm tra khung xưong đth, chạy máy cnc
Phòng thưòng, không cửa từ, đc mang đth theo', 'CCCD', NULL, NULL, NULL, 'Làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '1b133ce6-7ec6-4c0f-bbce-67682e611e11', 'DRAGONZET', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DRAGONZET') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', false, true, 16, 50, 'nữ
16 - 50 Tuổi
( Xử Lý CCCD)', NULL, NULL, 'Ca ngày 390k/1h Ca đêm 460k/11h
CN ngày 610k/11h - Ca đêm 660k/11h
Lương tầng 2 đồ chơi (yc mang dao dọc giấy)
N 410 - Đ 460
CN: 630- ĐCN: 690
Lương tầng 1 điện tử', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30
Tối 6h30', 'Làm ngồi/đứng,
Cắt viả đồ chời trẻ em /LINH KIỆN điện tử
phòng thường,', 'CCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'thanh toán lưong tuần
Làm luôn
Không nhận xăm
không nhận nhuộm tóc', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '98ab977e-961b-4ad8-b28b-43844e84636c', 'AAC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AAC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
18-45T', 4400000, 1000000, 'LCB 4TR4, PC 1tr - 1tr3
400k chuyên cần, 500k nhà ở
100k - 300k thâm niên
N:400 - Đ 450
CN: 500- ĐCN: 550', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm ngồi
Lắp ráp linh kiện điện tử
phòng thường', NULL, NULL, NULL, NULL, 'không nhận nhuộm tóc
không nhận nhuộm tóc
không nhận nhuộm tóc', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '232e5fcb-bfd9-4c27-8dbc-a9b67e1ac5be', 'TENMA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TENMA') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 35, 'nam nữ lẻ
18-35', 4700000, 1400000, '500k chuyên cần, 500k nhà ở
400k thâm niên
N:310 - Đ367
CN: 490- ĐCN: 650', NULL, NULL, ARRAY[]::TEXT[], '7h40 đi làm luôn
2 tuần N- 2 tuần đêm', 'Làm đứng
SX, lắp ráp máy in
phòng thưòng', NULL, NULL, NULL, NULL, 'không nhận nhuộm tóc
không nhận nhuộm tóc
không nhận nhuộm tóc', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '908ebbdc-b70a-4aa9-beec-888e8533d3bd', 'CNS', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('CNS') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QV2', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40
( Xử Lý CCCD)', 5200000, 1200000, 'N: 350 - Đ: 390
CN: 500 - Đ: 550
Đi giầy pv', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Khung xương, vỏ điện thoại
Phòng thường/sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5a679c4a-be2f-4930-b4c9-fb107ca56713', 'JMT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JMT') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QV2', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40', 4500000, 2200000, 'N: 320- Đ: 380', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Khung xương, vỏ điện thoại
Phòng sạch, sản xuất, có 20% soi kính', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '48a54970-56af-4902-87a6-cfb49d7769c4', 'SOHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SOHAN') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, 16, 40, 'Nam Nữ Lẻ
16 - 40
( Xử Lý CCCD)', 4200000, 1500000, '400k chuyên cần, 400k nhà ở
200k thâm niên (sau 3 tháng), 300K bộ phận Đúc
N: 330-Đ 380
CN: 450 - ĐCN: 500', NULL, NULL, ARRAY['sitting', 'bus']::TEXT[], 'Sáng 7h15', 'Làm Ngồi
Lắp ráp linh kiện camera giám sát, cam ô tô
Phòng Thường, có xe đưa đón từ qv1', 'CCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'nhận hết què cụt, quá tuỏi', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b9d7b192-450b-47f2-b973-3f7a002cdce8', 'PJ VINA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('PJ VINA') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 3', true, true, 16, 55, 'Nam Nữ Lẻ
16 - 55
( Xử Lý CCCD)', 4500000, 1000000, '400k chuyên cần, 400k nhà ở ,
200k thâm niên (sau 3 tháng)
N:320- Đ350
CN: 420- ĐCN: 470
T7 không có lịch vào', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'Sáng 7h30', 'Làm Ngồi
lắp ráp dây cáp
phòng thường, kh cửa từ, mang đt theo đc', NULL, NULL, NULL, NULL, 'không có xe đưa đón', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b33a0216-92fb-42ac-a191-e83eccde13d9', 'JIANGTAI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JIANGTAI') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 3', true, true, NULL, NULL, 'Nam Nữ Lẻ', 4500000, 1000000, '400k chuyên cần, 400k nhà ở ,
200k thâm niên (sau 3 tháng)
N:340- Đ380', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm Ngồi
Ngoại quan đồng hồ, màn hình điện thoại
Phòng sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '1600a7c6-decf-41b3-ab25-f4a9ed15920c', 'SUGA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SUGA') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, 18, 45, 'Nam Nữ Lẻ
18 - 45
( Xử Lý CCCD)', NULL, NULL, 'N:330 - Đ: 380
CN: 500 - CNĐ: 600', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm Ngồi
Lắp ráp linh kiện điện thoại, cửa từ
Phòng Thường', '1 CCCD Photo
Tất chân + Ổ Khoá', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b88f612d-8394-4a20-9ed3-f6ae3066782a', 'AD TECK', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AD TECK') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, 16, 40, 'Nam Nữ Lẻ
16 - 40
( Xử Lý CCCD)', 5000000, 1000000, '400k chuyên cần, 400k nhà ở ,
200k thâm niên (sau 3 tháng)
N:420- Đ:500/12h', NULL, NULL, ARRAY['sitting', 'no_gate', 'dorm']::TEXT[], NULL, 'Làm Ngồi, có ktx cty cách 1km7
Lắp ráp, kiểm tra dây cáp kết nối, dây điện thoại,..
Phòng Thường, kh cửa từ, điều hòa', NULL, NULL, NULL, NULL, 'chuyên ngày
KTX nhà thầu 300-500
không có xe đưa đón', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '8d870504-70ec-425f-a189-258b1f622579', 'SUNGWOO VINA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SUNGWOO VINA') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'THUẬN THÀNH', true, true, 18, 45, 'Nam Nữ Lẻ
18 - 45', NULL, NULL, 'N:412- Đ487
CN: 715- ĐCN: 825', NULL, NULL, ARRAY[]::TEXT[], '7h30', 'Biết chữ, biết ký tên
Sản xuất linh kiện, phụ kiện điện tử, ốp điện thoại, dụng cụ quang học
Phòng Thường/Sạch tùy xưỏng (lưong như nhau)', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'c428bbc0-05dd-4db5-8924-261707986a2f', 'DREAM SHORTING', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DREAM SHORTING') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18-40', 4700000, 1000000, '400k chuyên cần, 400k đời sống,
200k soi kính,
200k thâm niên (sau 3 tháng)
N:450
CN: 600
Chuyên ngày', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h30', 'Làm Ngồi, Đứng, chuyên ngày
KIỂM TRA linh kiện điện tử
Phòng sạch, phòng thường', 'CCCD
1 CCCD Photo
Tất Chân + ổ Khóa', NULL, NULL, NULL, '(chuyên ngày)
Làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b8a20c4c-7443-400c-920b-d219e3d55b6a', 'DREAM TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DREAM TECH') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18-40', 4700000, 1000000, '400k chuyên cần, 400k đời sống,
200k soi kính,
200k thâm niên (sau 3 tháng)
N:340 - Đ: 430
CN:594, ĐCN: 682', NULL, NULL, ARRAY['sitting']::TEXT[], '7h30', 'Làm ngồi
Kiểm tra linh kiện điện tử
Phòng thường', 'CCCD
1 CCCD Photo
Tất Chân + ổ Khóa', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9a4573d7-9ca8-4925-953e-e83155c50204', 'BIEL', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BIEL') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 45, 'NAM - NỮ
18-45T', 5600000, 1200000, '300k chuyên cần, 300k nhà ở,
200k phòng sạch,
200k thâm niên (sau 3 tháng)
N:380 - Đ: 480
CN: 600 - ĐCN: 800', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h00', 'Làm ngồi, Đứng
Lắp ráp linh kiện điện tử, sx màn hình đt
Phòng sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'bcd9b5d2-6c81-408a-81a6-78d8a43a43c5', 'FUSHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUSHAN') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18-40', 5500000, 900000, 'LCB 5.500.000 + PC 900k + 870k tiền BH
Lương Tháng công ty trả lương', '10 triệu/4 tháng chia 2-2-3-3', NULL, ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm Ngồi, Đứng
Lắp ráp linh kiện điện tử
Phòng thường', NULL, NULL, NULL, NULL, 'tv lương tháng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '23845369-3731-4658-ac4f-ccc2ed468a27', 'ITM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ITM') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18 - 40', 4800000, 700000, '140k chuyên cần, 200k đời sống, 200k thâm niên (sau 3 tháng) PC Phép năm 160k
N 370, Đ 465
CN 640, Đêm CN 800', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 7h30', 'Làm đứng, đào tạo 1 tuần
Lắp ráp linh kiện điện tử
Bán phòng sạch', 'CCCD
1 CCCD Photo
Tất Chân + ổ Khóa', NULL, NULL, NULL, 'Làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'cdca4e37-2199-4d0f-a375-4058005a6f16', 'DIAMOND', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DIAMOND') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 16, NULL, 'nam - nữ từ 16+', NULL, NULL, 'Ca ngày: 400
Ca đêm: 450
CN 700, ĐCN: 800', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30
chỉ phỏng vấn thứ 2-4-6', 'làm ngồi, phòng thường
làm quấn dây đồng trong dây cáp, dây sạc', 'CCCD', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'ea7a7d95-19af-4ed3-8c5c-32e93c148d14', 'JOSUNG', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JOSUNG') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18-40', 5200000, 1000000, 'N: 330 - Đ: 390
CN: 540- ĐCN: 620
chủ nhật làm 8 tiếng', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h00
đến muộn kh vào đưọc', 'Phòng thường
Lắp ráp linh kiện điện tử
Làm ngồi', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '018f8686-3dfb-4c08-99e5-f84b0bc76b2e', 'INOX', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('INOX') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'TIÊN SƠN', true, true, NULL, NULL, NULL, 4700000, 1200000, '400k chuyên cần, 400k nhà ở, 200K phòng sạch
200k thâm niên (sau 3 tháng)
N:350 - Đ:400
CN :500 - Đ : 600', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 8h30', NULL, NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '78f6e230-3508-44f0-aec0-a9bb18bd5ccc', 'HOJEONG', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOJEONG') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'TAM SƠN', true, true, NULL, NULL, NULL, 4300000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 8h00', NULL, NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '31d7235b-a25d-4205-a2d1-1e5c627a8afe', 'HOSIDEN (quang châu)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOSIDEN (quang châu)') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'Cặp Nam nữ
18 - 45 Tuổi
( Xử Lý CCCD)', 4410000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)
N:315- Đ: 420
CN: 465- ĐCN: 642', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h15', 'Làm ngồi
Sản xuất, kiểm hàng, lắp ráp tay cầm điêu khiển từ xa đồ chơi
Phòng thường, làm ngồi', 'CCCD
1 CCCD Photo
Tất Chân + ổ Khóa', NULL, NULL, NULL, 'Làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'dc5821df-dac1-4dfd-bf1e-2a4ab470f7a4', 'SAMKWANG QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SAMKWANG QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 16, 40, 'NỮ- NAM
16-40T', 4410000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)
N:330- Đ: 380
CN: 466- ĐCN: 570
1 tháng 2 thứ 7 lưong tíh như chủ nhật', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'Sáng 7h30
Tối 19h30', 'Làm đứng + Ngồi
Chạy máy CNC, kiểm hàng, vỏ khung xương ĐT
phòng thường, được mang ĐT vào xưởng, không cửa từ', 'CCCD
Tất chân + Ổ Khóa
đưọc chọn ca', NULL, NULL, NULL, 'VÀO LIÊN TỤC', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '18cfc958-61be-4c6e-ab1d-ba0f762c56c2', 'SIFLEX QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SIFLEX QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 40, 'NAM-NỮ
18-40', 4700000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)
N:323- Đ: 391
CN: 485- ĐCN: 698', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi, Đứng
Lắp ráp linh kiện điện tử
phòng thường', 'Sáng 7h30, Tối 19h30
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '763553f4-1e03-45bf-9600-f2b5b95c33b0', 'YOUNGJIN nội hoàng', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YOUNGJIN nội hoàng') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40
( Xử Lý CCCD)', NULL, NULL, 'N:330- Đ: 390
CN: 520- ĐCN: 600
phòng sạch
N:300- Đ: 365
CN: 500- ĐCN: 545
phòng thưòng', NULL, NULL, ARRAY['sitting']::TEXT[], 'sáng 7h15', 'Phòng sạch, làm ngồi
Kiểm hàng, lazer hàng
Làm Ngồi', 'CCCD PHOTO
Giầy/dép quai hậu + Tất
CCCD PHOTO
Giầy/dép quai hậu + Tất', NULL, NULL, NULL, 'pv xong làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd50d0f88-2b97-4969-94b2-ffb30298d327', 'KEPSION VT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KEPSION VT') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40', NULL, NULL, 'N:300- Đ: 350
CN: 450- ĐCN: 520', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'phòng thưòng
lắp ráp linh kiện, chạy máy, kiểm hàng, dán tape
làm ngồi, biêt ký tên', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '7b20b8fb-d7b9-4852-bb21-ad4cd6aaa911', 'S DRAGON VT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('S DRAGON VT') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 16, 40, 'Nam Nữ Lẻ
16 - 40
Thiếu tuổi đưọc, kh biêt chữ đc', 5200000, 1000000, 'N:328- Đ: 410
CN: 550- ĐCN: 632
làm 9 trả 7', NULL, NULL, ARRAY['sitting']::TEXT[], '7h30', 'phòng thưòng, công ty nhựa
lắp ráp bảng mạch,
gọt via kiểm hàng, lắp ráp
làm ngồi, biêt ký tên', NULL, NULL, NULL, NULL, 'bổ sung', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f292a1c8-83e4-4b83-9d08-7e175f67dce2', 'UTECH vân trug', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('UTECH vân trug') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N:300- Đ: 360
CN: 500- ĐCN: 550', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 7h30', NULL, 'ccccd', NULL, NULL, NULL, 'pv xong làm luôn
đủ 7 ngày mới trả công', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '202d96b8-ad03-44ae-8abb-88e0d0b93111', 'UMEC QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('UMEC QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N:320
CN: 480', NULL, NULL, ARRAY['no_gate']::TEXT[], NULL, 'chuyên ngày, phòng thưòng, không cửa từ
quấn dây dồng', NULL, NULL, NULL, NULL, 'chuyên ngày', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '94253271-8205-4d1f-8baa-abdf4d011925', 'FOUSINE QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FOUSINE QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N:300
CN: 520', NULL, NULL, ARRAY['no_gate']::TEXT[], NULL, 'Chuyên ngày
lắp ráp linh kiện
Phòng thưòng, không cửa từ', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd565a8e3-c315-401a-8ffc-62b7841c8154', 'CHENGLOONG QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('CHENGLOONG QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'cc tháng 500k
N:330- Đ: 410
CN: 470- ĐCN: 540
TT thứ 4-thứ 7', NULL, NULL, ARRAY['no_gate']::TEXT[], NULL, 'Lưong tuần
bao bì, carton
Phòng thưòng, không cửa từ', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'efaa10bf-3806-4554-b1aa-84c6a5793694', 'KYOCERA VT, nội hoàng', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KYOCERA VT, nội hoàng') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', false, true, 18, 47, '18 - 47
NỮ thôi', NULL, NULL, 'N:300
CN: 520', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], NULL, 'làm ngồi
Kiểm hàng, linh kiện điện thoại
Phòng thưòng, không cửa từ, đc cầm đth', 'CCCD PHOTO
Giầy/dép quai hậu + Tất', NULL, NULL, NULL, 'chuyên ngày
Linh kiện điện thoại Samsung khay sim
Nam chạy máy laze khắc laze lên con hàng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'baee711c-098b-42e0-8189-7addd12d486e', 'KTC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KTC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N 280 - Đ 365 (bp sản xuất)
CN: 481 - ĐCN: 551
N 300 - Đ 385 (bp QC)
CN: 481 - ĐCN: 551', NULL, NULL, ARRAY[]::TEXT[], NULL, 'LƯONG 3 ngày
Kiểm hàng, lắp ráp linh kiện', NULL, NULL, NULL, NULL, '(Song khê, Nội Hoàng)
Công ty KTC~ KCN SONG KHÊ NỘI HOÀNG NHẬN CẶP VÀ NỮ LẺ
Lưu Ý: Ca đêm kg nhận nam
CA NGÀY : 280/11h
CA ĐÊM : 365/11h
NGÀY CN: 481k/11h
CN ĐÊM : 551/11h
Lương trên áp dụng cho bộ phận sản xuất
CA NGÀY : 300k/11h
CA ĐÊM : 385k/11h
CN NGÀY : 481k/11h
CN ĐÊM : 551/11h
Mức lương áp dụng riêng bp Qc kiểm hàng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b0844d8b-6adf-4b45-9556-2abdfca490b9', 'ETESY', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ETESY') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, 4410000, 1000000, 'N:280/11h- 312/12h- 343/13h
CN:339/11h- 466/12h- 508/13h', NULL, NULL, ARRAY[]::TEXT[], NULL, 'chuyên ngày, lưong 3 ngày
Sản xuất dây sạc linh kiện
phòng thưòng', NULL, NULL, NULL, NULL, '(Song khê, Nội Hoàng)
CTy ETESY KCN NỘI HOÀNG Full Nam Nữ 15-40
Thanh toán lương 3 ngày
Môi trường làm việc phòng thường
Công Việc: sản xuất giây sạc điện thoại
Lcb: 4.410.000+ Pc 1.000.000
+ hành chính ngày: 180k
+ tc ngày 3h: 280k
+ tc ngày : 4h : 312k
+ tc ngày : 5h : 343k
+ CN ngày : 8h : 339k
+CN ngày : 11 h : 466k
+ CN Ngày : 12h : 508k', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'e4e07144-af1e-42b5-a74c-e3cd5e5fe479', 'ACTRO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ACTRO') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 5600000, 1450000, 'N 370 - Đ 430
CN: 550 - ĐCN: 660', '1.500.000/26 công chuyên cần', NULL, ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 7h30/Chiều 14h', 'Phòng Sạch
Kiểm tra linh kiện camera điện thoại
Làm Ngồi', 'CCCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '110e8be2-b23c-45f4-85eb-de382a01a1da', 'COSONIC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('COSONIC') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 4900000, 800000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Phòng Thường
Lắp ráp, đóng gói linh kiện tai nghe
Làm ngồi', 'CCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'a89a697e-016f-41cb-925a-e0c15c2da000', 'HANBO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HANBO') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 4900000, 800000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Phòng Thường
Lắp ráp, kiểm tra vỏ điện thoại
Làm ngồi/đứng', 'CCCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '602e643a-82eb-45e2-bc80-504d27bef188', 'SEGI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SEGI') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', false, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 5500000, 1000000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Phòng Thường
Lắp ráp, đóng gói linh kiện điện tử
Làm ngồi', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30
chỉ tuyển nữ', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'dcac32d6-d221-451e-aa0e-a608877b0a94', 'IM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('IM') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 6600000, 1050000, 'CC 300k, ĐS 450k, Soi kinh 300k
Thâm niên 3tháng/200k, 6 tháng/400k, 1năm/600k', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Phòng Sạch
Kiểm tra linh kiện camera điện thoại
Làm Ngồi', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '98545850-6238-47a9-8773-51d86a5edb73', 'SOLUM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SOLUM') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 6500000, 800000, 'CC 300k, ĐS 450k, Soi kinh 300k
Thâm niên 3tháng/200k, 6 tháng/400k, 1năm/600k', NULL, NULL, ARRAY['phone_ok']::TEXT[], NULL, 'Phòng thưòng
Kiểm tra linh kiện camera điện thoại
Làm đứng, đc mang điện thoại vào xưỏng', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0b60ccb9-55e2-40c6-b5de-4a26d4ce6f6f', 'COASIA BÌNH XUYÊN 2', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('COASIA BÌNH XUYÊN 2') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'PHÚ THỌ, VĨNH PHÚC CŨ', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 6000000, 1400000, 'CC 600k, ĐS 300k, Soi kinh 300k(nếu có)
Thâm niên 200k', NULL, NULL, ARRAY['sitting']::TEXT[], '8h20', 'Phòng Sạch
Sản xuất, lắp rpa sống kính camera, điện thoại
Làm Ngồi', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;
