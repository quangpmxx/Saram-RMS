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

## Bất biến không được phá
Bảo toàn lịch sử (ghi chú, lịch hẹn, phân công, Nhật ký) · gán/chuyển lead không race · phạm vi dữ liệu theo vai trò ở mọi API (kể cả tìm kiếm/lọc) · Đưa đón và ghi chú xoá mềm · tài khoản bị khoá/đổi nhóm thì mất realtime · mật khẩu mặc định buộc đổi.

## Điểm đặc tả còn mở (doc 09 mục 11)
Danh sách quyền chi tiết cho Quản lý/Leader (khung đã có, chưa có danh mục) · ranh giới Admin–Quản lý · quy trình bộ phận đưa đón · danh mục công ty đối tác (hiện nhập tự do) · báo cáo so sánh theo kỳ.

## Marketing Hub (đã duyệt 2026-11-02)
- Chỉ VNĐ. Mỗi tài khoản quảng cáo đúng 1 nhân viên phụ trách (unique nền tảng + mã ngoài). Admin gán/đổi cho ai cũng được; MKT chỉ liên kết/đồng bộ/gỡ tài khoản của mình, không giành tài khoản đã có người phụ trách; Quản lý chỉ xem.
- **Bảng Hiệu quả Marketing** (duyệt 2026-11-03): nhóm theo nhân viên phụ trách → từng TKQC (Loại TK, Số data, Tổng chi tiêu, Giá số, Trạng thái camp, Trạng thái TK) + dòng Tổng mỗi nhân viên + dòng Toàn công ty.
  - **Số data** của TKQC = số lead (chưa xoá) up trong kỳ có chọn **Nguồn MKT gắn với TKQC đó** (Admin gắn; 1 nguồn ↔ 1 TKQC). Không dùng số kết quả Facebook. TKQC chưa gắn nguồn → "Chưa gắn nguồn MKT".
  - **Giá số** = chi tiêu ÷ số data; dòng Tổng = tổng chi ÷ tổng data (không lấy trung bình cộng). Admin đặt 2 mốc: ≤ mốc xanh tô xanh, > mốc đỏ tô đỏ, ở giữa tô cam.
  - **Trạng thái camp**: có ≥1 chiến dịch ACTIVE → Đang hoạt động, ngược lại Dừng. **Trạng thái TK** theo `account_status` Facebook: 1 → Live ADS (xanh); 3/8/9 → Chưa thanh toán (cam); còn lại → Die ADS (đỏ). Lấy lúc đồng bộ.
- Chi phí/người đi làm: kết quả chung toàn công ty ở Dashboard (người đi làm lấy từ danh sách đưa đón, không có Nguồn MKT) — chưa làm. Chỉ số chiến dịch (CTR, click…) làm sau. Không xuất Excel.
- Token Facebook lưu mã hoá (AES-256-GCM, khoá `MARKETING_TOKEN_KEY` ≥ 32 ký tự), không bao giờ trả về API/frontend.
