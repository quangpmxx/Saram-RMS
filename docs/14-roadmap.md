# DEVELOPMENT ROADMAP — CRM TUYỂN DỤNG / CUNG ỨNG LAO ĐỘNG

> **Trạng thái:** `docs/09` đến `docs/13` đã **Design Freeze** kể từ thời điểm tài liệu này được tạo — không tự ý thay đổi nghiệp vụ/database/API. Roadmap này chỉ chia lịch phát triển, không mở thêm/bớt phạm vi so với 5 tài liệu đã chốt.
> Phạm vi: **chỉ lập kế hoạch phát triển theo Phase**. Không viết code.
> Nguyên tắc chia Phase: mỗi Phase là 1 lát cắt dọc (vertical slice) — có thể chạy, test, và đưa vào dùng thật độc lập; chỉ được phép phụ thuộc vào Phase **trước** nó, không bao giờ phụ thuộc vào Phase **sau** nó.

---

## 0. Ghi chú xuyên suốt mọi Phase (không phải Phase riêng)

Các mối quan tâm dưới đây cắt ngang nhiều Phase, không tách thành 1 Phase độc lập vì tự bản thân chúng không mang giá trị sử dụng nếu đứng một mình:

- **Responsive/di động:** bắt buộc áp dụng ngay từ Phase 1 trở đi (Mục 4.9, tài liệu 09), không phải tính năng bổ sung sau.
- **Ghi Audit Log (`audit_logs`):** hạ tầng ghi log nên được dựng từ Phase 0 (ghi nhận mọi hành động tạo/sửa/xóa/đăng nhập ngay khi tính năng đó ra đời), nhưng **màn hình xem nhật ký** chỉ xuất hiện ở Phase 9. Nghĩa là dữ liệu được ghi sớm, giao diện tra cứu ra sau — tránh tình trạng Phase 9 mới bắt đầu ghi log thì mất hết lịch sử trước đó.
- **Tìm kiếm/Lọc (M9):** không phải 1 Phase riêng — mỗi Phase tự bổ sung filter cho đúng những trường dữ liệu Phase đó tạo ra (Phase 1 có filter theo nguồn/ngày; Phase 3 có thêm filter theo trạng thái cuộc gọi...).
- **Hạ tầng worker nền (background job):** cần dựng từ Phase 1 (phục vụ import Excel bất đồng bộ — đã chốt tại Design Review), rồi tái sử dụng ở Phase 5 (quét cột chăm sóc) và Phase 8 (quét lịch nhắc Zalo) — không phải xây lại từ đầu mỗi lần.

---

## 1. Bảng tổng quan các Phase

| Phase | Tên | Phụ thuộc | Module liên quan | Giá trị dùng ngay |
|---|---|---|---|---|
| 0 | Nền tảng hệ thống & Tài khoản | Không | M1, M2 (rút gọn), M15 | Có hệ thống tài khoản/phân quyền chính thức thay quản lý thủ công |
| 1 | Thu thập dữ liệu ứng viên | 0 | M3 (tạo/sửa/xóa), M4, M8 (cơ bản), M9 (cơ bản) | Thay thế hoàn toàn việc MKT nhập liệu trên Google Sheet |
| 2 | Phân chia thủ công & Không gian Sale/Leader | 0, 1 | M5 (thủ công), M3 (phần "của tôi") | Thay thế việc Leader chia số thủ công trên sheet |
| 3 | Pipeline cuộc gọi & Lịch sử ghi chú | 0, 1, 2 | M7 (cuộc gọi), M3/M12 (note) | Thay thế các cột tình trạng/kết quả/ghi chú trên sheet |
| 4 | Lịch phỏng vấn, lịch gọi lại & Calendar | 0–3 | M7 (PV/đi làm), M10 | Hoàn thiện vòng đời ứng viên đầu-cuối — mốc MVP nghiệp vụ đầy đủ |
| 5 | Cột chăm sóc tự động | 0–4 | M6, M14 (ngưỡng thời gian) | Giải quyết đúng nỗi đau "lead bị bỏ quên" — giá trị lõi của dự án |
| 6 | Tự động phân chia (round-robin) | 0–2 | M5 (auto) | Giảm tải thao tác chia số cho Leader, có thể bật/tắt an toàn |
| 7 | Dashboard & Báo cáo | 0–6 | M13 | Cấp nhìn tổng quan để ra quyết định |
| 8 | Thông báo Zalo | 0–4 | M11 | Giảm thất lạc lịch hẹn |
| 9 | Nhật ký, Trùng lặp nâng cao & Phân quyền chi tiết | 0–1 | M12 (UI), M8 (màn hình riêng), M2 (phần còn lại) | Tăng khả năng giám sát/kiểm soát nội bộ |

