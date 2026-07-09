# TÀI LIỆU THIẾT KẾ API — CRM TUYỂN DỤNG / CUNG ỨNG LAO ĐỘNG

> Tài liệu này được xây dựng dựa trên `docs/09-business-specification.md`, `docs/10-system-design.md`, `docs/11-database-design.md` và `docs/12-ui-design.md`.
> Phạm vi: **chỉ thiết kế danh sách REST API ở mức đặc tả** (method, URL, tham số, dữ liệu trả về, quyền sử dụng). Không viết code, không viết cú pháp JSON/ngôn ngữ lập trình cụ thể — các trường dữ liệu được mô tả dưới dạng bảng.
> Không thiết kế API nào ngoài phạm vi nghiệp vụ đã xác nhận (vd: không có API xuất Excel, không có API cho module HR — vì chưa có nghiệp vụ, theo đúng tài liệu 09 Mục 11 và 12 Mục 6).

---

## 0. Quy ước chung

- **Xác thực:** mọi API (trừ `POST /login`) yêu cầu gửi kèm token phiên đăng nhập trong header Authorization; token được cấp sau khi đăng nhập thành công (Mục 10, tài liệu 09).
- **Phân trang (áp dụng cho các API danh sách):** tham số `page`, `page_size`; kết quả trả về kèm `total`, `page`, `page_size`, `items`.
- **Định dạng lỗi chung:** mã lỗi HTTP (400/401/403/404/409...) kèm `error_code` và `message` mô tả lý do.
- **Giới hạn phạm vi dữ liệu:** với mọi API danh sách/tìm kiếm, hệ thống tự động lọc dữ liệu theo phạm vi quyền của tài khoản đang gọi API (Sale: lead của mình + chăm sóc nhóm mình; Leader: cả nhóm; Quản lý/Admin: toàn bộ) — theo đúng Mục 8, tài liệu 09. Phần "Quyền sử dụng" ở mỗi API chỉ nêu **vai trò nào được gọi**, phạm vi dữ liệu trả về áp dụng ngầm định theo quy tắc này.

### 0.1. Các đối tượng dữ liệu dùng chung (tham chiếu — không phải bảng CSDL)

Để tránh lặp lại, các API bên dưới sẽ tham chiếu tới các "đối tượng chuẩn" sau khi mô tả dữ liệu trả về:

**Account:** id, full_name, username, role, team_id, team_name, status, created_at, updated_at *(không bao giờ trả về mật khẩu)*

**Team:** id, name, leader_id, leader_name, member_count, created_at

**Candidate:** id, full_name, phone_number, birth_year, address, source (id, name), mkt_note, data_quality_score, uploaded_by (id, name), uploaded_at, assigned_to (id, name), assigned_team_id, assigned_at, assignment_method, call_status (id, name), call_result (id, name), is_held, held_by (id, name), held_at, last_activity_at, entered_care_pool_at, care_pool_locked_by (id, name), is_duplicate_flagged, created_at, updated_at

**Note:** id, lead_id, created_by (id, name), content, call_status (id, name), call_result (id, name), created_at, is_deleted

**Interview:** id, lead_id, attempt_no, partner_company_name, scheduled_at, status (id, name), employment_status (id, name, có thể rỗng), employment_reason, created_by (id, name), created_at

**Callback:** id, lead_id, scheduled_at, is_completed, created_by (id, name), created_at

**DistributionRule:** id, team_id, is_active, last_assigned_position, members (danh sách account id + name + thứ tự)

**Notification:** id, account_id, lead_id, type, channel, scheduled_at, sent_at, status

**Config:** key, value, description, updated_by, updated_at

**AuditLog:** id, account_id (id, name), action_type, entity_type, entity_id, field_changed, old_value, new_value, created_at

**Permission:** id, code, name, description

---

## 1. Xác thực (Auth)

