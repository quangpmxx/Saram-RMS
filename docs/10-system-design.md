# TÀI LIỆU THIẾT KẾ HỆ THỐNG (SYSTEM DESIGN) — CRM TUYỂN DỤNG / CUNG ỨNG LAO ĐỘNG

> Tài liệu này được xây dựng dựa trên toàn bộ nội dung trong `docs/09-business-specification.md`.
> Phạm vi: **chỉ thiết kế hệ thống ở mức kiến trúc/module/màn hình/API**. Không viết code, không thiết kế chi tiết bảng dữ liệu (database), không thiết kế giao diện (UI/UX chi tiết).

---

## 1. Danh sách module

| # | Module | Mô tả | Nghiệp vụ liên quan (tham chiếu tài liệu 09) |
|---|---|---|---|
| M1 | **Xác thực & Phiên đăng nhập** | Đăng nhập bằng tài khoản/mật khẩu do Admin cấp, cho phép nhiều thiết bị, reset mật khẩu (chỉ Admin) | Mục 8 |
| M2 | **Quản lý tài khoản & Phân quyền** | Admin tạo/sửa/xóa tài khoản (Admin, Quản lý, Leader, MKT, Sale); cấu hình quyền chi tiết cho Quản lý/Leader | Mục 8, Mục 11 |
| M3 | **Quản lý Lead/Ứng viên** | Lưu trữ, xem, sửa thông tin lead: tên, SĐT, năm sinh, địa chỉ, nguồn, ghi chú... | Mục 2, 6, 7 |
| M4 | **Nhập liệu & Import** | MKT nhập tay từng dòng hoặc import hàng loạt từ Excel | Mục 2 |
| M5 | **Phân chia Lead** | Leader chia lead thủ công hoặc kích hoạt tự động phân chia (round-robin) | Mục 3 |
| M6 | **Cột chăm sóc (Care Pool)** | Cơ chế tự động đưa lead bị bỏ quên >30 phút vào danh sách dùng chung của nhóm; khóa xử lý đồng thời; đánh dấu giữ số | Mục 4, Mục 10 (quy tắc 1-3) |
| M7 | **Quản lý Trạng thái & Pipeline cuộc gọi/PV** | Cập nhật tình trạng cuộc gọi, kết quả cuộc gọi, trạng thái phỏng vấn, kết quả đi làm | Mục 7 |
| M8 | **Phát hiện trùng lặp** | Cảnh báo và đánh dấu các lead trùng SĐT, phạm vi hiển thị theo vai trò | Mục 10 (quy tắc 4) |
| M9 | **Tìm kiếm & Lọc** | Tìm/lọc lead theo trạng thái, ngày, nguồn, sale, đối tác — giới hạn theo quyền xem | Mục 8 |
| M10 | **Lịch hẹn (Calendar)** | Hiển thị dạng lịch cho lịch gọi lại và lịch hẹn phỏng vấn | Mục 4 |
| M11 | **Thông báo (Zalo)** | Gửi nhắc lịch gọi lại/hẹn phỏng vấn qua Zalo | Mục 10 (quy tắc 10) |
| M12 | **Lịch sử & Nhật ký (Audit Log)** | Lưu lịch sử truy cập, lịch sử ghi chú/cuộc gọi (kể cả note đã xóa) | Mục 10 (quy tắc 7) |
| M13 | **Dashboard & Báo cáo** | Tổng hợp số liệu: lead mới, tỷ lệ chuyển đổi, hiệu suất sale, số lead chăm sóc | Mục 9 |
| M14 | **Cấu hình hệ thống** | Admin chỉnh ngưỡng thời gian cột chăm sóc (mặc định 30 phút) và các tham số vận hành khác | Mục 10 (quy tắc 1) |
| M15 | **Quản lý Nhóm (Team)** *(bổ sung sau Design Review)* | Admin tạo/sửa nhóm sale, gán Leader phụ trách — hạ tầng nền cho M5 (phân chia theo nhóm) và M6 (chăm sóc theo nhóm); trước đó có bảng `teams` và API `/team` nhưng thiếu module tương ứng trong tài liệu này | Mục 3, Mục 8 |

---

## 2. Quan hệ giữa các module

**Module lõi (trung tâm hệ thống):** M3 – Quản lý Lead. Hầu hết các module khác đều đọc/ghi dữ liệu thông qua Lead.

**Sơ đồ quan hệ (mô tả dạng chữ):**

