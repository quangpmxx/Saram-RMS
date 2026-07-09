# TÀI LIỆU THIẾT KẾ DATABASE — CRM TUYỂN DỤNG / CUNG ỨNG LAO ĐỘNG

> Tài liệu này được xây dựng dựa trên `docs/09-business-specification.md` và `docs/10-system-design.md`.
> Phạm vi: **chỉ thiết kế cấu trúc dữ liệu ở mức khái niệm** (tên bảng, cột, kiểu dữ liệu mô tả, khóa, chỉ mục, quan hệ). Không viết câu lệnh SQL, không viết code, không thiết kế giao diện.
> Kiểu dữ liệu ghi ở dạng mô tả chung (UUID, VARCHAR, TEXT, INTEGER, BOOLEAN, TIMESTAMP, ENUM...) — mang tính khái niệm, không phải cú pháp của một hệ quản trị CSDL cụ thể.

---

## 1. Danh sách bảng

Tổng cộng **16 bảng**, chia theo 5 nhóm chức năng:

| Nhóm | Bảng | Mục đích |
|---|---|---|
| **Tài khoản & Phân quyền** | `teams` | Nhóm/đội sale, gắn với 1 leader |
| | `accounts` | Tài khoản nhân viên (Admin/Quản lý/Leader/MKT/Sale) |
| | `sessions` | Phiên đăng nhập (phục vụ đăng nhập nhiều thiết bị) |
| | `permissions` | Danh mục các quyền có thể cấu hình |
| | `account_permissions` | Quyền cụ thể được gán cho từng tài khoản (Quản lý/Leader) |
| **Danh mục dùng chung** | `lead_sources` | Danh mục nguồn kênh (Facebook/TikTok/Zalo/Khác) |
| | `status_catalog` | Danh mục trạng thái chuẩn hóa (cuộc gọi, PV, đi làm) |
| **Nghiệp vụ Lead (lõi)** | `leads` | Bảng trung tâm — thông tin & trạng thái hiện tại của ứng viên |
| | `lead_notes` | Lịch sử ghi chú/cuộc gọi của từng lead |
| | `interview_appointments` | Lịch sử các lần hẹn phỏng vấn của 1 lead |
| | `callback_schedules` | Lịch hẹn gọi lại |
| **Tự động hóa & Thông báo** | `auto_distribution_rules` | Cấu hình bật/tắt tự động phân chia theo nhóm |
| | `auto_distribution_members` | Danh sách + thứ tự sale tham gia vòng quay round-robin |
| | `notifications` | Hàng đợi thông báo (Zalo) |
| **Hệ thống & Nhật ký** | `system_configs` | Tham số cấu hình hệ thống (ngưỡng thời gian chăm sóc...) |
| | `audit_logs` | Nhật ký truy cập/thao tác toàn hệ thống |

> Các bảng có đánh dấu **(*)** ở Mục 8 là bảng được tự đề xuất bổ sung, không có tên gọi trực tiếp trong tài liệu nghiệp vụ nhưng cần thiết để hệ thống vận hành đúng.

---

## 2. Chi tiết cột từng bảng

Ký hiệu: 🔑 = Primary Key, 🔗 = Foreign Key.

### 2.1. `teams`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh nhóm |
| name | VARCHAR(100) | NOT NULL | Tên nhóm (vd: "Nhóm Leader A") |
| leader_id | UUID | 🔗 FK → accounts.id, NULLABLE, UNIQUE | Leader phụ trách nhóm |
| created_at | TIMESTAMP | NOT NULL | Ngày tạo nhóm |

### 2.2. `accounts`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh tài khoản |
| full_name | VARCHAR(150) | NOT NULL | Họ tên nhân viên (có thể đổi khi bàn giao tài khoản) |
| username | VARCHAR(50) | NOT NULL, UNIQUE | Tên đăng nhập |
| password_hash | VARCHAR(255) | NOT NULL | Mật khẩu đã mã hóa |
| role | ENUM('admin','manager','leader','mkt','sale') | NOT NULL | Vai trò — mỗi tài khoản đúng 1 vai trò |
| team_id | UUID | 🔗 FK → teams.id, NULLABLE | Nhóm trực thuộc (áp dụng cho leader/sale; NULL với admin/manager/mkt) |
| status | ENUM('active','inactive') | NOT NULL, DEFAULT 'active' | Trạng thái hoạt động của tài khoản |
| created_by | UUID | 🔗 FK → accounts.id, NULLABLE | Admin đã tạo tài khoản này |
| created_at | TIMESTAMP | NOT NULL | Ngày tạo |
| updated_at | TIMESTAMP | NOT NULL | Lần cập nhật gần nhất (đổi tên khi bàn giao...) |