### POST /login
- **Mô tả:** Đăng nhập bằng tài khoản/mật khẩu do Admin cấp.
- **Quyền sử dụng:** Tất cả vai trò (chưa cần đăng nhập).
- **Request:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| username | string | Có | Tên đăng nhập |
| password | string | Có | Mật khẩu |
- **Response:** token phiên đăng nhập + đối tượng `Account` của người vừa đăng nhập.

### POST /logout
- **Mô tả:** Đăng xuất phiên hiện tại.
- **Quyền sử dụng:** Tất cả vai trò đã đăng nhập.
- **Request:** không có tham số (dựa vào token trong header).
- **Response:** xác nhận đăng xuất thành công.

### GET /me
- **Mô tả:** Lấy thông tin tài khoản đang đăng nhập, kèm danh sách quyền hiện có.
- **Quyền sử dụng:** Tất cả vai trò đã đăng nhập.
- **Request:** không có tham số.
- **Response:** đối tượng `Account` + danh sách `Permission` đang được cấp (áp dụng với Quản lý/Leader).

---

## 2. Tài khoản & Phân quyền (Account)

### GET /account
- **Mô tả:** Danh sách tài khoản nhân viên.
- **Quyền sử dụng:** Admin.
- **Request (query):** page, page_size, role (lọc theo vai trò), team_id (lọc theo nhóm), status (active/inactive).
- **Response:** danh sách đối tượng `Account` (có phân trang).

### POST /account
- **Mô tả:** Tạo tài khoản nhân viên mới.
- **Quyền sử dụng:** Admin.
- **Request (body):**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| full_name | string | Có | Họ tên |
| username | string | Có | Tên đăng nhập (duy nhất) |
| role | enum | Có | admin / manager / leader / mkt / sale |
| team_id | uuid | Không | Bắt buộc nếu role = leader hoặc sale |
- **Response:** đối tượng `Account` vừa tạo (mật khẩu mặc định được cấp, không trả về trong response — thông báo riêng qua kênh bàn giao nội bộ).

### GET /account/:id
- **Mô tả:** Xem chi tiết 1 tài khoản.
- **Quyền sử dụng:** Admin.
- **Request:** path param `id`.
- **Response:** đối tượng `Account`.

### PUT /account/:id
- **Mô tả:** Sửa thông tin tài khoản — bao gồm cả trường hợp đổi tên/bàn giao tài khoản cho nhân viên mới khi có người nghỉ việc (Mục 10, tài liệu 09).
- **Quyền sử dụng:** Admin.
- **Request (body):** full_name, team_id, status — các trường có thể sửa.
- **Response:** đối tượng `Account` sau khi cập nhật.

### DELETE /account/:id
- **Mô tả:** Vô hiệu hóa tài khoản (xóa mềm — chuyển status = inactive, theo nguyên tắc bảo toàn dữ liệu lịch sử tại Mục 5, tài liệu 11).
- **Quyền sử dụng:** Admin.
- **Request:** path param `id`.
- **Response:** xác nhận đã vô hiệu hóa.

### POST /account/:id/reset-password
- **Mô tả:** Reset mật khẩu tài khoản về mặc định ("123456").
- **Quyền sử dụng:** Admin (**duy nhất** — Leader và Quản lý không có quyền này, theo Mục 8, tài liệu 09).
- **Request:** path param `id`.
- **Response:** xác nhận đã reset.

### PUT /account/:id/permission
- **Mô tả:** Cấu hình danh sách quyền cụ thể (bật/tắt) cho tài khoản Quản lý/Leader.
- **Quyền sử dụng:** Admin.
- **Request (body):** danh sách các cặp `permission_id` + `is_granted`.
- **Response:** danh sách `Permission` hiện tại của tài khoản kèm trạng thái bật/tắt.

### GET /permission
- **Mô tả:** Danh mục toàn bộ các quyền có thể cấu hình trong hệ thống.
- **Quyền sử dụng:** Admin.
- **Request:** không có tham số.
- **Response:** danh sách đối tượng `Permission`.

---

## 3. Nhóm (Team)