```
M1 (Xác thực) ──cấp phiên/quyền cho──> Tất cả module khác

M2 (Tài khoản & Phân quyền) ──quản lý──> M1, kiểm soát quyền truy cập M3-M14

M4 (Nhập liệu/Import) ──tạo mới──> M3 (Lead)
M3 (Lead) ──trạng thái "chờ phân chia"──> M5 (Phân chia)
M5 (Phân chia) ──gán chủ sở hữu──> M3 (Lead)

M3 (Lead) ──kích hoạt sau 30p không xử lý──> M6 (Cột chăm sóc)
M6 (Cột chăm sóc) ──cập nhật ngược──> M3 (Lead), đọc cấu hình từ M14

M3 (Lead) <──cập nhật trạng thái──> M7 (Pipeline cuộc gọi/PV)
M7 ──kích hoạt──> M10 (Lịch hẹn) khi có lịch gọi lại/hẹn PV
M10 ──kích hoạt──> M11 (Thông báo Zalo) khi gần đến giờ hẹn

M4 (Nhập liệu) ──kiểm tra──> M8 (Trùng lặp) mỗi khi có data mới
M3, M5, M6, M7 ──mọi thao tác ghi log──> M12 (Lịch sử/Audit Log)

M9 (Tìm kiếm & Lọc) ──đọc dữ liệu từ──> M3, M6, M7 (không ghi dữ liệu)
M13 (Dashboard) ──tổng hợp số liệu từ──> M3, M5, M6, M7 (chỉ đọc, không ghi)

M14 (Cấu hình hệ thống) ──cung cấp tham số cho──> M6 (ngưỡng thời gian chăm sóc)

M15 (Quản lý Nhóm) ──cung cấp dữ liệu nhóm cho──> M2 (gán account vào team), M5 (phân chia theo team), M6 (chăm sóc theo team), M9, M13 (lọc/tổng hợp theo team)
```

**Nguyên tắc thiết kế quan hệ:**
- M1, M2, M14 là các module **nền tảng/quản trị**, không chứa nghiệp vụ lead nhưng kiểm soát toàn bộ các module còn lại.
- M3 (Lead) là **nguồn dữ liệu duy nhất (single source of truth)** — mọi module khác (M6, M7, M8, M9, M10, M12, M13) chỉ đọc hoặc cập nhật trạng thái của lead, không có bản sao dữ liệu riêng.
- M11 (Thông báo) chỉ là **module phát tín hiệu ra ngoài**, không chứa dữ liệu nghiệp vụ, được kích hoạt bởi M7/M10.
- M13 (Dashboard) và M9 (Tìm kiếm) là **module chỉ đọc (read-only)**, không thay đổi dữ liệu gốc, tách biệt để không ảnh hưởng hiệu năng các module ghi dữ liệu.

---

## 3. Luồng dữ liệu

### 3.1. Luồng dữ liệu tổng quát (từ khi có data đến khi có kết quả)

```
[Kênh quảng cáo: FB / TikTok / Zalo / Khác]
        │
        ▼
[MKT nhập liệu / Import Excel]  ──> (M4, kiểm tra trùng qua M8)
        │
        ▼
[Lead mới – trạng thái "Chờ phân chia"]  (M3)
        │
        ▼
[Leader phân chia – thủ công hoặc auto round-robin]  (M5)
        │
        ▼
[Lead thuộc về 1 Sale cụ thể]  (M3, cập nhật chủ sở hữu)
        │
        ├──> [Sale xử lý trong 30 phút] ──> cập nhật trạng thái (M7) ──> ghi log (M12)
        │
        └──> [Không xử lý > 30 phút] ──> tự động vào Cột chăm sóc (M6) ──> Sale khác trong nhóm xử lý ──> cập nhật (M3, M7)
        │
        ▼
[Cập nhật kết quả cuộc gọi → Hẹn PV → Đến/Bùng PV → Đỗ/Trượt PV → Đi làm/Không đi làm]  (M7)
        │
        ├──> [Có lịch hẹn] ──> hiển thị Calendar (M10) ──> Nhắc qua Zalo (M11)
        │
        ▼
[Dữ liệu tổng hợp real-time]  ──> Dashboard (M13) hiển thị theo vai trò người xem
```

### 3.2. Luồng dữ liệu theo vai trò (ai ghi – ai đọc)

