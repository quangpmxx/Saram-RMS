# Saram RMS — CRM Tuyển dụng / Cung ứng lao động

Trạng thái: **Phase 0** (Nền tảng hệ thống & Tài khoản), **Phase 1** (Thu thập dữ liệu ứng viên) và **Phase 2** (Phân chia thủ công & Không gian Sale/Leader) đã hoàn thành (xem `docs/14-roadmap.md`).

Đã có:
- Đăng nhập, quản lý tài khoản nhân viên (Admin/Quản lý/Leader/MKT/Sale), quản lý nhóm, phân quyền theo vai trò, ghi nhật ký thao tác (Phase 0).
- Màn hình **Ứng viên**: MKT nhập ứng viên thủ công hoặc nhập hàng loạt từ file Excel, cảnh báo trùng số điện thoại tự động, tìm kiếm/lọc danh sách (Phase 1).
- **Chờ phân chia**, phân chia thủ công (từng lead hoặc hàng loạt), chuyển lead giữa các Sale trong nhóm, không gian "Lead của tôi" cho Sale, workload từng Sale cho Leader (Phase 2).

Các nghiệp vụ tuyển dụng tiếp theo (pipeline cuộc gọi/ghi chú, lịch phỏng vấn, cột chăm sóc, dashboard, thông báo Zalo...) sẽ có ở các Phase sau.

---

## 1. Yêu cầu hệ thống

- **Node.js 20 trở lên** (khuyến nghị dùng bản LTS mới nhất). Kiểm tra bằng:
  ```bash
  node -v
  ```
- Không bắt buộc cài PostgreSQL hay Docker thủ công — hướng dẫn bên dưới dùng công cụ đi kèm sẵn trong dự án (mục 3, Cách A). Nếu anh đã có Docker Desktop, có thể dùng Cách B.

## 2. Cấu trúc dự án

```
Saram-RMS/
├── backend/     — API NestJS + Prisma (PostgreSQL)
├── frontend/    — Giao diện Next.js
├── docs/        — Toàn bộ tài liệu đặc tả/thiết kế (Design Freeze)
├── sample-data/ — File Excel mẫu để thử chức năng nhập ứng viên (mục 5)
└── docker-compose.yml  — PostgreSQL (lựa chọn thay thế, xem mục 3 Cách B)
```

---

## 3. Cài đặt lần đầu — làm theo đúng thứ tự

### Bước 1 — Cài dependencies

Mở Terminal, chạy lần lượt (mỗi thư mục cài riêng, đây là 2 dự án độc lập):

```bash
cd backend
npm install

cd ../frontend
npm install
```

> **Nếu gặp lỗi `EACCES ... .npm/_cacache`:** đây là lỗi quyền thư mục cache của npm trên máy, không phải lỗi của dự án. Chạy lệnh sau rồi cài lại:
> ```bash
> sudo chown -R $(whoami) ~/.npm
> ```

### Bước 2 — Chuẩn bị database

Chọn **1 trong 2 cách**:

**Cách A — Không cần cài gì thêm (khuyến nghị để bắt đầu nhanh):**

Mở 1 tab Terminal riêng, để chạy xuyên suốt lúc phát triển:
```bash
cd backend
npx prisma dev
```
Lệnh này sẽ in ra 1 dòng `DATABASE_URL=...` — **copy giá trị này**, sẽ dùng ở Bước 3. Cứ để tab Terminal này chạy, không tắt.

**Cách B — Dùng Docker (nếu đã cài Docker Desktop):**
```bash
cd Saram-RMS   # thư mục gốc dự án
docker compose up -d
```
Với cách này, dùng đúng giá trị mẫu có sẵn trong `backend/.env.example` (không cần copy gì thêm).

### Bước 3 — Cấu hình biến môi trường

```bash
cd backend
cp .env.example .env
```
Mở file `backend/.env` vừa tạo:
- Nếu dùng **Cách A**: dán đè giá trị `DATABASE_URL` bằng dòng đã copy ở Bước 2. Giữ nguyên `DATABASE_POOL_MAX=1` (bắt buộc với Cách A — xem giải thích ngay trong file).
- Nếu dùng **Cách B**: giữ nguyên `DATABASE_URL` mặc định, và có thể xóa dòng `DATABASE_POOL_MAX` (Postgres thật không cần giới hạn này).

```bash
cd ../frontend
cp .env.example .env.local
```
File `frontend/.env.local` giữ nguyên giá trị mặc định là chạy được.

### Bước 4 — Tạo cấu trúc database và tài khoản Admin đầu tiên

```bash
cd ../backend
npm run prisma:generate
npm run prisma:deploy
npm run build
npm run seed
```

