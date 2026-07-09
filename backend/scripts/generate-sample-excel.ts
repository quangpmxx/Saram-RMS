/**
 * Sinh file Excel mẫu để trải nghiệm chức năng "Nhập từ Excel" (Mục 3,
 * docs/09; POST /candidate/import, docs/13). Cột khớp đúng thứ tự mà
 * ImportsService.processImport() đọc (backend/src/imports/imports.service.ts):
 * 1=Tên lao động, 2=Số điện thoại, 3=Nguồn, 4=Năm sinh, 5=Địa chỉ, 6=Ghi chú.
 *
 * File có chủ đích 3 loại dòng để người dùng thấy rõ 3 nhánh xử lý:
 *  - Dòng hợp lệ (thành công).
 *  - Dòng lỗi thiếu SĐT (để thấy đếm "error_count" + thông báo lỗi theo dòng).
 *  - Dòng trùng SĐT với dữ liệu mẫu đã seed sẵn (để thấy "duplicate_count").
 *
 * Chạy: npx ts-node -P tsconfig.json scripts/generate-sample-excel.ts
 */
import ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ứng viên');

  sheet.addRow(['Tên lao động', 'Số điện thoại', 'Nguồn', 'Năm sinh', 'Địa chỉ', 'Ghi chú']);

  // Các dòng hợp lệ.
  sheet.addRow(['Hoàng Văn Em', '0902000001', 'Facebook', 1997, 'Long An', 'Sẵn sàng đi làm ngay']);
  sheet.addRow(['Vũ Thị Giang', '0902000002', 'Zalo', 1999, 'Tây Ninh', '']);
  sheet.addRow(['Đặng Văn Hùng', '0902000003', 'TikTok', 2001, 'Bình Phước', 'Có kinh nghiệm may mặc']);

  // Dòng lỗi: thiếu số điện thoại.
  sheet.addRow(['Bùi Thị Không SĐT', '', 'Facebook', 1998, 'Bình Dương', '']);

  // Dòng trùng SĐT với dữ liệu mẫu đã seed (0901000001 — Nguyễn Văn An).
  sheet.addRow(['Nguyễn Văn An (trùng)', '0901000001', 'Khác', 1998, 'Bình Dương', 'Nhập lại từ nguồn khác']);

  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const outPath = path.join(__dirname, '..', '..', 'sample-data', 'mau-import-ung-vien.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Đã tạo file mẫu: ${outPath}`);
}

main().catch((error: unknown) => {
  console.error('Sinh file mẫu thất bại:', error);
  process.exit(1);
});