| Vai trò | Ghi dữ liệu vào | Đọc dữ liệu từ |
|---|---|---|
| MKT | M3 (tạo lead mới), M4 | M3 (lead do mình up), M8 (cảnh báo trùng toàn hệ thống), M12 (note của sale) |
| Leader | M5 (phân chia), M3 (sửa lead nhóm mình) | M3, M6, M7, M9, M13 (phạm vi nhóm mình) |
| Sale | M7 (cập nhật trạng thái), M6 (xử lý chăm sóc), M3 (note) | M3, M6, M7, M9, M10 (phạm vi lead của mình + nhóm) |
| Quản lý | M3, M5, M7 (toàn hệ thống, trừ M2 thêm/xóa NV) | Toàn bộ M3–M13 |
| Admin | Tất cả các module | Tất cả các module |

---

## 4. Kiến trúc tổng thể

### 4.1. Mô hình kiến trúc

Áp dụng mô hình **Modular Monolith** (đã thống nhất ở giai đoạn chọn công nghệ): một backend duy nhất, chia theo module nghiệp vụ độc lập (tương ứng các module M1–M14 ở Mục 1), thay vì tách microservices — phù hợp quy mô 20–100 người dùng đồng thời.

### 4.2. Các lớp kiến trúc (Layers)

```
┌─────────────────────────────────────────────────────┐
│  Lớp Trình bày (Presentation Layer)                  │
│  - Web App (responsive, dùng được trên điện thoại)   │
│  - Giao diện theo vai trò (Admin/Quản lý/Leader/MKT/Sale) │
└───────────────────────┬───────────────────────────────┘
                         │ (giao tiếp qua API)
┌───────────────────────▼───────────────────────────────┐
│  Lớp API / Backend (Modular Monolith)                 │
│  - Các module nghiệp vụ M1–M14                        │
│  - Xử lý xác thực, phân quyền theo vai trò             │
└───────┬───────────────────────────────┬────────────────┘
        │                               │
┌───────▼─────────────┐      ┌──────────▼───────────────┐
│  Lớp Dữ liệu          │      │  Lớp Tác vụ nền (Worker)  │
│  - Cơ sở dữ liệu chính │      │  - Kiểm tra ngưỡng 30 phút│
│    (lưu lead, tài khoản,│     │    để đẩy lead vào M6     │
│    lịch sử, cấu hình)  │      │  - Gửi thông báo Zalo (M11)│
└─────────────────────────┘      │  - Xử lý import Excel lớn │
                                  └───────────────────────────┘
```

### 4.3. Thành phần bổ sung theo yêu cầu nghiệp vụ

- **Bộ lập lịch/Worker nền (Scheduler):** bắt buộc phải có, vì cơ chế "cột chăm sóc" (M6) và nhắc lịch Zalo (M11) đều dựa trên thời gian tự động, không thể chỉ xử lý theo yêu cầu người dùng (request-based) — cần tiến trình chạy ngầm liên tục kiểm tra và kích hoạt.
- **Import Excel xử lý bất đồng bộ** *(làm rõ sau Design Review)*: với batch có thể tới ~1.000-20.000 dòng, xử lý đồng bộ trong 1 request HTTP dễ timeout. Worker nhận file, xử lý nền, trả về mã tiến trình (job) để client theo dõi trạng thái/kết quả riêng — xem API tương ứng tại tài liệu 13.
- **Cơ chế an toàn cho khóa Cột chăm sóc** *(khuyến nghị bổ sung sau Design Review)*: nghiệp vụ yêu cầu khóa tự giải phóng "ngay khi thoát ra giữa chừng" (Mục 4, tài liệu 09) — điều này phụ thuộc vào việc client báo hiệu thoát thành công. Để tránh khóa bị "treo" vĩnh viễn khi mất kết nối/tắt trình duyệt đột ngột không kịp báo hiệu, tầng backend nên có thêm cơ chế dự phòng (vd giải phóng khóa nếu không có tín hiệu hoạt động từ phiên đang giữ khóa trong một khoảng thời gian ngắn), bổ sung cho cơ chế giải phóng chủ động, không thay đổi hành vi nghiệp vụ đã chốt.
- **Tích hợp bên thứ 3:** kênh gửi thông báo Zalo (Zalo Notification Service hoặc tương đương) — là điểm tích hợp ngoài duy nhất được xác nhận trong nghiệp vụ hiện tại.
- **Khả năng mở rộng lên Cloud:** kiến trúc phân lớp rõ ràng cho phép sau này tách riêng lớp Worker hoặc lớp Dữ liệu ra hạ tầng riêng khi khối lượng dữ liệu tăng (đã dự trù ~1 triệu bản ghi trong định hướng ban đầu).