### 2.3. `sessions` (*)
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh phiên đăng nhập |
| account_id | UUID | 🔗 FK → accounts.id, NOT NULL | Tài khoản đăng nhập |
| device_info | VARCHAR(255) | NULLABLE | Thông tin thiết bị/trình duyệt |
| created_at | TIMESTAMP | NOT NULL | Thời điểm đăng nhập |
| last_active_at | TIMESTAMP | NOT NULL | Hoạt động gần nhất trong phiên |
| revoked_at | TIMESTAMP | NULLABLE | Thời điểm phiên bị hủy (đăng xuất/thu hồi) |

### 2.4. `permissions` (*)
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh quyền |
| code | VARCHAR(50) | NOT NULL, UNIQUE | Mã quyền (vd: ADD_EMPLOYEE, DELETE_LEAD, EDIT_SYSTEM_CONFIG) |
| name | VARCHAR(150) | NOT NULL | Tên hiển thị |
| description | VARCHAR(255) | NULLABLE | Mô tả quyền |

### 2.5. `account_permissions`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh |
| account_id | UUID | 🔗 FK → accounts.id, NOT NULL | Tài khoản được cấu hình quyền |
| permission_id | UUID | 🔗 FK → permissions.id, NOT NULL | Quyền cụ thể |
| is_granted | BOOLEAN | NOT NULL, DEFAULT false | Bật/tắt quyền này cho tài khoản |
| updated_by | UUID | 🔗 FK → accounts.id, NOT NULL | Admin đã cấu hình |
| updated_at | TIMESTAMP | NOT NULL | Lần cấu hình gần nhất |

Ràng buộc duy nhất: `(account_id, permission_id)` không được trùng lặp.

### 2.6. `lead_sources`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh nguồn |
| name | VARCHAR(50) | NOT NULL, UNIQUE | Facebook / TikTok / Zalo / Khác |

### 2.7. `status_catalog`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh trạng thái |
| category | ENUM('call_status','call_result','interview_status','employment_status') | NOT NULL | Nhóm trạng thái |
| code | VARCHAR(50) | NOT NULL | Mã trạng thái (vd: NOT_ANSWERED, POTENTIAL, PASSED_INTERVIEW) |
| name | VARCHAR(100) | NOT NULL | Tên hiển thị tiếng Việt |
| sort_order | SMALLINT | NOT NULL, DEFAULT 0 | Thứ tự hiển thị |

Ràng buộc duy nhất: `(category, code)`.

Dữ liệu khởi tạo dự kiến (không phải bảng riêng, chỉ liệt kê để tham chiếu tài liệu 09 – Mục 7):
- `call_status`: Đã gọi, Chưa gọi, Không nghe máy, Thuê bao
- `call_result`: Tiềm năng, Không tiềm năng, Đang cân nhắc, Hẹn gọi lại
- `interview_status`: Đã hẹn PV, Đến PV, Bùng PV, Đỗ PV, Trượt PV
- `employment_status`: Đã đi làm, Không đi làm

### 2.8. `leads` (bảng trung tâm)
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh lead |
| full_name | VARCHAR(150) | NOT NULL | Tên lao động |
| phone_number | VARCHAR(20) | NOT NULL | SĐT — **không đặt UNIQUE** vì nghiệp vụ cho phép trùng, chỉ cảnh báo |
| birth_year | SMALLINT | NULLABLE | Năm sinh |
| address | VARCHAR(255) | NULLABLE | Địa chỉ/quê quán |
| source_id | UUID | 🔗 FK → lead_sources.id, NOT NULL | Nguồn kênh |
| mkt_note | TEXT | NULLABLE | Ghi chú của MKT lúc up data |
| data_quality_score | SMALLINT | NULLABLE | Chất lượng data (thang điểm số, tự đánh giá) |
| uploaded_by | UUID | 🔗 FK → accounts.id, NOT NULL | MKT đã nhập/import lead này |
| uploaded_at | TIMESTAMP | NOT NULL | Thời điểm up data |
| assigned_to | UUID | 🔗 FK → accounts.id, NULLABLE | Sale đang phụ trách (NULL = đang "Chờ phân chia") |
| assigned_team_id | UUID | 🔗 FK → teams.id, NULLABLE | Nhóm sở hữu lead (denormalize từ `assigned_to` — xem Mục 7) |
| assigned_at | TIMESTAMP | NULLABLE | Thời điểm được phân chia |
| assignment_method | ENUM('manual','auto') | NULLABLE | Cách thức phân chia |
| call_status_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | Tình trạng cuộc gọi hiện tại |
| call_result_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | Kết quả cuộc gọi hiện tại |
| current_interview_status_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | **[Bổ sung sau Design Review]** Trạng thái PV hiện tại — snapshot từ dòng `interview_appointments` mới nhất của lead (xem Mục 7.2, lý do denormalize) |
| current_employment_status_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | **[Bổ sung sau Design Review]** Trạng thái đi làm hiện tại — snapshot từ dòng `interview_appointments` mới nhất |
| current_partner_company_name | VARCHAR(150) | NULLABLE | **[Bổ sung sau Design Review]** Công ty đối tác của lần hẹn PV gần nhất — snapshot phục vụ lọc nhanh trên danh sách Candidate |
| is_held | BOOLEAN | NOT NULL, DEFAULT false | Đánh dấu "giữ số" |
| held_by | UUID | 🔗 FK → accounts.id, NULLABLE | Sale đã giữ số |
| held_at | TIMESTAMP | NULLABLE | Thời điểm giữ số |
| last_activity_at | TIMESTAMP | NULLABLE | Thời điểm xử lý gần nhất — dùng để tính ngưỡng vào cột chăm sóc |
| entered_care_pool_at | TIMESTAMP | NULLABLE | Thời điểm lead tự động vào cột chăm sóc (once set, tồn tại vĩnh viễn) |
| care_pool_locked_by | UUID | 🔗 FK → accounts.id, NULLABLE | Sale đang khóa xử lý trong cột chăm sóc |
| care_pool_locked_at | TIMESTAMP | NULLABLE | Thời điểm chiếm khóa |
| removed_from_care_pool_by | UUID | 🔗 FK → accounts.id, NULLABLE | Admin đã gỡ khỏi danh sách chăm sóc (nếu có) |
| removed_from_care_pool_at | TIMESTAMP | NULLABLE | Thời điểm gỡ |
| is_duplicate_flagged | BOOLEAN | NOT NULL, DEFAULT false | Cờ đánh dấu có trùng SĐT với lead khác (tính lại mỗi khi có data mới trùng) |
| created_at | TIMESTAMP | NOT NULL | Ngày tạo bản ghi |
| updated_at | TIMESTAMP | NOT NULL | Lần cập nhật gần nhất |
| deleted_at | TIMESTAMP | NULLABLE | Xóa mềm — chỉ Admin thực hiện (xem Mục 7) |
| deleted_by | UUID | 🔗 FK → accounts.id, NULLABLE | Admin đã xóa |