### GET /team
- **Mô tả:** Danh sách các nhóm sale.
- **Quyền sử dụng:** Admin, Quản lý (xem tất cả); Leader (xem nhóm mình).
- **Request (query):** page, page_size.
- **Response:** danh sách đối tượng `Team`.

### POST /team
- **Mô tả:** Tạo nhóm mới (phục vụ khi công ty mở rộng thêm nhóm/leader mới).
- **Quyền sử dụng:** Admin.
- **Request (body):** name, leader_id (không bắt buộc — có thể gán sau).
- **Response:** đối tượng `Team` vừa tạo.

### PUT /team/:id
- **Mô tả:** Sửa tên nhóm hoặc gán/đổi leader phụ trách.
- **Quyền sử dụng:** Admin.
- **Request (body):** name, leader_id.
- **Response:** đối tượng `Team` sau cập nhật.

### GET /team/:id/member
- **Mô tả:** Danh sách nhân viên (sale) thuộc 1 nhóm, kèm khối lượng lead đang phụ trách (phục vụ màn hình Leader — Mục 5, tài liệu 12).
- **Quyền sử dụng:** Admin, Quản lý, Leader (nhóm mình).
- **Request:** path param `id`.
- **Response:** danh sách `Account` kèm `assigned_count` (số lead đang phụ trách) và `care_pool_count`.

---

## 4. Ứng viên/Lead (Candidate)

### GET /candidate
- **Mô tả:** Danh sách ứng viên — API lõi phục vụ màn hình Candidate (Mục 2, tài liệu 12), có đầy đủ bộ lọc theo Mục 8, tài liệu 09.
- **Quyền sử dụng:** Tất cả vai trò (phạm vi dữ liệu tự giới hạn theo quyền).
- **Request (query):** page, page_size, keyword (tìm theo tên/SĐT), call_status_id, call_result_id, interview_status_id, employment_status_id, source_id, assigned_to, team_id, partner_company_name, date_from, date_to, is_duplicate_flagged, is_pending (chờ phân chia).
- **Response:** danh sách đối tượng `Candidate` (có phân trang).

### POST /candidate
- **Mô tả:** Tạo mới 1 ứng viên (nhập tay).
- **Quyền sử dụng:** MKT.
- **Request (body):**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| full_name | string | Có | Tên lao động |
| phone_number | string | Có | SĐT — hệ thống kiểm tra trùng nhưng vẫn cho lưu |
| source_id | uuid | Có | Nguồn kênh |
| mkt_note | string | Không | Ghi chú MKT |
- **Response:** đối tượng `Candidate` vừa tạo, kèm cảnh báo `duplicate_warning` (nếu trùng SĐT — gồm danh sách ngày/nhân viên đã trùng, theo đúng Mục 10, tài liệu 09).

### POST /candidate/import
- **Mô tả:** Import hàng loạt ứng viên từ file Excel. **[Làm rõ sau Design Review]** Với batch lớn (có thể tới hàng nghìn dòng — Mục 9, tài liệu 09 ghi nhận ~20.000 dòng data cũ), API xử lý **bất đồng bộ**: nhận file, đẩy vào hàng đợi worker, trả về ngay `job_id` thay vì chờ xử lý xong trong cùng 1 request (tránh timeout).
- **Quyền sử dụng:** MKT.
- **Request (body):** file Excel đính kèm.
- **Response:** `job_id` để tra cứu tiến độ qua `GET /candidate/import/:jobId`.

### GET /candidate/import/:jobId
- **Mô tả:** **[Bổ sung sau Design Review]** Tra cứu tiến độ/kết quả 1 lần import đã submit.
- **Quyền sử dụng:** MKT (người đã submit job đó).
- **Request:** path param `jobId`.
- **Response:** trạng thái (đang xử lý/hoàn tất/lỗi), tổng số dòng, số dòng thành công, số dòng lỗi (kèm lý do), số dòng trùng SĐT phát hiện.

### GET /candidate/:id
- **Mô tả:** Xem chi tiết 1 ứng viên.
- **Quyền sử dụng:** Tất cả vai trò (nếu nằm trong phạm vi được xem).
- **Request:** path param `id`.
- **Response:** đối tượng `Candidate` đầy đủ.

