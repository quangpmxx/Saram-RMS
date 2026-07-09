# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ — CRM TUYỂN DỤNG / CUNG ỨNG LAO ĐỘNG

> Tài liệu này tổng hợp toàn bộ nghiệp vụ đã thu thập qua các buổi trao đổi với chủ doanh nghiệp.
> Phạm vi: **chỉ đặc tả nghiệp vụ**. Không thiết kế database, không viết code, không thiết kế giao diện.

---

## 1. Giới thiệu công ty

- **Loại hình:** Công ty cung ứng/môi giới lao động phổ thông (công nhân) trung gian, kết nối ứng viên (người lao động) với các nhà máy đối tác có nhu cầu tuyển dụng công nhân.
- **Quy mô vận hành:** 1 văn phòng duy nhất, chưa có chi nhánh.
- **Hiện trạng:** Toàn bộ quy trình quản lý lead/ứng viên đang thực hiện thủ công trên Google Sheet, gây khó khăn trong việc theo dõi, phân chia công việc, tránh trùng lặp dữ liệu và giám sát hiệu suất nhân viên.
- **Mục tiêu xây dựng phần mềm:** Thay thế Google Sheet bằng một hệ thống quản lý tập trung, giúp:
  - Theo dõi toàn bộ vòng đời ứng viên, từ khi có dữ liệu đến khi ứng viên đi làm.
  - Hỗ trợ phân chia công việc giữa các nhân viên sale.
  - Tự động điều phối các lead bị bỏ quên (cơ chế "chăm sóc").
  - Cung cấp báo cáo/dashboard tổng quan cho quản lý.
- **Phạm vi phần mềm (giai đoạn hiện tại):** Quản lý lead → tư vấn → phỏng vấn → đi làm.
- **Ngoài phạm vi (giai đoạn hiện tại):** Quản lý tài chính, hoa hồng, hợp đồng lao động, vận hành đưa đón công nhân (dự kiến bổ sung ở giai đoạn sau dưới dạng module riêng).

---

## 2. Quy trình Marketing (MKT)

1. MKT chạy quảng cáo/thu thập dữ liệu từ các kênh: **Facebook, TikTok, Zalo, Khác**.
2. Data thu thập được nhập lên hệ thống theo 2 hình thức:
   - **Nhập tay từng dòng**: áp dụng cho data phát sinh hàng ngày (trung bình ~200 lead mới/ngày toàn công ty).
   - **Import hàng loạt từ Excel**: áp dụng cho data cũ đang lưu trong Google Sheet (~20.000 dòng), import dần theo từng đợt (đợt đầu tiên dự kiến ~1.000 dòng).
3. Mỗi lead khi MKT nhập cần có tối thiểu: tên lao động, số điện thoại, nguồn kênh, thời gian up, ghi chú của MKT (nếu có).
4. Sau khi nhập, lead vào trạng thái **"Chờ phân chia"** — hiển thị cho cả MKT và Leader xem, chờ Leader chia cho Sale.
5. Quyền của MKT trên data do chính mình upload: được **sửa** hoặc **xóa**.
6. MKT xem được toàn bộ ghi chú/lịch sử xử lý mà Sale thực hiện trên lead, nhưng **không có quyền chỉnh sửa** nội dung đó.
7. MKT không tham gia vào việc chia lead cho sale, cũng không thao tác trên cột "chăm sóc".
8. Có 4 nhân viên MKT, ngang quyền nhau, không có cấp bậc/leader riêng trong bộ phận MKT.
9. Hệ thống cảnh báo trùng lặp: nếu cùng 1 số điện thoại được up nhiều lần, MKT và Admin/Quản lý luôn nhìn thấy toàn bộ các lần trùng, không giới hạn theo nhóm sale nào phụ trách.

---

## 3. Quy trình Leader (Leader Sale)

1. Leader xem được toàn bộ dữ liệu thuộc nhóm sale mình quản lý; **không thấy dữ liệu của nhóm khác**.
2. Leader vào màn hình "Chờ phân chia" để chia lead cho từng sale trong nhóm, theo 1 trong 2 cách:
   - **Chia thủ công**: chọn từng lead, giao cho 1 sale cụ thể.
   - **Tự động phân chia (round-robin)**: Leader sắp xếp thứ tự danh sách các sale sẽ tham gia (ví dụ: A, C, D, B) rồi kích hoạt. Từ đó, mỗi lead mới về sẽ tự động gán lần lượt theo thứ tự đã chọn, hết vòng thì quay lại từ đầu (lead 1→A, lead 2→C, lead 3→D, lead 4→B, lead 5→A, ...).
   - Leader có thể **tạm dừng** chế độ tự động bất kỳ lúc nào để thêm/bớt sale khỏi vòng quay.