### 2.9. `lead_notes`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh ghi chú |
| lead_id | UUID | 🔗 FK → leads.id, NOT NULL | Lead liên quan |
| created_by | UUID | 🔗 FK → accounts.id, NOT NULL | Người ghi chú (Sale) |
| content | TEXT | NOT NULL | Nội dung ghi chú/cuộc gọi |
| call_status_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | Snapshot tình trạng cuộc gọi tại thời điểm ghi |
| call_result_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | Snapshot kết quả cuộc gọi tại thời điểm ghi |
| created_at | TIMESTAMP | NOT NULL | Thời điểm ghi |
| is_deleted | BOOLEAN | NOT NULL, DEFAULT false | Đánh dấu đã xóa (xóa mềm — vẫn lưu lịch sử) |
| deleted_by | UUID | 🔗 FK → accounts.id, NULLABLE | Người xóa |
| deleted_at | TIMESTAMP | NULLABLE | Thời điểm xóa |

### 2.10. `interview_appointments`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh lịch hẹn |
| lead_id | UUID | 🔗 FK → leads.id, NOT NULL | Lead liên quan |
| attempt_no | SMALLINT | NOT NULL, DEFAULT 1 | Lần hẹn thứ mấy (phục vụ trường hợp bùng PV, hẹn lại) |
| partner_company_name | VARCHAR(150) | NOT NULL | Công ty đối tác hẹn PV (nhập tự do — xem Mục 7) |
| scheduled_at | TIMESTAMP | NOT NULL | Ngày giờ hẹn phỏng vấn |
| status_id | UUID | 🔗 FK → status_catalog.id, NOT NULL | Trạng thái PV (đã hẹn/đến/bùng/đỗ/trượt) |
| employment_status_id | UUID | 🔗 FK → status_catalog.id, NULLABLE | Kết quả đi làm (chỉ có giá trị nếu đỗ PV) |
| employment_reason | TEXT | NULLABLE | Lý do không đi làm (nếu có) |
| created_by | UUID | 🔗 FK → accounts.id, NOT NULL | Sale đã tạo lịch hẹn |
| created_at | TIMESTAMP | NOT NULL | Ngày tạo |
| updated_at | TIMESTAMP | NOT NULL | Cập nhật gần nhất |

### 2.11. `callback_schedules`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh lịch gọi lại |
| lead_id | UUID | 🔗 FK → leads.id, NOT NULL | Lead liên quan |
| scheduled_at | TIMESTAMP | NOT NULL | Thời điểm cần gọi lại |
| is_completed | BOOLEAN | NOT NULL, DEFAULT false | Đã xử lý xong hay chưa |
| created_by | UUID | 🔗 FK → accounts.id, NOT NULL | Sale đã đặt lịch |
| created_at | TIMESTAMP | NOT NULL | Ngày tạo |

