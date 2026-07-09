# TÀI LIỆU THIẾT KẾ GIAO DIỆN (UI DESIGN) — CRM TUYỂN DỤNG / CUNG ỨNG LAO ĐỘNG

> Tài liệu này được xây dựng dựa trên `docs/09-business-specification.md`, `docs/10-system-design.md` và `docs/11-database-design.md`.
> Phạm vi: **chỉ mô tả thành phần giao diện ở mức khái niệm** (nút bấm, bảng dữ liệu, bộ lọc, popup, thống kê hiển thị). Không viết code, không thiết kế mockup/hình ảnh, không chỉ định màu sắc/layout kỹ thuật.
> Nội dung hiển thị trên mỗi màn hình sẽ tự động giới hạn theo quyền của từng vai trò (đã quy định tại Mục 8, tài liệu 09).

---

## 1. Dashboard

Màn hình tổng quan, nội dung hiển thị khác nhau theo phạm vi dữ liệu của từng vai trò (Sale: cá nhân; Leader: nhóm mình; Quản lý/Admin: toàn hệ thống).

**Nút:**
- Chọn khoảng thời gian xem (Hôm nay / Tuần này / Tháng này / Tùy chọn)
- Làm mới dữ liệu
- Xem chi tiết (điều hướng nhanh từ mỗi thẻ số liệu sang màn hình tương ứng — vd bấm vào "Lead chờ phân chia" sẽ mở màn hình Candidate)

**Bảng:**
- Bảng xếp hạng hiệu suất Sale (Top performer): tên sale, số cuộc gọi, số lead tiềm năng, số lịch hẹn, số đi làm
- Bảng tổng hợp theo nhóm (chỉ hiển thị với Quản lý/Admin): tên nhóm, số lead, tỷ lệ chuyển đổi, số lead đang ở cột chăm sóc

**Filter:**
- Theo khoảng thời gian
- Theo nhóm (đối với Quản lý/Admin — có thể chọn xem 1 nhóm cụ thể hoặc tất cả)

**Popup:**
- Popup xem nhanh chi tiết khi click vào 1 dòng trong bảng xếp hạng (thông tin tóm tắt, không thay thế trang chi tiết đầy đủ)

**Thống kê hiển thị (thẻ số liệu — theo đúng Mục 9, tài liệu 09):**
- Tổng lead mới hôm nay/tuần, phân theo nguồn kênh (Facebook/TikTok/Zalo/Khác)
- Số lượng lead đang "Chờ phân chia"
- Phễu chuyển đổi: Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm (dạng số + tỷ lệ %)
- Số lead đang ở cột chăm sóc, theo từng nhóm
- Hiệu suất từng Sale (số cuộc gọi, số lead tiềm năng, số đi làm)

---

## 2. Candidate (Ứng viên / Lead)

Màn hình quản lý toàn bộ dữ liệu ứng viên — trung tâm dữ liệu chính của hệ thống.

### 2.1. Màn hình Danh sách ứng viên

**Nút:**
- Thêm ứng viên mới (nhập tay)
- Import từ Excel
- Phân chia (hiện với Leader — chọn nhiều dòng rồi gán cho Sale)
- Chuyển lead (hiện với Leader)
- Đánh dấu giữ số (hiện với Sale, trên dòng thuộc quyền mình)
- Xóa (chỉ hiện với Admin)
- Xem lịch sử/nhật ký của 1 ứng viên

**Bảng (danh sách ứng viên):**
Cột hiển thị: Tên lao động, SĐT (kèm icon cảnh báo nếu trùng), Nguồn, Ngày up, Sale phụ trách, Tình trạng cuộc gọi, Kết quả cuộc gọi, Trạng thái PV, Trạng thái đi làm, Chất lượng data.

**Filter:**
- Theo trạng thái (tình trạng cuộc gọi / kết quả cuộc gọi / trạng thái PV / trạng thái đi làm)
- Theo khoảng ngày (ngày up)
- Theo nguồn kênh
- Theo Sale phụ trách
- Theo nhóm (Quản lý/Admin)
- Theo công ty đối tác đã hẹn
- Tìm kiếm theo tên hoặc số điện thoại (giới hạn theo phạm vi quyền xem)
- Lọc riêng "Chỉ hiện lead trùng lặp"

