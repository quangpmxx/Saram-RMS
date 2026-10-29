/**
 * Dải ngăn cách giữa 2 ngày trong bảng (yêu cầu người dùng 2026-10-29 —
 * giống dải xanh đậm người dùng tự kẻ trong Google Sheet): chèn trước dòng
 * đầu tiên của một ngày mới. Chỉ để nhìn, không bấm được.
 */
export function DaySeparatorRow({ colSpan }: { colSpan: number }) {
  return (
    <tr aria-hidden="true">
      <td colSpan={colSpan} className="h-3.5 bg-blue-700 p-0" />
    </tr>
  );
}
