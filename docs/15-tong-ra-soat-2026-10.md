# Tổng rà soát 30-10-2026 — kết quả và hướng dẫn triển khai

Tài liệu bổ sung (không sửa docs 09–13 đã chốt). Nhánh thực hiện: `refactor/tong-ra-soat`.
Kế hoạch gốc và các quyết định nằm trong file Excel "Saram-RMS - Giai doan 1 - Khao sat 30-10-2026.xlsx".

## 1. Đã làm

| Bước | Commit | Nội dung |
|---|---|---|
| B1 | 74fab80 | Gán lead (đơn lẻ/hàng loạt) an toàn khi nhiều người bấm cùng lúc — người đến sau nhận lỗi 409. Giới hạn đăng nhập sai: 5 lần/tài khoản, 20 lần/IP thì khoá 15 phút. Thêm header bảo mật cơ bản. Tự ngắt kết nối realtime khi tài khoản bị khoá/xoá/đổi nhóm/đổi trạng thái. |
| B2 | a8fe81b | Gom code dùng chung ở backend (`findOwnTeamId`, `ROLE_LABEL`), đổi tên hằng số quyền cho rõ nghĩa. Không đổi hành vi. |
| B3 | 0002cba | Quyền trên giao diện dùng chung một nơi (`frontend/lib/lead-permissions.ts`). Danh sách đơn nghỉ báo lỗi khi tải thất bại. |
| B5 | d867bd5 | Gỡ code chết đã xác minh không còn nơi dùng: module Care-pool, `/checkin/preview`, `/column-width`, `/report/funnel`, `/report/by-source`, e2e phase5, 3 thư viện thừa. Giữ nguyên cột DB và trường response. Seed không in mật khẩu. |
| B8 | 1c63080 | Index cho Nhật ký; Đưa đón xoá mềm; bắt đổi mật khẩu khi dùng mật khẩu mặc định (trang `/doi-mat-khau`). |
| B7 | c0105b9 | Hiệu năng: Dashboard hiệu suất/xếp hạng gom query theo cả danh sách Sale (trước ~6 query/Sale, giờ 6 query tổng); chỉ ghi `lastActiveAt` khi cũ hơn 60 giây; thông báo Đưa đón chạy song song. |
| B6 | bb9de25 | Thêm test hồi quy cho phần hiệu suất Dashboard và `JwtStrategy`. Toàn bộ 577 test backend đạt; frontend `tsc` sạch. |

## 2. Cố ý không làm

- **B4 — tách file lớn:** rủi ro cao, ít lợi ích ngay. Nên tách từng module khi lần tới phải sửa đến nó.
- **M4 — thống nhất định dạng ngày:** sẽ đổi chữ hiển thị trên giao diện, cần người dùng quyết.
- **H3 — danh sách Kho:** đang nạp toàn bộ lead trong Kho vào bộ nhớ rồi lọc (≈230 ms với dữ liệu hiện tại). Viết lại dễ làm lệch số liệu; nên làm khi Kho lớn lên rõ rệt (hàng chục nghìn lead).

## 3. Giới hạn của lần kiểm tra này (nói rõ để không hiểu nhầm)

- **Chưa đo lại thời gian thực tế sau B7.** Mốc trước B7 (DB tạm, trung vị 12 lần): mở Dashboard 0,9–1,3 giây; ranking ≈500 ms; performance 58–508 ms tuỳ vai trò. Mức cải thiện hiện chỉ được chứng minh bằng số query giảm, chưa bằng giây. Nên đo lại bằng đúng kịch bản cũ trước khi tuyên bố con số.
- **Chưa chạy e2e phân quyền theo vai trò trên DB tạm** (các bộ `test/*.e2e-spec.ts` cần database). B6 chỉ gồm unit test. Nên chạy `npm run test:e2e` trên DB tạm trước khi đưa lên máy chủ thật.
- `npx tsc --noEmit` ở backend báo 3 lỗi kiểu `Buffer` có sẵn trong `attendance.service.spec.ts` và `test/phase6.e2e-spec.ts` — không thuộc đợt này, không ảnh hưởng chạy thật.

## 4. Hướng dẫn triển khai lên VPS

Các điểm dưới đây rút từ `backend/.env.example`, `frontend/.env.example` và code hiện tại.

**Backend (`backend/.env`)**
- `NODE_ENV=production` — **bắt buộc**. Các endpoint seed/demo (vd `POST /dashboard/seed-demo-data`) tự bị chặn khi production.
- `DATABASE_URL` trỏ tới PostgreSQL thật. **Xoá dòng `DATABASE_POOL_MAX`** (chỉ dùng cho `prisma dev` ở máy cá nhân).
- `JWT_SECRET` — đổi sang chuỗi ngẫu nhiên dài, không dùng giá trị mẫu.
- `DEFAULT_PASSWORD` — đặt khác giá trị mẫu. Tài khoản mới/reset sẽ bị bắt đổi mật khẩu ở lần đăng nhập đầu.
- `CORS_ORIGIN` — đúng origin HTTPS của frontend (cookie đăng nhập cần khớp chính xác).
- `SEED_ADMIN_USERNAME` — chỉ dùng cho lần `npm run seed` đầu tiên; sau đó nên đổi mật khẩu Admin ngay.

**Frontend (`frontend/.env`)**
- `NEXT_PUBLIC_API_URL=/api` và `API_URL` trỏ backend trên cùng máy.

**Các bước**
1. `npx prisma migrate deploy` (không dùng `migrate dev` trên máy chủ). Đã gồm các migration B8: `20261031090000` (index Nhật ký), `20261031091000` (Đưa đón xoá mềm), `20261031092000` (cờ bắt đổi mật khẩu).
2. `npm run seed` một lần để tạo Admin đầu tiên.
3. Build và chạy backend + frontend bằng trình quản lý tiến trình (pm2/systemd).
4. Đặt reverse proxy (nginx/Caddy) có **HTTPS**.

**Lưu ý vận hành**
- **Chỉ chạy 1 bản backend.** Bộ giới hạn đăng nhập sai nằm trong bộ nhớ (`auth/login-attempt-limiter.ts`); chạy nhiều bản hoặc khởi động lại sẽ làm mất/đếm lệch. Khi cần mở rộng nhiều bản, chuyển bộ đếm sang Redis/DB.
- **Sao lưu 2 thư mục tải lên:** `uploads` và `private-uploads` (ảnh đại diện, tệp riêng tư) — không nằm trong database nên backup DB không đủ.
- **Sao lưu PostgreSQL định kỳ** (`pg_dump`) và thử khôi phục ít nhất một lần.
- Backend đặt `trust proxy = 1` (tin đúng 1 lớp proxy). Reverse proxy phải đứng **ngay trước** backend và gửi `X-Forwarded-For`; nếu không, giới hạn đăng nhập theo IP sẽ tính nhầm mọi người là một IP.