**Popup:**
- Popup Thêm ứng viên mới (form nhập tên, SĐT, nguồn, ghi chú MKT) — hiện cảnh báo ngay nếu SĐT trùng ("đã trùng với data ngày ... của nhân viên ...") nhưng vẫn cho lưu
- Popup Import Excel (chọn file → xem trước dữ liệu → xác nhận import → báo cáo số dòng thành công/lỗi/trùng)
- Popup Phân chia hàng loạt (chọn Sale nhận các lead đã tick chọn)
- Popup Chuyển lead sang Sale khác (chọn sale mới + lý do tùy chọn)
- Popup xác nhận Xóa (chỉ Admin, có cảnh báo hành động không thể hoàn tác với dữ liệu hiển thị — dù dữ liệu thực tế được xóa mềm)
- Tooltip/popup nhanh khi hover/click vào icon cảnh báo trùng SĐT: hiển thị danh sách các lần trùng (ngày up, nhân viên phụ trách) — theo đúng yêu cầu "hover/click xem chi tiết" tại Mục 10, tài liệu 09 *(bổ sung sau Design Review — trước đó tài liệu này mới có cột cảnh báo, chưa mô tả thao tác xem chi tiết)*

**Thống kê hiển thị:**
- Badge số lượng theo từng tab/nhóm trạng thái (vd: "Chờ phân chia (12)", "Đang xử lý (48)", "Trùng lặp (5)")
- Tổng số bản ghi đang hiển thị theo bộ lọc hiện tại

### 2.2. Màn hình Chi tiết ứng viên

**Nút:**
- Lưu thay đổi thông tin
- Gọi ngay (mở nhanh khu vực cập nhật tình trạng/kết quả cuộc gọi)
- Thêm ghi chú mới
- Xóa ghi chú (giữ lại trong lịch sử)
- Đặt lịch gọi lại
- Đặt lịch hẹn phỏng vấn
- Đánh dấu/Bỏ đánh dấu giữ số
- Chuyển lead (Leader)
- Xóa ứng viên (Admin)

**Bảng:**
- Bảng lịch sử ghi chú/cuộc gọi (thời gian, người ghi, nội dung, trạng thái tại thời điểm đó, đã xóa hay chưa)
- Bảng lịch sử các lần hẹn phỏng vấn (lần hẹn, công ty đối tác, ngày giờ, kết quả)

**Filter:**
- Lọc lịch sử ghi chú theo khoảng thời gian
- Lọc lịch sử phỏng vấn theo trạng thái

**Popup:**
- Popup thêm ghi chú
- Popup cập nhật tình trạng cuộc gọi / kết quả cuộc gọi
- Popup đặt lịch gọi lại
- Popup đặt lịch hẹn phỏng vấn (chọn công ty đối tác, ngày giờ)
- Popup cập nhật kết quả phỏng vấn (Đến/Bùng/Đỗ/Trượt)
- Popup cập nhật kết quả đi làm (Đi làm/Không đi làm + lý do nếu không đi làm)
- Popup xác nhận xóa ghi chú/xóa ứng viên

**Thống kê hiển thị:**
- Số lần đã gọi, số lần hẹn PV, thời gian xử lý gần nhất (phục vụ theo dõi ngưỡng 30 phút vào cột chăm sóc)

---

## 3. Sales (Không gian làm việc của Sale)

**Nút:**
- Gọi ngay / Cập nhật trạng thái nhanh (trên từng dòng danh sách, không cần mở chi tiết)
- Đánh dấu giữ số
- Mở lead trong Cột chăm sóc để xử lý (chiếm khóa)
- Thêm ghi chú nhanh
- Đặt lịch gọi lại / Đặt lịch hẹn PV