Thứ tự 6, 7, 8 có thể hoán đổi cho nhau hoặc làm song song nếu nguồn lực cho phép — không vi phạm nguyên tắc phụ thuộc vì cả ba chỉ phụ thuộc ngược về các Phase trước, không phụ thuộc lẫn nhau.

---

## Phase 0 — Nền tảng hệ thống & Tài khoản

**Mục tiêu:** Dựng khung xác thực, quản lý tài khoản và nhóm — điều kiện tiên quyết để mọi vai trò có thể đăng nhập và được giới hạn đúng phạm vi dữ liệu.

**Phạm vi (tham chiếu tài liệu):**
- Đăng nhập/đăng xuất bằng tài khoản-mật khẩu do Admin cấp, hỗ trợ nhiều thiết bị (Mục 8, tài liệu 09; S1, tài liệu 10; `POST /login`, `POST /logout`, `GET /me`, tài liệu 13).
- Admin tạo/sửa/vô hiệu hóa tài khoản, gán vai trò (Admin/Quản lý/Leader/MKT/Sale), reset mật khẩu (S11, tài liệu 10 và 12; nhóm API `/account`, tài liệu 13).
- Quản lý nhóm (Team): tạo nhóm, gán Leader phụ trách (S16, tài liệu 10; Mục 9.0, tài liệu 12; nhóm API `/team`).
- Phân quyền áp dụng theo **5 vai trò cố định** đã chốt tại Mục 8, tài liệu 09. **Không** bao gồm phần phân quyền tùy chỉnh (checklist) cho Quản lý/Leader — dời sang Phase 9 vì còn là điểm chưa chốt nghiệp vụ (Mục 11.1, tài liệu 09).

**Phụ thuộc:** Không.

**Tiêu chí hoàn thành / test độc lập:**
- Admin đăng nhập được, tạo được 1 nhóm, tạo được đủ 5 loại tài khoản (Admin/Quản lý/Leader/MKT/Sale) và gán đúng nhóm.
- Từng tài khoản vừa tạo đăng nhập được, chỉ thấy đúng menu/quyền theo vai trò (Mục 6, tài liệu 10).
- Reset mật khẩu về mặc định hoạt động đúng, chỉ Admin thực hiện được.
- Đăng nhập đồng thời trên 2 thiết bị với cùng 1 tài khoản không bị chặn.

**Giá trị đưa vào dùng ngay:** Công ty có hệ thống tài khoản/phân quyền chính thức — có thể bắt đầu cấp tài khoản thật cho nhân viên trước khi các nghiệp vụ khác hoàn thiện.

---

## Phase 1 — Thu thập dữ liệu ứng viên (Lead Intake)

**Mục tiêu:** MKT có nơi nhập/import dữ liệu ứng viên thay cho Google Sheet.

**Phạm vi:**
- Nhập tay 1 lead (S6, tài liệu 10/12; `POST /candidate`).
- Import Excel hàng loạt, xử lý bất đồng bộ, tra cứu tiến độ (S7; `POST /candidate/import`, `GET /candidate/import/:jobId`) — phục vụ import dần ~20.000 dòng dữ liệu cũ (Mục 2, tài liệu 09).
- Danh sách ứng viên cơ bản: xem, tìm kiếm theo tên/SĐT, lọc theo nguồn/ngày (S3 rút gọn; `GET /candidate`).
- MKT sửa/xóa data do chính mình upload (`PUT /candidate/:id`, `DELETE /candidate/:id`).
- Cảnh báo trùng SĐT cơ bản ngay khi nhập (banner "đã trùng với data ngày...của nhân viên...") — **chưa gồm** màn hình Danh sách trùng lặp chuyên biệt (S15, dời sang Phase 9).