### 4.4. Nguyên tắc phân quyền trong kiến trúc

Toàn bộ API ở Lớp Backend đều đi qua một lớp kiểm tra quyền chung (Authorization Guard) dựa trên vai trò + phạm vi dữ liệu (nhóm), áp dụng thống nhất cho mọi module — đảm bảo quy tắc "phạm vi xem theo vai trò" (Mục 8, tài liệu 09) được thực thi nhất quán ở mọi màn hình và API, không lặp lại logic phân quyền riêng lẻ ở từng module.

---

## 5. Danh sách màn hình

| # | Tên màn hình | Vai trò sử dụng |
|---|---|---|
| S1 | Đăng nhập | Tất cả |
| S2 | Dashboard tổng quan | Tất cả (nội dung khác nhau theo vai trò) |
| S3 | Danh sách Lead – Chờ phân chia | MKT, Leader, Quản lý, Admin |
| S4 | Danh sách Lead – Của tôi | Sale, Leader |
| S5 | Chi tiết Lead (thông tin, lịch sử note, cập nhật trạng thái) | Tất cả (quyền sửa khác nhau) |
| S6 | Nhập liệu Lead thủ công | MKT |
| S7 | Import Lead từ Excel | MKT |
| S8 | Cột chăm sóc (Care Pool) | Sale, Leader, Quản lý, Admin |
| S9 | Phân chia Lead (thủ công + cấu hình tự động round-robin) | Leader |
| S10 | Lịch hẹn (Calendar view) | Sale, Leader, Quản lý, Admin |
| S11 | Quản lý tài khoản nhân viên | Admin |
| S12 | Phân quyền tài khoản (cấu hình quyền Quản lý/Leader) | Admin |
| S13 | Cấu hình hệ thống (ngưỡng thời gian chăm sóc...) | Admin |
| S14 | Lịch sử/Nhật ký truy cập | Admin, Quản lý |
| S15 | Danh sách lead trùng lặp | MKT, Quản lý, Admin (đầy đủ); Sale/Leader (giới hạn trong nhóm) |
| S16 | Quản lý nhóm (Team) *(bổ sung sau Design Review)* | Admin |

---

## 6. Menu của hệ thống

**Sale:**
- Dashboard
- Lead của tôi
- Cột chăm sóc
- Lịch hẹn

**Leader:**
- Dashboard
- Lead chờ phân chia
- Lead của tôi / Phân chia lead
- Cột chăm sóc (nhóm)
- Lịch hẹn

**MKT:**
- Dashboard
- Nhập liệu Lead
- Import Excel
- Lead chờ phân chia (xem)
- Danh sách trùng lặp

**Quản lý:**
- Dashboard (toàn hệ thống)
- Toàn bộ Lead (mọi nhóm)
- Cột chăm sóc (mọi nhóm)
- Danh sách trùng lặp
- Lịch hẹn
- Lịch sử/Nhật ký

**Admin:**
- Dashboard (toàn hệ thống)
- Toàn bộ Lead (mọi nhóm)
- Cột chăm sóc (mọi nhóm)
- Danh sách trùng lặp
- Lịch hẹn
- Quản lý tài khoản
- Quản lý nhóm
- Phân quyền tài khoản
- Cấu hình hệ thống
- Lịch sử/Nhật ký

---

## 7. Các chức năng của từng màn hình

**S1 – Đăng nhập:** nhập tài khoản/mật khẩu; báo lỗi sai thông tin; không có chức năng tự đăng ký (chỉ Admin tạo tài khoản).

**S2 – Dashboard:** hiển thị các chỉ số tại Mục 9 (tài liệu 09), lọc theo khoảng thời gian; nội dung tự động giới hạn theo phạm vi quyền của người xem.

**S3 – Danh sách Lead chờ phân chia:** xem danh sách lead chưa gán sale; chọn nhiều lead để phân chia thủ công (Leader); xem nhanh nguồn, thời gian up, đánh dấu trùng lặp.

**S4 – Danh sách Lead của tôi:** danh sách lead đang phụ trách, lọc theo trạng thái/ngày, thao tác nhanh (gọi, cập nhật trạng thái), đánh dấu giữ số.