### 2.12. `auto_distribution_rules`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh cấu hình |
| team_id | UUID | 🔗 FK → teams.id, NOT NULL, UNIQUE | Nhóm áp dụng (1 nhóm chỉ có 1 cấu hình) |
| is_active | BOOLEAN | NOT NULL, DEFAULT false | Đang bật/tạm dừng |
| last_assigned_position | SMALLINT | NOT NULL, DEFAULT 0 | Con trỏ vị trí kế tiếp trong vòng quay round-robin |
| created_by | UUID | 🔗 FK → accounts.id, NOT NULL | Leader đã cấu hình |
| updated_at | TIMESTAMP | NOT NULL | Cập nhật gần nhất |

### 2.13. `auto_distribution_members`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh |
| rule_id | UUID | 🔗 FK → auto_distribution_rules.id, NOT NULL | Cấu hình thuộc về |
| account_id | UUID | 🔗 FK → accounts.id, NOT NULL | Sale tham gia vòng quay |
| order_index | SMALLINT | NOT NULL | Thứ tự trong vòng quay |

Ràng buộc duy nhất: `(rule_id, order_index)` và `(rule_id, account_id)`.

### 2.14. `notifications` (*)
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh thông báo |
| account_id | UUID | 🔗 FK → accounts.id, NOT NULL | Người nhận |
| lead_id | UUID | 🔗 FK → leads.id, NULLABLE | Lead liên quan (nếu có) |
| type | ENUM('callback_reminder','interview_reminder') | NOT NULL | Loại thông báo |
| channel | ENUM('zalo') | NOT NULL, DEFAULT 'zalo' | Kênh gửi |
| scheduled_at | TIMESTAMP | NOT NULL | Thời điểm cần gửi |
| sent_at | TIMESTAMP | NULLABLE | Thời điểm đã gửi thực tế |
| status | ENUM('pending','sent','failed') | NOT NULL, DEFAULT 'pending' | Trạng thái gửi |
| created_at | TIMESTAMP | NOT NULL | Ngày tạo |

### 2.15. `system_configs`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh |
| config_key | VARCHAR(100) | NOT NULL, UNIQUE | Tên tham số (vd: CARE_POOL_THRESHOLD_MINUTES) |
| config_value | VARCHAR(255) | NOT NULL | Giá trị (vd: "30") |
| description | VARCHAR(255) | NULLABLE | Mô tả tham số |
| updated_by | UUID | 🔗 FK → accounts.id, NOT NULL | Admin đã cập nhật |
| updated_at | TIMESTAMP | NOT NULL | Lần cập nhật gần nhất |

### 2.16. `audit_logs`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | UUID | 🔑 PK | Định danh nhật ký |
| account_id | UUID | 🔗 FK → accounts.id, NOT NULL | Người thực hiện hành động |
| action_type | ENUM('view','create','update','delete','assign','transfer','hold','lock','unlock','login','logout','reset_password') | NOT NULL | Loại hành động |
| entity_type | VARCHAR(50) | NOT NULL | Đối tượng tác động (vd: "lead", "account") |
| entity_id | UUID | NULLABLE | ID của đối tượng bị tác động |
| field_changed | VARCHAR(100) | NULLABLE | Trường dữ liệu thay đổi (nếu là update) |
| old_value | TEXT | NULLABLE | Giá trị cũ |
| new_value | TEXT | NULLABLE | Giá trị mới |
| created_at | TIMESTAMP | NOT NULL | Thời điểm hành động |

---

## 3. Quan hệ giữa các bảng

### 3.1. Mô tả quan hệ chính (dạng chữ)

```
teams (1) ────────────── (N) accounts            [1 nhóm có nhiều sale; accounts.team_id → teams.id]
accounts (1) ─────────── (1) teams                [1 leader phụ trách 1 nhóm; teams.leader_id → accounts.id]
accounts (1) ─────────── (N) sessions             [1 tài khoản có nhiều phiên đăng nhập – hỗ trợ đa thiết bị]
accounts (N) ──────────── (N) permissions          [qua bảng trung gian account_permissions]

lead_sources (1) ──────── (N) leads               [1 nguồn có nhiều lead]
accounts (1) ──────────── (N) leads (uploaded_by) [1 MKT tạo nhiều lead]
accounts (1) ──────────── (N) leads (assigned_to) [1 sale được giao nhiều lead]
teams (1) ─────────────── (N) leads (assigned_team_id) [1 nhóm sở hữu nhiều lead]
status_catalog (1) ────── (N) leads (call_status_id, call_result_id)

leads (1) ─────────────── (N) lead_notes          [1 lead có nhiều ghi chú/lịch sử cuộc gọi]
leads (1) ─────────────── (N) interview_appointments [1 lead có thể có nhiều lần hẹn PV — do bùng PV được hẹn lại]
leads (1) ─────────────── (N) callback_schedules  [1 lead có nhiều lịch gọi lại theo thời gian]
status_catalog (1) ────── (N) interview_appointments (status_id, employment_status_id)

teams (1) ─────────────── (1) auto_distribution_rules [1 nhóm có tối đa 1 cấu hình tự động phân chia]
auto_distribution_rules (1) ─ (N) auto_distribution_members [1 cấu hình có nhiều sale tham gia vòng quay]

accounts (1) ──────────── (N) notifications        [1 tài khoản nhận nhiều thông báo]
leads (1) ─────────────── (N) notifications        [1 lead có thể phát sinh nhiều thông báo]

accounts (1) ──────────── (N) audit_logs           [1 tài khoản thực hiện nhiều hành động được ghi log]
```