3. Leader có quyền **chuyển lead** đang thuộc 1 sale sang sale khác trong cùng nhóm (ví dụ khi phát sinh vấn đề nhân sự).
4. Leader có thể chỉnh sửa mọi thông tin của lead thuộc nhóm mình.
5. Leader có quyền chỉnh (cùng Admin) thời gian ngưỡng của cơ chế chăm sóc — **thực tế theo ghi nhận, quyền chỉnh thời gian 30 phút là của Admin**; Leader chỉ vận hành chia/chuyển lead trong nhóm (xem Mục 8 để biết chi tiết phân quyền).
6. **Trường hợp Sale nghỉ việc:** không cần thao tác chuyển lead thủ công — toàn bộ lead của sale đó vẫn thuộc quyền quản lý/chăm sóc chung của cả nhóm (Leader + các sale còn lại). Khi có nhân viên mới thay thế, Admin đổi tên/thông tin đăng nhập của tài khoản cũ cho nhân viên mới, giữ nguyên toàn bộ lead đã gán.
7. Leader **không có quyền**: thêm/xóa nhân viên, reset mật khẩu nhân viên, xem dữ liệu của nhóm khác.

---

## 4. Quy trình Sale

1. Sale nhận lead từ 2 nguồn:
   - Lead được **Leader giao trực tiếp** (thủ công hoặc qua cơ chế tự động round-robin).
   - Lead xuất hiện ở **cột "chăm sóc"** — là lead của người khác trong nhóm bị bỏ quên quá thời gian quy định, hiển thị dùng chung cho cả nhóm xử lý (trừ lead đã được đánh dấu giữ riêng).
2. Với mỗi lead, Sale gọi điện tư vấn và thu thập thêm thông tin: năm sinh, địa chỉ/quê quán, thông tin tư vấn khác.
3. Sale cập nhật lần lượt các trạng thái theo tiến trình xử lý lead (chi tiết tại Mục 7).
4. Khi hẹn lịch phỏng vấn, Sale ghi rõ **công ty đối tác (nhà máy) hẹn phỏng vấn** — nhập tự do dạng văn bản.
5. Sale có thể đánh dấu **"giữ số"** cho lead của mình để loại trừ khỏi cơ chế tự động chuyển vào cột chăm sóc; **không giới hạn** số lượng lead được giữ.
6. Khi xử lý 1 lead trong cột chăm sóc: chỉ 1 sale được thao tác tại 1 thời điểm — người vào sau sẽ thấy thông báo "Sale ... đang xử lý"; nếu người đang xử lý thoát ra giữa chừng mà chưa hoàn tất, hệ thống **tự động giải phóng ngay lập tức** để người khác có thể vào xử lý.
7. Ghi chú/lịch sử cuộc gọi: mỗi lần gọi, Sale ghi nhận kết quả dưới dạng note. Sale có thể xóa note cũ nhưng hệ thống **vẫn lưu lại toàn bộ lịch sử** (không mất dữ liệu).
8. Phạm vi thao tác của Sale: chỉ xem và thao tác trên **lead được giao cho mình** + **cột chăm sóc chung của nhóm mình**.
9. Sale sử dụng hệ thống trên cả máy tính và điện thoại (bắt buộc responsive tốt trên di động).
10. Không giới hạn số lượng lead tối đa mà 1 sale được nhận.

---

## 5. Quy trình HR

Trong phạm vi nghiệp vụ đã thu thập được đến thời điểm hiện tại, **công ty không có vai trò hoặc quy trình HR riêng biệt** trong hệ thống. Toàn bộ công việc tư vấn và theo dõi ứng viên do **Sale** và **Leader** đảm nhiệm.

Công ty có kế hoạch bổ sung **module "đưa đón lao động"** ở giai đoạn sau (nhân viên đưa đón công nhân tới nhà máy sẽ cập nhật kết quả trên hệ thống), tuy nhiên vai trò, quy trình cụ thể, và quyền hạn của bộ phận này **chưa được đặc tả chi tiết** — sẽ thu thập yêu cầu khi triển khai giai đoạn đó (xem Mục 11).