### PUT /candidate/:id
- **Mô tả:** Sửa thông tin cơ bản của ứng viên (tên, năm sinh, địa chỉ, ghi chú...).
- **Quyền sử dụng:** MKT (chỉ data do mình upload), Sale (lead của mình/đang chăm sóc), Leader (nhóm mình), Quản lý, Admin.
- **Request (body):** các trường thông tin cần sửa.
- **Response:** đối tượng `Candidate` sau cập nhật.

### DELETE /candidate/:id
- **Mô tả:** Xóa ứng viên (xóa mềm).
- **Quyền sử dụng:** Admin (duy nhất — theo Mục 8, tài liệu 09); MKT chỉ được xóa data do chính mình upload thông qua API này với kiểm tra quyền sở hữu.
- **Request:** path param `id`.
- **Response:** xác nhận đã xóa.

### GET /candidate/pending
- **Mô tả:** Danh sách ứng viên đang ở trạng thái "Chờ phân chia".
- **Quyền sử dụng:** MKT, Leader, Quản lý, Admin.
- **Request (query):** page, page_size, source_id, date_from, date_to.
- **Response:** danh sách đối tượng `Candidate`.

### GET /candidate/duplicate
- **Mô tả:** Danh sách các nhóm ứng viên bị trùng SĐT.
- **Quyền sử dụng:** MKT, Quản lý, Admin (toàn hệ thống); Sale/Leader (chỉ thấy trùng trong phạm vi nhóm mình — theo Mục 10, tài liệu 09).
- **Request (query):** page, page_size, team_id.
- **Response:** danh sách nhóm trùng, mỗi nhóm gồm `phone_number` + danh sách các đối tượng `Candidate` liên quan.

---

## 5. Phân chia & Cột chăm sóc

### POST /candidate/:id/assign
- **Mô tả:** Gán 1 ứng viên cho 1 sale cụ thể (phân chia thủ công).
- **Quyền sử dụng:** Leader (nhóm mình).
- **Request (body):** account_id (sale nhận lead).
- **Response:** đối tượng `Candidate` sau khi gán.

### POST /candidate/assign-bulk
- **Mô tả:** Gán nhiều ứng viên cùng lúc cho 1 sale.
- **Quyền sử dụng:** Leader (nhóm mình).
- **Request (body):** danh sách `candidate_id` + `account_id`.
- **Response:** số lượng đã gán thành công.

### POST /candidate/:id/transfer
- **Mô tả:** Chuyển ứng viên đang thuộc sale này sang sale khác trong nhóm (vd khi có vấn đề nhân sự — Mục 3, tài liệu 09).
- **Quyền sử dụng:** Leader (nhóm mình).
- **Request (body):** new_account_id, reason (không bắt buộc).
- **Response:** đối tượng `Candidate` sau khi chuyển.

### POST /candidate/:id/hold
- **Mô tả:** Đánh dấu "giữ số" — loại trừ khỏi cơ chế tự động vào cột chăm sóc.
- **Quyền sử dụng:** Sale (chỉ với lead của mình).
- **Request:** path param `id`.
- **Response:** đối tượng `Candidate` với `is_held = true`.

### DELETE /candidate/:id/hold
- **Mô tả:** Bỏ đánh dấu giữ số.
- **Quyền sử dụng:** Sale (chỉ với lead của mình).
- **Request:** path param `id`.
- **Response:** đối tượng `Candidate` với `is_held = false`.

### GET /distribution-rule/:teamId
- **Mô tả:** Xem cấu hình tự động phân chia (danh sách sale + thứ tự vòng quay) của 1 nhóm.
- **Quyền sử dụng:** Leader (nhóm mình), Quản lý, Admin.
- **Request:** path param `teamId`.
- **Response:** đối tượng `DistributionRule`.

