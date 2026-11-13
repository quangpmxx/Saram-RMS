/**
 * Bộ thành phần lương mặc định theo mẫu phiếu lương Saram (2026-11-13) — tạo sẵn lần đầu
 * mở trang (PayrollService.ensureDefaults), kèm mẫu "Phiếu lương Saram" gồm đủ các khoản.
 *
 * - Công thức "0": số cố định theo từng người (phụ cấp, bảo hiểm) — kế toán đặt ở mục
 *   Nhân viên → công thức riêng (vd 1500000).
 * - Không có công thức (null): nhập tay số tiền mỗi tháng ở bảng lương.
 * - nature "allowance" = phụ cấp: cộng vào Tổng lương, in riêng nhóm "Các khoản phụ cấp".
 */
export interface PresetComponent {
  code: string;
  name: string;
  nature: 'income' | 'allowance' | 'deduction' | 'info';
  formula: string | null;
}

export const DEFAULT_COMPONENTS: PresetComponent[] = [
  {
    code: 'LUONG_THU_VIEC',
    name: 'Lương thử việc 85%',
    nature: 'income',
    formula: 'LUONG_CO_BAN * 0.85 / CONG_CHUAN * CONG_THU_VIEC',
  },
  {
    code: 'LUONG_CHINH_THUC',
    name: 'Lương chính thức 100%',
    nature: 'income',
    formula: 'LUONG_CO_BAN / CONG_CHUAN * CONG_CHINH_THUC',
  },
  {
    code: 'LUONG_NGAY_LE',
    name: 'Lương ngày lễ 200%',
    nature: 'income',
    formula: null,
  },
  {
    code: 'LUONG_DEM_LE',
    name: 'Lương đêm lễ 250%',
    nature: 'income',
    formula: null,
  },
  // Có mức hoa hồng riêng (vd 50.000đ/người) → tính theo đầu người; không có → theo giờ × mức công ty.
  {
    code: 'DOANH_SO',
    name: 'Doanh số',
    nature: 'income',
    formula: 'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)',
  },
  {
    code: 'PC_DIEN_THOAI',
    name: 'Phụ cấp điện thoại',
    nature: 'allowance',
    formula: '0',
  },
  {
    code: 'PC_CHUYEN_CAN',
    name: 'Phụ cấp chuyên cần',
    nature: 'allowance',
    formula: '0',
  },
  {
    code: 'PC_TRACH_NHIEM',
    name: 'Phụ cấp trách nhiệm',
    nature: 'allowance',
    formula: '0',
  },
  {
    code: 'PC_NHA_O',
    name: 'Phụ cấp nhà ở',
    nature: 'allowance',
    formula: '0',
  },
  {
    code: 'TIEN_AN',
    name: 'Tiền ăn',
    nature: 'allowance',
    formula: '30000 * MIN(CONG_THUC_TE, CONG_CHUAN)',
  },
  {
    code: 'HO_TRO_PHONG_TRO',
    name: 'Hỗ trợ phòng trọ',
    nature: 'allowance',
    formula: '0',
  },
  { code: 'UNG_LUONG', name: 'Ứng lương', nature: 'deduction', formula: null },
  { code: 'BAO_HIEM', name: 'Bảo hiểm', nature: 'deduction', formula: '0' },
  { code: 'PHAT', name: 'Phạt', nature: 'deduction', formula: null },
  { code: 'KHAU_TRU_KHAC', name: 'Khác', nature: 'deduction', formula: null },
];