---

## 6. Quy trình ứng viên (góc nhìn ứng viên/lao động)

1. Ứng viên để lại thông tin qua các kênh quảng cáo (Facebook, TikTok, Zalo, khác) → trở thành 1 "lead" trong hệ thống.
2. Ứng viên được Sale liên hệ tư vấn qua điện thoại, cung cấp thêm thông tin cá nhân (năm sinh, địa chỉ...).
3. Nếu được đánh giá tiềm năng, Sale hẹn lịch phỏng vấn với 1 công ty đối tác (nhà máy) cụ thể.
4. Ứng viên đến phỏng vấn, hoặc **bùng lịch** (không đến) — trường hợp bùng vẫn có thể được **hẹn lại lần khác**.
5. Kết quả phỏng vấn: **đỗ** hoặc **trượt**.
6. Nếu đỗ, ứng viên có thể **đi làm** hoặc **không đi làm** — nếu không đi làm dù đã đỗ phỏng vấn, Sale ghi nhận lý do (nhập tự do).
7. Việc đưa đón ứng viên tới nhà máy do bộ phận đưa đón của công ty đảm nhiệm — nằm ngoài phạm vi phần mềm ở giai đoạn hiện tại.
8. Mọi trạng thái của ứng viên trong toàn bộ hành trình này đều **có thể cập nhật lại** — không có trạng thái nào là vĩnh viễn hay "đóng hẳn".

---

## 7. Các trạng thái ứng viên (Lead Status)

### a) Tình trạng cuộc gọi
- Đã gọi
- Chưa gọi
- Không nghe máy
- Thuê bao (không liên lạc được)

### b) Kết quả cuộc gọi
- Tiềm năng
- Không tiềm năng
- Đang cân nhắc
- Hẹn gọi lại

### c) Trạng thái phỏng vấn
- Đã hẹn PV (kèm thông tin công ty đối tác hẹn)
- Đến PV
- Bùng PV (không đến — có thể hẹn lại)
- Đỗ PV
- Trượt PV

### d) Trạng thái đi làm
- Đã đi làm
- Không đi làm (kèm lý do ghi chú tự do, áp dụng cho trường hợp đỗ PV nhưng không đi làm)

### e) Trạng thái vận hành nội bộ (không phải trạng thái ứng viên, nhưng gắn liền với lead)
- Chờ phân chia
- Đã phân chia (thuộc về 1 sale cụ thể)
- Đang ở cột chăm sóc (dùng chung cho cả nhóm)
- Đã giữ riêng (loại trừ khỏi cột chăm sóc)

**Lưu ý quan trọng:** Không có trạng thái nào là vĩnh viễn — kể cả "Không tiềm năng" hay "Bùng PV" đều có thể được cập nhật hoặc gọi lại sau này. Hệ thống không có khái niệm "đóng lead".

---

## 8. Các quyền của từng vai trò

| Vai trò | Phạm vi xem dữ liệu | Thêm nhân viên | Xóa nhân viên | Reset mật khẩu NV | Chia/chuyển lead | Xóa lead/data | Sửa cấu hình hệ thống (thời gian chăm sóc...) |
|---|---|---|---|---|---|---|---|
| **Admin** | Toàn bộ hệ thống | Có | Có | Có | Có | Có (duy nhất) | Có |
| **Quản lý** (Admin có thể tạo nhiều tài khoản) | Toàn bộ hệ thống (giống Admin) | Không | Không | Không (theo ghi nhận hiện tại — xem Mục 11) | Có (như Leader/vận hành) | Không | Chưa xác định rõ (xem Mục 11) |
| **Leader Sale** | Toàn bộ dữ liệu nhóm mình | Không | Không | Không | Có (trong nhóm mình) | Không | Không |
| **MKT** (4 người, ngang quyền) | Dữ liệu mình upload + xem (không sửa) note của Sale | Không | Không | Không | Không | Có (chỉ data do mình upload) | Không |
| **Sale** | Lead được giao cho mình + cột chăm sóc nhóm mình | Không | Không | Không | Không | Không (chỉ xóa note cũ, vẫn lưu lịch sử) | Không |