### PUT /distribution-rule/:teamId
- **Mô tả:** Cập nhật danh sách sale tham gia và thứ tự vòng quay round-robin.
- **Quyền sử dụng:** Leader (nhóm mình).
- **Request (body):** danh sách `account_id` theo đúng thứ tự mong muốn.
- **Response:** đối tượng `DistributionRule` sau cập nhật.

### POST /distribution-rule/:teamId/activate
- **Mô tả:** Kích hoạt chế độ tự động phân chia cho nhóm.
- **Quyền sử dụng:** Leader (nhóm mình).
- **Request:** path param `teamId`.
- **Response:** đối tượng `DistributionRule` với `is_active = true`.

### POST /distribution-rule/:teamId/pause
- **Mô tả:** Tạm dừng chế độ tự động phân chia.
- **Quyền sử dụng:** Leader (nhóm mình).
- **Request:** path param `teamId`.
- **Response:** đối tượng `DistributionRule` với `is_active = false`.

### GET /care-pool
- **Mô tả:** Danh sách ứng viên đang ở cột chăm sóc.
- **Quyền sử dụng:** Sale, Leader, Quản lý, Admin (phạm vi theo nhóm, trừ Quản lý/Admin xem toàn bộ).
- **Request (query):** page, page_size, team_id.
- **Response:** danh sách đối tượng `Candidate` (chỉ các bản ghi có `entered_care_pool_at` khác rỗng và chưa bị Admin gỡ), kèm thông tin `locked_by` nếu đang có người xử lý.

### POST /care-pool/:id/lock
- **Mô tả:** Chiếm quyền xử lý 1 ứng viên trong cột chăm sóc.
- **Quyền sử dụng:** Sale (cùng nhóm với lead đó).
- **Request:** path param `id`.
- **Response:** thành công (kèm `locked_by`, `locked_at`) hoặc báo lỗi 409 nếu đã có người khác đang khóa — kèm tên người đang xử lý (phục vụ thông báo "Sale ... đang xử lý", Mục 4, tài liệu 09).

### POST /care-pool/:id/release
- **Mô tả:** Giải phóng khóa xử lý (khi hoàn tất hoặc thoát giữa chừng).
- **Quyền sử dụng:** Sale (người đang giữ khóa).
- **Request:** path param `id`.
- **Response:** xác nhận đã giải phóng.

### DELETE /care-pool/:id
- **Mô tả:** Gỡ 1 ứng viên khỏi danh sách cột chăm sóc (không phải xóa ứng viên).
- **Quyền sử dụng:** Admin (duy nhất — theo Mục 4, tài liệu 09).
- **Request:** path param `id`.
- **Response:** xác nhận đã gỡ khỏi cột chăm sóc.

---

## 6. Ghi chú, Lịch phỏng vấn, Lịch gọi lại

### PUT /candidate/:id/call-status
- **Mô tả:** Cập nhật tình trạng cuộc gọi (đã gọi/chưa gọi/không nghe máy/thuê bao).
- **Quyền sử dụng:** Sale (lead của mình/đang chăm sóc), Leader, Quản lý, Admin.
- **Request (body):** call_status_id.
- **Response:** đối tượng `Candidate` sau cập nhật.

### PUT /candidate/:id/call-result
- **Mô tả:** Cập nhật kết quả cuộc gọi (tiềm năng/không tiềm năng/đang cân nhắc/hẹn gọi lại).
- **Quyền sử dụng:** Sale, Leader, Quản lý, Admin.
- **Request (body):** call_result_id.
- **Response:** đối tượng `Candidate` sau cập nhật.

### POST /candidate/:id/note
- **Mô tả:** Thêm ghi chú/lịch sử cuộc gọi mới cho ứng viên.
- **Quyền sử dụng:** Sale, Leader, Quản lý, Admin.
- **Request (body):** content.
- **Response:** đối tượng `Note` vừa tạo.

### GET /candidate/:id/note
- **Mô tả:** Xem toàn bộ lịch sử ghi chú của 1 ứng viên (kể cả note đã xóa — theo nguyên tắc lưu lịch sử tại Mục 10, tài liệu 09).
- **Quyền sử dụng:** Tất cả vai trò có quyền xem ứng viên đó (MKT chỉ xem, không sửa — theo Mục 2, tài liệu 09).
- **Request:** path param `id`; query: date_from, date_to.
- **Response:** danh sách đối tượng `Note`.

