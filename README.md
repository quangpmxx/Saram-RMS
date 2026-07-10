# Saram RMS — CRM Tuyển dụng / Cung ứng lao động

Trạng thái: **Phase 0** (Nền tảng hệ thống & Tài khoản), **Phase 1** (Thu thập dữ liệu ứng viên), **Phase 2** (Phân chia thủ công & Không gian Sale/Leader), **Phase 3** (Pipeline cuộc gọi & Lịch sử ghi chú), **Phase 4** (Lịch phỏng vấn, lịch gọi lại & Calendar), **Phase 5** (Cột chăm sóc tự động & Cấu hình vận hành) và **Phase 6** (Tự động phân chia lead — Round-robin) đã hoàn thành (xem `docs/14-roadmap.md`).

Đã có:
- Đăng nhập, quản lý tài khoản nhân viên (Admin/Quản lý/Leader/MKT/Sale), quản lý nhóm, phân quyền theo vai trò, ghi nhật ký thao tác (Phase 0).
- Màn hình **Ứng viên**: MKT nhập ứng viên thủ công hoặc nhập hàng loạt từ file Excel, cảnh báo trùng số điện thoại tự động, tìm kiếm/lọc danh sách (Phase 1).
- **Chờ phân chia**, phân chia thủ công (từng lead hoặc hàng loạt), chuyển lead giữa các Sale trong nhóm, không gian "Lead của tôi" cho Sale, workload từng Sale cho Leader (Phase 2).
- Màn hình **Chi tiết ứng viên**: Sale cập nhật tình trạng/kết quả cuộc gọi, ghi lịch sử ghi chú theo thời gian (không ghi đè), xóa mềm ghi chú (vẫn giữ lịch sử) — MKT xem được nhưng không sửa (Phase 3).
- Đặt lịch hẹn phỏng vấn (kèm hẹn lại khi bùng PV, giữ nguyên lịch sử các lần hẹn), cập nhật kết quả PV/đi làm (đỗ/trượt, đi làm/không đi làm kèm lý do bắt buộc), đặt lịch gọi lại, màn hình **Lịch hẹn** dạng agenda tổng hợp cả 2 loại lịch (Phase 4).
- **Cột chăm sóc**: lead bị bỏ quên quá ngưỡng thời gian (mặc định 30 phút, chỉnh được) tự động chuyển vào cột chăm sóc dùng chung của nhóm; Sale mở lead để xử lý sẽ tự chiếm khóa (khóa hết hạn sau 15 phút nếu quên giải phóng), Admin gỡ khỏi cột chăm sóc khi cần. Sale đánh dấu/bỏ đánh dấu **giữ số** ngay trên trang Chi tiết ứng viên để tạm dừng cơ chế tự động này. Màn hình **Cấu hình vận hành** (Admin) để chỉnh ngưỡng thời gian trên (Phase 5).
- **Tự động phân chia lead (Round-robin)**: Leader cấu hình danh sách + thứ tự Sale tham gia vòng quay ngay trên màn hình Ứng viên, kích hoạt/tạm dừng bất kỳ lúc nào; khi bật, lead mới (nhập tay hoặc import Excel) tự động gán lần lượt theo thứ tự, quay vòng lại từ đầu khi hết danh sách — tự động bỏ qua Sale đã nghỉ việc/rời nhóm; tạm dừng thì quay về phân chia thủ công (Phase 6).