**Ghi chú bổ sung:**
- Mỗi tài khoản chỉ được gán **đúng 1 vai trò**.
- Đăng nhập bằng tài khoản/mật khẩu do Admin cấp; cho phép đăng nhập **nhiều thiết bị cùng lúc**.
- Quên mật khẩu: **chỉ Admin** có quyền reset (mật khẩu reset về mặc định "123456"); Leader và Quản lý không có quyền này.
- Tìm kiếm/lọc dữ liệu luôn giới hạn theo đúng phạm vi được xem của từng vai trò (Sale: lead của mình + chăm sóc nhóm mình; Leader: cả nhóm; Quản lý/Admin: toàn bộ hệ thống).

---

## 9. Các báo cáo cần có

Dashboard tổng quan (đã thống nhất với chủ doanh nghiệp) gồm các chỉ số:

1. Tổng số lead mới trong ngày/tuần, phân theo nguồn kênh (Facebook/TikTok/Zalo/Khác).
2. Số lượng lead đang ở trạng thái "chờ phân chia".
3. Tỷ lệ chuyển đổi theo từng bước phễu: Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm.
4. Hiệu suất từng Sale: số cuộc gọi đã thực hiện, số lead tiềm năng, số lead đã đi làm.
5. Số lượng lead hiện đang nằm ở cột "chăm sóc", theo từng nhóm.

**Không yêu cầu** chức năng xuất báo cáo ra file Excel — chỉ cần xem trực tiếp trên Dashboard trong phần mềm.

---

## 10. Các quy tắc nghiệp vụ

1. **Cơ chế "cột chăm sóc" (30 phút):**
   - Chỉ áp dụng cho lead **đã qua ít nhất 1 lần xử lý** (đã có kết quả cuộc gọi, ví dụ "hẹn gọi lại"), nếu bị bỏ quên quá thời gian ngưỡng (mặc định 30 phút, Admin chỉnh được) thì tự động hiển thị thêm ở cột chăm sóc cho các thành viên khác cùng nhóm.
   - Lead hoàn toàn mới (chưa từng được gọi lần nào) **không** áp dụng cơ chế này.
   - Thời gian tính liên tục theo giờ đồng hồ (24/7), không tính riêng theo giờ hành chính.
   - Quyền sở hữu gốc của lead **không thay đổi** khi lead vào cột chăm sóc — cột chăm sóc chỉ là nơi hiển thị dùng chung để xử lý chéo.
   - Lead đã vào cột chăm sóc sẽ **ở đó vĩnh viễn**, chỉ Admin có quyền xóa khỏi danh sách này.
   - Mọi trạng thái lead (kể cả "Không tiềm năng") đều tuân theo cùng quy tắc 30 phút này nếu bị bỏ quên.

2. **Đánh dấu giữ số:** Sale có quyền giữ riêng lead của mình (loại khỏi cơ chế chăm sóc), không giới hạn số lượng được giữ.

3. **Khóa xử lý đồng thời trong cột chăm sóc:** chỉ 1 người xử lý 1 lead tại 1 thời điểm; khóa tự động giải phóng ngay khi người đang xử lý thoát ra giữa chừng (không cần chờ timeout).

4. **Xử lý dữ liệu trùng lặp:**
   - Trùng trong cùng nhóm: đánh dấu bằng màu chữ khác, hover/click xem chi tiết trùng với ngày nào, sale nào.
   - Trùng khác nhóm: Sale không thấy cảnh báo; chỉ MKT, Quản lý, Admin luôn thấy toàn bộ các lần trùng.
   - Dữ liệu trùng **vẫn được phép upload bình thường**, hệ thống chỉ cảnh báo, không chặn.

5. **Tự động phân chia lead (round-robin):** Leader chọn và sắp xếp danh sách sale tham gia, kích hoạt để hệ thống tự gán lead mới lần lượt theo thứ tự, có thể tạm dừng bất kỳ lúc nào.

6. **Không có khái niệm đóng lead:** mọi lead tồn tại vĩnh viễn trong hệ thống; chỉ Admin có quyền xóa.

7. **Lưu lịch sử:** toàn bộ lịch sử truy cập và ghi chú được lưu lại; khi Sale xóa 1 note cũ, dữ liệu note đó vẫn được giữ trong lịch sử (không mất).