### DELETE /candidate/:id/note/:noteId
- **Mô tả:** Xóa 1 ghi chú (xóa mềm — đánh dấu `is_deleted`, dữ liệu vẫn được lưu).
- **Quyền sử dụng:** Sale (ghi chú của mình). **[Giả định — chưa xác nhận với chủ doanh nghiệp]** Tài liệu 09 (Mục 4.7) chỉ xác nhận "Sale có thể xóa note cũ", không nói rõ có được xóa note do sale khác ghi trên cùng 1 lead hay không (vd lead đang ở cột chăm sóc, có note của nhiều sale). Đã ghi nhận là điểm cần hỏi lại tại Mục 11, tài liệu 09.
- **Request:** path param `id`, `noteId`.
- **Response:** xác nhận đã xóa (mềm).

### POST /candidate/:id/interview
- **Mô tả:** Đặt lịch hẹn phỏng vấn mới (kể cả trường hợp hẹn lại sau khi bùng PV — hệ thống tự tăng `attempt_no`).
- **Quyền sử dụng:** Sale, Leader, Quản lý, Admin.
- **Request (body):**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| partner_company_name | string | Có | Công ty đối tác hẹn (nhập tự do) |
| scheduled_at | datetime | Có | Ngày giờ hẹn |
- **Response:** đối tượng `Interview` vừa tạo.

### GET /candidate/:id/interview
- **Mô tả:** Xem toàn bộ lịch sử các lần hẹn phỏng vấn của 1 ứng viên.
- **Quyền sử dụng:** Tất cả vai trò có quyền xem ứng viên đó.
- **Request:** path param `id`.
- **Response:** danh sách đối tượng `Interview`.

### PUT /interview/:id
- **Mô tả:** Cập nhật kết quả 1 lần hẹn phỏng vấn (đến/bùng PV, đỗ/trượt PV, đi làm/không đi làm kèm lý do).
- **Quyền sử dụng:** Sale, Leader, Quản lý, Admin.
- **Request (body):** status_id, employment_status_id (không bắt buộc), employment_reason (không bắt buộc — dùng khi đỗ PV nhưng không đi làm).
- **Response:** đối tượng `Interview` sau cập nhật.

### POST /candidate/:id/callback
- **Mô tả:** Đặt lịch gọi lại.
- **Quyền sử dụng:** Sale, Leader, Quản lý, Admin.
- **Request (body):** scheduled_at.
- **Response:** đối tượng `Callback` vừa tạo.

### PUT /callback/:id
- **Mô tả:** Cập nhật/đánh dấu hoàn tất lịch gọi lại.
- **Quyền sử dụng:** Sale (lịch của mình), Leader, Quản lý, Admin.
- **Request (body):** scheduled_at (nếu dời lịch), is_completed.
- **Response:** đối tượng `Callback` sau cập nhật.

---

## 7. Lịch tổng hợp & Thông báo

### GET /calendar
- **Mô tả:** Lấy danh sách lịch gọi lại + lịch hẹn phỏng vấn theo khoảng thời gian, phục vụ màn hình Lịch hẹn dạng calendar (Mục 10, tài liệu 09 và Mục 7, tài liệu 12).
- **Quyền sử dụng:** Tất cả vai trò (phạm vi theo quyền xem ứng viên).
- **Request (query):** date_from, date_to, team_id, account_id.
- **Response:** danh sách sự kiện gồm loại (callback/interview), thời gian, đối tượng `Candidate` liên quan rút gọn (id, full_name, phone_number).

### GET /notification
- **Mô tả:** Danh sách thông báo (Zalo) đã/sẽ gửi cho tài khoản đang đăng nhập.
- **Quyền sử dụng:** Tất cả vai trò đã đăng nhập (chỉ xem thông báo của chính mình).
- **Request (query):** page, page_size, status.
- **Response:** danh sách đối tượng `Notification`.