### 3.2. Lưu ý về quan hệ vòng (circular reference)

`teams.leader_id` tham chiếu đến `accounts.id`, trong khi `accounts.team_id` lại tham chiếu ngược đến `teams.id`. Đây là quan hệ vòng hợp lệ trong mô hình quan hệ (2 bảng tham chiếu lẫn nhau), cần lưu ý khi khởi tạo dữ liệu: tạo `teams` trước với `leader_id = NULL`, sau đó tạo tài khoản Leader và cập nhật lại `teams.leader_id`, hoặc cho phép `leader_id` NULLABLE như đã thiết kế.

### 3.3. Bảng trung gian (Many-to-Many)

| Bảng trung gian | Kết nối | Mục đích |
|---|---|---|
| `account_permissions` | `accounts` ↔ `permissions` | Cho phép 1 tài khoản có nhiều quyền tùy chỉnh, 1 quyền áp dụng cho nhiều tài khoản (đáp ứng yêu cầu Admin tick chọn quyền riêng cho từng Quản lý/Leader) |
| `auto_distribution_members` | `auto_distribution_rules` ↔ `accounts` | Cho phép 1 cấu hình vòng quay gồm nhiều sale, và về lý thuyết 1 sale có thể xuất hiện trong lịch sử nhiều cấu hình (dù thực tế chỉ thuộc 1 nhóm tại 1 thời điểm) |

---

## 4. Tổng hợp Primary Key

| Bảng | Primary Key |
|---|---|
| teams | id |
| accounts | id |
| sessions | id |
| permissions | id |
| account_permissions | id |
| lead_sources | id |
| status_catalog | id |
| leads | id |
| lead_notes | id |
| interview_appointments | id |
| callback_schedules | id |
| auto_distribution_rules | id |
| auto_distribution_members | id |
| notifications | id |
| system_configs | id |
| audit_logs | id |

Tất cả PK sử dụng kiểu **UUID** (thay vì số tự tăng) để thuận tiện khi mở rộng lên nhiều server/cloud sau này, tránh xung đột ID khi đồng bộ dữ liệu.

---

## 5. Tổng hợp Foreign Key

| Bảng nguồn.Cột | Bảng đích.Cột | Ghi chú |
|---|---|---|
| teams.leader_id | accounts.id | Nullable — team có thể chưa gán leader |
| accounts.team_id | teams.id | Nullable — admin/manager/mkt không thuộc team |
| accounts.created_by | accounts.id | Nullable — tài khoản admin đầu tiên không có người tạo |
| sessions.account_id | accounts.id | Bắt buộc |
| account_permissions.account_id | accounts.id | Bắt buộc |
| account_permissions.permission_id | permissions.id | Bắt buộc |
| account_permissions.updated_by | accounts.id | Bắt buộc |
| leads.source_id | lead_sources.id | Bắt buộc |
| leads.uploaded_by | accounts.id | Bắt buộc |
| leads.assigned_to | accounts.id | Nullable — chưa phân chia |
| leads.assigned_team_id | teams.id | Nullable |
| leads.call_status_id | status_catalog.id | Nullable |
| leads.call_result_id | status_catalog.id | Nullable |
| leads.current_interview_status_id | status_catalog.id | Nullable — bổ sung sau Design Review |
| leads.current_employment_status_id | status_catalog.id | Nullable — bổ sung sau Design Review |
| leads.held_by | accounts.id | Nullable |
| leads.care_pool_locked_by | accounts.id | Nullable |
| leads.removed_from_care_pool_by | accounts.id | Nullable |
| leads.deleted_by | accounts.id | Nullable |
| lead_notes.lead_id | leads.id | Bắt buộc |
| lead_notes.created_by | accounts.id | Bắt buộc |
| lead_notes.deleted_by | accounts.id | Nullable |
| interview_appointments.lead_id | leads.id | Bắt buộc |
| interview_appointments.status_id | status_catalog.id | Bắt buộc |
| interview_appointments.employment_status_id | status_catalog.id | Nullable |
| interview_appointments.created_by | accounts.id | Bắt buộc |
| callback_schedules.lead_id | leads.id | Bắt buộc |
| callback_schedules.created_by | accounts.id | Bắt buộc |
| auto_distribution_rules.team_id | teams.id | Bắt buộc, UNIQUE |
| auto_distribution_rules.created_by | accounts.id | Bắt buộc |
| auto_distribution_members.rule_id | auto_distribution_rules.id | Bắt buộc |
| auto_distribution_members.account_id | accounts.id | Bắt buộc |
| notifications.account_id | accounts.id | Bắt buộc |
| notifications.lead_id | leads.id | Nullable |
| system_configs.updated_by | accounts.id | Bắt buộc |
| audit_logs.account_id | accounts.id | Bắt buộc |

