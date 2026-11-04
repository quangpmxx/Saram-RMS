# Quy tắc nghiệp vụ quan trọng

Nguồn: `09-business-specification.md` (đặc tả gốc, một số mục đã cũ) + quyết định đã duyệt ghi trong `15-tong-ra-soat-2026-10.md`. Mục đánh dấu **[chưa xác minh với code]** cần đối chiếu trước khi dựa vào.

## Vai trò & phạm vi dữ liệu
| Vai trò | Thấy gì | Làm được |
|---|---|---|
| Admin | Toàn hệ thống | Tất cả; duy nhất thêm/xoá/reset mật khẩu nhân viên; cấu hình Chia tự động mọi nhóm |
| Quản lý | Toàn hệ thống như Admin | Chia/chuyển lead, thêm data thủ công; không thêm/xoá NV, không xoá data |
| Leader | Chỉ nhóm mình | Chia/chuyển lead trong nhóm, sửa mọi lead nhóm, cấu hình vòng quay, xoá ghi chú trong nhóm |
| MKT | Data mình upload + xem (không sửa) ghi chú của Sale | Sửa/xoá data (đã duyệt: MKT sửa/xoá mọi data) |
| Sale | Lead được giao + Kho chăm sóc nhóm mình | Cập nhật trạng thái/ghi chú; xử lý hộ data trong nhóm khi data có người phụ trách |
- Mỗi tài khoản đúng 1 vai trò; nhiều thiết bị đăng nhập cùng lúc. Dashboard chung toàn công ty (đã duyệt).
- Vai trò accounting, order_staff, shuttle_staff gắn với module riêng (Kế toán, Quản lý đơn, Đưa đón) — **[chưa xác minh chi tiết]**.
- Quyền module hiển thị trên sidebar do `MODULE_REGISTRY` + trang Admin "Phân quyền" quyết định.

## Data lao động (Lead)
- Tối thiểu: tên, SĐT, nguồn (Facebook/TikTok/Zalo/Khác), thời gian up, ghi chú MKT. Nhập tay hoặc import Excel.
- **Nguồn MKT** (không bắt buộc, chỉ form nhập tay): danh mục text tự do, **chỉ Admin** thêm/sửa/xoá ở Marketing Hub (`/marketing-hub/mkt-sources`); xoá nguồn → lead cũ để trống nguồn MKT.
- Lead mới → "Chờ phân chia" → Leader chia thủ công hoặc round-robin (bỏ qua Sale đã nghỉ/rời nhóm).
- Trạng thái (cập nhật lại được, **không có "đóng lead"**): cuộc gọi (đã gọi/chưa gọi/không nghe/thuê bao) → kết quả (tiềm năng/không tiềm năng/đang cân nhắc/hẹn gọi lại) → PV (đã hẹn/đến/bùng/đỗ/trượt; bùng vẫn hẹn lại, giữ lịch sử các lần hẹn) → đi làm (đã đi/không đi, kèm lý do bắt buộc).
- Trùng SĐT: **vẫn cho up**, chỉ cảnh báo. **Chu kỳ lọc trùng 30 ngày**: chỉ tính trùng khi 2 lần up cách nhau <30 ngày (`LeadDuplicateService`). Số up lại trong 30 ngày kể từ lần up gốc (sớm nhất trong 30 ngày qua) **tự chuyển về nhóm đang giữ số gốc** (nhập tay + import Excel; không áp dụng "Up data cũ"), cảnh báo báo rõ đã chuyển nhóm. Cùng nhóm: đánh dấu màu; khác nhóm: Sale không thấy, MKT/Quản lý/Admin thấy hết.
- Ghi chú chỉ **thêm**, không ghi đè; xoá là xoá mềm (giữ lịch sử).
- Gán lead (đơn/hàng loạt) phải an toàn khi nhiều người bấm cùng lúc: người đến sau nhận lỗi 409.
- "Giữ số": Sale giữ riêng lead, không giới hạn số lượng.
- Sale nhận data (thủ công/hàng loạt/tự động) được thông báo.