---

## 8. Dashboard & Báo cáo

### GET /dashboard/summary
- **Mô tả:** Số liệu tổng quan Dashboard (Mục 9, tài liệu 09): tổng lead mới theo nguồn, số lead chờ phân chia, phễu chuyển đổi, số lead ở cột chăm sóc.
- **Quyền sử dụng:** Tất cả vai trò (phạm vi theo quyền xem).
- **Request (query):** date_from, date_to, team_id.
- **Response:** các chỉ số tổng hợp theo đúng Mục 9, tài liệu 09.

### GET /dashboard/performance
- **Mô tả:** Hiệu suất từng Sale (số cuộc gọi, số lead tiềm năng, số đi làm).
- **Quyền sử dụng:** Leader (nhóm mình), Quản lý, Admin.
- **Request (query):** date_from, date_to, team_id.
- **Response:** danh sách hiệu suất theo từng `account_id`.

### GET /dashboard/by-team
- **Mô tả:** **[Bổ sung sau Design Review]** Số liệu tổng hợp theo từng nhóm trong 1 lần gọi — phục vụ "Bảng tổng hợp theo nhóm" trên Dashboard (Mục 1, tài liệu 12). Trước đó `GET /dashboard/summary` chỉ nhận 1 `team_id` mỗi lần gọi, không đủ để hiển thị bảng so sánh nhiều nhóm cùng lúc mà không gọi API lặp lại nhiều lần.
- **Quyền sử dụng:** Quản lý, Admin.
- **Request (query):** date_from, date_to.
- **Response:** danh sách theo từng `team_id` kèm số lead, tỷ lệ chuyển đổi, số lead ở cột chăm sóc.

### GET /report/funnel
- **Mô tả:** Chi tiết phễu chuyển đổi Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm, dùng cho màn hình Reports (Mục 8, tài liệu 12 — dùng chung engine với Dashboard).
- **Quyền sử dụng:** Leader, Quản lý, Admin.
- **Request (query):** date_from, date_to, team_id, account_id.
- **Response:** số lượng + tỷ lệ % ở từng bước phễu.

### GET /report/by-source
- **Mô tả:** Thống kê chuyển đổi theo từng nguồn kênh.
- **Quyền sử dụng:** Leader, Quản lý, Admin.
- **Request (query):** date_from, date_to, team_id.
- **Response:** danh sách theo `source_id` kèm số lead, tỷ lệ tiềm năng, tỷ lệ đi làm.

---

## 9. Cấu hình hệ thống, Nhật ký & Danh mục

### GET /config
- **Mô tả:** Lấy toàn bộ tham số cấu hình hệ thống hiện tại (vd ngưỡng thời gian vào cột chăm sóc).
- **Quyền sử dụng:** Admin.
- **Request:** không có tham số.
- **Response:** danh sách đối tượng `Config`.

### PUT /config/:key
- **Mô tả:** Cập nhật 1 tham số cấu hình hệ thống.
- **Quyền sử dụng:** Admin.
- **Request (body):** value.
- **Response:** đối tượng `Config` sau cập nhật.

### GET /audit-log
- **Mô tả:** Tra cứu nhật ký truy cập/thao tác toàn hệ thống.
- **Quyền sử dụng:** Admin, Quản lý.
- **Request (query):** page, page_size, account_id, action_type, entity_type, entity_id, date_from, date_to.
- **Response:** danh sách đối tượng `AuditLog`.

### GET /lead-source
- **Mô tả:** Danh mục nguồn kênh (Facebook/TikTok/Zalo/Khác).
- **Quyền sử dụng:** Tất cả vai trò đã đăng nhập.
- **Request:** không có tham số.
- **Response:** danh sách `{id, name}`.