**S5 – Chi tiết Lead:** xem/sửa thông tin cá nhân ứng viên; cập nhật tình trạng cuộc gọi, kết quả cuộc gọi, lịch hẹn PV, công ty hẹn, kết quả PV, kết quả đi làm + lý do; xem toàn bộ lịch sử note/cuộc gọi trước đó; thêm note mới; xóa note cũ (vẫn lưu lịch sử).

**S6 – Nhập liệu Lead thủ công:** form nhập tên, SĐT, nguồn, ghi chú MKT; cảnh báo ngay nếu trùng SĐT (kèm thông tin trùng với ai/ngày nào) nhưng vẫn cho lưu.

**S7 – Import Excel:** tải file lên, xem trước dữ liệu, xác nhận import; báo cáo dòng lỗi/dòng trùng sau khi import; theo dõi tiến trình với các batch lớn.

**S8 – Cột chăm sóc:** danh sách lead đang chờ xử lý chung của nhóm; trạng thái khóa ("Sale ... đang xử lý") theo thời gian thực; mở lead để xử lý (chiếm khóa); tự nhả khóa khi thoát giữa chừng.

**S9 – Phân chia Lead:** giao diện chọn lead → gán sale (thủ công); cấu hình danh sách sale tham gia vòng quay tự động + thứ tự; nút Kích hoạt/Tạm dừng chế độ tự động; chuyển lead giữa các sale trong nhóm.

**S10 – Lịch hẹn:** xem dạng lịch (ngày/tuần/tháng) các lịch gọi lại và lịch hẹn phỏng vấn; nhấp vào 1 mốc để mở nhanh chi tiết lead tương ứng.

**S11 – Quản lý tài khoản:** tạo/sửa/vô hiệu hóa tài khoản nhân viên; gán vai trò; đổi thông tin đăng nhập (phục vụ trường hợp bàn giao khi nhân viên nghỉ); reset mật khẩu về mặc định.

**S12 – Phân quyền tài khoản:** với tài khoản vai trò Quản lý/Leader, chọn các quyền cụ thể được bật/tắt (danh sách quyền chi tiết — xem điểm còn chưa rõ tại Mục 10 dưới đây).

**S13 – Cấu hình hệ thống:** chỉnh ngưỡng thời gian tự động chuyển vào cột chăm sóc (mặc định 30 phút); các tham số vận hành khác phát sinh sau này.

**S14 – Lịch sử/Nhật ký:** tra cứu ai đã xem/sửa lead nào, khi nào; lọc theo nhân viên, theo lead, theo khoảng thời gian.

**S15 – Danh sách trùng lặp:** liệt kê các nhóm SĐT bị trùng, số lần trùng, thuộc sale/nhóm nào, ngày up.

**S16 – Quản lý nhóm** *(bổ sung sau Design Review — trước đó có bảng `teams` và API `/team` nhưng thiếu màn hình thao tác)*: tạo nhóm mới, đặt tên nhóm, gán/đổi Leader phụ trách; xem nhanh số lượng sale trong từng nhóm.

---

## 8. Các API cần có

> Danh sách API ở mức thiết kế (method + mục đích), không mô tả chi tiết kỹ thuật/code.

### 8.1. Xác thực & Tài khoản (M1, M2)
| Method | Endpoint | Mục đích |
|---|---|---|
| POST | /auth/login | Đăng nhập bằng tài khoản/mật khẩu |
| POST | /auth/logout | Đăng xuất phiên hiện tại |
| GET | /auth/me | Lấy thông tin tài khoản đang đăng nhập + quyền hạn |
| GET | /accounts | Danh sách tài khoản nhân viên (Admin) |
| POST | /accounts | Tạo tài khoản mới (Admin) |
| PUT | /accounts/{id} | Sửa thông tin/đổi tên tài khoản (Admin) |
| DELETE | /accounts/{id} | Vô hiệu hóa tài khoản — xóa mềm (Admin) |
| POST | /accounts/{id}/reset-password | Reset mật khẩu về mặc định (Admin) |
| PUT | /accounts/{id}/permissions | Cấu hình quyền chi tiết cho tài khoản Quản lý/Leader (Admin) |
| GET, POST, PUT | /teams, /teams/{id} | *(bổ sung sau Design Review)* Tạo/sửa nhóm, gán Leader phụ trách (Admin) — chi tiết tại tài liệu 13 |