**Phụ thuộc:** Phase 0 (cần tài khoản MKT để đăng nhập).

**Tiêu chí hoàn thành / test độc lập:**
- MKT nhập tay 1 lead → xuất hiện ngay trong danh sách với trạng thái "Chờ phân chia".
- Import 1 file Excel mẫu (vài chục dòng, có cả dòng lỗi và dòng trùng SĐT) → nhận được báo cáo kết quả đúng số dòng thành công/lỗi/trùng qua job status.
- Nhập 1 SĐT đã tồn tại → nhận cảnh báo trùng ngay khi lưu nhưng vẫn lưu được.
- MKT A không sửa/xóa được data do MKT B upload.

**Giá trị đưa vào dùng ngay:** Thay thế hoàn toàn việc MKT nhập/theo dõi data trên Google Sheet — đây là mốc dùng thật đầu tiên của dự án.

---

## Phase 2 — Phân chia thủ công & Không gian làm việc Sale/Leader

**Mục tiêu:** Leader chia lead cho Sale, Sale thấy được lead của mình — thay thế bước "chia số" thủ công trên sheet.

**Phạm vi:**
- Màn hình "Chờ phân chia" cho Leader (S3; `GET /candidate/pending`).
- Phân chia thủ công từng lead hoặc hàng loạt (`POST /candidate/:id/assign`, `POST /candidate/assign-bulk`).
- Chuyển lead giữa các Sale trong nhóm (`POST /candidate/:id/transfer`).
- Màn hình "Lead của tôi" cho Sale (S4; `GET /candidate?assigned_to=me`).
- Leader xem toàn bộ dữ liệu nhóm mình, workload từng Sale (S16-team-member API `GET /team/:id/member`).

**Phụ thuộc:** Phase 0, Phase 1 (cần có lead ở trạng thái chờ phân chia).

**Tiêu chí hoàn thành / test độc lập:**
- Lead mới từ Phase 1 xuất hiện đúng ở "Chờ phân chia" của Leader phụ trách đúng nhóm.
- Leader gán 1 lead cho Sale A → Sale A thấy lead đó trong "Lead của tôi"; Sale B không thấy.
- Leader chuyển lead từ Sale A sang Sale B → cập nhật đúng, Sale A không còn thấy lead đó nữa.
- Leader nhóm 1 không thấy được data chờ phân chia của nhóm 2.

**Giá trị đưa vào dùng ngay:** Thay thế bước phân chia thủ công trên sheet — vòng lặp MKT → Leader → Sale đã khép kín ở mức cơ bản.

---

## Phase 3 — Pipeline cuộc gọi & Lịch sử ghi chú

**Mục tiêu:** Sale cập nhật tiến trình tư vấn và lưu lịch sử cuộc gọi — thay thế các cột trạng thái/ghi chú trên sheet.

**Phạm vi:**
- Cập nhật tình trạng cuộc gọi và kết quả cuộc gọi (`PUT /candidate/:id/call-status`, `PUT /candidate/:id/call-result`).
- Thêm/xóa ghi chú, giữ lịch sử đầy đủ kể cả note đã xóa (`POST/GET/DELETE /candidate/:id/note`).
- MKT xem được note của Sale nhưng không sửa được (kiểm tra quyền ở tầng API).
- Màn hình Chi tiết ứng viên hoàn chỉnh phần cuộc gọi/ghi chú (S5, Mục 2.2 tài liệu 12).

**Phụ thuộc:** Phase 0, 1, 2 (cần lead đã được gán cho Sale).

**Tiêu chí hoàn thành / test độc lập:**
- Sale cập nhật tình trạng/kết quả cuộc gọi cho 1 lead của mình → phản ánh đúng trên danh sách và chi tiết.
- Sale thêm 3 ghi chú liên tiếp cho cùng 1 lead → cả 3 đều được lưu, không ghi đè nhau.
- Sale xóa 1 note cũ → note biến mất khỏi giao diện chính nhưng vẫn truy được trong lịch sử (kiểm tra qua dữ liệu, chưa cần màn hình audit log riêng).
- MKT mở được note của Sale nhưng không có nút sửa/xóa.