8. **Nhân viên nghỉ việc:** không cần thao tác chuyển lead — lead vẫn thuộc quản lý chung của nhóm; tài khoản cũ được đổi tên/thông tin đăng nhập để bàn giao cho nhân viên mới.

9. **Không giới hạn** số lượng lead tối đa mỗi sale được nhận, cũng như số lượng lead được giữ riêng.

10. **Thông báo:** nhắc lịch gọi lại và lịch hẹn phỏng vấn được gửi qua **Zalo**; hệ thống hiện tại chưa cần thêm thông báo trong app (chuông thông báo).

---

## 11. Những điểm còn chưa rõ (cần bổ sung/xác nhận thêm)

Các mục dưới đây được ghi nhận là **chưa xác định đầy đủ**, cần thu thập thêm thông tin trước khi hoàn thiện thiết kế:

1. **Danh sách quyền chi tiết (checklist) cho vai trò Quản lý/Leader** — chủ doanh nghiệp đề nghị bên xây dựng đề xuất cụ thể danh sách các quyền có thể bật/tắt khi Admin tạo hoặc chỉnh sửa tài khoản Quản lý/Leader; hiện chưa có danh sách chốt.
2. **Ranh giới đầy đủ giữa Admin và Quản lý:** ngoài 3 hành động đã xác nhận là chỉ Admin làm được (thêm/xóa nhân viên, xóa data, reset mật khẩu nhân viên), chủ doanh nghiệp xác nhận **chưa nghĩ ra hết** các hành động khác cần giới hạn — sẽ bổ sung sau.
3. **Quy trình/vai trò bộ phận đưa đón (liên quan HR/vận hành):** chưa được đặc tả — dự kiến thu thập khi triển khai module "đưa đón lao động" ở giai đoạn sau.
4. **Danh sách công ty đối tác (nhà máy):** hiện trường "công ty hẹn" chỉ nhập tự do dạng văn bản, chưa có danh mục chuẩn hóa — có thể ảnh hưởng đến độ chính xác khi thống kê/báo cáo theo từng đối tác trong tương lai, cần xác nhận lại nếu phát sinh nhu cầu này.
5. **Nội dung và tần suất thông báo qua Zalo:** mới xác nhận kênh gửi là Zalo, chưa xác định rõ những sự kiện cụ thể nào sẽ kích hoạt gửi thông báo.
6. **Báo cáo theo chu kỳ dài hạn** (so sánh tuần này/tuần trước, tháng này/tháng trước...): chưa được yêu cầu cụ thể ngoài các chỉ số Dashboard đã thống nhất tại Mục 9 — có thể cần làm rõ thêm khi hệ thống đi vào sử dụng thực tế.
7. **[Phát hiện qua Design Review]** Quyền xóa ghi chú (note): Mục 4.7 chỉ xác nhận "Sale có thể xóa note cũ", chưa rõ Sale chỉ được xóa note do chính mình ghi, hay được xóa cả note do sale khác ghi trên cùng 1 lead (tình huống thực tế: lead ở cột chăm sóc, nhiều sale cùng ghi note theo thời gian). Tài liệu 13 (thiết kế API) đang tạm giả định "chỉ note của mình" — cần xác nhận lại.
8. **[Phát hiện qua Design Review]** Quyền sửa thông tin cơ bản (tên/SĐT) của MKT: Mục 2.5 xác nhận MKT được sửa data do mình upload, nhưng chưa rõ có giới hạn theo thời gian/trạng thái xử lý không — vd lead đã có lịch hẹn PV hoặc nhiều note của Sale, MKT sửa SĐT lúc này có thể gây sai lệch dữ liệu đang được Sale xử lý. Cần xác nhận có nên giới hạn hay không.
9. **[Phát hiện qua Design Review]** Vòng quay tự động phân chia (round-robin): khi 1 sale trong danh sách tham gia vòng quay bị nghỉ việc/vô hiệu hóa, hệ thống có tự động bỏ qua người đó trong vòng quay không, hay Leader phải tự vào cấu hình lại danh sách? Chưa được đề cập trong nghiệp vụ đã thu thập.

---

*Tài liệu được tổng hợp từ các buổi trao đổi nghiệp vụ trực tiếp với chủ doanh nghiệp. Chưa thiết kế database, chưa viết code, chưa thiết kế giao diện — đúng theo yêu cầu.*
