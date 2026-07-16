/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, Mục 6): "Không hiển thị năm
 * sinh hoặc tuổi để bảo vệ thông tin cá nhân. Chỉ hiển thị tên, avatar,
 * nhóm/chức vụ nếu phù hợp." — KHÔNG có field ngày sinh đầy đủ nào ở đây.
 */
export interface BirthdayEmployeeDto {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  /** Chức vụ tùy chỉnh (Account.position) — null thì frontend tự hiện nhãn vai trò thay thế, giống các nơi khác trong hệ thống. */
  position: string | null;
  team_name: string | null;
}

export interface BirthdayTodayResponseDto {
  /** "MM-DD" đang dùng để so khớp — ngày thật, hoặc ngày giả lập nếu đang ở chế độ xem thử (Mục 11). */
  date: string;
  /** true nếu kết quả này đến từ chế độ xem thử (simulated_date/force_account_id) — frontend dùng để không lưu cache dài hạn cho kết quả preview. */
  is_preview: boolean;
  employees: BirthdayEmployeeDto[];
}