**Quy tắc xóa (áp dụng khái niệm, không phải cú pháp cụ thể):**
- Xóa `leads` → chỉ xóa mềm (`deleted_at`), không xóa cứng, để bảo toàn `lead_notes`, `interview_appointments`, `callback_schedules`, `audit_logs` liên quan.
- Xóa `accounts` → theo nghiệp vụ hiện tại, tài khoản không thực sự bị xóa khi nhân viên nghỉ mà được **đổi tên/bàn giao**; trường hợp Admin chủ động xóa tài khoản, nên chuyển `status = inactive` (xóa mềm) thay vì xóa cứng, để không phá vỡ dữ liệu lịch sử (`leads.assigned_to`, `lead_notes.created_by`...).

---

## 6. Tổng hợp Index đề xuất

| Bảng | Cột lập chỉ mục | Lý do |
|---|---|---|
| accounts | username (UNIQUE) | Tra cứu nhanh khi đăng nhập |
| accounts | team_id | Lọc danh sách nhân viên theo nhóm |
| accounts | role | Lọc theo vai trò khi phân quyền |
| leads | phone_number | **Quan trọng nhất** — phục vụ phát hiện trùng lặp và tìm kiếm theo SĐT |
| leads | assigned_to | Truy vấn "Lead của tôi" |
| leads | assigned_team_id | Truy vấn theo phạm vi nhóm (Leader/Quản lý/Admin) |
| leads | (assigned_team_id, entered_care_pool_at) | Composite — phục vụ truy vấn Cột chăm sóc theo nhóm, chỉ lấy lead đã vào chăm sóc |
| leads | call_result_id | Lọc/thống kê theo kết quả cuộc gọi (Dashboard) |
| leads | current_interview_status_id | **[Bổ sung sau Design Review]** Lọc danh sách Candidate/Interview theo trạng thái PV hiện tại — tránh join `interview_appointments` trên mỗi request danh sách |
| leads | uploaded_at | Lọc theo khoảng ngày, thống kê lead mới theo ngày |
| leads | deleted_at | Loại trừ nhanh các lead đã xóa mềm khỏi truy vấn mặc định |
| leads | (is_held, entered_care_pool_at, last_activity_at) | **[Bổ sung sau Design Review]** Composite — phục vụ worker quét định kỳ tìm lead đã xử lý, chưa giữ số, vượt ngưỡng thời gian để đẩy vào cột chăm sóc; không có index này, truy vấn sẽ full table scan khi dữ liệu lên tới hàng triệu bản ghi |
| lead_notes | lead_id | Lấy lịch sử ghi chú của 1 lead |
| lead_notes | (lead_id, created_at) | Composite — sắp xếp lịch sử theo thời gian |
| interview_appointments | lead_id | Lấy lịch sử phỏng vấn của 1 lead |
| interview_appointments | scheduled_at | Phục vụ Calendar view và nhắc lịch |
| callback_schedules | (scheduled_at, is_completed) | Composite — worker quét các lịch gọi lại sắp đến hạn/chưa xử lý |
| notifications | (status, scheduled_at) | Composite — worker quét thông báo cần gửi |
| audit_logs | (entity_type, entity_id) | Composite — tra cứu lịch sử của 1 đối tượng cụ thể |
| audit_logs | account_id | Tra cứu hành động theo từng nhân viên |
| audit_logs | created_at | Lọc theo khoảng thời gian |
| status_catalog | (category, code) UNIQUE | Đảm bảo không trùng mã trạng thái trong cùng nhóm |

---

## 7. Chuẩn hóa dữ liệu

### 7.1. Các quyết định chuẩn hóa (Normalization)