**Giá trị đưa vào dùng ngay:** Toàn bộ vòng tư vấn cơ bản (gọi → ghi nhận kết quả → note) đã số hóa hoàn toàn, không còn phụ thuộc sheet cho phần này.

---

## Phase 4 — Lịch phỏng vấn, lịch gọi lại & Calendar

**Mục tiêu:** Theo dõi trọn vòng đời ứng viên từ hẹn phỏng vấn đến kết quả đi làm.

**Phạm vi:**
- Đặt lịch hẹn PV kèm công ty đối tác (`POST /candidate/:id/interview`); hỗ trợ hẹn lại khi bùng PV (attempt_no tăng dần).
- Cập nhật tuần tự: đến/bùng PV → đỗ/trượt PV → đi làm/không đi làm kèm lý do (`PUT /interview/:id`).
- Đặt/cập nhật lịch gọi lại (`POST/PUT /candidate/:id/callback`, `/callback/:id`).
- Màn hình Lịch tổng hợp dạng calendar (S10; `GET /calendar`) và màn hình Interview/agenda (Mục 7, tài liệu 12).

**Phụ thuộc:** Phase 0–3 (cần pipeline cuộc gọi đã hoạt động để có lead đủ điều kiện hẹn PV).

**Tiêu chí hoàn thành / test độc lập:**
- Đặt lịch PV cho 1 lead → xuất hiện đúng trên Calendar.
- Cập nhật "Bùng PV" → đặt lại lịch lần 2 cho cùng lead → hệ thống lưu cả 2 lần hẹn, không mất lịch sử lần 1.
- Đi hết chuỗi: đến PV → đỗ PV → đi làm — mỗi bước phản ánh đúng trạng thái hiện tại trên danh sách Candidate (nhờ cột denormalize đã bổ sung ở Design Review).
- Đỗ PV nhưng chọn "Không đi làm" → bắt buộc nhập lý do, lưu đúng.

**Giá trị đưa vào dùng ngay:** Đây là mốc **MVP nghiệp vụ đầy đủ** — toàn bộ hành trình từ lead mới đến khi đi làm đã được số hóa trọn vẹn, đủ để vận hành thay thế sheet 100% (chưa có tự động hóa, nhưng đủ dùng thủ công).

---

## Phase 5 — Cột chăm sóc tự động (Care Pool)

**Mục tiêu:** Tự động phát hiện và điều phối các lead bị bỏ quên — đúng nỗi đau lớn nhất mà dự án được lập ra để giải quyết.

**Phạm vi:**
- Worker nền quét định kỳ, đẩy lead đã xử lý nhưng quá ngưỡng thời gian (mặc định 30 phút) vào cột chăm sóc chung của nhóm (M6; `GET /care-pool`).
- Cơ chế khóa xử lý đồng thời + giải phóng khi thoát (`POST /care-pool/:id/lock`, `/release`), kèm khuyến nghị fallback an toàn đã ghi ở Design Review.
- Đánh dấu/bỏ đánh dấu "giữ số" (`POST/DELETE /candidate/:id/hold`).
- Admin cấu hình ngưỡng thời gian (S13; `GET/PUT /config`).
- Admin gỡ lead khỏi danh sách chăm sóc (`DELETE /care-pool/:id`).

**Phụ thuộc:** Phase 0–4 (cần trạng thái "đã xử lý" từ Phase 3 để biết lead nào đủ điều kiện, cần lead đã gán từ Phase 2).