## Kho chăm sóc
- Dùng chung theo nhóm; quyền sở hữu gốc của lead **không đổi** khi vào Kho. Một lead chỉ một người xử lý tại một thời điểm (khóa; tự hết sau 15 phút nếu quên, nhả ngay khi thoát). Admin gỡ khỏi Kho.
- Mốc ngày/tháng tính theo giờ VN (`+07:00`).
- **Chu kỳ chăm sóc = 30 ngày gần nhất tính đến hiện tại** (không theo tháng lịch). Data up <30 ngày và nằm trong Kho tự tính 1 lượt; "Chưa chăm sóc 30 ngày" chỉ khi đã up ≥30 ngày VÀ không có ghi chú nào trong 30 ngày qua. Cột UI: "CS trong 30 ngày". Hàm: `summarizeLeadMonth` (`care-metrics.ts`). Chưa đổi: thống kê theo Sale/tháng và hạn lượt giao (vẫn theo tháng).
- Mốc "30 phút bỏ quên → tự vào Kho" trong đặc tả gốc, nhưng worker tự động đã gỡ 2026-07-24: **[chưa xác minh cơ chế hiện tại — đối chiếu `care-warehouse.service.ts`]**.

## Số liệu & Dashboard
- Phễu: Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm; hiệu suất Sale (cuộc gọi, tiềm năng, đi làm); lead ở Kho theo nhóm; lead mới theo nguồn; lead chờ phân chia.
- Phạm vi số liệu theo vai trò; không có xuất Excel.
- Hiệu suất/xếp hạng gom query cả danh sách Sale (B7) — giữ nguyên kết quả khi tối ưu; có test hồi quy.

- **Chính thức / Thời vụ** (2026-11-04): ô Hẹn/Đến/Bùng/Đỗ/Trượt PV và 3 ô tỷ lệ hẹn/đến/đỗ ở Dashboard bấm vào mới hiện tách **CT / TV**, theo cột "Loại hình" của Đưa đón. Tỷ lệ CT/TV cùng mẫu số Data mới (CT + TV + dòng chưa chọn loại hình = tổng).
- Nguồn số PV ở Dashboard = Đưa đón: Hẹn PV = mọi dòng; Đến PV = Tình trạng "Đã đón"; Bùng PV = "Chưa đón được"; Đỗ/Trượt PV = Kết quả "Đỗ PV"/"Trượt PV". Không lọc Nhóm/NV → đếm **mọi dòng** (kể cả chưa chọn Sale); có lọc → chỉ dòng của Sale thuộc phạm vi. Các giá trị trên + `CT`/`TV` là **lựa chọn cố định** (không xoá/đổi tên, chỉ đổi màu).

## Bất biến không được phá
Bảo toàn lịch sử (ghi chú, lịch hẹn, phân công, Nhật ký) · gán/chuyển lead không race · phạm vi dữ liệu theo vai trò ở mọi API (kể cả tìm kiếm/lọc) · Đưa đón và ghi chú xoá mềm · tài khoản bị khoá/đổi nhóm thì mất realtime · mật khẩu mặc định buộc đổi.

## Điểm đặc tả còn mở (doc 09 mục 11)
Danh sách quyền chi tiết cho Quản lý/Leader (khung đã có, chưa có danh mục) · ranh giới Admin–Quản lý · quy trình bộ phận đưa đón · danh mục công ty đối tác (hiện nhập tự do) · báo cáo so sánh theo kỳ.