### GET /status
- **Mô tả:** Danh mục trạng thái chuẩn hóa (tình trạng cuộc gọi, kết quả cuộc gọi, trạng thái PV, trạng thái đi làm) — dùng để tạo dropdown ở giao diện.
- **Quyền sử dụng:** Tất cả vai trò đã đăng nhập.
- **Request (query):** category (call_status / call_result / interview_status / employment_status).
- **Response:** danh sách `{id, category, code, name, sort_order}`.

---

## 10. Bảng tổng hợp toàn bộ API

| # | Method | URL | Module |
|---|---|---|---|
| 1 | POST | /login | Auth |
| 2 | POST | /logout | Auth |
| 3 | GET | /me | Auth |
| 4 | GET | /account | Account |
| 5 | POST | /account | Account |
| 6 | GET | /account/:id | Account |
| 7 | PUT | /account/:id | Account |
| 8 | DELETE | /account/:id | Account |
| 9 | POST | /account/:id/reset-password | Account |
| 10 | PUT | /account/:id/permission | Account |
| 11 | GET | /permission | Account |
| 12 | GET | /team | Team |
| 13 | POST | /team | Team |
| 14 | PUT | /team/:id | Team |
| 15 | GET | /team/:id/member | Team |
| 16 | GET | /candidate | Candidate |
| 17 | POST | /candidate | Candidate |
| 18 | POST | /candidate/import | Candidate |
| 19 | GET | /candidate/:id | Candidate |
| 20 | PUT | /candidate/:id | Candidate |
| 21 | DELETE | /candidate/:id | Candidate |
| 22 | GET | /candidate/pending | Candidate |
| 23 | GET | /candidate/duplicate | Candidate |
| 24 | POST | /candidate/:id/assign | Distribution |
| 25 | POST | /candidate/assign-bulk | Distribution |
| 26 | POST | /candidate/:id/transfer | Distribution |
| 27 | POST | /candidate/:id/hold | Distribution |
| 28 | DELETE | /candidate/:id/hold | Distribution |
| 29 | GET | /distribution-rule/:teamId | Distribution |
| 30 | PUT | /distribution-rule/:teamId | Distribution |
| 31 | POST | /distribution-rule/:teamId/activate | Distribution |
| 32 | POST | /distribution-rule/:teamId/pause | Distribution |
| 33 | GET | /care-pool | Care Pool |
| 34 | POST | /care-pool/:id/lock | Care Pool |
| 35 | POST | /care-pool/:id/release | Care Pool |
| 36 | DELETE | /care-pool/:id | Care Pool |
| 37 | PUT | /candidate/:id/call-status | Pipeline |
| 38 | PUT | /candidate/:id/call-result | Pipeline |
| 39 | POST | /candidate/:id/note | Pipeline |
| 40 | GET | /candidate/:id/note | Pipeline |
| 41 | DELETE | /candidate/:id/note/:noteId | Pipeline |
| 42 | POST | /candidate/:id/interview | Pipeline |
| 43 | GET | /candidate/:id/interview | Pipeline |
| 44 | PUT | /interview/:id | Pipeline |
| 45 | POST | /candidate/:id/callback | Pipeline |
| 46 | PUT | /callback/:id | Pipeline |
| 47 | GET | /calendar | Calendar |
| 48 | GET | /notification | Notification |
| 49 | GET | /dashboard/summary | Dashboard |
| 50 | GET | /dashboard/performance | Dashboard |
| 51 | GET | /report/funnel | Report |
| 52 | GET | /report/by-source | Report |
| 53 | GET | /config | System |
| 54 | PUT | /config/:key | System |
| 55 | GET | /audit-log | System |
| 56 | GET | /lead-source | Catalog |
| 57 | GET | /status | Catalog |
| 58 | GET | /candidate/import/:jobId | Candidate *(bổ sung sau Design Review)* |
| 59 | GET | /dashboard/by-team | Dashboard *(bổ sung sau Design Review)* |

---

*Tài liệu được xây dựng dựa trên `docs/09` đến `docs/12`. Không viết code — toàn bộ request/response được mô tả dưới dạng bảng đặc tả, không dùng cú pháp JSON/ngôn ngữ lập trình cụ thể.*