1. **Tách trạng thái ra bảng danh mục (`status_catalog`) thay vì lưu chuỗi text trực tiếp** trong `leads`/`interview_appointments`. Lý do: tránh sai chính tả/không nhất quán khi nhập liệu tự do, cho phép đổi tên hiển thị (vd sửa lỗi chính tả trạng thái) mà không phải cập nhật hàng loạt dữ liệu, và hỗ trợ thống kê chính xác theo mã cố định — đúng tinh thần "dropdown chuẩn hóa" đã thống nhất trong tài liệu 09.
2. **Gộp 3 nhóm trạng thái (tình trạng cuộc gọi / kết quả cuộc gọi / đi làm) vào chung 1 bảng `status_catalog` có cột `category`**, thay vì tạo 3-4 bảng danh mục riêng biệt gần giống nhau. Đây là lựa chọn giảm số lượng bảng nhỏ lẻ trùng cấu trúc (id, code, name) — vẫn đảm bảo chuẩn hóa vì không có text lặp lại, đồng thời dễ bảo trì khi cần thêm/sửa danh mục trạng thái mới.
3. **Tách `lead_notes` thành bảng riêng (1-N với `leads`)** thay vì lưu 1 cột "ghi chú" trong `leads`. Lý do: nghiệp vụ yêu cầu lưu **nhiều ghi chú theo thời gian, không ghi đè, giữ lịch sử kể cả khi xóa** — nếu để 1 cột duy nhất sẽ vi phạm dạng chuẩn 1NF (giá trị không nguyên tố / lặp lại) và không thể soft-delete từng note riêng lẻ.
4. **Tách `interview_appointments` thành bảng riêng (1-N với `leads`)** thay vì các cột cố định "lần hẹn 1", "lần hẹn 2" trong `leads`. Lý do: nghiệp vụ xác nhận "Bùng PV" có thể được hẹn lại nhiều lần — số lần hẹn không cố định, nên phải tách bảng để tránh lặp cột (vi phạm 1NF) và không giới hạn số lần hẹn lại.
5. **Tách `callback_schedules` thành bảng riêng** vì 1 lead có thể có nhiều lịch gọi lại phát sinh theo thời gian (không phải chỉ 1 lịch cố định).
6. **Tách quyền hạn thành `permissions` + `account_permissions`** (mô hình nhiều-nhiều) thay vì các cột boolean cố định (`can_add_employee`, `can_delete_employee`...) trực tiếp trong `accounts`. Lý do: nghiệp vụ yêu cầu **Admin có thể tùy chỉnh quyền linh hoạt** khi tạo từng tài khoản Quản lý/Leader (Mục 11, tài liệu 09) — thiết kế dạng bảng quyền động cho phép bổ sung quyền mới trong tương lai mà không cần thay đổi cấu trúc bảng `accounts`.

### 7.2. Các quyết định phi chuẩn hóa có chủ đích (Denormalization)

1. **`leads.assigned_team_id`** là dữ liệu suy ra được từ `leads.assigned_to → accounts.team_id`, nhưng vẫn được lưu trực tiếp trên bảng `leads`. Lý do: mọi truy vấn phân quyền theo nhóm (Leader chỉ xem nhóm mình, Cột chăm sóc lọc theo nhóm) đều lọc theo cột này với tần suất rất cao — nếu luôn phải join qua `accounts` sẽ ảnh hưởng hiệu năng khi dữ liệu lên tới hàng triệu bản ghi (mục tiêu quy mô đã đặt ra ban đầu). Đánh đổi: ứng dụng phải đảm bảo đồng bộ cột này mỗi khi `assigned_to` thay đổi (khi phân chia/chuyển lead).
2. **`leads.phone_number` không đặt ràng buộc UNIQUE.** Đây là quyết định bắt buộc theo nghiệp vụ (Mục 10, tài liệu 09: cho phép trùng SĐT, chỉ cảnh báo chứ không chặn) — khác với thực hành chuẩn hóa thông thường (thường sẽ unique số điện thoại). Việc phát hiện trùng lặp được xử lý ở tầng truy vấn (group theo `phone_number` có index), không dùng ràng buộc dữ liệu.
3. **`interview_appointments.partner_company_name` lưu dạng text tự do**, chưa tách thành bảng danh mục đối tác riêng (dù về nguyên tắc chuẩn hóa nên tách). Đây là quyết định **giữ nguyên theo đúng yêu cầu nghiệp vụ hiện tại** (chủ doanh nghiệp xác nhận muốn nhập tự do) — đã ghi nhận là điểm có thể chuẩn hóa thêm trong tương lai (xem Mục 11, tài liệu 09 và Mục 10, tài liệu 10).
4. **`leads.is_duplicate_flagged`** là cờ suy ra được từ việc đếm số lead cùng `phone_number`, nhưng lưu sẵn để tránh phải tính toán lại (COUNT + GROUP BY) mỗi lần hiển thị danh sách — đánh đổi giữa hiệu năng đọc và việc phải cập nhật lại cờ này mỗi khi có lead trùng mới phát sinh.
5. **[Bổ sung sau Design Review] `leads.current_interview_status_id`, `leads.current_employment_status_id`, `leads.current_partner_company_name`** là dữ liệu suy ra được từ dòng mới nhất của `interview_appointments`, nhưng được lưu (snapshot) trực tiếp trên `leads`. Lý do: màn hình Candidate (Mục 2, tài liệu 12) và API `GET /candidate` (Mục 4, tài liệu 13) đều cần lọc/hiển thị "trạng thái PV hiện tại", "trạng thái đi làm hiện tại", "công ty đối tác đã hẹn" ngay trên danh sách chính — nếu không denormalize, mỗi lần tải danh sách sẽ phải join/subquery lấy dòng `interview_appointments` mới nhất cho từng lead, rất tốn kém khi dữ liệu lên tới hàng triệu bản ghi. Đánh đổi: ứng dụng phải đồng bộ lại 3 cột này mỗi khi có dòng `interview_appointments` mới được tạo hoặc cập nhật cho lead đó (cùng nguyên tắc với `assigned_team_id`).

