-- Lịch tuyển dụng (2026-11-11): nhập sẵn lịch tuyển của Nhóm 1 từ sheet của nhóm (98 thẻ).
-- Dòng ẩn trong sheet = đang dừng tuyển → trạng thái "paused". Số điện thoại cá nhân trong sheet đã được bỏ.
-- Người sửa gần nhất gán cho tài khoản Admin đầu tiên; DB chưa có Admin thì không chèn gì.

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '453d963a-67c4-4b17-9d46-6a207efcff4c', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'GOERTEK', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('GOERTEK') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
1981', 5700000, 1250000, NULL, '12.500.000/5 tháng (giới thiệu 1,5 triệu)', 'NHÀ MÁY
T1: 2.000.000
T2: 2.000.000
T3: 2.000.000
T4: 2.000.000
T5: 2.000.000
NHÀ CUNG ỨNG 30K/NGÀY
Làm đủ 26 công thưởng 780.000
Làm đủ 52 công thưởng 780.000
Làm đủ 78 công thưởng 780.000', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8- 10h -
Chiều 14h-16h', 'Làm Ngồi
Lắp ráp linh kiện điện tử (tai nghe, đồng hồ, loa,..)
Phòng Thường, có cửa từ', 'CCCD gốc/vneid b2 là đưọc
nghỉ 45 ngày mới quay lại lấy thưỏng đưọc, nghỉ ngang tối đa 3 lần', 'Tự Thôn( 2km)
Nam Sơn, Đa cấu( 4-6km)
Phố Và( 3 - 4km)', 'Công ty Lớn, chế độ tốt, đầy đủ
Tăng ca + thưởng nhiều=> Lương cao
Phỏng Vấn, Hồ sơ dễ', 'Áp lực sản lượng và Tổ trưởng( chửi mắng nhiều)
Nhiều quy định( quàn áo, dày dép, giờ giấc), đi ăn khó khăn( do quá đông)', 'Hạp Lĩnh
xăm vào được, tay chân lành lặn, biết chữ, có đthoai thông minh
có phòng trọ 1 triệu /2,3 ngưòi, bao điẹn nưóc, có xe đưa đón
kí túc xá 3 Tháng free, có xe đưa đón
vietin, vietcom, bidv', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5838d707-02e4-4c16-9a6f-1705cd5a5650', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SEGYUNG VINA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SEGYUNG VINA') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'CẶP NAM NỮ
18-40T', NULL, NULL, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Sản xuất màn hình điện thoại
phòng sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '72a7ddf4-724c-41ef-bfe4-53b3aefcad61', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'YUTO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUTO') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '365cb34f-a80a-4037-ab32-102a7de14aab', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'DRAGONJET ( Chu Mẫu gần vp mình )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DRAGONJET ( Chu Mẫu gần vp mình )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 49, 'NAM-NỮ
18-49T', 5600000, 1250000, 'LCB 5.600.000đ (thử việc 5tr400)', '5.5 triệu', 'NHÀ MÁY THƯỞNG 2.500.000/6 tháng
T1: 500K
T2: 500K
T3: 500K
T6: 1 TRIỆU
NCU THƯỞNG 3.000.000/3 tháng
ĐỦ 10 CÔNG THƯỞNG 500K
ĐỦ 25 CÔNG THƯỞNG 500K
T2: 1 TRIỆU
T3: 1 TRIỆU', ARRAY['sitting', 'no_gate', 'phone_ok', 'bonus']::TEXT[], 'sáng trc 10h', 'Làm ngồi
Sản xuất linh kiện điện thoại, gọt via đồ chơi trẻ em
Phòng thường, không cửa từ, được mang điện thoại', 'CCCD gốc
1 CCCD photo
VNEID bậc 2', NULL, NULL, NULL, 'Không có điều hòa nên sẽ hơi nóng
tăng ca rất nhiều
mang theo dao dọc giấy', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '1e17ef6e-2dd3-471d-a5b3-9174960631fd', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'JAEYOUNG ( Làng Giang, Đa Cấu )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JAEYOUNG ( Làng Giang, Đa Cấu )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', false, true, 18, 42, 'NỮ
18-42T', 5500000, 1800000, 'LCB 5.500.000đ + 1.800.000đ', NULL, NULL, ARRAY['sitting', 'no_gate']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Sản xuất Camera điện thoại
phòng sạch', 'CCCD gốc
CCCD Photo Công chứng
Sơ Yếu Lí Lịch( không cần dấu)', NULL, 'chưa hồ sơ thì 7h đến', NULL, 'Không cửa từ
Việc bền, không cắt nghỉ
Chế độ tốt', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '8635a34a-232b-40f7-8156-7567e5b9b9a1', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'CANON', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('CANON') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '41f6d2c9-17d3-40b6-a465-814cf885914f', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ASKEY ( Lãm Làng )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ASKEY ( Lãm Làng )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM - NỮ
18-40T', 5500000, 860000, NULL, '12TR300', 'Thưởng 7.500.000 đ/3 tháng (Mỗi quý 1tr, quý 4 thưỏng 1tr8)
T1: 1.500.000 ( CTY) + 1.000.000 (NCU)
T2: 1.500.000 ( CTY) + 1.000.000 (NCU)
T3: 1.500.000 ( CTY) + 1.000.000 (NCU)', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 8h00', 'Làm Đứng, Ngồi
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f99e3597-8e35-4cc3-8414-4bdb6110ecd0', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'AAC ( Chu Mẫu )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AAC ( Chu Mẫu )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
18-45T', 5900000, 1500000, NULL, '13 triệu/4 tháng', 'T1: 4 triệu
T2: 4 triệu
T3: 3 triệu
T4: 2 triệu
(nhà máy 10, nhà thầu 3tr/3 tháng)', ARRAY['sitting', 'dorm', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h
Chiều 14h
Lưu ý đến đúng h công ty chỉ cho qua cửa 1 lần', 'Làm ngồi
Lắp ráp linh kiện điện tử, tai nghe, loa
Phòng thường', 'CCCD Gốc', 'Lãm Làng( 0,8 - 1km)
Chu Mẫu ( 0,8 - 1km)', NULL, NULL, 'từ ktx chu mẫu đi bộ ra được
Tăng ca cực nhiều, tăng ca chùa, cơm dở
CV sẽ hơi áp lực
Nhận xăm, bổ sung hồ sơ sau 1 tuần', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f513b55a-7669-4b73-abba-a8a4daf98242', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'WOOJEON', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('WOOJEON') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM-NỮ
18-40T', 5200000, 700000, 'PC: 700.000 - 1.000.000đ', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h', 'Làm ngồi/đứng, làm đúc
Sản xuất vỏ điện thoại, tai nghe, lắp ráp
Phòng thường, kh cuẳ từ', 'CCCD gốc
1 CCCD photo
VNEID bậc 2', NULL, NULL, NULL, 'Không có điều hòa nên sẽ hơi nóng
tăng ca rất nhiều', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'da950262-cfde-467e-9176-fc228bb76702', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'BUJEON ( Mao Dộc )', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BUJEON ( Mao Dộc )') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, NULL, NULL, 'NAM NỮ LẺ
(nữ 45-nam 45 tuổi không xăm, nhuộm)', 5660000, 1600000, NULL, NULL, NULL, ARRAY['sitting', 'no_gate', 'dorm', 'tattoo_ok', 'phone_ok']::TEXT[], 'Sáng 7h30', 'Làm ngồi, có KTX trong cty cho nữ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '2e3c2622-2929-4b79-a101-7b3620c0841b', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HỒNG HẢI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HỒNG HẢI') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 42, 'NAM - NỮ
18-42T', 5500000, 1800000, 'LCB 5.500.000đ + PC: 1.800.000đ + Thẻ ăn 1.176.000đ', '10.000.000đ/ 3 tháng', 'T1: 3.000.000( CTY) + 1.000.000( SR)
T2: 3.000.000( CTY)
T3: 4.000.000( CTY) + 1.000.000( SR)', ARRAY['sitting', 'dorm', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Làm Ngồi, Đứng
Model WF, Dây cáp kết nối sạc, Macbook', 'CCCD gốc', NULL, NULL, NULL, 'Thưởng thêm 2.000.000/2 tháng
Có kí túc xá ( vào ở trừ tiền trợ cấp nhà ở)
PV ở Quế Võ, làm việc ở Bắc Giang', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '96657aa0-3d89-4f6f-82e5-4e94ff002107', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'TALWAY', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TALWAY') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 42, 'NAM - NỮ
18-42T', 5200000, 1450000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm Ngồi
Lắp Ráp, Kiểm tra dây điện, ổ cắm
phòng thường', 'CCCD
CCCD Photo ( k cần dấu đỏ)
Xác nhận dân sự', 'Đa Cấu ( 1 -1,5km)
Mao ( 1 - 2km)', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '17f90281-f609-40c3-b4e4-03aecc20caf4', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HS TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HS TECH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9acebd97-25b9-427d-a691-ca5e43ad3fdc', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'KH VATEC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KH VATEC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 16, 45, 'cặp NAM NỮ
16-45T', 5140000, 750000, 'PC 1350', '3 triệu/3 tháng', 'T1: 1.000.000( CTY)
T2: 1.000.000( CTY)
T3: 1.000.000( CTY)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi
Lắp ráp linh kiện điện tử, dán tape, khung ĐT
Phòng thường', NULL, 'Chu Mẫu 0,5 - 1km
Do Nha 0,5 - 1km', NULL, NULL, '(Do Nha, gần vp mình)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '66df3107-c0b9-4588-9728-a6ff1c11add0', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'YUZHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUZHAN') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 46, 'NAM NỮ
18-45T
(1980)', 5700000, 2100000, 'Mang giầy, dép quai hậu đi pv', 'Không thưởng', NULL, ARRAY['sitting', 'no_gate', 'tattoo_ok']::TEXT[], 'sáng 7h45
chiều 14h', 'Làm ngồi, đứng, biết ký tên, xăm, nhuộm ok
Bao bì, hộp quà, hộp carton
phòng thưòng, kh cửa từ', 'CCCD / VNEID 2 CC
mang giầy/quai hậu
TAY CHÂN TẬT, KHÔNG BT KÝ không nhận', NULL, NULL, NULL, 'QV1 (Mao Dộc)
đơn này dừng nhe', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '3a900858-f54b-426e-a17d-88c467b3ab10', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HOÀNG KIM (sau công viên lãm làng)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOÀNG KIM (sau công viên lãm làng)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 38, 'NAM - NỮ TỪ 1988', 5100000, 500000, 'xăng xe 250k
chuyên cần 250k
thâm niên 3 tháng 50k', 'Không thưởng', NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], NULL, 'Làm ngồi, phòng thường, không cửa từ, được mang điện thoại
Chạy máy CNC, kiểm tra khung xương điện thoại', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'ac4c0648-ff77-4591-9017-8ab7c56fa27e', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'KB TECH (chân cầu Do Nha)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KB TECH (chân cầu Do Nha)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 40, 'NAM NỮ 18-40 tuổi', 5500000, 1450000, NULL, 'Không thưởng', NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm ngồi, phòng thường
Kiểm hàng, chạy CNC, sx linh kiện điện thoại', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd5bccccb-a135-42e0-8247-9f739e483c8e', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HANSEONG (chân cầu Do Nha)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HANSEONG (chân cầu Do Nha)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, NULL, NULL, NULL, 5500000, 900000, NULL, 'Không thưởng', NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm ngồi, đứng
Phòng thường
Sx linh kiện kim loại ốc vít, gia công khuôn mẫu', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'a267f374-0768-4c0c-a888-c2afe71f2b94', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LCE', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LCE') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 49, 'NAM - NỮ
18-49T', 5600000, 2400000, 'LCB tính tăng ca là 6tr4', NULL, 'T1: 2.000.000 ( CTY)
T2: 2.000.000( CTY)
T3: 2.000.000( CTY)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi
Lắp ráp, kiểm tra linh kiện camera oto, dễ làm
Phòng sạch nhưng không có cuẳ từ', 'CCCD', 'Nghiêm Xá
Việt Tân', NULL, NULL, 'Tăng ca đều, lương rất cao
có làmchủ nhật', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'eedfc1ad-34e9-4b57-a24b-cf8920cb20dd', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ADTEK QV3', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ADTEK QV3') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NỮ-NAM lẻ
18-45T', 6000000, 2700000, 'LCB 6.000.000 + PC 2.700.000đ + Thâm niên 1tr-2tr6,CC TUẦN 200k
Nhà ở : 300.000 - Đi lại : 300.000 - Chuyên cần : 500.000 - Thâm niên : 1.000.000 - 2.600.000đ (60 tháng) - Thưởng hiệu suất : 600.000, Thưởng KPI: 300.000 - 600.000đ', '30 triệu/12 tháng', 'NHÀ MÁY THƯỞNG 6 TRIỆU/6 THÁNG CHO NGƯỜI MỚI
THƯỞNG THÂM NIÊN 12,7 TRIỆU (TỪ THÁNG THỨ 4 - THÁNG THỨ 12)
THƯỞNG NĂNG SUẤT 6,6 TRIỆU (TỪ THÁNG THỨ 2 - THÁNG THỨ 12)
ĐẠI VIỆT THƯỞNG:
200k sau đào tạo
500k sau 14 công
Tháng thứ 1 thưởng 1 triệu
Tháng thứ 2 thưởng 1 triệu
Tháng thứ 3 thưởng 2 triệu
Miễn phí ktx 3 tháng', ARRAY['sitting', 'bonus']::TEXT[], '8h', 'Làm ngồi
Dây sạc điện thoại, nhìn đc con hàng', 'CCCD bản phôt công chứng
HỐ SƠ XIN VIỆC
GKSK bổ sung sau', 'Nghiêm Xá
Việt Tân', NULL, NULL, 'biết đọc, viết
đi tất', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '7c54d085-3937-44d1-9bb5-84299eb17776', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'YUZHAN (2)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUZHAN (2)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, false, 18, 46, 'NAM
(1980)', 5700000, 1300000, '3tr5 triệu/2 tháng', '3 tr/2 tháng', 'T1: 1.500.000( CTY)
T2: 2.000.000( CTY)
Mang giầy, dép quai hậu đi pv', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], NULL, 'Làm ngồi, đứng
Bao bì, hộp quà, hộp carton
phòng thưòng, kh cửa từ', 'CCCD / VNEID 2 CC
mang giầy/quai hậu', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5da9b53d-9172-4700-ad37-831f52c58d51', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SUGA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SUGA') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', false, true, 18, 35, 'NỮ
18-35T', 5400000, 1700000, NULL, '4/3T', 'T1: 2.000.000 ( CTY)
T2: 2.000.000( CTY)
T3: 2.000.000( CTY)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm Ngồi
Lắp ráp linh kiện điện thoại, cửa từ
Phòng Thường', '2 CCCD photo( dấu đỏ)
GKSK', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'a3aae867-d524-4168-ba3e-2a7d31c8e7ae', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'TENMA TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TENMA TECH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NAM SƠN/QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ 18-45', 5510000, 570000, NULL, '12 triệu/12 tháng', 'T1: 2.000.000 ( CTY)
T3+T4: 1.000.000 + 1.000.000
T6+T8+T10+T12: 2.000.000 + 2.000.000 + 2.000.000 + 2.000.000', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], NULL, 'Làm ngồi, phòng thường
Sản xuất, lắp ráp linh kiện máy in, nhựa tổng hợp, khuôn đúc
Không có cửa từ', NULL, NULL, NULL, NULL, '(Mao Dộc)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9157eadd-545b-46c8-9b75-48fd7021ff54', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FUSHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUSHAN') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 900000, 'LCB 5.700.000đ + PC 900.000đ + thẻ ăn 1.170k', '10.000.000/4 tháng', 'Tháng đầu thưởng 2 triệu
Tháng thứ 2 thưởng 2 triệu
Tháng thứ 3 thưởng 3 triệu
Tháng thứ 4 thưởng 3 triệu', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng : 8h
Chiều: 2h', 'Làm Ngồi
Lắp ráp linh kiện điện tử, dây sạc
Phòng Thường', NULL, 'Phù Chẩn( 2,5 - 4km)
Đại Trung( 3 - 4km)
Đại Thượng( 3 - 4km)', 'Công ty to, nhiều chế độ
Việc tương đối dễ làm', 'Không có trọ gần
giờ nghỉ trưa ít, đi ăn xa', NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '62d79bba-9070-4a2b-9122-76da5aca16cb', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'BIEL CRYSTAL', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BIEL CRYSTAL') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'VISIP', true, true, 18, 45, 'NAM - NỮ
18-45T', 5900000, 1200000, NULL, '14.500.000/4 tháng', 'NCU
LÀM ĐỦ 7 CÔNG THƯỞNG 700K
LÀM ĐỦ 14 CÔNG THƯỞNG 700K
LÀM ĐỦ 26 CÔNG THƯỞNG 700K
TỪ CÔNG THỨ 31 THƯỞNG 70K/1 NGÀY CÔNG (Thưởng theo 10 công 1 lần)
CÔNG TY
CÔNG TY THƯỞNG 8TR/4 THÁNG MỖI THÁNG 2TR', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng : 8h', 'Làm ngồi, Đứng
Lắp ráp linh kiện điện tử, sx màn hình đt
Phòng sạch', 'Sơ Yếu Lí Lịch( không cần dấu)
Đơn xin Việc', 'Đại Trung( 800 - 1,2km)
Đại Thượng( 1,5 - 2km)
Đại Vi( 2 - 2,5km)', 'Chế độ tốt, lương cao
Tuyển dụng quanh năm', 'Việc khó làm( Phòng sạch, làm đứng, soi kính)
hết việc => cắt nghỉ thời vụ', 'Cần đi giày pv
Kh biết chữ vào đc', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '770742cd-f59d-43d4-b1ac-6eda34f3e284', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'DIAMOND (KCN ĐẠI ĐỒNG, TIÊN DU)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DIAMOND (KCN ĐẠI ĐỒNG, TIÊN DU)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 45, 'Nam nữ 18-45', 5330000, 800000, '(chuyên cần 450, đời sống 350)', NULL, '5tr/4 tháng
T1: 1,5 triệu
T2: 1,5 triệu
T3: 1 triệu
T4: 1 triệu', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], NULL, 'Làm ngồi, không cửa từ, phòng thường
Quấn dây đồng', 'Mang cccd + bút, yêu cầu thuận tay phải', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f1632c06-6c24-4433-8289-769bc14cb84c', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'EMTECH (KCN YÊN PHONG)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('EMTECH (KCN YÊN PHONG)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'YÊN PHONG', false, true, 18, 45, 'nữ 18-45 tuổi
pv 7h30 sáng, mang bút ghi 10 tờ khai', 5500000, 2730000, NULL, '13 triệu/3 tháng', 'T1: 2.000.000 (NCU)
T2: 3.000.000 + 1.000.000 (NCU)
T3: 7.000.000 (NCU)', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Phòng thường, làm ngồi
Sản xuất tai nghe, loa', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '3220f301-9c6b-4d44-9e18-5386f78f9e8f', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SEGYUNG VINA (KCN YÊN PHONG MỞ RỘNG)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SEGYUNG VINA (KCN YÊN PHONG MỞ RỘNG)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'YÊN PHONG', true, true, 18, 45, 'nam nữ 18-45t', 6100000, 1200000, NULL, '7 triệu', 'Thưởng 7 triệu k biết chia như nào', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Phòng sạch, làm ngồi
Soi kính màn hình điện thoại', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'da44709b-e6b3-4cf9-bb53-042af0cef770', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'AMKOR (KCN YÊN PHONG 2)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AMKOR (KCN YÊN PHONG 2)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'YÊN PHONG', false, true, 18, 40, 'chỉ nữ 18-40 tuổi
có bằng cấp 3', 7400000, NULL, NULL, 'Không thưởng', NULL, ARRAY[]::TEXT[], NULL, 'Phòng sạch, soi kính
Sản xuất thiết bị bán dẫn
Đi pv mang cccd + bằng cấp 3', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '62c5266f-ef9b-4955-b092-72848262710c', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'AMPHENOL (KCN YÊN PHONG MỞ RỘNG)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AMPHENOL (KCN YÊN PHONG MỞ RỘNG)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'YÊN PHONG', true, true, 18, 43, 'nam - nữ 18-43 tuổi', 6500000, NULL, 'LCB: 6.500.000 + PC lên đến 5.000.000
(1 triệu + hiệu suất 1,4 triệu + soi kính 2,76 triệu)', '13.5 triệu/1 năm', '7 công: 500 nghìn (ncu)
T1: 2 triệu (ncu)
T2: 1 triệu (ncu)
T3: 4 triệu + 1 triệu (ncu)
T6: 2 triệu
1 năm: 3 triệu', ARRAY['bonus']::TEXT[], NULL, 'Phòng sạch, soi kính 70%
Sản xuất connector - đầu kết nối điện tử
thu nhập tháng 17-18 triệu', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'fe9ec8bd-7628-4f82-a7c8-c89a3a0ebf30', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LUXSHARE - ICT (QC1,2,3)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LUXSHARE - ICT (QC1,2,3)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T
(1981 chưa qua sn)', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ', '11.500.000đ/5 tháng', 'NHÀ MÁY 10TR/5 THÁNG
NCU 500K/THÁNG', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h
đi muộn không pv đưọc', 'Làm Ngồi, Đứng, cuẳ từ, phòng thưòng
Dây cáp, dây sạc, máy tính, điện thoại', '1 Sơ Yếu Lí Lịch( không cần dấu), quét mã pv trước
2 Ảnh 3*4, 2 CCCD photo ( không cần dấu)
sau 3 tháng mới quay lại đưọc, phảo có cccd gốc', 'Tam Tầng ( 1 - 1,5km)
Núi Hiểu( 800 - 1,5km)
Trung Đồng/ My Điền ( 2 - 2,5km)', 'Công ty lớn, nhiều chế độ
Nhiều Xưởng, đa dạng lựa chọn
Việc tương đối dễ làm', 'Tương đối áp lực
ít tăng ca', '2 ngón trỏ và cái phải lành lặn, biết đọc, viêt
Có kí túc xá 2 tháng ở vântrung , có xe đưa đón
xăm không lộ, kh xăm mặt', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f02abb25-2e67-4b60-9577-82ee95a2b572', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'NEWWING VT HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('NEWWING VT HH') LIMIT 1), 'official'::"recruitment_kind", 'open'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ
PC tổng 2.970.000
LCB+PC: 8.470.000', '9.000.000đ/ 3 tháng', 'Tháng đầu thưởng 2.000.000
Tháng thứ 2 thưởng 2.000.000
Tháng thứ 3 thưởng 2.000.000
Tháng thứ 4 thưởng 2.000.000
Tháng thứ 5 thưởng 2.000.000
NHÀ CUNG ỨNG
ĐỦ 1 THÁNG THƯỞNG 1.000.000
ĐỦ 2 THÁNG THƯỞNG 1.000.000
ĐỦ 3 THÁNG THƯỞNG 1.000.000', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h ( không CN)', 'làm ngồi, phòng thưòng, có cửa từ
Dây cáp, dây sạc, máy tính, điện thoại', 'CCCD gốc
nhận săm', 'My Điền', 'Nhiều chế độ
Việc dễ làm
Nhận cả xăm', 'Áp Lực', '(đã có ktx và xe đưa đón của nhà máy)
Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '2159b816-353d-4e7a-8b39-9ead24498fcf', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FUKANG QC HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUKANG QC HH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ', '15.000.000đ/ 3 tháng', 'NHÀ MÁY THƯỞNG:
Làm đủ 1 công thưởng 1.000.000
Làm đủ 7 công thưởng 1.000.000
Làm đủ 26 công thưởng 3.000.000
Làm đủ 52 công thưởng 2.000.000
Làm đủ 78 công thưởng 3.000.000
ĐẠI VIỆT THƯỞNG:
LÀM ĐỦ 7 CÔNG THƯỞNG 1.000.000
LÀM ĐỦ 30 CÔNG THƯỞNG 1.500.000
TỪ CÔNG THỨ 31 TRỞ ĐI THƯỞNG 50K/1 NGÀY CÔNG', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm Ngồi/Đứng
Linh kiện màn hình, tai nghe
Phòng sạch', 'CCCD gốc', NULL, 'nghỉ', NULL, 'Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '6353d812-a0df-48b0-9246-97cd89875f1b', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SHUNYUN QC HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SHUNYUN QC HH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, 'NAM 38
NỮ 42', 5800000, 2400000, 'LCB 5.800.000đ + PC: 2.400.000đ + Thẻ ăn 1.222.000đ', '16.000.000đ/ 6 tháng', 'T1:3tr T2: 4tr
T3:4tr T4: 2tr
T6: 3tr', ARRAY['bonus']::TEXT[], NULL, 'Làm Đứng
Linh kiện điện tử
Phòng sạch (chính)/phòng thưòng', 'CCCD gốc', 'Nhà ở: 600.000 Đi lại: 300.000 Chuyên cần:500.000
Thâm niên: 300.000-1.000.000
Trợ cấp vị trí: 250.000-1.900.000 Hiệu suất: 500.000-1.700.000', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9c39997e-3b80-4e58-94c3-db27ce4c84d1', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FUYU/FULIAN (QC)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUYU/FULIAN (QC)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 42, 'NAM - NỮ
18-42T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ', '12.300.000đ/ 3 tháng', 'Tháng đầu 3.000.000
Tháng thứ 2 thưởng 2.000.000
Tháng thứ 3 thưởng 2.000.000
Tháng thứ 4 thưởng: 3.000.000
ĐẠI VIỆT THƯỞNG 30k/ngày công (2tr3/3 tháng)', ARRAY['sitting', 'dorm', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Làm Ngồi, Đứng
Model WF, Dây cáp kết nối sạc, Macbook', 'CCCD gốc', 'Trung Đồng/ My Điền ( 2 - 2,5km)', NULL, 'Đi Phỏng vấn đeo giày, mặc quần dài, đeo dép quai hậu', 'Thưởng thêm 2.000.000/2 tháng
Có kí túc xá ( vào ở trừ tiền trợ cấp nhà ở)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '6fff37c1-c2e3-47f6-b3a7-bc2fade48817', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HUIMEI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HUIMEI') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 42, 'NAM - NỮ
18-42T', 5550000, 2000000, NULL, '10 triệu', 'làm liền 6 tháng thưởng 10tr', ARRAY['sitting', 'no_gate', 'bonus']::TEXT[], 'Sáng 8h', 'Làm Ngồi, Đứng
Lắp ráp Nhựa, mô hình đồ chơi
Phòng thường, kh cửa từ', 'CCCD gốc
3 bản CCCD photo công chứng
Sơ Yếu Lí Lịch( không cần dấu)', NULL, NULL, NULL, '2 ca', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '3b049bbc-4060-4a6c-bef3-44d1c8001df3', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LENS', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LENS') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '4a33823f-7f1a-4904-8260-edc29fa72098', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LUXSHARE ICT( VT)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LUXSHARE ICT( VT)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'NAM - NỮ
18-45T', 5700000, 1800000, 'LCB 5.700.000đ + PC: 1.800.000đ + Thẻ ăn 1.170.000đ', '11.500.000đ/5 tháng', 'NHÀ MÁY 10 TRIỆU/5 THÁNG
NHÀ CUNG ỨNG 500k/tháng', ARRAY['sitting', 'dorm', 'bus', 'tattoo_ok', 'bonus']::TEXT[], 'Sáng 8h - Chiều 13h', 'Làm Ngồi, Đứng, cuẳ từ, phòng thưòng
Dây cáp, dây sạc, máy tính, điện thoại, dồng hồ', '1 Sơ Yếu Lí Lịch( không cần dấu), quét mã pv trước
2 Ảnh 3*4, 2 CCCD photo ( không cần dấu)
sau 3 tháng mới quay lại đưọc', 'Có kí túc ở Vân Trung
My Điền', 'Công ty lớn, nhiều chế độ
Nhiều Xưởng, đa dạng lựa chọn
Việc tương đối dễ làm', NULL, '2 ngón trỏ và cái phải lành lặn, biết đọc, viêt
Có kí túc xá 2 tháng ở vântrung , có xe đưa đón
xăm không lộ, kh xăm mặt', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '7a49cb9a-e612-41db-b140-97cf5389d40b', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'UMC (KCN TÂN TRƯỜNG - CẨM GIÀNG - HẢI DƯƠNG CŨ)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('UMC (KCN TÂN TRƯỜNG - CẨM GIÀNG - HẢI DƯƠNG CŨ)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'HẢI PHÒNG', true, true, 18, 45, 'NAM NỮ 18-45', 5681700, 1050000, NULL, '22 triệu/6 tháng', 'Thưởng tháng 1: 3.000.000
Thưởng tháng 2: 4.000.000
Thưởng tháng 3: 4.000.000
Thưởng tháng 4: 2.000.000
Thưởng tháng 5: 3.000.000
Thưởng tháng 6: 3.000.000
THƯỞNG THÊM 3.000.000 KHI LÀM ĐỦ 700H TRONG 3 THÁNG', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi, phòng thường
Sản xuất lắp ráp gia công linh kiện điện tử công nghệ cao (bo mạch điều hòa và linh kiện kỹ thuật số)', NULL, 'không nhận xăm (không qua được bên nhà cung ứng)
lđ nào trước làm rồi nghỉ trên 6 tháng mình mới nhận.
chỉ pv chiều gửi tt trước 10h', NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '977b13fa-1e5c-4c99-8047-731bb66bf4fb', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ELENTEC (KCN QUANG MINH)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ELENTEC (KCN QUANG MINH)') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'HÀ NỘI', true, true, 18, 45, 'NAM - NỮ 18-45', 5682000, 1168000, NULL, '6,5 triệu/6 tháng', 'T1: 1 triệu + 500k ncu
T2: 1 triệu + 500k ncu
T3: 1 triệu + 500k ncu
T4: 500K
T5: 500K
T6: 1 triệu', ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm ngồi, phòng thường
Sx linh kiện điện tử', '1. Sơ yếu lí lịch (1 ảnh 3*4 và điền thông tin đầy đủ)
2. Photo ảnh chụp thành phần gia đình trên ứng dụng vnid (1 bản)
3. Giấy khai sinh (1 bản)', NULL, NULL, NULL, 'ngày nào cũng phỏng vấn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '97d9e180-8e44-470e-8d9d-0699bfebc4fc', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ORG VT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ORG VT') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, true, false, 25, 35, 'NAM
25-35T
>1m6', 6612500, NULL, 'LCB 6.612.500đ + PC_TC: 3.262.500đ
Tổng Lưong chưa tăng ca: 9.875.000đ', NULL, 'Thưỏng tuần: 20k/ngày, thanh toán theo tuần (t4-t5 tuần tới)', ARRAY['no_gate', 'bonus']::TEXT[], '15h', 'Làm Đứng, Chuyên ngày
Đứng máy in giấy, sx thảm, giấy
Không cửa tử, phòng thường, không điều hòa', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b034881e-44ed-4325-bb89-4bdbab672a9a', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FUYU/FULIAN (FUHONG) QC HH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUYU/FULIAN (FUHONG) QC HH') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, true, true, 18, 45, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '825fcc0d-8ee7-4592-80d5-2c2625537e97', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'COOLER MASTER', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('COOLER MASTER') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, true, true, 18, 52, 'NAM - NỮ
18-52T', 5500000, 2230000, NULL, '14.000.000', 'T1: 2.000.000 ( CTY) + 2.000.000 (SR)
T2: 2.000.000( CTY) + 2.000.000 (SR)
T3: 2.000.000( CTY) + 2.000.000 (SR)', ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 8h - Chiều 14h', 'Làm ngồi
Lắp ráp, sản xuất quạt tản nhiệt máy tính, đt
Phòng thường', 'CCCD/VNEID 2', NULL, NULL, NULL, '2 ca ( Có chuyên ngày)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '3187827c-332a-4a83-8963-db68d60a762e', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LENS QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LENS QC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", NULL, false, true, 18, 45, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'e05f3c7e-6697-4783-8a70-b40117612f32', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LUXSHARE KCN VISIP HƯNG NGUYÊN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LUXSHARE KCN VISIP HƯNG NGUYÊN') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'NGHỆ AN', true, true, 18, 45, '18-45T', 5400000, 1700000, 'LCB: 5.400K + PC: 1.700K + Thẻ ăn: 1.170k', '20,5 TRIỆU/ 6 tháng', 'Sau 7 công: 500k
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '1bf2a009-1d87-4305-af99-6dafeb96d29f', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'WNC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('WNC') LIMIT 1), 'official'::"recruitment_kind", 'paused'::"recruitment_status", 'HÀ NAM', true, true, NULL, NULL, NULL, 5600000, 2400000, NULL, NULL, 'Sau 7 công: 500k
T1: 4.000.000 (CTY) + 1.000.000 (SR)
T2: 3.000.000 (CTY) + 1.000.000 (SR)
T3: 2.000.000 (CTY) + 1.000.000 (SR)', ARRAY['dorm', 'bus', 'bonus']::TEXT[], NULL, 'Phòng thưòng, sạch
KTX 500k, xe đưa đón 100k', 'SƠ YẾU LÍ LỊCH, CCCD công chứng', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '40fbc761-5267-424e-ad61-b0017e493fb3', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'TALWAY', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TALWAY') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 15, 45, '15-45 tuổi
nam nữ vào hết
chỉ cần có ảnh cccd', NULL, NULL, 'N: 350K - Đ: 400K
CN: 550K - ĐCN: 638K', NULL, NULL, ARRAY['sitting', 'no_gate']::TEXT[], 'SÁNG 7H30', 'làm ngồi, phòng thường
kiểm tra, lắp ráp làm dây điện, gấp vỏ hộp điện thoại
không cửa từ', NULL, NULL, NULL, NULL, '(sau goertek Nam Sơn)', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '200ede14-021f-4e3d-8df5-25d7ce579b43', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'KH VATEC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KH VATEC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 42, 'Cặp Nam Nữ, Nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f810df2a-ab6a-4116-8d13-e678a075b695', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'VDS chân cầu do nha', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('VDS chân cầu do nha') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 42, 'Nam Nữ lẻ
16 - 42 Tuổi
có xử lý cccd', 4800000, 1000000, 'N:350 - Đ400
CN: 550- ĐCN: 650', NULL, NULL, ARRAY['dorm', 'tattoo_ok']::TEXT[], 'Sáng 7h30', 'Làm đứng
Lắp ráp linh kiện điện tư
Bán phòng sạch, nhận xăm, nhuộm thiếu cccd', NULL, NULL, NULL, NULL, 'gần KTX chu mẫu (1km2)
vào dễ', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '29d6a113-2f3b-4103-b420-183a287495de', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'YUTO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YUTO') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 50, 'Nam Nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'abc12e7a-0685-4473-b526-0341ceb371fa', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'WOOJEON (giang liễu)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('WOOJEON (giang liễu)') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 40, 'NAM NỮ (Xử lý cccd)
16-40T', 4800000, 1100000, '300k chuyên cần, 300k nhà ở
200k thâm niên (sau 3 tháng), 300K bộ phận Đúc
N: 340 - Đ: 390
CN: 470 - Đ: 520
Phòng thường', NULL, NULL, ARRAY['sitting', 'no_gate']::TEXT[], 'Sáng 8h00', 'Làm ngồi/đứng, làm đúc
Sản xuất vỏ điện thoại, tai nghe, lắp ráp, điện thoại
Phòng thường, kh cửa từ , phòng đúc sẽ không điêu hòa hơi nóng nhưng tăng ca nhiều', 'CCCD
1 CCCD Photo
Tất Chân', NULL, NULL, NULL, '(ưu tiên vào đây nhé)
N: 360 - Đ: 410
CN: 490 - Đ: 540
phòng đúc
Làm luôn
https://maps.app.goo.gl/t6gHP5eqDYBLPs797', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'f686cd63-f41a-43a1-9833-bf380c528cdb', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HS TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HS TECH') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 40, 'Nam Nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd689e044-cc70-41c2-a8a1-095487e7c4ad', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'BUJEON', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BUJEON') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 45, '1NỮ: 1NAM, Nữ lẻ
18 - 45 Tuổi
( CCCD/VNEID 2)', 4500000, 850000, '500k chuyên cần, 150k nhà ở
200k thâm niên (sau 3 tháng)
N:360 - Đ: 420
CN: 560- ĐCN: 620', NULL, NULL, ARRAY['sitting']::TEXT[], 'CCCD
Tất chân + Ổ Khóa', 'Làm ngồi (nam không xăm, không nhuộm)
Lắp ráp linh kiện điện thoại
phòng thường, đthoai để trong túi zip', NULL, NULL, NULL, NULL, 'Sáng 7h30
Làm luôn
Không nhận xăm', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '7ed851b9-9daf-417a-b89b-f83d31f564b6', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ALMUS TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ALMUS TECH') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', false, true, 18, 45, 'NAM NỮ
18 - 45 Tuổi', 4600000, 1000000, '400k chuyên cần, 400k nhà ở
200k thâm niên (sau 3 tháng)
N: 320 - Đ 370
CN: 450 - ĐCN: 500', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30
Chiều 18h30', 'Làm Ngồi
tai nghe Bluetooth, đồng hồ thông minh
phòng thường, có cửa từ', 'CCCD
1 CCCD Photo
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'chỉ nữ
Làm luôn
Không Nhận xăm', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '67e169e7-a5da-42b1-b286-197c75380b06', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'LAIRD', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('LAIRD') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 45, 'có xử lý cccd
Nam Nữ
16 - 45 Tuổi', 5000000, 1000000, '400k chuyên cần, 400k nhà ở , 200k đi lại
200k thâm niên (sau 3 tháng)
N 340- Đ 380
CN 450 - ĐCN 500
T7 không có lịch vào', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'sáng 7h30
tối trc 20h (19h30) hỏi trc lịch vào', 'Làm ngồi
Sản xuất thiết bị y tế (máy siêu âm, máy chụp x quang), phụ tùng ô tô
Phòng thường, không cửa từ', 'Không cccd vào được
cccd
Tiền đồ là 500k, 3 công mới được nhàmáy chốt', NULL, NULL, NULL, 'N 330- Đ 370
Lương thanh toán theo ngày
mANG tất, vào đc phát giầy
đc mang điện thoại
1 xưởng, làm cùng nhau đc, dễ xin', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd4c20547-27fb-4058-93d7-7d44d35317d0', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'JAEYOUNG', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JAEYOUNG') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', false, true, 16, 50, 'CHỈ NỮ
16 - 50 Tuổi
( Xử Lý CCCD)', 5500000, 1400000, 'LCB 5Tr5 , PC 1tr400k
300k chuyên cần, 400k nhà ở 250k-500k công đoạn
200k thâm niên (sau 3 tháng)
N 400 - Đ 460
CN 600- ĐCN 700', NULL, NULL, ARRAY[]::TEXT[], 'Chiều 17h00', 'phòng thường, có cửa từ
Sản xuất camera ,Volume điện thoại
Phòng sạch, soi kính', '1 CCCD Photo
CCCD Gốc
Hỗ trợ mượn CCCD', NULL, NULL, NULL, 'không tóc lòe loẹt, quần rách
quần rách không nhận', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '77567411-83fe-40f7-a38c-9c818e5247ed', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FINE MS', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FINE MS') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 50, 'Nữ NAM lẻ
18 - 50 Tuổi
cccd gốc', NULL, NULL, 'tháng hè 12-13tr /tháng
bình thưỏng 8-9 triệu
"
nữ phòng sạch, làm ngồi"
N 400 - Đ 450
CN 550- ĐCN 600
Phòng sạch', NULL, NULL, ARRAY['no_gate']::TEXT[], '7h30
15h', 'Phòng thưòng làm đứng/Phòng sạch sản xuất
Dán tape, đóng gói, lau chuì màn hình, ktra linh kiện
Phòng sạch/ thưòng, không cửa từ', 'cần đi tất, giầy pv
ổ khóa
kh xăm, nhuộm', NULL, NULL, NULL, 'N 350 - Đ 400
CN 500- ĐCN 550
phòng thưòng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '99d0726f-f65a-4cdb-bb72-a91a118db6b5', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HOÀNG KIM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOÀNG KIM') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 16, 45, 'Nam Nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '4d4a5ad2-64a8-4916-9781-c0abe54c0704', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'DRAGONZET', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DRAGONZET') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 1', false, true, 16, 50, 'nữ
16 - 50 Tuổi
( Xử Lý CCCD)', NULL, NULL, 'Ca ngày 350k/11h Ca đêm 400k/11h
CN ngày 610k/11h - Ca đêm 660k/11h
Lương tầng 2 đồ chơi (yc mang dao dọc giấy)
N 370 - Đ 430
CN: 630- ĐCN: 690
Lương tầng 1 điện tử', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30
Tối 6h30', 'Làm ngồi/đứng
Cắt vỏ đồ chơi trẻ em /LINH KIỆN điện tử
Phòng thường', 'CCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Thanh toán lưong tuần
Làm luôn
Không nhận xăm
không nhận nhuộm tóc', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '38006ac1-b1f3-48b2-8c44-0410914ef123', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'AAC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AAC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 45, 'NAM - NỮ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'bea26cbc-52e2-4eb8-a87f-2b75c4497ce5', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'TENMA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('TENMA') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 1', true, true, 18, 35, 'nam nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '232856f9-6a92-4e06-97af-fabce978b2a3', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'CNS', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('CNS') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QV2', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40
( Xử Lý CCCD)', 5200000, 1200000, 'N: 350 - Đ: 390
CN: 500 - Đ: 550
Đi giầy pv', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Khung xương, vỏ điện thoại
Phòng thường/sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'fcfc0643-7983-4615-9cfb-f4e7e7f25101', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'JMT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JMT') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QV2', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40', 4500000, 2200000, 'N: 320- Đ: 380', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Khung xương, vỏ điện thoại
Phòng sạch, sản xuất, có 20% soi kính', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0387d7b2-9bf5-4dbf-b711-e7cab62b0341', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SOHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SOHAN') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, 16, 40, 'Nam Nữ Lẻ
16 - 40
( Xử Lý CCCD)', 4200000, 1500000, '400k chuyên cần, 400k nhà ở
200k thâm niên (sau 3 tháng), 300K bộ phận Đúc
N: 330-Đ 380
CN: 450 - ĐCN: 500', NULL, NULL, ARRAY['sitting', 'bus']::TEXT[], 'Sáng 7h15', 'Làm Ngồi
Lắp ráp linh kiện camera giám sát, cam ô tô
Phòng Thường, có xe đưa đón từ qv1', 'CCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'nhận hết què cụt, quá tuỏi', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'bf756e7b-593f-4d00-9ec9-3f1c60909cb0', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'PJ VINA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('PJ VINA') LIMIT 1), 'seasonal'::"recruitment_kind", 'open'::"recruitment_status", 'QUẾ VÕ 3', true, true, 16, 55, 'Nam Nữ Lẻ
16 - 55
( Xử Lý CCCD)', 4500000, 1000000, '400k chuyên cần, 400k nhà ở ,
200k thâm niên (sau 3 tháng)
N:320
CN: 420
T7 không có lịch vào', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], 'Sáng 7h30', 'Làm ngồi
Lắp ráp dây cáp
Phòng thường, kh cửa từ, mang đt theo đc', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5800c206-0a3a-438f-856e-6a7688686a57', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'JIANGTAI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JIANGTAI') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, NULL, NULL, 'Nam Nữ Lẻ', 4500000, 1000000, '400k chuyên cần, 400k nhà ở ,
200k thâm niên (sau 3 tháng)
N:340- Đ380', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Làm Ngồi
Ngoại quan đồng hồ, màn hình điện thoại
Phòng sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'dce6effe-085f-4155-b061-db826eb2fd35', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SUGA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SUGA') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, 18, 45, 'Nam Nữ Lẻ
18 - 45
( Xử Lý CCCD)', NULL, NULL, 'N:330 - Đ: 380
CN: 500 - CNĐ: 600', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm Ngồi
Lắp ráp linh kiện điện thoại, cửa từ
Phòng Thường', '1 CCCD Photo
Tất chân + Ổ Khoá', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '756b7c13-1473-405d-92cf-6fd1982e1f34', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'AD TECK', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('AD TECK') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'QUẾ VÕ 3', true, true, 16, 40, 'Nam Nữ Lẻ
16 - 40
( Xử Lý CCCD)', 5000000, 1000000, '400k chuyên cần, 400k nhà ở ,
200k thâm niên (sau 3 tháng)
N:420- Đ:500/12h', NULL, NULL, ARRAY['sitting', 'no_gate', 'dorm']::TEXT[], NULL, 'Làm Ngồi, có ktx cty cách 1km7
Lắp ráp, kiểm tra dây cáp kết nối, dây điện thoại,..
Phòng Thường, kh cửa từ, điều hòa', NULL, NULL, NULL, NULL, 'chuyên ngày
KTX nhà thầu 300-500
không có xe đưa đón', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '2944484f-8f77-44a5-ba6c-7bddc0acff39', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SUNGWOO VINA', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SUNGWOO VINA') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'THUẬN THÀNH', true, true, 18, 45, 'Nam Nữ Lẻ
18 - 45', NULL, NULL, 'N:412- Đ487
CN: 715- ĐCN: 825', NULL, NULL, ARRAY[]::TEXT[], '7h30', 'Biết chữ, biết ký tên
Sản xuất linh kiện, phụ kiện điện tử, ốp điện thoại, dụng cụ quang học
Phòng Thường/Sạch tùy xưỏng (lưong như nhau)', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '235ac988-a722-4c9e-8773-10f6097413ac', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'DREAM SHORTING', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DREAM SHORTING') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9a1821ec-95f7-411e-b6f5-5b8498054edf', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'DREAM TECH', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DREAM TECH') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0e877ed9-5704-455a-8fa7-7f5a37c45805', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'BIEL', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('BIEL') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 45, 'NAM - NỮ
18-45T', 5600000, 1200000, '300k chuyên cần, 300k nhà ở,
200k phòng sạch,
200k thâm niên (sau 3 tháng)
N:380 - Đ: 480
CN: 600 - ĐCN: 800', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h00', 'Làm ngồi, Đứng
Lắp ráp linh kiện điện tử, sx màn hình đt
Phòng sạch', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '5f06beb5-845b-4a0b-a2bd-67e8ed4ebe54', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FUSHAN', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FUSHAN') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18-40', 5500000, 900000, 'LCB 5.500.000 + PC 900k + 870k tiền BH
Lương Tháng công ty trả lương', '10 triệu/4 tháng chia 2-2-3-3', NULL, ARRAY['sitting', 'bonus']::TEXT[], NULL, 'Làm Ngồi, Đứng
Lắp ráp linh kiện điện tử
Phòng thường', NULL, NULL, NULL, NULL, 'tv lương tháng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b5985e5a-a1b5-4b99-9f01-72d44946ef69', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ITM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ITM') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18 - 40', 4800000, 700000, '140k chuyên cần, 200k đời sống, 200k thâm niên (sau 3 tháng) PC Phép năm 160k
N 370, Đ 465
CN 640, Đêm CN 800', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 7h30', 'Làm đứng, đào tạo 1 tuần
Lắp ráp linh kiện điện tử
Bán phòng sạch', 'CCCD
1 CCCD Photo
Tất Chân + ổ Khóa', NULL, NULL, NULL, 'Làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'e1eb8276-9563-4545-8507-dc2115294805', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'DIAMOND', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('DIAMOND') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 16, NULL, 'nam - nữ từ 16+', NULL, NULL, 'Ca ngày: 400
Ca đêm: 450
CN 700, ĐCN: 800', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30
chỉ phỏng vấn thứ 2-4-6', 'làm ngồi, phòng thường
làm quấn dây đồng trong dây cáp, dây sạc', 'CCCD', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '3ed67cf5-8bc1-401a-85ea-dbf8b7ec6c59', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'JOSUNG', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('JOSUNG') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'VISIP', true, true, 18, 40, 'Nam Nữ lẻ
18-40', 5200000, 1000000, 'N: 330 - Đ: 390
CN: 540- ĐCN: 620
chủ nhật làm 8 tiếng', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 8h00
đến muộn kh vào đưọc', 'Phòng thường
Lắp ráp linh kiện điện tử
Làm ngồi', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'c0248005-89f0-4af5-a553-e4fcd252381d', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'INOX', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('INOX') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'TIÊN SƠN', true, true, NULL, NULL, NULL, 4700000, 1200000, '400k chuyên cần, 400k nhà ở, 200K phòng sạch
200k thâm niên (sau 3 tháng)
N:350 - Đ:400
CN :500 - Đ : 600', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 8h30', NULL, NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '113c030d-fdc8-4455-a7f4-b329737bb453', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HOJEONG', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOJEONG') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'TAM SƠN', true, true, NULL, NULL, NULL, 4300000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 8h00', NULL, NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b5e0b5f0-2921-4e50-9574-d3f4884dbad2', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HOSIDEN (quang châu)', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HOSIDEN (quang châu)') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 45, 'Cặp Nam nữ
18 - 45 Tuổi
( Xử Lý CCCD)', 4410000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)
N:315- Đ: 420
CN: 465- ĐCN: 642', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h15', 'Làm ngồi
Sản xuất, kiểm hàng, lắp ráp tay cầm điêu khiển từ xa đồ chơi
Phòng thường,có cửa từ', 'CCCD
1 CCCD Photo
Tất Chân + ổ Khóa', NULL, NULL, NULL, 'Làm luôn', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '182d3c92-3c98-44b2-a54a-9ab43ad2df38', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SAMKWANG QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SAMKWANG QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 16, 40, 'NỮ- NAM
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '71d0b469-4d7d-4b97-8653-1edfbc18d54c', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SIFLEX QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SIFLEX QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 40, 'NAM-NỮ
18-40', 4700000, 1000000, '400k chuyên cần, 400k nhà ở,
200k thâm niên (sau 3 tháng)
N:323- Đ: 391
CN: 485- ĐCN: 698', NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Làm ngồi, Đứng
Lắp ráp linh kiện điện tử
phòng thường', 'Sáng 7h30, Tối 19h30
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '8ca1d843-e3b1-4948-8a16-3673d66b4013', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'YOUNGJIN nội hoàng', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('YOUNGJIN nội hoàng') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 40, 'Nam Nữ Lẻ
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'd4bd98dd-c014-41f4-a884-23bf5c8e38e2', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'KEPSION VT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KEPSION VT') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 18, 40, 'Nam Nữ Lẻ
18 - 40', NULL, NULL, 'N:300- Đ: 350
CN: 450- ĐCN: 520', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'phòng thưòng
lắp ráp linh kiện, chạy máy, kiểm hàng, dán tape
làm ngồi, biêt ký tên', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'ea8cd971-a431-4f5c-acfc-870b0c548d64', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'S DRAGON VT', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('S DRAGON VT') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, 16, 40, 'Nam Nữ Lẻ
16 - 40
Thiếu tuổi đưọc, kh biêt chữ đc', 5200000, 1000000, 'N:328- Đ: 410
CN: 550- ĐCN: 632
làm 9 trả 7', NULL, NULL, ARRAY['sitting']::TEXT[], '7h30', 'phòng thưòng, công ty nhựa
lắp ráp bảng mạch,
gọt via kiểm hàng, lắp ráp
làm ngồi, biêt ký tên', NULL, NULL, NULL, NULL, 'bổ sung', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '083102f9-e2ba-442f-ab12-a1691a9ac43e', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'UTECH vân trug', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('UTECH vân trug') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N:300- Đ: 360
CN: 500- ĐCN: 550', NULL, NULL, ARRAY[]::TEXT[], 'Sáng 7h30', NULL, 'ccccd', NULL, NULL, NULL, 'pv xong làm luôn
đủ 7 ngày mới trả công', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '9719b331-085b-4699-b59a-c41a7b29778b', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'UMEC QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('UMEC QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N:320
CN: 480', NULL, NULL, ARRAY['no_gate']::TEXT[], NULL, 'chuyên ngày, phòng thưòng, không cửa từ
quấn dây dồng', NULL, NULL, NULL, NULL, 'chuyên ngày', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '99da5cf0-445b-4de4-97a7-e6649be174e0', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'FOUSINE QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('FOUSINE QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N:300
CN: 520', NULL, NULL, ARRAY['no_gate']::TEXT[], NULL, 'Chuyên ngày
lắp ráp linh kiện
Phòng thưòng, không cửa từ', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'cc7e1ed5-24d6-47a9-85fa-e2455fad17c3', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'CHENGLOONG QC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('CHENGLOONG QC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'cc tháng 500k
N:330- Đ: 410
CN: 470- ĐCN: 540
TT thứ 4-thứ 7', NULL, NULL, ARRAY['no_gate']::TEXT[], NULL, 'Lưong tuần
bao bì, carton
Phòng thưòng, không cửa từ', NULL, NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0972ce48-fc10-4c70-8876-69dc01443fdf', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'KYOCERA VT, nội hoàng', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KYOCERA VT, nội hoàng') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', false, true, 18, 47, '18 - 47
NỮ thôi', NULL, NULL, 'N:300
CN: 520', NULL, NULL, ARRAY['sitting', 'no_gate', 'phone_ok']::TEXT[], NULL, 'làm ngồi
Kiểm hàng, linh kiện điện thoại
Phòng thưòng, không cửa từ, đc cầm đth', 'CCCD PHOTO
Giầy/dép quai hậu + Tất', NULL, NULL, NULL, 'chuyên ngày
Linh kiện điện thoại Samsung khay sim
Nam chạy máy laze khắc laze lên con hàng', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b1c2ac53-0657-48ed-a3f4-0e7840bac449', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'KTC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('KTC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, NULL, NULL, 'N 280 - Đ 365 (bp sản xuất)
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0410afdc-5a0c-453f-bd9c-2971afc8c622', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ETESY', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ETESY') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BẮC GIANG', true, true, NULL, NULL, NULL, 4410000, 1000000, 'N:280/11h- 312/12h- 343/13h
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

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '0fda7c01-91e0-4635-88a9-aa629af97d72', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'ACTRO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('ACTRO') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 5600000, 1450000, 'N 370 - Đ 430
CN: 550 - ĐCN: 660', '1.500.000/26 công chuyên cần', NULL, ARRAY['sitting', 'bonus']::TEXT[], 'Sáng 7h30/Chiều 14h', 'Phòng Sạch
Kiểm tra linh kiện camera điện thoại
Làm Ngồi', 'CCCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '082debaf-26ec-48e7-afc0-b566a657df5a', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'COSONIC', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('COSONIC') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 4900000, 800000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Phòng Thường
Lắp ráp, đóng gói linh kiện tai nghe
Làm ngồi', 'CCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT 'b09027ba-bd50-4d4d-a237-260fb56e722d', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'HANBO', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('HANBO') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 4900000, 800000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], 'Sáng 7h30', 'Phòng Thường
Lắp ráp, kiểm tra vỏ điện thoại
Làm ngồi/đứng', 'CCCCD
Tất chân + Ổ Khóa', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '6c87c335-7161-4213-83f3-7cd8e1ab6b18', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SEGI', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SEGI') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', false, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 5500000, 1000000, NULL, NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Phòng Thường
Lắp ráp, đóng gói linh kiện điện tử
Làm ngồi', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, 'Sáng 7h30, Tối 19h30
chỉ tuyển nữ', a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '91a8706a-a50d-4b94-a5b6-f941ded5c58f', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'IM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('IM') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 6600000, 1050000, 'CC 300k, ĐS 450k, Soi kinh 300k
Thâm niên 3tháng/200k, 6 tháng/400k, 1năm/600k', NULL, NULL, ARRAY['sitting']::TEXT[], NULL, 'Phòng Sạch
Kiểm tra linh kiện camera điện thoại
Làm Ngồi', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '48fe338e-9fd3-4c96-a764-4d9d1dc36c39', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'SOLUM', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('SOLUM') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'BÁ THIỆN 2, VĨNH PHÚC', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 6500000, 800000, 'CC 300k, ĐS 450k, Soi kinh 300k
Thâm niên 3tháng/200k, 6 tháng/400k, 1năm/600k', NULL, NULL, ARRAY['phone_ok']::TEXT[], NULL, 'Phòng thưòng
Kiểm tra linh kiện camera điện thoại
Làm đứng, đc mang điện thoại vào xưỏng', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;

INSERT INTO "recruitment_postings" ("id", "team_id", "company_name", "order_record_id", "kind", "status", "area", "accept_male", "accept_female", "age_min", "age_max", "requirement", "base_salary", "allowance", "salary_note", "bonus_summary", "bonus", "tags", "interview_slot", "work", "documents", "housing", "pros", "cons", "notes", "updated_by", "updated_at")
SELECT '3da33c6f-5e21-4107-846f-40711d4d2f4d', (SELECT t."id" FROM "teams" t WHERE lower(trim(t."name")) = lower('Nhóm 1') ORDER BY t."created_at" ASC LIMIT 1), 'COASIA BÌNH XUYÊN 2', (SELECT o."id" FROM "order_records" o WHERE lower(o."name") = lower('COASIA BÌNH XUYÊN 2') LIMIT 1), 'seasonal'::"recruitment_kind", 'paused'::"recruitment_status", 'PHÚ THỌ, VĨNH PHÚC CŨ', true, true, 16, 40, 'Nam nữ
16 - 40 Tuổi
( Xử Lý CCCD)', 6000000, 1400000, 'CC 600k, ĐS 300k, Soi kinh 300k(nếu có)
Thâm niên 200k', NULL, NULL, ARRAY['sitting']::TEXT[], '8h20', 'Phòng Sạch
Sản xuất, lắp rpa sống kính camera, điện thoại
Làm Ngồi', 'CCCCD
Tất chân + Ổ Khóa
1 CCCD Photo', NULL, NULL, NULL, NULL, a."id", CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "accounts" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1) a;
