/**
 * Đưa đón cho phép nhập trùng (lao động hẹn hôm qua, hôm nay đón lại vẫn nhập dòng mới — yêu cầu
 * người dùng 2026-11-08). Khi ĐẾM NGƯỜI (Dashboard) thì gộp theo cặp SĐT + tên: 1 SĐT 3 tên khác
 * nhau = 3 người; cùng SĐT + cùng tên nhập nhiều lần = 1 người. Tên so không phân biệt hoa/thường,
 * dấu, khoảng trắng thừa.
 */
export function shuttlePersonKey(row: {
  phoneNumber: string;
  fullName: string;
}): string {
  const name = row.fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return `${row.phoneNumber.replace(/\D/g, '')}|${name}`;
}

/** Số người (không trùng SĐT + tên) trong các dòng. */
export function countShuttlePersons(
  rows: { phoneNumber: string; fullName: string }[],
): number {
  return new Set(rows.map(shuttlePersonKey)).size;
}