### 7.3. Mức chuẩn hóa đạt được

Toàn bộ thiết kế đạt **chuẩn 3NF (Third Normal Form)** đối với các bảng nghiệp vụ lõi — không có thuộc tính lặp lại (1NF), không có phụ thuộc bộ phận vào khóa chính khi khóa là tổ hợp (2NF), không có phụ thuộc bắc cầu giữa các thuộc tính không khóa (3NF) — ngoại trừ các trường hợp phi chuẩn hóa có chủ đích đã liệt kê ở Mục 7.2, đều được giải thích rõ lý do đánh đổi hiệu năng/nghiệp vụ.

---

## 8. Các bảng tự bổ sung (không có tên trực tiếp trong tài liệu nghiệp vụ)

| Bảng | Lý do bổ sung |
|---|---|
| `sessions` | Nghiệp vụ yêu cầu "cho phép đăng nhập nhiều thiết bị cùng lúc" — cần bảng lưu từng phiên đăng nhập để có thể tra cứu/thu hồi phiên sau này, dù hiện tại chưa yêu cầu tính năng thu hồi. |
| `permissions` / `account_permissions` | Nghiệp vụ yêu cầu Admin tùy chỉnh quyền linh hoạt cho từng tài khoản Quản lý/Leader nhưng chưa chốt danh sách quyền cụ thể — cần thiết kế dạng bảng động để không phải sửa cấu trúc dữ liệu khi danh sách quyền được bổ sung sau này. |
| `status_catalog` | Nghiệp vụ chỉ liệt kê các giá trị trạng thái cụ thể (Mục 7, tài liệu 09) nhưng không đề cập việc lưu trữ dưới dạng danh mục — bổ sung để đảm bảo chuẩn hóa và cho phép chỉnh sửa dropdown mà không cần thay đổi mã nguồn. |
| `notifications` | Nghiệp vụ chỉ mô tả "nhắc lịch qua Zalo" ở mức hành vi — cần bảng hàng đợi để hệ thống theo dõi thông báo nào đã gửi/chưa gửi/gửi lỗi, tránh gửi trùng hoặc thất lạc thông báo. |
| `audit_logs` | Nghiệp vụ yêu cầu "lưu lại lịch sử truy cập" nhưng không mô tả cấu trúc — bổ sung bảng nhật ký chung để phục vụ mọi loại hành động cần truy vết (xem, sửa, xóa, đăng nhập, reset mật khẩu...). |
| `auto_distribution_rules` / `auto_distribution_members` | Nghiệp vụ mô tả hành vi "chọn danh sách sale theo thứ tự rồi kích hoạt" — cần 2 bảng để lưu cấu hình (bật/tắt, vị trí con trỏ) và danh sách thành viên tham gia vòng quay một cách có thứ tự. |

---

## 9. Rủi ro & khuyến nghị bổ sung (từ Design Review)

1. **Nguy cơ phình bảng `audit_logs`:** `action_type` hiện bao gồm cả `'view'`. Nếu hệ thống ghi log mỗi lần bất kỳ ai mở xem 1 ứng viên, với hàng triệu lead và hàng chục nhân viên thao tác liên tục, bảng `audit_logs` có thể phình to hơn cả bảng `leads` và ảnh hưởng hiệu năng ghi. **Khuyến nghị:** chỉ ghi log `view` cho các hành động xem có ý nghĩa truy vết (vd mở Chi tiết ứng viên), không ghi log cho mỗi lần tải trang danh sách; cân nhắc ghi log bất đồng bộ (qua hàng đợi) thay vì ghi đồng bộ trong request.
2. **Cập nhật `is_duplicate_flagged` hai chiều:** khi 1 lead mới trùng SĐT với lead đã có từ trước, ứng dụng cần cập nhật cờ này cho **toàn bộ** các bản ghi cùng SĐT (không chỉ bản ghi mới nhất), nếu không các lead cũ sẽ không hiển thị cảnh báo trùng dù thực tế đã có bản ghi trùng mới phát sinh.
3. **Chỉ mục phục vụ worker cột chăm sóc:** đã bổ sung tại Mục 6 — bắt buộc phải có trước khi dữ liệu vượt quá vài trăm nghìn bản ghi, nếu không worker quét định kỳ (mỗi 1-5 phút) sẽ ngày càng chậm và có thể ảnh hưởng tải chung của hệ thống.

---

*Tài liệu được xây dựng dựa trên `docs/09-business-specification.md` và `docs/10-system-design.md`. Không viết code, không viết câu lệnh SQL, không thiết kế giao diện — đúng theo yêu cầu.*