Các nghiệp vụ tuyển dụng tiếp theo (dashboard, thông báo Zalo...) sẽ có ở các Phase sau.

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
Đã tạo nhóm "Nhóm Sale Demo 2" với Leader (leader_demo_2/123456) và Sale (sale_demo_c/123456).
Đã tạo 3 ứng viên trùng SĐT 0901000005 ở 2 nhóm khác nhau + 1 chưa phân chia để thử tooltip "Trùng SĐT".
Đã cập nhật tình trạng/kết quả cuộc gọi + 3 ghi chú (1 đã xóa mềm) cho ứng viên "Nguyễn Văn An".
Đã tạo dữ liệu mẫu Phase 4: lịch hẹn PV cho "Nguyễn Văn An" (đã đi làm) và "Trần Thị Bình" (bùng PV → đỗ nhưng không đi làm → hẹn lại sắp tới) + 1 lịch gọi lại.
Đã seed tham số cấu hình CARE_POOL_THRESHOLD_MINUTES = 30.
Đã tạo ứng viên mẫu "Hoàng Văn Đạt" (Sale Demo B) đang ở Cột chăm sóc do bỏ quên quá ngưỡng.
Đã tạo cấu hình vòng quay mẫu [Sale Demo A → Sale Demo B] cho "Nhóm Sale Demo" (đang TẮT — Leader tự kích hoạt khi muốn thử).
```
**Ghi nhớ tài khoản Admin** — đây là tài khoản duy nhất có quyền tạo tài khoản khác. Lệnh `seed` còn tạo sẵn: 1 tài khoản MKT mẫu (`mkt_demo`/`123456`) kèm 5 ứng viên mẫu (trong đó có 1 cặp trùng số điện thoại); 2 nhóm mẫu "Nhóm Sale Demo" (Leader `leader_demo`/`123456`, Sale `sale_demo_a`/`sale_demo_b`/`123456`) và "Nhóm Sale Demo 2" (Leader `leader_demo_2`/`123456`, Sale `sale_demo_c`/`123456`); riêng SĐT `0901000005` cố tình trùng ở cả 2 nhóm + 1 bản ghi chưa phân chia, để thử ngay tooltip "Trùng SĐT" với đủ tình huống cùng nhóm/khác nhóm; ứng viên "Nguyễn Văn An" đã có sẵn tình trạng/kết quả cuộc gọi + 3 ghi chú (1 đã xóa mềm) và 1 lịch hẹn PV đã "Đỗ PV" + "Đã đi làm"; ứng viên "Trần Thị Bình" có sẵn 3 lần hẹn PV (bùng PV → đỗ nhưng không đi làm kèm lý do → hẹn lại sắp tới) + 1 lịch gọi lại — để thử ngay màn Chi tiết ứng viên và Lịch hẹn, xem mục 5; ứng viên "Hoàng Văn Đạt" (Sale Demo B) đã được đặt sẵn ở trạng thái bị bỏ quên quá ngưỡng (30 phút) nên xuất hiện ngay trong tab **Cột chăm sóc** mà không cần đợi worker quét — để thử ngay mục 5.7; "Nhóm Sale Demo" đã có sẵn cấu hình vòng quay tự động phân chia [Sale Demo A → Sale Demo B] nhưng cố ý để **TẮT** — để thử ngay mục 5.8 mà không ảnh hưởng các bước demo phân chia thủ công khác.

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

### 5.4. Xem chi tiết trùng SĐT (tooltip)

1. Đăng nhập `admin` / `123456` (hoặc `mkt_demo`) → vào **Ứng viên**, tìm ứng viên "Võ Thị Em" (có 3 dòng cùng SĐT `0901000005`). Rê chuột (hoặc bấm) vào badge **Trùng SĐT** cạnh số điện thoại → hiện popup đầy đủ: tên các ứng viên trùng, ngày up, Sale phụ trách, nhóm của Sale, trạng thái hiện tại. Admin/MKT/Quản lý luôn thấy toàn bộ (Mục 10.4, `docs/09`).
2. Đăng xuất, đăng nhập `leader_demo` / `123456` (thuộc "Nhóm Sale Demo") → vào **Ứng viên**, tìm ứng viên "Võ Thị Em (Nhóm 1)" → rê chuột vào badge **Trùng SĐT** → vì 2 bản ghi trùng còn lại thuộc "Nhóm Sale Demo 2" và chưa phân chia (không phải nhóm mình), popup chỉ hiện dòng chung: **"Số điện thoại này đã tồn tại trong hệ thống."**
3. Đăng nhập `leader_demo_2` / `123456` → tìm "Võ Thị Em (Nhóm 2)" → rê chuột vào badge → tương tự, chỉ thấy dòng chung (bản ghi trùng còn lại thuộc nhóm khác).
4. Đăng nhập `sale_demo_a` / `123456` → nếu có ứng viên trùng SĐT trong đúng nhóm mình (ví dụ tạo thêm 1 lead cùng SĐT rồi phân chia cho `sale_demo_b` cùng nhóm), Sale vẫn xem được chi tiết bản ghi trùng **trong nhóm mình**, nhưng không thấy chi tiết của nhóm khác.

### 5.5. Chi tiết ứng viên — cuộc gọi & ghi chú (Phase 3)

1. Đăng nhập `sale_demo_a` / `123456` → vào **Ứng viên** → bấm vào tên "Nguyễn Văn An" để mở màn **Chi tiết ứng viên**. Đã thấy sẵn: tình trạng cuộc gọi "Đã gọi", kết quả "Hẹn gọi lại", 2 ghi chú lịch sử (ghi chú thứ 3 đã bị xóa nên không hiện trong danh sách chính).
2. Bấm **Gọi ngay** → chọn lại tình trạng/kết quả cuộc gọi → **Cập nhật** → thấy phản ánh ngay trên khối "Tiến trình cuộc gọi" và cả badge trên danh sách chính.
3. Bấm **Thêm ghi chú** → nhập nội dung → **Lưu**, lặp lại 2-3 lần liên tiếp → xác nhận cả 3 ghi chú đều xuất hiện, không cái nào bị ghi đè.
4. Bấm **Xóa** trên 1 ghi chú do chính `sale_demo_a` ghi → ghi chú biến mất khỏi danh sách ngay (dữ liệu vẫn còn trong hệ thống, đánh dấu `is_deleted`, chưa có màn hình tra cứu riêng — sẽ có ở Phase 9).
5. Đăng xuất, đăng nhập `sale_demo_b` / `123456` → mở lại ứng viên "Nguyễn Văn An" → không có nút **Gọi ngay**/**Thêm ghi chú**/**Xóa** vì ứng viên này không phải của mình; đăng nhập `mkt_demo` / `123456` → mở lại → xem được toàn bộ ghi chú nhưng cũng không có các nút thao tác (chỉ xem, đúng Mục 2.6 `docs/09`).
6. Đăng nhập `leader_demo` / `123456` (Leader của nhóm `sale_demo_a`) → mở ứng viên → vẫn cập nhật/ghi chú được (trong phạm vi nhóm mình) nhưng không xóa được ghi chú do Sale ghi (chỉ chính Sale đó xóa được — theo giả định tạm ghi trong `docs/13`, xem mục "Lưu ý" trong `docs/09` Mục 11.7).

### 5.6. Lịch phỏng vấn, lịch gọi lại & Calendar (Phase 4)

1. Đăng nhập `sale_demo_b` / `123456` → mở ứng viên "Trần Thị Bình" — khối **"Phỏng vấn & đi làm"** đã có sẵn 3 lần hẹn PV: **Lần 1** Bùng PV, **Lần 2** Đỗ PV + Không đi làm (kèm lý do), **Lần 3** Đã hẹn PV (sắp tới) — minh họa đúng tiêu chí "bùng PV vẫn hẹn lại được, giữ nguyên lịch sử cả 2 lần".
2. Bấm **Đặt lịch PV** → nhập công ty đối tác + ngày giờ hẹn → **Đặt lịch** → lần hẹn mới xuất hiện ngay trong danh sách với số thứ tự tăng dần (attempt_no tự tăng).
3. Bấm **Cập nhật kết quả** trên lần hẹn 3 (Đã hẹn PV) → đổi sang **Đỗ PV** → chọn kết quả đi làm là **Không đi làm** nhưng để trống lý do → **Cập nhật** → hệ thống báo lỗi bắt buộc nhập lý do. Nhập lý do → cập nhật lại → thành công.
4. Vào **Ứng viên** → thấy 2 cột mới **Trạng thái PV** và **Trạng thái đi làm** phản ánh đúng lần hẹn mới nhất; thử lọc theo "Trạng thái PV"/"Trạng thái đi làm"/"Công ty đối tác" trong khối bộ lọc.
5. Bấm **Đặt lịch gọi lại** trên ứng viên bất kỳ đang phụ trách → chọn thời điểm → xác nhận.
6. Vào menu **Lịch hẹn** → thấy toàn bộ lịch hẹn PV + lịch gọi lại của "Trần Thị Bình" trong khoảng ngày mặc định (7 ngày trước → 30 ngày sau), nhóm theo từng ngày. Bấm vào 1 dòng → mở thẳng màn Chi tiết ứng viên tương ứng. Thử đổi khoảng ngày rồi bấm **Lọc**.
7. Bấm **Đặt lịch hẹn PV mới** ngay trên trang **Lịch hẹn** (không cần vào Candidate trước) → tìm ứng viên theo tên/SĐT → chọn → nhập công ty đối tác + ngày giờ → xác nhận, không cần mở màn Chi tiết ứng viên trước.
8. Đăng nhập `sale_demo_a` / `123456` → vào **Lịch hẹn** → chỉ thấy lịch hẹn của ứng viên mình phụ trách ("Nguyễn Văn An"), không thấy lịch của `sale_demo_b`. Đăng nhập `mkt_demo` / `123456` → menu không có mục **Lịch hẹn** (MKT chỉ xem dữ liệu ứng viên, không xử lý pipeline theo `docs/10` Mục 6).

### 5.7. Cột chăm sóc tự động & Cấu hình vận hành (Phase 5)

1. Đăng nhập `sale_demo_a` / `123456` (đồng đội cùng nhóm với `sale_demo_b`, không phụ trách lead dưới đây) → vào **Ứng viên** → bấm tab **Cột chăm sóc** → thấy sẵn ứng viên mẫu "Hoàng Văn Đạt" (do `sale_demo_b` phụ trách, đã gọi 1 lần rồi bị bỏ quên quá ngưỡng) với trạng thái khóa **"Đang rảnh"**.
2. Bấm **Mở xử lý** trên dòng đó → hệ thống tự động chiếm khóa xử lý (không cần thao tác gì thêm) và mở màn Chi tiết ứng viên — thấy badge **"Cột chăm sóc — Đang xử lý: Bạn"**. Quay lại tab **Cột chăm sóc** → trạng thái khóa đã đổi thành **"Đang xử lý: Bạn"**.
3. Đăng nhập bằng 1 tài khoản Sale khác cùng nhóm (vd tự tạo qua **Quản lý tài khoản**, hoặc dùng `sale_demo_c` sau khi Admin chuyển vào cùng nhóm) → vào **Cột chăm sóc** → thử bấm **Mở xử lý** trên lead đang bị `sale_demo_a` khóa → hệ thống từ chối (409, "Sale ... đang xử lý, vui lòng thử lại sau").
4. Quay lại `sale_demo_a` → bấm **Giải phóng** trên dòng đó → khóa được gỡ, dòng trở lại **"Đang rảnh"**, Sale khác giờ mở xử lý được.
5. Đăng nhập `sale_demo_b` / `123456` (chủ sở hữu lead) → mở ứng viên "Hoàng Văn Đạt" → bấm **Giữ số** → xác nhận popup cảnh báo → thấy badge **"Đang giữ số"** ngay trên trang. Vào lại tab **Cột chăm sóc** bằng tài khoản khác → lead này không còn tự động bị đẩy vào cột chăm sóc lần nữa dù bỏ quên tiếp (cơ chế quét bỏ qua lead đang giữ số). Bấm **Bỏ giữ số** để hủy.
6. Đăng nhập `admin` / `123456` → vào **Cột chăm sóc** → thấy toàn bộ lead trong cột chăm sóc (không giới hạn theo nhóm, khác Sale/Leader). Bấm **Gỡ** trên 1 dòng → xác nhận → lead biến mất khỏi cột chăm sóc nhưng vẫn còn nguyên trong danh sách **Ứng viên** (không bị xóa).
7. Đăng nhập `mkt_demo` / `123456` → menu **Ứng viên** không có tab **Cột chăm sóc** (MKT không có quyền xem, theo Mục 5 `docs/13`).
8. Vẫn với `admin` → vào menu **Cấu hình vận hành** (chỉ Admin thấy mục này) → thấy tham số **"Ngưỡng thời gian vào Cột chăm sóc (phút)"** đang là `30`. Bấm **Sửa** → đổi thành 1 giá trị khác (vd `45`) → xác nhận popup cảnh báo ảnh hưởng toàn hệ thống → lưu thành công, cột "Cập nhật gần nhất" đổi theo. Đăng nhập bằng vai trò khác (Quản lý/Leader/Sale) → không thấy mục **Cấu hình vận hành** trên menu, và gọi thẳng API cũng bị từ chối (chỉ Admin).
9. Cơ chế quét tự động chạy nền mỗi 2 phút (không cần thao tác gì) — 1 lead bất kỳ đã qua ít nhất 1 lần xử lý (có "Xử lý gần nhất") mà quá ngưỡng thời gian cấu hình ở bước 8, không bị giữ số, sẽ tự động xuất hiện trong **Cột chăm sóc** ở lần quét kế tiếp; lead hoàn toàn mới chưa xử lý lần nào thì không bao giờ tự vào cột chăm sóc dù để lâu.

### 5.8. Tự động phân chia lead — Round-robin (Phase 6)

1. Đăng nhập `leader_demo` / `123456` → vào **Ứng viên** → ở khối "Khối lượng công việc nhóm" bấm **Cấu hình phân chia tự động** → đã thấy sẵn danh sách mẫu **Sale Demo A → Sale Demo B** (đang **Tắt**, seed sẵn nhưng cố ý chưa bật để không ảnh hưởng các bước kiểm thử phân chia thủ công khác).
2. Thử dùng nút mũi tên lên/xuống để đổi thứ tự, nút ✕ để bỏ 1 Sale khỏi vòng quay, hoặc chọn thêm Sale từ ô "Thêm Sale vào vòng quay" (chỉ hiện Sale trong đúng nhóm mình) → bấm **Lưu danh sách**.
3. Bấm **Kích hoạt** → trạng thái chuyển thành **Đang bật**.
4. Vào **Ứng viên** với tài khoản `mkt_demo` / `123456` → **Thêm ứng viên mới** liên tiếp 3 lần (SĐT khác nhau) → mỗi lần thêm xong, ứng viên đã có ngay Sale phụ trách theo đúng thứ tự đã cấu hình (vd A → B → A nếu vòng quay có 2 Sale), không còn ở trạng thái "Chờ phân chia" nữa.
5. Quay lại `leader_demo` → mở lại popup cấu hình → bấm **Tạm dừng** → trạng thái về **Đang tắt**. Thêm 1 ứng viên mới (`mkt_demo`) → lần này vẫn ở "Chờ phân chia" như bình thường — vào tab **Chờ phân chia** phân chia thủ công như Phase 2, xác nhận hệ thống không bị ảnh hưởng.
6. Thử nhập Excel (`mkt_demo` → **Nhập từ Excel**) trong lúc vòng quay đang **bật** → các dòng nhập thành công cũng được tự động phân chia giống hệt lead nhập tay.
7. Đăng nhập `sale_demo_a`/`sale_demo_c` hoặc `admin`/`123456` → không thấy nút **Cấu hình phân chia tự động** (chỉ Leader thấy); gọi thẳng API `PUT/POST /distribution-rule/:teamId...` bằng Admin/Quản lý cũng bị từ chối (403) — chỉ `GET` xem được, đúng theo quyền đã chốt.
8. Vô hiệu hóa 1 Sale đang nằm giữa vòng quay (Admin → **Quản lý tài khoản** → **Vô hiệu hóa**) trong lúc vòng quay đang bật → lead mới tiếp theo tự động bỏ qua Sale đó, gán cho người kế tiếp còn hoạt động — không báo lỗi, không cần Leader cấu hình lại.
9. **Nhắc nhở:** vòng quay mẫu ở bước 1 mặc định TẮT — nếu bạn từng bật lên để thử rồi tắt lại, dữ liệu "Chờ phân chia" của các Phase khác (vd Phase 2 demo) không bị ảnh hưởng; nhưng nếu quên tắt trước khi test các mục 5.1-5.6, ứng viên mới tạo sẽ tự động có người phụ trách thay vì ở "Chờ phân chia" như mô tả — nhớ **Tạm dừng** lại nếu muốn tái hiện đúng kịch bản demo ban đầu.

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

> **⚠️ Cảnh báo quan trọng:** `npm run test:e2e` sẽ chạy `TRUNCATE` toàn bộ bảng `accounts`, `teams`, `sessions`, `audit_logs`, `leads`, `lead_notes`, `interview_appointments`, `callback_schedules`, `system_configs`, `auto_distribution_members`, `auto_distribution_rules`, `import_jobs` trong database mà `backend/.env` đang trỏ tới, kể cả tài khoản Admin và toàn bộ dữ liệu mẫu đã seed (ứng viên, nhóm, ghi chú, Leader/Sale demo, tham số cấu hình, cấu hình vòng quay tự động phân chia) — đây là hành vi cố ý để test tự chạy lặp lại được, **không phải lỗi**. Nếu chạy lệnh này trên cùng database đang dùng để phát triển/thử nghiệm hàng ngày, phải **chạy lại `npm run seed` ngay sau đó** để có lại toàn bộ tài khoản/dữ liệu mẫu, nếu không đăng nhập sẽ báo "Tên đăng nhập hoặc mật khẩu không đúng" dù mọi thứ khác đều đúng. Tốt nhất nên dùng 1 database riêng cho việc chạy `test:e2e`, tách khỏi database phát triển hàng ngày.

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

Phase 0, 1, 2, 3, 4, 5 và 6 đã xong (Tài khoản & Nhóm; Thu thập dữ liệu ứng viên; Phân chia thủ công & Không gian Sale/Leader; Pipeline cuộc gọi & Lịch sử ghi chú; Lịch phỏng vấn/lịch gọi lại & Calendar; Cột chăm sóc tự động & Cấu hình vận hành; Tự động phân chia lead - Round-robin). Đây là mốc **MVP nghiệp vụ đầy đủ** theo `docs/14-roadmap.md` — toàn bộ hành trình từ lead mới đến khi đi làm đã được số hóa trọn vẹn, kèm cơ chế tự động thu hồi lead bị bỏ quên và tự động phân chia lead mới. Các nghiệp vụ tiếp theo (dashboard, thông báo Zalo...) sẽ được xây dựng lần lượt theo roadmap, từng Phase độc lập và có thể dùng ngay sau khi hoàn thành.

### Ghi chú giả định của Phase 6 (Round-robin) — nghiệp vụ tài liệu chưa mô tả

`docs/09` Mục 11.9 tự xác nhận: "khi 1 sale trong danh sách tham gia vòng quay bị nghỉ việc/vô hiệu hóa, hệ thống có tự động bỏ qua người đó hay Leader phải tự cấu hình lại — chưa được đề cập". Đã chọn hành vi **tự động bỏ qua** (không gán việc cho tài khoản không thể xử lý được) vì đây là lựa chọn an toàn duy nhất hợp lý, không phát sinh thêm nghiệp vụ mới.

Tài liệu cũng chỉ mô tả kịch bản **1 nhóm** bật vòng quay tại 1 thời điểm; trường hợp nhiều nhóm cùng bật đồng thời và cùng "tranh nhau" lead mới từ pool "Chờ phân chia" chung chưa được đặc tả. Đã xử lý theo quy tắc xác định (không ngẫu nhiên): nhóm nào **kích hoạt sớm hơn** được ưu tiên nhận lead mới trước. Nếu công ty thực tế cần chạy song song nhiều nhóm tự động và chia đều lead giữa các nhóm, đây là nghiệp vụ cần xác nhận thêm và có thể cần điều chỉnh logic này.

### Ghi chú khác biệt so với `docs/12-ui-design.md` Mục 7 (Interview/Calendar)

Tài liệu UI mô tả màn Lịch hẹn có thêm chế độ xem "Lịch (ngày/tuần/tháng)" bên cạnh agenda, và bảng agenda có thêm cột "Sale phụ trách"/"Trạng thái PV". API `GET /calendar` đã chốt tại `docs/13-api-design.md` (Design Freeze) chỉ trả về loại sự kiện, thời gian và Candidate rút gọn (id, tên, SĐT) — không có 2 trường trên, và tài liệu UI đã tự xác nhận đây "không phải 1 tập dữ liệu riêng", chỉ là góc nhìn theo lịch. Bản hiện tại chỉ hiện thực chế độ xem **danh sách agenda** (được tài liệu UI cho phép là 1 trong 2 chế độ hợp lệ) và không hiện 2 cột nói trên, để không tự thêm trường dữ liệu ngoài API đã chốt. Cột `current_interview_status`/`current_employment_status`/`current_partner_company_name` trên đối tượng `Candidate` cũng là bổ sung hợp lý ngoài danh sách trường liệt kê tại Mục 0.1, `docs/13` — các trường này đã tồn tại trong `leads` từ Design Review (Mục 7.2, `docs/11`) và được chính tiêu chí hoàn thành của Phase 4 trong roadmap yêu cầu ("mỗi bước phản ánh đúng trạng thái hiện tại trên danh sách Candidate nhờ cột denormalize"), nên được xem là tài liệu 13 liệt kê thiếu chứ không phải chủ đích loại trừ.