**Tiêu chí hoàn thành / test độc lập:**
- Một lead đã có kết quả cuộc gọi, không ai động vào quá ngưỡng cấu hình → tự động xuất hiện ở cột chăm sóc của các Sale khác cùng nhóm.
- Lead hoàn toàn mới (chưa gọi lần nào) để quá ngưỡng thời gian → **không** vào cột chăm sóc (đúng quy tắc Mục 10.1, tài liệu 09).
- Sale đánh dấu giữ số → lead đó không bị đẩy vào chăm sóc dù quá ngưỡng.
- 2 Sale cùng mở 1 lead trong cột chăm sóc → người thứ 2 nhận thông báo "đang được xử lý", không sửa được cho tới khi người thứ 1 giải phóng.
- Đổi ngưỡng thời gian trong Cấu hình hệ thống → hành vi quét áp dụng theo giá trị mới.

**Giá trị đưa vào dùng ngay:** Giải quyết trực tiếp lý do công ty đặt hàng phần mềm này — không còn lead nào "chìm" mà không ai biết.

---

## Phase 6 — Tự động phân chia lead (Round-robin)

**Mục tiêu:** Giảm thao tác chia lead thủ công cho Leader.

**Phạm vi:**
- Leader cấu hình danh sách + thứ tự Sale tham gia vòng quay (`GET/PUT /distribution-rule/:teamId`).
- Kích hoạt/tạm dừng (`POST /distribution-rule/:teamId/activate|pause`) — có thể quay lại chế độ thủ công (Phase 2) bất kỳ lúc nào.

**Phụ thuộc:** Phase 0–2 (dùng chung nền tảng phân chia thủ công).

**Tiêu chí hoàn thành / test độc lập:**
- Leader cấu hình vòng quay 3 sale (A, B, C), kích hoạt → 3 lead mới liên tiếp được gán đúng thứ tự A→B→C, lead thứ 4 quay lại A.
- Tạm dừng giữa chừng → lead mới tiếp theo không tự gán, quay về luồng thủ công của Phase 2.
- Chạy song song với vận hành thật không phá vỡ Phase 2 (thủ công vẫn dùng được cho các nhóm chưa bật auto).

**Giá trị đưa vào dùng ngay:** Tính năng cộng thêm, an toàn bật/tắt độc lập theo từng nhóm — không bắt buộc để hệ thống hoạt động.

---

## Phase 7 — Dashboard & Báo cáo

**Mục tiêu:** Cung cấp cái nhìn tổng quan cho quản lý dựa trên dữ liệu đã tích lũy từ các Phase trước.

**Phạm vi:**
- Các chỉ số đã chốt tại Mục 9, tài liệu 09: lead mới theo nguồn, chờ phân chia, phễu chuyển đổi, hiệu suất Sale, số lead ở cột chăm sóc theo nhóm (`GET /dashboard/summary`, `/dashboard/performance`, `/dashboard/by-team`).
- Màn hình Reports mở rộng, dùng chung engine với Dashboard (`GET /report/funnel`, `/report/by-source`).

**Phụ thuộc:** Phase 0–6 (càng nhiều Phase trước hoàn thành, số liệu càng đầy đủ — nhưng về kỹ thuật chỉ cần Phase 0–4 đã đủ dữ liệu tối thiểu để hiển thị được).

**Tiêu chí hoàn thành / test độc lập:**
- Số liệu Dashboard khớp chính xác với dữ liệu thực tế đã nhập/xử lý ở các Phase trước (đối chiếu thủ công 1 vài chỉ số).
- Lọc theo khoảng thời gian/nhóm trả về đúng tập con dữ liệu tương ứng.
- Bấm vào 1 con số breakdown (Reports) → mở đúng danh sách ứng viên đã lọc sẵn.

**Giá trị đưa vào dùng ngay:** Chủ doanh nghiệp có công cụ ra quyết định ngay cả khi dữ liệu còn ít, giá trị tăng dần theo thời gian sử dụng.

---

## Phase 8 — Thông báo Zalo

**Mục tiêu:** Giảm thất lạc lịch hẹn bằng nhắc lịch tự động.

**Phạm vi:**
- Worker quét lịch gọi lại/hẹn PV sắp đến giờ, gửi thông báo qua Zalo (`GET /notification`, tích hợp Zalo Notification Service — điểm tích hợp ngoài duy nhất theo Mục 4.3, tài liệu 10).

**Phụ thuộc:** Phase 0–4 (cần dữ liệu lịch hẹn từ Phase 4).