**Bảng:**
- Bảng "Lead của tôi": danh sách lead đang được giao, kèm trạng thái hiện tại và thời gian xử lý gần nhất
- Bảng "Cột chăm sóc": danh sách lead dùng chung của nhóm, kèm cờ hiển thị "Đang được xử lý bởi [Tên Sale]" nếu đang bị khóa

**Filter:**
- Theo trạng thái cuộc gọi/PV
- Theo lịch hẹn hôm nay/tuần này
- Riêng cột chăm sóc: lọc "Lead đang rảnh" / "Lead đang bị khóa"

**Popup:**
- Popup cập nhật tình trạng/kết quả cuộc gọi
- Popup đặt lịch hẹn PV/gọi lại
- Popup thông báo "Lead đang được Sale ... xử lý, vui lòng thử lại sau" (khi cố mở 1 lead đã bị khóa trong cột chăm sóc)
- Popup xác nhận đánh dấu giữ số

**Thống kê hiển thị:**
- Số lead đã gọi hôm nay
- Số lead tiềm năng đang xử lý
- Số lịch hẹn (gọi lại + PV) trong hôm nay
- Số lead đang giữ riêng
- Số lead đang có trong cột chăm sóc của nhóm

---

## 4. Marketing (Không gian làm việc của MKT)

**Nút:**
- Thêm ứng viên mới (nhập tay)
- Import Excel
- Sửa (chỉ với data do chính mình upload)
- Xóa (chỉ với data do chính mình upload)
- Xem chi tiết trùng lặp

**Bảng:**
- Bảng danh sách lead do mình đã up (kèm trạng thái đã/chưa được phân chia)
- Bảng "Chờ phân chia" (xem, không thao tác phân chia)
- Bảng danh sách trùng lặp toàn hệ thống (mọi nhóm)

**Filter:**
- Theo ngày up
- Theo nguồn kênh
- Theo trạng thái đã/chưa phân chia
- Riêng bảng trùng lặp: lọc theo khoảng ngày trùng, theo nhóm/sale liên quan

**Popup:**
- Popup thêm ứng viên mới (cảnh báo trùng SĐT ngay khi nhập, vẫn cho lưu)
- Popup Import Excel (xem trước, xác nhận, báo cáo kết quả import gồm dòng lỗi/dòng trùng)
- Popup sửa thông tin lead
- Popup xác nhận xóa lead

**Thống kê hiển thị:**
- Tổng lead đã up hôm nay/tuần (trên tổng ~200 lead/ngày toàn công ty)
- Số lead đang chờ phân chia
- Số lượng lead trùng lặp phát hiện trong ngày/tuần

---

## 5. Leader (Không gian quản lý nhóm)

**Nút:**
- Phân chia thủ công (chọn lead → chọn Sale)
- Cấu hình danh sách & thứ tự Sale tham gia tự động phân chia
- Kích hoạt / Tạm dừng chế độ tự động phân chia
- Chuyển lead giữa các Sale trong nhóm
- Xem workload từng Sale (số lead đang phụ trách)

**Bảng:**
- Bảng "Chờ phân chia" của nhóm
- Bảng danh sách Sale trong nhóm kèm số lượng lead đang phụ trách, số lead trong cột chăm sóc, hiệu suất gần đây
- Bảng toàn bộ lead thuộc nhóm (tương tự màn hình Candidate nhưng giới hạn phạm vi nhóm)

**Filter:**
- Theo Sale cụ thể trong nhóm
- Theo trạng thái
- Theo khoảng ngày

**Popup:**
- Popup cấu hình vòng quay tự động phân chia (sắp xếp thứ tự Sale tham gia)
- Popup phân chia hàng loạt
- Popup xác nhận chuyển lead sang Sale khác (có thể ghi lý do)
- Popup xác nhận Tạm dừng/Kích hoạt lại chế độ tự động

**Thống kê hiển thị:**
- Tổng số lead của nhóm, số đã phân chia/chưa phân chia
- Tỷ lệ chuyển đổi của nhóm theo từng bước phễu
- Số lead đang ở cột chăm sóc của nhóm
- Số lead trung bình mỗi Sale đang phụ trách (để nhận biết mất cân bằng khối lượng công việc)

---

## 6. HR