Nếu thành công, terminal in ra dòng dạng:
```
Đã tạo tài khoản Admin đầu tiên: username="admin", mật khẩu mặc định="123456"
...
Đã tạo tài khoản MKT mẫu: username="mkt_demo", mật khẩu mặc định="123456"
Đã tạo 5 ứng viên mẫu cho tài khoản "mkt_demo".
Đã tạo nhóm "Nhóm Sale Demo" với Leader (leader_demo/123456) và 2 Sale (sale_demo_a, sale_demo_b/123456).
Đã phân chia 2 ứng viên mẫu cho Sale Demo A/B — số còn lại vẫn ở trạng thái "Chờ phân chia".
```
**Ghi nhớ tài khoản Admin** — đây là tài khoản duy nhất có quyền tạo tài khoản khác. Lệnh `seed` còn tạo sẵn: 1 tài khoản MKT mẫu (`mkt_demo`/`123456`) kèm 5 ứng viên mẫu (trong đó có 1 cặp trùng số điện thoại); 1 nhóm mẫu "Nhóm Sale Demo" với Leader (`leader_demo`/`123456`) và 2 Sale (`sale_demo_a`, `sale_demo_b`/`123456`), trong đó 2/5 ứng viên mẫu đã được phân chia sẵn — xem mục 5.

---

## 4. Chạy dự án hàng ngày (sau khi đã cài đặt xong ở mục 3)

Cần **3 tab Terminal chạy đồng thời**:

**Tab 1 — Database** (bỏ qua nếu đang dùng Docker ở Cách B — khi đó chỉ cần đảm bảo `docker compose up -d` đã chạy):
```bash
cd backend
npx prisma dev
```

**Tab 2 — Backend:**
```bash
cd backend
npm run start:dev
```
Chạy thành công khi thấy dòng `Nest application successfully started`. Backend chạy ở `http://localhost:3001`.

**Tab 3 — Frontend:**
```bash
cd frontend
npm run dev
```
Chạy thành công khi thấy dòng `Ready in ...`. Mở trình duyệt vào `http://localhost:3000`.

---

## 5. Đăng nhập và thử nghiệm

### 5.1. Tài khoản & nhóm (Phase 0)

1. Mở `http://localhost:3000` → tự động chuyển tới trang đăng nhập.
2. Đăng nhập bằng tài khoản Admin đã tạo ở Bước 4 (mục 3): `admin` / `123456`.
3. Vào **Quản lý nhóm** → tạo 1 nhóm mới.
4. Vào **Quản lý tài khoản** → tạo thử vài tài khoản (Leader/Sale cần chọn nhóm; Quản lý/MKT thì không).
5. Đăng xuất, đăng nhập lại bằng tài khoản vừa tạo để xác nhận hoạt động đúng.

### 5.2. Ứng viên (Phase 1)

1. Đăng nhập bằng tài khoản MKT mẫu đã seed sẵn: `mkt_demo` / `123456` (hoặc tài khoản vai trò MKT do Admin tự tạo).
2. Vào **Ứng viên** → đã thấy sẵn 5 ứng viên mẫu, trong đó **Phạm Thị Duyên** có 2 dòng cùng số điện thoại `0901000004` được đánh dấu **Trùng lặp** — minh họa cơ chế cảnh báo trùng SĐT (Mục 4, `docs/09`).
3. Bấm **Thêm ứng viên** → nhập thủ công 1 ứng viên mới. Nếu nhập số điện thoại trùng với ứng viên đã có, hệ thống hiện cảnh báo ngay.
4. Bấm **Nhập từ Excel** → chọn file mẫu `sample-data/mau-import-ung-vien.xlsx` (đi kèm sẵn trong dự án). File này có chủ đích 3 loại dòng: 3 dòng hợp lệ, 1 dòng lỗi (thiếu số điện thoại), 1 dòng trùng SĐT với ứng viên mẫu "Nguyễn Văn An" — nhập xong sẽ thấy kết quả đếm theo 3 loại (thành công/lỗi/trùng) và chi tiết lỗi theo từng dòng.
5. Thử sửa/xoá 1 ứng viên do tài khoản `mkt_demo` tạo — thành công. Nếu đăng nhập bằng tài khoản MKT khác và thử sửa/xoá ứng viên của `mkt_demo`, hệ thống sẽ từ chối (chỉ người nhập được sửa/xoá dữ liệu của mình, theo Mục 2.6 `docs/09`).
6. Vai trò Quản lý xem được toàn bộ danh sách nhưng không sửa/xoá được.

### 5.3. Phân chia & không gian Sale/Leader (Phase 2)