**Tiêu chí hoàn thành / test độc lập:**
- Đặt 1 lịch hẹn sắp tới hạn → nhân viên phụ trách nhận được tin nhắn Zalo đúng thời điểm cấu hình.
- Tắt/lỗi kênh Zalo không làm gián đoạn các chức năng khác của hệ thống (fail gracefully, chỉ trạng thái thông báo chuyển "failed").

**Giá trị đưa vào dùng ngay:** Lớp cộng thêm giảm rủi ro quên lịch — hệ thống vẫn hoạt động đầy đủ nếu tích hợp Zalo tạm thời gián đoạn.

---

## Phase 9 — Nhật ký, Trùng lặp nâng cao & Phân quyền chi tiết

**Mục tiêu:** Hoàn thiện lớp giám sát/kiểm soát nội bộ.

**Phạm vi:**
- Màn hình Lịch sử/Nhật ký truy cập đầy đủ cho Admin/Quản lý (S14; `GET /audit-log`) — dựa trên dữ liệu đã được ghi từ Phase 0 trở đi (xem Mục 0).
- Màn hình Danh sách trùng lặp chuyên biệt toàn hệ thống (S15; `GET /candidate/duplicate`) — mở rộng từ cảnh báo cơ bản ở Phase 1.
- Phân quyền chi tiết (checklist quyền) cho tài khoản Quản lý/Leader (S12; `PUT /account/:id/permission`, `GET /permission`).

**Phụ thuộc:** Phase 0 (tài khoản), Phase 1 (dữ liệu trùng lặp).

**⚠️ Điểm cần dừng lại và xác nhận trước khi triển khai phần Phân quyền chi tiết:** danh sách quyền cụ thể (checklist) cho vai trò Quản lý/Leader hiện **chưa được chốt** với chủ doanh nghiệp (Mục 11.1 và 11.2, tài liệu 09). Theo đúng nguyên tắc Design Freeze, Phase này chỉ dựng phần khung (bảng `permissions` rỗng, giao diện checklist) và **phải dừng lại xin xác nhận danh sách quyền cụ thể** trước khi hoàn thiện — không tự suy đoán quyền nào nên có.

**Tiêu chí hoàn thành / test độc lập:**
- Tra cứu nhật ký theo 1 tài khoản/1 khoảng thời gian → trả về đúng các hành động đã xảy ra từ các Phase trước.
- Xem danh sách trùng lặp toàn hệ thống → đúng với các cảnh báo đã phát sinh từ Phase 1.
- (Sau khi có xác nhận quyền cụ thể) Admin bật/tắt 1 quyền cho 1 tài khoản Quản lý → hành vi tài khoản đó thay đổi đúng theo.

**Giá trị đưa vào dùng ngay:** Tăng khả năng kiểm soát nội bộ và minh bạch — không chặn các nghiệp vụ chính đã vận hành từ các Phase trước.

---

## 2. Ma trận phụ thuộc (kiểm tra chéo — không có phụ thuộc ngược)

```
Phase 0 ← (không phụ thuộc)
Phase 1 ← 0
Phase 2 ← 0, 1
Phase 3 ← 0, 1, 2
Phase 4 ← 0, 1, 2, 3
Phase 5 ← 0, 1, 2, 3, 4
Phase 6 ← 0, 1, 2                  (độc lập với 3, 4, 5)
Phase 7 ← 0, 1, 2, 3, 4, 5, 6      (đọc dữ liệu, không tạo phụ thuộc ngược)
Phase 8 ← 0, 1, 2, 3, 4            (độc lập với 5, 6, 7)
Phase 9 ← 0, 1                     (độc lập với 2–8)
```
Mọi mũi tên đều trỏ về Phase có số nhỏ hơn — không Phase nào yêu cầu Phase phía sau phải tồn tại trước mới chạy được, đúng yêu cầu đặt ra.

---

*Roadmap được xây dựng trên nền `docs/09` đến `docs/13` (Design Freeze). Không viết code, không mở rộng phạm vi nghiệp vụ/database/API ngoài những gì đã chốt.*