## Marketing Hub (đã duyệt 2026-11-02)
- Chỉ VNĐ. Mỗi tài khoản quảng cáo đúng 1 nhân viên phụ trách (unique nền tảng + mã ngoài). Admin gán/đổi cho ai cũng được; MKT chỉ liên kết/đồng bộ/gỡ tài khoản của mình, không giành tài khoản đã có người phụ trách; Quản lý chỉ xem.
- **Bảng Hiệu quả Marketing** (duyệt 2026-11-03): nhóm theo nhân viên phụ trách → từng TKQC (Loại TK, Số data, Tổng chi tiêu, Giá số, Trạng thái camp, Trạng thái TK) + dòng Tổng mỗi nhân viên + dòng Toàn công ty.
  - Admin gắn **Nguồn MKT** cho từng TKQC (nhiều TKQC dùng chung 1 nguồn được, vd 5 TKQC cùng nguồn của 1 người). Data up không tách theo TKQC nên **Số data / Giá số chỉ ở dòng Tổng** (nhân viên, toàn công ty), dòng TKQC để trống. Số data = số lead (chưa xoá) up trong kỳ có chọn các Nguồn MKT (khác nhau) gắn với TKQC của người đó. Không dùng số kết quả Facebook.
  - **Giá số** = tổng chi ÷ số data. Admin đặt 2 mốc: ≤ mốc xanh tô xanh, > mốc đỏ tô đỏ, ở giữa tô cam.
  - **Trạng thái camp**: có ≥1 chiến dịch ACTIVE → Đang hoạt động, ngược lại Dừng. **Trạng thái TK** theo `account_status` Facebook: 1 → Live ADS (xanh); 3/8/9 → Chưa thanh toán (cam); còn lại → Die ADS (đỏ). Lấy lúc đồng bộ.
- **Dashboard — khối "Chi phí Marketing"** (Admin/Quản lý/MKT, không theo bộ lọc Dashboard, tự làm mới 5 phút): Chi phí MKT, Data thu được (lead có Nguồn MKT đã gắn TKQC), Chi phí/data — đều của HÔM NAY; **Chi phí/phỏng vấn = chi tiêu HÔM QUA ÷ số người trong danh sách đưa đón HÔM NAY**.
- Chi phí/người đi làm: kết quả chung toàn công ty ở Dashboard (người đi làm lấy từ danh sách đưa đón, không có Nguồn MKT) — chưa làm. Chỉ số chiến dịch (CTR, click…) làm sau. Không xuất Excel.
- Token Facebook lưu mã hoá (AES-256-GCM, khoá `MARKETING_TOKEN_KEY` ≥ 32 ký tự), không bao giờ trả về API/frontend.

## Pancake — Up tự động (duyệt 2026-11-04)
- Mỗi page Pancake liên kết bằng token page (mã hoá như token Facebook), đúng 1 người phụ trách. Quyền liên kết/gỡ/đổi phụ trách/gắn Nguồn MKT giống TKQC. Liên kết lần đầu: lấy 30 ngày hội thoại cũ **chỉ để thống kê, không up data**.
- Đọc Pancake **mỗi 10 giây**. Hội thoại (inbox hoặc bình luận) **lần đầu** có SĐT, trong lúc Up tự động đang bật → tạo data: tên Facebook, SĐT, nguồn **Facebook**, Nguồn MKT = nguồn của page, **người up = người phụ trách page**. Mỗi hội thoại up tối đa 1 data. SĐT xuất hiện lúc đang tắt bị bỏ qua, bật lại không lấy bù.
- Nút **Up tự động** ở Data lao động (Admin/MKT): bật/tắt + tỉ lệ chia nhóm **dùng chung mọi page**, đan xen (1-2 → N1, N2, N2, lặp lại; tỉ lệ 0 = không nhận; nhóm mới tự hiện với 0). Đổi tỉ lệ → vòng chia bắt đầu lại từ nhóm đầu.
- Số trùng 30 ngày → về nhóm giữ số gốc như nhập tay và **không tính lượt chia**. Vào nhóm rồi thì theo cách nhóm đang làm (Chờ phân chia / Chia tự động của nhóm), có thông báo như nhập tay.
- Bảng **Pancake theo page** ở Marketing Hub, theo kỳ đang lọc: Người nhắn tin mới (hội thoại inbox bắt đầu trong kỳ), Để lại SĐT (trong số đó, có SĐT), Tỉ lệ = để lại SĐT ÷ người nhắn mới, Data đã up tự động.