Theo `docs/09-business-specification.md` (Mục 5, Mục 11), công ty hiện **chưa có vai trò/quy trình HR** trong phạm vi nghiệp vụ đã xác nhận — chỉ có định hướng bổ sung module "đưa đón lao động" ở giai đoạn sau, chưa được đặc tả (chưa rõ ai thao tác, cập nhật gì, theo quy trình nào).

**Mục này chưa thiết kế giao diện** để tránh bịa ra nghiệp vụ chưa được xác nhận. Sẽ thiết kế sau khi có một đợt thu thập nghiệp vụ riêng cho bộ phận đưa đón, theo đúng cách tài liệu 09 đã được xây dựng.

---

## 7. Interview (Lịch phỏng vấn)

Đây không phải một tập dữ liệu riêng — dữ liệu phỏng vấn vẫn nằm trong Candidate (bảng `interview_appointments`). Mục này chỉ là **góc nhìn theo lịch (calendar)** cho lịch gọi lại và lịch hẹn PV, đúng theo nhu cầu "cần xem dạng lịch" đã xác nhận ở tài liệu 09 (Mục 4/10). Việc cập nhật kết quả PV/đi làm được thao tác tại màn hình Chi tiết ứng viên (Mục 2.2) — không tạo popup cập nhật trùng lặp ở đây.

**Nút:**
- Chuyển đổi chế độ xem: Lịch (ngày/tuần/tháng) ↔ Danh sách agenda
- Đặt lịch hẹn PV mới (mở nhanh, không cần vào Candidate)

**Bảng:**
- Danh sách agenda các lịch hẹn PV sắp tới: Tên ứng viên, Công ty đối tác, Ngày giờ, Sale phụ trách, Trạng thái PV — thực chất là Candidate đã lọc sẵn theo điều kiện "có lịch hẹn PV"

**Filter:**
- Theo khoảng ngày hẹn, theo công ty đối tác, theo Sale/nhóm phụ trách, theo trạng thái PV

**Popup:**
- Popup đặt lịch hẹn PV mới (giống popup tại Candidate)
- Bấm vào 1 mốc trên lịch → mở thẳng màn hình Chi tiết ứng viên để cập nhật kết quả

**Thống kê hiển thị:**
- Số lịch hẹn PV hôm nay/tuần này, tỷ lệ đến PV, tỷ lệ đỗ PV, tỷ lệ đi làm sau đỗ PV (cùng công thức với Dashboard, chỉ lọc riêng phạm vi phỏng vấn)

---

## 8. Reports (Báo cáo)

Về bản chất, đây là **phần mở rộng của Dashboard** (Mục 1), dùng chung đúng bộ chỉ số đã thống nhất tại Mục 9, tài liệu 09 — không phát sinh số liệu hay bảng dữ liệu mới nào ngoài phạm vi đã chốt. Điểm khác duy nhất so với Dashboard: cho phép lọc sâu hơn và xem breakdown chi tiết đằng sau mỗi con số.

**Nút:**
- Chọn khoảng thời gian, chọn nhóm/Sale/nguồn để xem chi tiết
- Làm mới dữ liệu

**Bảng:**
- Bảng hiệu suất chi tiết từng Sale, bảng theo nguồn kênh — là dạng "mở rộng hàng" của các thẻ số liệu trên Dashboard, không phải bảng dữ liệu mới

**Filter:**
- Theo khoảng ngày, theo nhóm, theo Sale, theo nguồn kênh

**Popup:**
- Popup xem danh sách ứng viên cụ thể đằng sau 1 con số (vd bấm "Đỗ PV: 24" → mở danh sách 24 ứng viên, thực chất là Candidate đã lọc sẵn)

**Thống kê hiển thị:**
- Giống hệt Dashboard (Mục 9, tài liệu 09), chỉ trình bày dạng bảng/biểu đồ chi tiết hơn thay vì thẻ tóm tắt.
- Không có chức năng xuất Excel (đã xác nhận trong tài liệu 09 — chỉ xem trong phần mềm).

---

## 9. Settings (Cấu hình hệ thống)

