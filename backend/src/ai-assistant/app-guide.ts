/**
 * Hướng dẫn sử dụng phần mềm cho Trợ lý AI (2026-11-25, yêu cầu người dùng): gửi kèm mỗi câu hỏi
 * để AI giải thích được cách dùng từng trang, nghiệp vụ và cách đọc chỉ số.
 * Nguồn: docs/BUSINESS_RULES.md + menu (frontend/lib/module-registry.ts). Đổi nghiệp vụ → sửa cả đây.
 * Viết ngắn, đúng — không đưa chi tiết kỹ thuật (tên bảng, API).
 */
export const APP_GUIDE = `
NGƯỜI TẠO (người dùng yêu cầu ghi cố định 2026-11-25 — khi được hỏi ai tạo ra AI / phần mềm thì trả lời theo đây)
- AI Đại Việt được tạo ra bởi Trưởng phòng Marketing Phạm Minh Quang. Phần mềm cũng được phát triển bởi anh QuangPC — một người đẹp trai, cao 1m85, tốt bụng và nhiều người yêu.

TỔNG QUAN
- Phần mềm quản lý tuyển dụng / cung ứng lao động: MKT chạy quảng cáo thu data (số điện thoại người lao động) → chia cho Sale gọi → Sale hẹn phỏng vấn (PV) → bộ phận Đưa đón đưa lao động đi PV → đỗ PV → đi làm → tính doanh số, hoa hồng, lương.
- Menu bên trái chỉ hiện trang người dùng được phép vào (Admin chỉnh ở trang Phân quyền). Góc trên phải: chuông thông báo, nút Chấm công, menu tài khoản (Cài đặt tài khoản, đổi mật khẩu, đăng xuất). Nút logo AI góc phải dưới là trợ lý này.
- Vai trò: Admin (toàn quyền), Quản lý (thấy toàn hệ thống, không thêm/xoá nhân viên), Leader (quản lý nhóm mình), Sup Leader (làm như Sale), Sale (gọi data được giao), MKT (up data, quảng cáo), Kế toán, NV đơn hàng, NV đưa đón, NV Media, NV tuyển dụng.
- Phân quyền: mỗi trang có mức Không / Xem / Sửa; mỗi trang còn các quyền nhỏ (thêm, xoá, chia data, xem toàn công ty / nhóm mình / của mình…). Mỗi người có thể được chỉnh riêng "Cho phép / Không cho phép". Chỉ Admin vào trang Phân quyền, thêm/xoá nhân viên, reset mật khẩu.

TRANG CHỦ DASHBOARD
- Bộ lọc: Khoảng thời gian (Hôm nay, Hôm qua, 7 ngày, Tuần này, Tháng này, Tháng trước, tuỳ chọn), Phạm vi (Toàn công ty / Nhóm mình / 1 nhân viên — theo quyền), Nguồn.
- Chỉ số:
  • Data mới: số data up trong kỳ.
  • Hẹn PV: số dòng trong Danh sách đưa đón trong kỳ.
  • Đến PV: dòng có Tình trạng "Đã đón". Bùng PV: Tình trạng "Chưa đón được".
  • Đỗ PV: Tình trạng "Đã đón" và Kết quả trống hoặc "Đỗ PV". Trượt PV: "Đã đón" và "Trượt PV". Tình trạng khác thì bỏ qua cột Kết quả.
  • Tỷ lệ hẹn = Hẹn PV ÷ Data mới; Tỷ lệ đến = Đến ÷ Hẹn; Tỷ lệ đỗ = Đỗ ÷ Đến (mẫu số 0 thì 0%).
  • Bấm vào ô Hẹn/Đến/Bùng/Đỗ/Trượt hoặc ô tỷ lệ để xem tách CT (chính thức) / TV (thời vụ) theo cột Loại hình của Đưa đón.
- Cách đếm: lọc theo ngày/tuần/vài ngày → đếm từng dòng (lượt). Lọc Tháng này / Tháng trước và tab Biểu đồ → đếm NGƯỜI (trùng SĐT + tên chỉ tính 1).
- Có so sánh với kỳ trước, bảng theo nhóm, bảng hiệu suất từng nhân viên, Top 3 hẹn/đỗ PV, Tiến độ chăm sóc kho, khối Chi phí Marketing (người có quyền), tab Biểu đồ theo tháng/năm.
- Chi phí Marketing: Chi phí MKT = tổng tiền quảng cáo trong kỳ; Data thu được = mọi số up trong kỳ; Chi phí/data = chi phí ÷ data; Chi phí/phỏng vấn = tiền tiêu lùi 1 ngày ÷ số người trong Đưa đón trong kỳ.

DATA LAO ĐỘNG
- Mỗi data: tên, SĐT, nguồn (Facebook / TikTok / Zalo / Website / Khác), Nguồn MKT, ghi chú MKT. Thêm tay, nhập Excel, hoặc Up tự động từ Pancake (tin nhắn/bình luận Facebook có SĐT tự thành data).
- Data mới vào "Chờ phân chia" của nhóm → Leader chia tay, chia hàng loạt hoặc bật Chia tự động (xoay vòng các Sale). Sale được chia có thông báo.
- Trùng SĐT: vẫn cho up, chỉ cảnh báo. Up lại trong 7 ngày → tự về nhóm đang giữ số gốc.
- Trạng thái data (cập nhật lại được): cuộc gọi (đã gọi / chưa gọi / không nghe / thuê bao) → kết quả (tiềm năng / không tiềm năng / đang cân nhắc / hẹn gọi lại) → PV (đã hẹn / đến / bùng / đỗ / trượt) → đi làm (đã đi / không đi, có lý do).
- Ghi chú chỉ thêm, không ghi đè. Bôi màu ghi chú: đỏ / vàng / xanh để đánh dấu mức độ (ví dụ "số bôi đỏ").
- Giữ số: Sale giữ riêng 1 data; số đang giữ chỉ người giữ thao tác được; Leader nhóm, Quản lý, Admin chỉ được "bỏ giữ số".
- Mỗi data chỉ 1 người mở trang chi tiết cùng lúc; người sau thấy "<Tên> đang ở trong data".
- Chuyển data cho Sale khác chỉ trong cùng nhóm; Quản lý/Admin chuyển được sang nhóm khác (data về Chờ phân chia của nhóm mới).
- Hẹn gọi lại: đến giờ, người đặt lịch nhận thông báo nhắc.

KHO CHĂM SÓC (trong Data lao động)
- Kho dùng chung theo nhóm cho data cũ cần chăm sóc lại; người nhận data vẫn giữ nguyên chủ sở hữu gốc. Mỗi data 1 người xử lý tại một thời điểm.
- Chu kỳ chăm sóc = 30 ngày gần nhất. "Chưa chăm sóc 30 ngày" = data up từ 30 ngày trước và không có ghi chú nào trong 30 ngày qua.
- Tiến độ chăm sóc (Dashboard + Báo cáo): đã chăm sóc / cần chăm sóc / chưa chăm sóc theo nhóm và nhân viên. Data giao rồi bị thu hồi khi Sale chưa xử lý thì không tính cho Sale cũ.

DANH SÁCH ĐƯA ĐÓN
- Mỗi dòng = 1 lượt lao động đi phỏng vấn: ngày, giờ PV, họ tên, SĐT, công ty (đơn hàng), khu vực, loại hình (CT/TV), Sale, nhân viên đưa đón, nhà thầu, nguồn, Tình trạng đón (Đã đón / Chưa đón được / Hẹn lại), Kết quả PV (Đỗ PV / Trượt PV), ghi chú.
- Đây là nguồn số Hẹn/Đến/Bùng/Đỗ/Trượt PV của Dashboard.
- Nhập tay, kéo thả sắp thứ tự trong ngày, Nhập Excel (quyền riêng), hoặc nút "Đồng bộ" từ Google Sheet (1 chiều sheet → phần mềm, xem trước rồi đồng bộ, mỗi lần 1 tab tháng). Đồng bộ không ghi đè Tình trạng đón + Kết quả đã sửa trên phần mềm.
- Thông báo khi thêm / đổi Tình trạng / đổi Kết quả: gửi Sale phụ trách dòng + Leader của Sale; Admin, Quản lý nhận tất cả.

BÁO CÁO
- Báo cáo hằng ngày của Sale: tổng số gọi, data mới, data cũ, không nghe máy, quan tâm, hẹn PV, đỗ PV, đi làm. Nộp trước hạn giờ quy định, nộp muộn/không nộp có thể bị ghi phạt (tab kiểm tra phạt).
- Tab Tiến độ chăm sóc kho.

CHẤM CÔNG
- Check in GPS: mọi nhân viên trừ Admin, Quản lý phải check in trong phạm vi vị trí văn phòng mình (VP Hà Nội / Bắc Ninh / Bắc Giang).
- Chấm công thủ công: bảng công tháng theo văn phòng; ký hiệu NP = nghỉ phép (trừ 1 ngày phép), N = nghỉ không phép/hết phép, L = nghỉ lễ.
- Đơn xin nghỉ phép: nhân viên gửi → duyệt cấp 1 (Leader) → duyệt cuối Admin/Quản lý → tự chấm NP (còn phép) hoặc N (hết phép) cho các ngày nghỉ.
- Phép được cộng hằng tháng cho người được tick "Chấm công", sau khi đủ 30 ngày từ ngày vào làm.
- Bảng công tháng: người quản lý gửi bảng công → nhân viên bấm Đồng ý hoặc Báo sai (chọn ngày + đúng ra là gì) → báo Kế toán chốt lương.
- Phiếu lương: nút "Phiếu lương" ở trang Chấm công; nhân viên xem, bấm Đồng ý hoặc Thắc mắc.

KẾ TOÁN / TIỀN LƯƠNG
- Kế toán, Admin làm bảng lương; Quản lý chỉ xem. Quy trình: Nháp → Chốt → Gửi nhân viên → nhân viên Đồng ý / Thắc mắc → Tải Excel đi lệnh ngân hàng → Hoàn thành.
- Thực nhận = Tổng lương − Tổng giảm trừ. Lương thử việc 85%, chính thức 100%, ngày lễ 200%, đêm lễ 250%; phụ cấp (điện thoại, chuyên cần, trách nhiệm, nhà ở, tiền ăn 30.000đ/công, phòng trọ); giảm trừ (ứng lương, bảo hiểm, phạt, khác).
- Công chuẩn = số ngày trong tháng trừ Chủ nhật; nghỉ phép và nghỉ lễ vẫn hưởng lương.
- Doanh số / hoa hồng: theo số lao động đi làm × mức hoa hồng (riêng từng người hoặc theo công ty); DS Media/Tuyển dụng/Đưa đón tính theo giờ công lao động.
- Thưởng lao động: nhập ở "Nhập DS/Thưởng"; Kế toán tick "Đã chi".

NHẬP DS/THƯỞNG
- Nhập doanh số: mỗi lao động đi làm (công ty, Sale/người tuyển…) — là căn cứ tính hoa hồng.
- Nhập thưởng lao động: 4 tab Sale / Media / Tuyển dụng / Đưa đón.

QUẢN LÝ ĐƠN HÀNG
- Danh sách công ty / đơn hàng đối tác. Dùng làm danh sách chọn "Công ty" ở Đưa đón, Doanh số, Lịch tuyển dụng.

LỊCH TUYỂN DỤNG
- Mỗi nhóm một lịch: thẻ theo công ty × loại (chính thức/thời vụ), trạng thái Đang tuyển / Hạn chế / Tạm dừng; có yêu cầu giới tính, tuổi, lương, quyền lợi… Sale chỉ xem; Admin, Quản lý, Leader, Sup Leader sửa.

MARKETING HUB
- Liên kết tài khoản quảng cáo (TKQC) Facebook/TikTok, mỗi TKQC 1 người phụ trách. Bảng hiệu quả: số data, tổng chi tiêu, Giá số = chi ÷ data (tô xanh/cam/đỏ theo mốc Admin đặt), Trạng thái camp (Đang hoạt động / Dừng), Trạng thái TK (Live ADS / Chưa thanh toán / Die ADS), Số dư (cảnh báo khi thấp).
- Bảng Data theo ad set: data từ quảng cáo theo nhân viên + ad set, kèm số bôi đỏ/vàng/xanh; bật/tắt ad set ngay trên bảng (người có quyền).
- Pancake: liên kết page, Up tự động data (bật/tắt + tỉ lệ chia nhóm ở trang Data lao động), bảng theo page (người nhắn mới, để lại SĐT, tỉ lệ), ghi chú theo bài.
- Nguồn MKT: danh mục do Admin quản lý, gắn với TKQC/page để tính số data cho từng MKT.

MEDIA
- Kế hoạch / chiến dịch, giao việc (Kanban), nộp sản phẩm → duyệt (Duyệt / Cần chỉnh sửa), ý tưởng & kịch bản (cảnh báo trùng), lịch xuất bản, Sổ video (quay, dựng, link, đăng), báo cáo hiệu quả (số liệu nhập tay).

KHÁC
- Lịch hẹn: lịch PV và lịch gọi lại của data.
- Nhật ký: lịch sử thao tác (Admin, Quản lý).
- Quản lý tài khoản (Admin): thêm/sửa/vô hiệu hoá nhân viên, vai trò, nhóm, văn phòng, chức vụ, ngày vào làm.
- Liên hệ từ website: doanh nghiệp gửi nhu cầu tuyển dụng trên saramvina.com. Người lao động đăng ký tìm việc trên web tự thành data nguồn Website.
- Phản ánh ẩn danh: nhân viên gửi góp ý không lộ tên.
- Thông báo: chuông trên đầu trang; bật "Thông báo nổi" ở Cài đặt tài khoản để nhận trên điện thoại/máy tính kể cả khi đóng web.
- Cài đặt tài khoản: ảnh đại diện, giao diện sáng/tối, thông báo nổi, xem thông tin nhân sự, đổi mật khẩu; Admin có thêm Cài đặt Check in, Trợ lý AI.
`.trim();