### 8.2. Lead/Ứng viên (M3, M4)
| Method | Endpoint | Mục đích |
|---|---|---|
| GET | /leads | Danh sách lead (có phân trang, lọc theo quyền) |
| POST | /leads | Tạo lead mới (nhập tay) |
| POST | /leads/import | Import hàng loạt từ Excel — xử lý bất đồng bộ, trả về mã tiến trình *(làm rõ sau Design Review)* |
| GET | /leads/import/{jobId} | *(bổ sung sau Design Review)* Tra cứu tiến độ/kết quả 1 lần import |
| GET | /leads/{id} | Xem chi tiết 1 lead |
| PUT | /leads/{id} | Cập nhật thông tin lead |
| DELETE | /leads/{id} | Xóa lead (chỉ Admin) |
| GET | /leads/pending | Danh sách lead đang chờ phân chia |
| GET | /leads/duplicates | Danh sách các lead trùng lặp |

### 8.3. Phân chia & Cột chăm sóc (M5, M6)
| Method | Endpoint | Mục đích |
|---|---|---|
| POST | /leads/{id}/assign | Gán 1 lead cho 1 sale (thủ công) |
| POST | /leads/assign-bulk | Gán nhiều lead cùng lúc |
| POST | /distribution/auto/activate | Kích hoạt chế độ tự động phân chia (round-robin) |
| POST | /distribution/auto/pause | Tạm dừng chế độ tự động |
| PUT | /distribution/auto/order | Cập nhật thứ tự danh sách sale tham gia vòng quay |
| POST | /leads/{id}/transfer | Chuyển lead sang sale khác (Leader) |
| POST | /leads/{id}/hold | Đánh dấu giữ số (Sale) |
| DELETE | /leads/{id}/hold | Bỏ đánh dấu giữ số |
| GET | /care-pool | Danh sách lead trong cột chăm sóc (theo nhóm) |
| POST | /care-pool/{id}/lock | Chiếm quyền xử lý 1 lead trong cột chăm sóc |
| POST | /care-pool/{id}/release | Giải phóng khóa (khi xử lý xong hoặc thoát giữa chừng) |

### 8.4. Trạng thái/Pipeline & Lịch sử (M7, M12)
| Method | Endpoint | Mục đích |
|---|---|---|
| PUT | /leads/{id}/call-status | Cập nhật tình trạng cuộc gọi |
| PUT | /leads/{id}/call-result | Cập nhật kết quả cuộc gọi |
| PUT | /leads/{id}/interview | Cập nhật lịch hẹn PV, công ty hẹn, kết quả PV |
| PUT | /leads/{id}/employment | Cập nhật kết quả đi làm + lý do (nếu có) |
| POST | /leads/{id}/notes | Thêm note/lịch sử cuộc gọi mới |
| DELETE | /leads/{id}/notes/{noteId} | Xóa note (vẫn lưu trong lịch sử) |
| GET | /leads/{id}/history | Xem toàn bộ lịch sử note/cập nhật của 1 lead |
| GET | /audit-logs | Tra cứu nhật ký truy cập/thao tác (Admin, Quản lý) |

### 8.5. Lịch hẹn & Thông báo (M10, M11)
| Method | Endpoint | Mục đích |
|---|---|---|
| GET | /calendar | Lấy danh sách lịch gọi lại/hẹn PV theo khoảng thời gian |
| POST | /notifications/zalo/send | Gửi thông báo nhắc lịch qua Zalo (nội bộ hệ thống gọi) |

### 8.6. Dashboard & Cấu hình (M13, M14)
| Method | Endpoint | Mục đích |
|---|---|---|
| GET | /dashboard/summary | Số liệu tổng quan theo Mục 9 (tài liệu 09) |
| GET | /dashboard/performance | Hiệu suất từng sale |
| GET | /dashboard/by-team | *(bổ sung sau Design Review)* Số liệu tổng hợp theo từng nhóm trong 1 lần gọi — phục vụ "Bảng tổng hợp theo nhóm" trên Dashboard (Quản lý/Admin), tránh phải gọi lặp lại theo từng team_id |
| GET | /config | Lấy cấu hình hệ thống hiện tại |
| PUT | /config | Cập nhật cấu hình (ngưỡng thời gian chăm sóc...) |

---

## 9. Luồng xử lý của từng nghiệp vụ