### 9.0. Quản lý nhóm (Team) *(bổ sung sau Design Review)*

Trước đó tài liệu 11 (bảng `teams`) và 13 (API `/team`) đã có sẵn nhưng chưa có màn hình thao tác — bổ sung để Admin có nơi tạo/quản lý nhóm trước khi gán nhân viên vào nhóm ở Mục 9.1.

**Nút:**
- Thêm nhóm mới
- Sửa tên nhóm / gán hoặc đổi Leader phụ trách

**Bảng:**
- Danh sách nhóm: Tên nhóm, Leader phụ trách, Số lượng Sale, Ngày tạo

**Filter:** (không cần thiết — số lượng nhóm ít)

**Popup:**
- Popup tạo nhóm mới (tên nhóm, chọn Leader — có thể để trống, gán sau)
- Popup gán/đổi Leader phụ trách

**Thống kê hiển thị:**
- Tổng số nhóm, số nhóm chưa có Leader phụ trách

### 9.1. Quản lý tài khoản

**Nút:**
- Thêm tài khoản mới
- Sửa thông tin tài khoản (đổi tên — phục vụ bàn giao khi nhân viên nghỉ)
- Vô hiệu hóa/Kích hoạt lại tài khoản
- Reset mật khẩu (chỉ Admin)
- Cấu hình quyền chi tiết (với tài khoản vai trò Quản lý/Leader)

**Bảng:**
- Danh sách tài khoản: Họ tên, Tên đăng nhập, Vai trò, Nhóm, Trạng thái, Ngày tạo

**Filter:**
- Theo vai trò
- Theo nhóm
- Theo trạng thái hoạt động

**Popup:**
- Popup tạo tài khoản mới (họ tên, tên đăng nhập, vai trò, nhóm)
- Popup cấu hình quyền chi tiết (checklist các quyền có thể bật/tắt — áp dụng cho vai trò Quản lý/Leader)
- Popup xác nhận Reset mật khẩu (cảnh báo mật khẩu sẽ về mặc định)
- Popup xác nhận Vô hiệu hóa tài khoản

**Thống kê hiển thị:**
- Số lượng tài khoản theo từng vai trò
- Số tài khoản đang hoạt động/đã vô hiệu hóa

### 9.2. Cấu hình vận hành

**Nút:**
- Lưu cấu hình

**Bảng:**
- Bảng danh sách tham số cấu hình hệ thống (tên tham số, giá trị hiện tại, mô tả, người cập nhật gần nhất)

**Filter:** (không cần thiết — danh sách tham số ngắn, không cần lọc)

**Popup:**
- Popup chỉnh sửa 1 tham số cụ thể (vd: ngưỡng thời gian vào cột chăm sóc — mặc định 30 phút)
- Popup xác nhận thay đổi cấu hình (cảnh báo ảnh hưởng toàn hệ thống)

**Thống kê hiển thị:** (không áp dụng — đây là màn hình cấu hình, không phải màn hình số liệu)

### 9.3. Lịch sử/Nhật ký truy cập

**Nút:**
- Xuất bộ lọc hiện tại thành danh sách xem nhanh (không phải xuất Excel — chỉ lọc/xem trong app)

**Bảng:**
- Bảng nhật ký: Thời gian, Tài khoản thực hiện, Loại hành động, Đối tượng tác động, Giá trị cũ → Giá trị mới

**Filter:**
- Theo tài khoản
- Theo loại hành động (xem/sửa/xóa/đăng nhập/reset mật khẩu...)
- Theo khoảng thời gian
- Theo đối tượng (lead cụ thể/tài khoản cụ thể)

**Popup:**
- Popup xem chi tiết đầy đủ 1 dòng nhật ký

**Thống kê hiển thị:**
- Tổng số hành động trong khoảng thời gian đang lọc
- Số phiên đăng nhập đang hoạt động

---

*Tài liệu được xây dựng dựa trên `docs/09-business-specification.md`, `docs/10-system-design.md` và `docs/11-database-design.md`. Không viết code, không thiết kế mockup — đúng theo yêu cầu.*