1. Đăng nhập bằng tài khoản Leader mẫu: `leader_demo` / `123456`.
2. Vào **Ứng viên** → thấy khối **"Khối lượng công việc nhóm"** (số lead mỗi Sale đang phụ trách) và nút chuyển tab **Tất cả / Chờ phân chia**.
3. Bấm tab **Chờ phân chia** → thấy các ứng viên chưa ai phụ trách (3 ứng viên mẫu còn lại). Tick chọn 1-2 dòng → bấm **Phân chia đã chọn** → chọn Sale (`sale_demo_a` hoặc `sale_demo_b`) → xác nhận. Ứng viên biến mất khỏi "Chờ phân chia", khối workload cập nhật ngay.
4. Chuyển sang tab **Tất cả** → với ứng viên đã có người phụ trách, bấm **Chuyển** → chọn Sale khác trong nhóm (có thể ghi lý do) → xác nhận. Sale cũ không còn thấy ứng viên đó nữa.
5. Đăng xuất, đăng nhập bằng `sale_demo_a` / `123456` → vào **Ứng viên**, chỉ thấy đúng các ứng viên đang được giao cho mình (không có tab Chờ phân chia, không thấy dữ liệu của `sale_demo_b`).
6. Thử đăng nhập bằng tài khoản Leader của 1 nhóm khác (tự tạo qua **Quản lý tài khoản**) và thử phân chia/chuyển ứng viên của "Nhóm Sale Demo" → hệ thống từ chối (chỉ thao tác được trong nhóm mình, theo Mục 3 `docs/09`).

---

## 6. Kiểm tra chất lượng (không bắt buộc, dùng khi cần xác minh lại)

```bash
cd backend
npm test           # unit test
npm run test:e2e   # ⚠️ XÓA SẠCH dữ liệu trong database đang cấu hình ở .env trước khi test — xem cảnh báo dưới
npm run lint

cd ../frontend
npm run lint
npm run build       # build thử để chắc chắn không lỗi
```

> **⚠️ Cảnh báo quan trọng:** `npm run test:e2e` sẽ chạy `TRUNCATE` toàn bộ bảng `accounts`, `teams`, `sessions`, `audit_logs`, `leads`, `import_jobs` trong database mà `backend/.env` đang trỏ tới, kể cả tài khoản Admin và toàn bộ dữ liệu mẫu đã seed (ứng viên, nhóm, Leader/Sale demo) — đây là hành vi cố ý để test tự chạy lặp lại được, **không phải lỗi**. Nếu chạy lệnh này trên cùng database đang dùng để phát triển/thử nghiệm hàng ngày, phải **chạy lại `npm run seed` ngay sau đó** để có lại toàn bộ tài khoản/dữ liệu mẫu, nếu không đăng nhập sẽ báo "Tên đăng nhập hoặc mật khẩu không đúng" dù mọi thứ khác đều đúng. Tốt nhất nên dùng 1 database riêng cho việc chạy `test:e2e`, tách khỏi database phát triển hàng ngày.

---

## 7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân/Cách xử lý |
|---|---|
| `EACCES` khi `npm install` | Xem ghi chú ở Bước 1, mục 3. |
| Backend báo lỗi kết nối database | Kiểm tra Tab 1 (database) còn đang chạy không; kiểm tra `DATABASE_URL` trong `backend/.env` đúng chưa. |
| Trang web báo lỗi không gọi được API | Kiểm tra Tab 2 (backend) còn chạy ở cổng 3001 không; kiểm tra `frontend/.env.local`. |
| `next dev` báo "Port 3000 is in use" | Có tiến trình cũ chưa tắt hẳn — đóng hết các tab Terminal cũ đang chạy `next` rồi mở lại, hoặc tắt tiến trình đang chiếm cổng. |
| Quên mật khẩu tài khoản Admin duy nhất | Chạy lại `npm run seed` sẽ báo "đã tồn tại — bỏ qua"; cần tạo Admin khác bằng cách sửa trực tiếp database, hoặc liên hệ để được hướng dẫn thêm (chưa có màn hình "quên mật khẩu" ở Phase 0, đúng theo thiết kế — chỉ Admin reset được mật khẩu người khác). |
| Trang web thỉnh thoảng báo lỗi 401/500 ngẫu nhiên (vd. màn Quản lý nhóm) dù đã đăng nhập đúng | Chỉ xảy ra khi dùng Cách A (`npx prisma dev`) — kiểm tra `backend/.env` có dòng `DATABASE_POOL_MAX=1` chưa; nếu thiếu, thêm vào rồi khởi động lại backend. |

---

## 8. Bước tiếp theo

Phase 0, 1 và 2 đã xong (Tài khoản & Nhóm; Thu thập dữ liệu ứng viên; Phân chia thủ công & Không gian Sale/Leader). Các nghiệp vụ tiếp theo (pipeline cuộc gọi/ghi chú, lịch phỏng vấn, cột chăm sóc, dashboard, thông báo Zalo...) sẽ được xây dựng lần lượt theo `docs/14-roadmap.md`, từng Phase độc lập và có thể dùng ngay sau khi hoàn thành.