### 9.1. Luồng tạo lead và phân chia
1. MKT nhập lead (thủ công hoặc import Excel).
2. Hệ thống kiểm tra trùng SĐT → nếu trùng, hiển thị cảnh báo nhưng vẫn cho lưu, gắn dấu hiệu trùng.
3. Lead được lưu với trạng thái "Chờ phân chia".
4. Leader mở màn hình Chờ phân chia:
   - Nếu chế độ tự động **đang tắt**: Leader chọn lead → chọn sale → gán thủ công.
   - Nếu chế độ tự động **đang bật**: hệ thống tự gán theo thứ tự vòng quay đã cấu hình ngay khi lead xuất hiện.
5. Lead chuyển trạng thái "Đã phân chia", thuộc quyền xử lý của 1 sale cụ thể.

### 9.2. Luồng tự động phân chia (round-robin)
1. Leader chọn danh sách sale tham gia và sắp xếp thứ tự.
2. Leader nhấn Kích hoạt.
3. Mỗi khi có lead mới đủ điều kiện (đã chờ phân chia), hệ thống gán lần lượt theo thứ tự đã cấu hình, quay vòng lại từ đầu sau khi hết danh sách.
4. Leader có thể nhấn Tạm dừng bất kỳ lúc nào để chỉnh lại danh sách, sau đó kích hoạt lại.

### 9.3. Luồng xử lý cuộc gọi và cập nhật trạng thái
1. Sale mở lead được giao, thực hiện cuộc gọi.
2. Sale cập nhật Tình trạng cuộc gọi (đã gọi/không nghe máy/...).
3. Nếu liên lạc được, Sale cập nhật Kết quả cuộc gọi (tiềm năng/không tiềm năng/hẹn gọi lại...).
4. Sale ghi note mô tả nội dung cuộc gọi — note được lưu vào lịch sử, không ghi đè lên note cũ.
5. Nếu cần, Sale đặt lịch gọi lại hoặc hẹn phỏng vấn (kèm công ty hẹn) → hệ thống đẩy vào Lịch hẹn (M10) và lên lịch nhắc Zalo (M11).

### 9.4. Luồng cơ chế "Cột chăm sóc"
1. Hệ thống (worker nền) định kỳ quét các lead đã qua ít nhất 1 lần xử lý.
2. Với mỗi lead, nếu thời gian từ lần cập nhật gần nhất vượt quá ngưỡng cấu hình (mặc định 30 phút) **và** lead chưa được đánh dấu "giữ số" → đưa vào danh sách Cột chăm sóc, hiển thị cho các thành viên khác cùng nhóm.
3. Một sale khác trong nhóm mở lead trong cột chăm sóc để xử lý → hệ thống khóa lead này lại (chỉ người đó thao tác được).
4. Các thành viên khác cố mở cùng lead sẽ nhận thông báo "Sale ... đang xử lý", không thao tác được.
5. Khi người xử lý hoàn tất và lưu, hoặc thoát ra giữa chừng → khóa được giải phóng ngay lập tức.
6. Lead vẫn tồn tại vĩnh viễn trong danh sách Cột chăm sóc (không tự động biến mất) — chỉ Admin có quyền xóa khỏi danh sách này.
7. *(Khuyến nghị bổ sung sau Design Review)* Trường hợp mất kết nối/tắt trình duyệt đột ngột không kịp gửi tín hiệu thoát: cần có cơ chế dự phòng ở tầng backend để tự giải phóng khóa sau một khoảng thời gian ngắn không có hoạt động, tránh khóa bị "treo" vĩnh viễn — xem Mục 4.3.

### 9.5. Luồng hẹn phỏng vấn và theo dõi kết quả
1. Sale cập nhật lịch hẹn PV + tên công ty đối tác (nhập tự do).
2. Đến ngày hẹn, Sale cập nhật: Đến PV hoặc Bùng PV.
3. Nếu Bùng PV → có thể quay lại bước 1 để hẹn lịch mới.
4. Nếu Đến PV → cập nhật kết quả: Đỗ PV hoặc Trượt PV.
5. Nếu Đỗ PV → cập nhật tiếp: Đã đi làm hoặc Không đi làm (kèm lý do nếu không đi làm).
6. Mọi bước trên đều có thể sửa lại sau này (không có trạng thái khóa vĩnh viễn).

### 9.6. Luồng nhân viên nghỉ việc / bàn giao tài khoản
1. Sale nghỉ việc — không cần thao tác chuyển lead, vì Leader và các thành viên khác trong nhóm vẫn quản lý/chăm sóc chung được (thông qua Cột chăm sóc).
2. Khi có nhân viên mới thay thế, Admin mở màn hình Quản lý tài khoản, đổi tên/thông tin đăng nhập của tài khoản cũ sang nhân viên mới.
3. Toàn bộ lead đã gán trước đó giữ nguyên, không cần thao tác lại.

### 9.7. Luồng phát hiện trùng lặp
1. Khi MKT nhập/import lead mới, hệ thống kiểm tra SĐT đã tồn tại trong hệ thống chưa.
2. Nếu trùng trong cùng nhóm: hiển thị cảnh báo nhỏ ngay lúc nhập ("đã trùng với data ngày ... của nhân viên ..."), vẫn cho lưu, gắn màu chữ đánh dấu để mọi người trong nhóm nhận biết khi xem danh sách.
3. Nếu trùng khác nhóm: không cảnh báo cho Sale/Leader liên quan, nhưng MKT/Quản lý/Admin luôn thấy được đầy đủ thông tin trùng lặp trong màn hình Danh sách trùng lặp (S15).

### 9.8. Luồng thông báo Zalo
1. Worker nền kiểm tra định kỳ các mốc lịch gọi lại/hẹn PV sắp đến giờ.
2. Khi đến thời điểm cần nhắc, hệ thống gửi thông báo qua Zalo tới nhân viên phụ trách.

### 9.9. Luồng đăng nhập & reset mật khẩu
1. Nhân viên đăng nhập bằng tài khoản/mật khẩu do Admin cấp — cho phép đăng nhập nhiều thiết bị cùng lúc.
2. Nếu quên mật khẩu, nhân viên liên hệ Admin.
3. Admin vào màn hình Quản lý tài khoản, chọn Reset mật khẩu → mật khẩu của tài khoản đó trở về mặc định ("123456") → nhân viên tự đăng nhập lại bằng mật khẩu mặc định.

---

## 10. Các điểm có thể mở rộng trong tương lai

1. **Module Đưa đón lao động:** bổ sung vai trò/quy trình cho bộ phận đưa đón công nhân tới nhà máy, kết nối với trạng thái "Đến PV"/"Đi làm" hiện có.
2. **Danh mục đối tác (nhà máy) chuẩn hóa:** chuyển trường "công ty hẹn" từ nhập tự do sang danh sách quản lý tập trung, cho phép thống kê/báo cáo chính xác theo từng đối tác, đồng thời có thể mở rộng thành module "Quản lý đơn hàng lao động" nếu sau này công ty cần theo dõi nhu cầu tuyển dụng cụ thể của từng đối tác.
3. **Mở rộng kênh thông báo:** bổ sung thông báo trong app (chuông thông báo), email, SMS bên cạnh Zalo.
4. **Phân quyền linh hoạt hơn (Permission Builder):** xây dựng giao diện cấu hình quyền chi tiết dạng checklist đầy đủ cho vai trò Quản lý/Leader (hiện đang ghi nhận là điểm chưa rõ tại tài liệu 09, Mục 11).
5. **Báo cáo nâng cao:** so sánh số liệu theo kỳ (tuần/tháng/quý), xuất báo cáo, biểu đồ xu hướng dài hạn.
6. **Tìm kiếm nâng cao:** khi khối lượng dữ liệu tăng lên tới hàng triệu bản ghi, có thể bổ sung công cụ tìm kiếm chuyên dụng (full-text search) để tăng tốc độ tra cứu.
7. **Mở rộng nhiều chi nhánh/văn phòng:** hiện tại hệ thống thiết kế cho 1 văn phòng; kiến trúc phân quyền theo nhóm hiện có (Leader – nhóm) có thể mở rộng thêm 1 cấp "chi nhánh" nếu công ty phát triển thêm văn phòng mới.
8. **Cổng thông tin cho đối tác (nhà máy):** nếu sau này công ty muốn đối tác tự tra cứu tiến độ ứng viên đã giới thiệu, có thể bổ sung một cổng truy cập giới hạn dành riêng cho đối tác.
9. **Tự động hóa nhắc việc thông minh hơn:** ví dụ tự gợi ý sale nên ưu tiên gọi lại lead nào trước dựa trên lịch sử/độ tiềm năng.

---

*Tài liệu được xây dựng dựa trên `docs/09-business-specification.md`. Không viết code, không thiết kế database, không thiết kế giao diện chi tiết — đúng theo yêu cầu.*
