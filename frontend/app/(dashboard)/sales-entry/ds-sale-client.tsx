"use client";

import { useCan } from "@/lib/capability-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Plus, Rows3, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast-context";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { ApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { SortableTh, type SortState } from "@/components/ui/sortable-th";
import { ViewOnlyBadge } from "@/components/ui/view-only-badge";
import type {
  AccountRole,
  AppRealtimeEvent,
  DsKind,
  DsSaleAccountOption,
  DsSaleCompanyOption,
  DsSaleRow,
  DsSalePage,
  DsSaleRowInput,
  ModulePermissionLevel,
} from "@/lib/types";
import { buildDsSaleExportUrl, createDsSaleRow, deleteDsSaleRows, listDsSaleRows, updateDsSaleRow } from "@/lib/ds-sale-api";
import { DsSaleSearchSelect, type DsSaleSelectOption } from "./ds-sale-search-select";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, yêu cầu trực tiếp người
 * dùng): "DS Sale" — bảng nhập liệu kiểu Google Sheets/Excel, module con
 * của "Nhập doanh số". File này CHỈ phục vụ đúng phạm vi DS Sale — không
 * đụng tới bất kỳ module nào khác.
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SheetRow {
  /** Key React ổn định — bằng `id` thật khi đã lưu, hoặc "draft-xxx" khi còn là dòng nháp chưa lưu. */
  localId: string;
  id: string | null;
  employee_code: string;
  full_name: string;
  date_of_birth: string;
  identity_number: string;
  hometown: string;
  phone: string;
  join_date: string;
  company: DsSaleSelectOption | null;
  /** DS Sale: cột "Sale"; 3 tab còn lại: cột "Người tuyển". */
  sale: DsSaleSelectOption | null;
  pickup: DsSaleSelectOption | null;
  note: string;
  // Chỉ DS Media / DS Tuyển dụng / DS Đưa đón dùng (2026-11-12).
  work_status: string;
  check: DsSaleSelectOption | null;
  total_days: string;
  total_hours: string;
  // Chỉ tab Nhập thưởng dùng (2026-11-12).
  amount: string;
  bank_account_number: string;
  bank_account_name: string;
  bank_name: string;
  referrer_name: string;
  paid_date: string;
  status: SaveStatus;
}

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300] as const;

/** Yêu cầu trực tiếp người dùng (2026-07-18): "thêm chức năng thu phóng như trang Danh sách đưa đón" — khớp đúng ZOOM_LEVELS ở shuttle-client.tsx. */
const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200] as const;

// Mục 8, yêu cầu người dùng — kích thước cột gợi ý (px).
const CHECK_COL_WIDTH = 36;
type DsSaleSortKey = "stt" | "date_of_birth" | "join_date";

const STT_COL_WIDTH = 56;
const CODE_COL_WIDTH = 100;
const NAME_COL_WIDTH = 200;
const DOB_COL_WIDTH = 120;
const IDENTITY_COL_WIDTH = 160;
const HOMETOWN_COL_WIDTH = 260;
const PHONE_COL_WIDTH = 120;
const JOIN_COL_WIDTH = 120;
const COMPANY_COL_WIDTH = 170;
const SALE_COL_WIDTH = 160;
const PICKUP_COL_WIDTH = 160;
const NOTE_COL_WIDTH = 320;
// Cột riêng của DS Media / DS Tuyển dụng / DS Đưa đón.
const STATUS_COL_WIDTH = 140;
const CHECKER_COL_WIDTH = 160;
const STAFF_NOTE_COL_WIDTH = 220;
const DAYS_COL_WIDTH = 90;
const HOURS_COL_WIDTH = 90;
// Cột riêng của tab Nhập thưởng.
const AMOUNT_COL_WIDTH = 120;
const BANK_NUMBER_COL_WIDTH = 150;
const BANK_OWNER_COL_WIDTH = 200;
const BANK_NAME_COL_WIDTH = 140;
const REFERRER_COL_WIDTH = 170;
const BONUS_NOTE_COL_WIDTH = 300;
const PAID_COL_WIDTH = 120;

const CHECK_LEFT = 0;
const STT_LEFT = CHECK_COL_WIDTH;
const CODE_LEFT = STT_LEFT + STT_COL_WIDTH;
const NAME_LEFT = CODE_LEFT + CODE_COL_WIDTH;

const SHARED_COLS_WIDTH =
  CHECK_COL_WIDTH +
  STT_COL_WIDTH +
  CODE_COL_WIDTH +
  NAME_COL_WIDTH +
  DOB_COL_WIDTH +
  IDENTITY_COL_WIDTH +
  HOMETOWN_COL_WIDTH +
  JOIN_COL_WIDTH +
  COMPANY_COL_WIDTH +
  SALE_COL_WIDTH;

const SALE_TABLE_WIDTH = SHARED_COLS_WIDTH + PHONE_COL_WIDTH + PICKUP_COL_WIDTH + NOTE_COL_WIDTH;

const BONUS_TABLE_WIDTH =
  CHECK_COL_WIDTH +
  STT_COL_WIDTH +
  CODE_COL_WIDTH +
  NAME_COL_WIDTH +
  COMPANY_COL_WIDTH +
  JOIN_COL_WIDTH +
  AMOUNT_COL_WIDTH +
  BANK_NUMBER_COL_WIDTH +
  BANK_OWNER_COL_WIDTH +
  BANK_NAME_COL_WIDTH +
  REFERRER_COL_WIDTH +
  SALE_COL_WIDTH +
  BONUS_NOTE_COL_WIDTH +
  PAID_COL_WIDTH;

const STAFF_TABLE_WIDTH =
  SHARED_COLS_WIDTH + STATUS_COL_WIDTH + CHECKER_COL_WIDTH + STAFF_NOTE_COL_WIDTH + DAYS_COL_WIDTH + HOURS_COL_WIDTH;

const STICKY_EDGE_SHADOW = "shadow-[2px_0_6px_-2px_rgba(15,23,42,0.18)]";
const Z_BODY_STICKY = "z-10";
const Z_HEADER = "z-20";
const Z_HEADER_CORNER = "z-30";

/** Thứ tự cột có thể focus/điều hướng bằng Enter — khớp đúng thứ tự hiển thị trên bảng (Mục 2). */
type TextField =
  | "employee_code"
  | "full_name"
  | "date_of_birth"
  | "identity_number"
  | "hometown"
  | "phone"
  | "join_date"
  | "work_status"
  | "note"
  | "total_days"
  | "total_hours"
  | "amount"
  | "bank_account_number"
  | "bank_account_name"
  | "bank_name"
  | "referrer_name"
  | "paid_date";

const SALE_PASTE_COLUMNS: Array<TextField | null> = [
  "employee_code",
  "full_name",
  "date_of_birth",
  "identity_number",
  "hometown",
  "phone",
  "join_date",
];

/**
 * DS Media / DS Tuyển dụng / DS Đưa đón: đúng thứ tự cột file Excel mẫu của
 * user (2026-11-12) để dán nguyên dòng từ Excel vào. `null` = cột là ô chọn
 * (Công ty, Người tuyển, Check) — khi dán thì bỏ qua, chọn tay sau.
 */
const STAFF_PASTE_COLUMNS: Array<TextField | null> = [
  "employee_code",
  "full_name",
  "date_of_birth",
  "identity_number",
  "hometown",
  null,
  "join_date",
  "work_status",
  null,
  null,
  "note",
  "total_days",
  "total_hours",
];

/** Tab Nhập thưởng: đúng thứ tự cột file Excel mẫu của user (2026-11-12); `null` = ô chọn (Công ty, Sale). */
const BONUS_PASTE_COLUMNS: Array<TextField | null> = [
  "employee_code",
  "full_name",
  null,
  "join_date",
  "amount",
  "bank_account_number",
  "bank_account_name",
  "bank_name",
  "referrer_name",
  null,
  "note",
  "paid_date",
];

const DATE_FIELDS: ReadonlySet<TextField> = new Set<TextField>(["date_of_birth", "join_date", "paid_date"]);

/** "2.000.000 đ" / "500.000" → 2000000 / 500000 (chỉ lấy chữ số); trống → null. */
function parseAmount(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function formatAmount(value: number): string {
  return value.toLocaleString("vi-VN");
}

/** Excel dán ra ngày dạng 27/04/2021 — ô ngày của trình duyệt cần 2021-04-27. */
function normalizePastedDate(value: string): string {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (!match) return value;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/** "24,5" / "24.0" → 24.5 / 24; trống hoặc không phải số → null. Làm tròn 1 chữ số thập phân. */
function parseDecimal(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 10) / 10;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const KIND_LABELS: Record<DsKind, string> = {
  sale: "DS Sale",
  media: "DS Media",
  recruitment: "DS Tuyển dụng",
  shuttle: "DS Đưa đón",
  bonus: "danh sách thưởng",
};

function toOption(account: DsSaleAccountOption): DsSaleSelectOption {
  return {
    id: account.id,
    label: account.nickname ?? account.full_name,
    sublabel: account.team_name,
    avatarUrl: account.avatar_url,
  };
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-27): "Sale sẽ tự nhập doanh số cho
 * chính mình... không cần chọn sale ở cột này mà sẽ hiện luôn tên mình" —
 * dòng nháp mới của Sale luôn có sẵn `sale = defaultSale` (chính họ), các
 * vai trò khác vẫn để trống như trước (defaultSale = null).
 */
function makeDraftRow(defaultSale: DsSaleSelectOption | null = null): SheetRow {
  return {
    localId: `draft-${crypto.randomUUID()}`,
    id: null,
    employee_code: "",
    full_name: "",
    date_of_birth: "",
    identity_number: "",
    hometown: "",
    phone: "",
    join_date: "",
    company: null,
    sale: defaultSale,
    pickup: null,
    note: "",
    work_status: "",
    check: null,
    total_days: "",
    total_hours: "",
    amount: "",
    bank_account_number: "",
    bank_account_name: "",
    bank_name: "",
    referrer_name: "",
    paid_date: "",
    status: "idle",
  };
}

function toSheetRow(row: DsSaleRow): SheetRow {
  return {
    localId: row.id,
    id: row.id,
    employee_code: row.employee_code ?? "",
    full_name: row.full_name ?? "",
    date_of_birth: row.date_of_birth ?? "",
    identity_number: row.identity_number ?? "",
    hometown: row.hometown ?? "",
    phone: row.phone ?? "",
    join_date: row.join_date ?? "",
    company: row.company ? { id: row.company.id, label: row.company.name } : null,
    sale: row.sale ? toOption(row.sale) : null,
    pickup: row.pickup ? toOption(row.pickup) : null,
    note: row.note ?? "",
    work_status: row.work_status ?? "",
    check: row.check ? toOption(row.check) : null,
    total_days: row.total_days === null ? "" : String(row.total_days),
    total_hours: row.total_hours === null ? "" : String(row.total_hours),
    amount: row.amount === null ? "" : formatAmount(row.amount),
    bank_account_number: row.bank_account_number ?? "",
    bank_account_name: row.bank_account_name ?? "",
    bank_name: row.bank_name ?? "",
    referrer_name: row.referrer_name ?? "",
    paid_date: row.paid_date ?? "",
    status: "saved",
  };
}

/**
 * `ignoreSale=true` cho vai trò Sale (yêu cầu trực tiếp người dùng,
 * 2026-07-27) — dòng nháp của Sale luôn có sẵn `sale = chính họ` (xem
 * makeDraftRow), nên KHÔNG tính trường này khi xét "trống", nếu không dòng
 * nháp trống sẽ không bao giờ được coi là trống, tự lưu thành dòng rác dù
 * chưa gõ gì khác — khớp đúng logic isRowBlank() ở backend (sales-entry.service.ts).
 */
function isRowBlank(row: SheetRow, ignoreSale = false): boolean {
  return (
    !row.employee_code.trim() &&
    !row.full_name.trim() &&
    !row.date_of_birth &&
    !row.identity_number.trim() &&
    !row.hometown.trim() &&
    !row.phone.trim() &&
    !row.join_date &&
    !row.company &&
    (ignoreSale || !row.sale) &&
    !row.pickup &&
    !row.note.trim() &&
    !row.work_status.trim() &&
    !row.check &&
    parseDecimal(row.total_days) === null &&
    parseDecimal(row.total_hours) === null &&
    parseAmount(row.amount) === null &&
    !row.bank_account_number.trim() &&
    !row.bank_account_name.trim() &&
    !row.bank_name.trim() &&
    !row.referrer_name.trim() &&
    !row.paid_date
  );
}

function toInput(row: SheetRow, kind: DsKind, period: { year: number; month: number }): DsSaleRowInput {
  return {
    kind,
    period_year: period.year,
    period_month: period.month,
    work_status: row.work_status.trim(),
    check_user_id: row.check?.id ?? null,
    total_days: parseDecimal(row.total_days),
    total_hours: parseDecimal(row.total_hours),
    amount: parseAmount(row.amount),
    bank_account_number: row.bank_account_number.trim(),
    bank_account_name: row.bank_account_name.trim(),
    bank_name: row.bank_name.trim(),
    referrer_name: row.referrer_name.trim(),
    paid_date: row.paid_date || null,
    employee_code: row.employee_code.trim(),
    full_name: row.full_name.trim(),
    date_of_birth: row.date_of_birth || null,
    identity_number: row.identity_number.trim(),
    hometown: row.hometown.trim(),
    phone: row.phone.trim(),
    join_date: row.join_date || null,
    company_id: row.company?.id ?? null,
    sale_user_id: row.sale?.id ?? null,
    pickup_user_id: row.pickup?.id ?? null,
    note: row.note.trim(),
  };
}

const EMPTY_ACCOUNTS: DsSaleAccountOption[] = [];

export function DsSaleClient({
  permissionLevel,
  currentUserId,
  currentUserFullName,
  currentUserNickname,
  initialRows,
  initialSaleAccounts,
  initialPickupAccounts,
  initialCompanies,
  initialYear,
  initialMonth,
  initialCheckAccounts = EMPTY_ACCOUNTS,
  kind = "sale",
  extraTopOffset = 0,
}: {
  permissionLevel: ModulePermissionLevel;
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserFullName: string;
  currentUserNickname: string | null;
  initialRows: DsSalePage;
  initialSaleAccounts: DsSaleAccountOption[];
  initialPickupAccounts: DsSaleAccountOption[];
  initialCompanies: DsSaleCompanyOption[];
  /** Kỳ (tháng/năm) của `initialRows` — tháng hiện tại theo giờ Việt Nam. */
  initialYear: number;
  initialMonth: number;
  /** Người chọn được ở cột "Check" — chỉ DS Media / DS Tuyển dụng / DS Đưa đón. */
  initialCheckAccounts?: DsSaleAccountOption[];
  /** Tab nhỏ đang hiển thị (mặc định DS Sale). 3 tab còn lại dùng bộ cột theo file Excel mẫu. */
  kind?: DsKind;
  /** Chiều cao thanh tab "DS Sale" ở component cha (sales-entry-client.tsx) — cộng vào phần đo chiều cao khối cuộn bảng bên dưới. */
  extraTopOffset?: number;
}) {
  const toast = useToast();
  const isSale = kind === "sale";
  const isBonus = kind === "bonus";
  /** Tên cột chọn người: DS Sale và Nhập thưởng là "Sale", 3 tab còn lại là "Người tuyển". */
  const recruiterLabel = isSale || isBonus ? "Sale" : "Người tuyển";
  const kindLabel = KIND_LABELS[kind];
  // Dự án phụ — nâng cấp toàn diện (2026-07-24, "Phân quyền" phiên bản đơn
  // giản, Mục 2/6): "Chỉ xem" — khóa toàn bộ bảng bằng pointer-events (bảng
  // DS Sale nhập trực tiếp từng ô, quá nhiều field để disable riêng lẻ).
  const isReadOnly = permissionLevel === "view";
  // Yêu cầu trực tiếp người dùng (2026-07-27): "Sale sẽ tự nhập doanh số
  // cho chính mình... không cần chọn sale ở cột này mà sẽ hiện luôn tên
  // mình, chỉ có leader, quản lý, admin là được chọn sale như hiện tại".
  // Chỉ nhập doanh số của chính mình khi không có quyền cả nhóm/toàn công ty (mặc định Sale).
  const can = useCan();
  const isSaleRole = !can("sales.team") && !can("sales.all");
  const selfOption: DsSaleSelectOption = useMemo(
    () => ({ id: currentUserId, label: currentUserNickname ?? currentUserFullName }),
    [currentUserId, currentUserFullName, currentUserNickname],
  );

  // Nguồn dropdown tải sẵn từ SERVER (page.tsx, Mục 4/5/6) — không đổi trong
  // phiên xem trang này nên chỉ cần chuyển dạng 1 lần, không cần useState riêng.
  const saleAccounts = useMemo(() => initialSaleAccounts.map(toOption), [initialSaleAccounts]);
  const pickupAccounts = useMemo(() => initialPickupAccounts.map(toOption), [initialPickupAccounts]);
  const checkAccounts = useMemo(() => initialCheckAccounts.map(toOption), [initialCheckAccounts]);
  const companies = useMemo(
    () => initialCompanies.map((c) => ({ id: c.id, label: c.name })),
    [initialCompanies],
  );

  const [sheetRows, setSheetRows] = useState<SheetRow[]>(() => initialRows.items.map(toSheetRow));
  const rowsRef = useRef<SheetRow[]>([]);
  useEffect(() => {
    rowsRef.current = sheetRows;
  }, [sheetRows]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(initialRows.total);
  /** Tab Nhập thưởng: tổng số tiền theo bộ lọc đang xem (mọi trang). */
  const [totalAmount, setTotalAmount] = useState(initialRows.total_amount ?? 0);
  const [page, setPage] = useState(initialRows.page);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(100);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(100);

  const [keyword, setKeyword] = useState("");
  // Bộ lọc Tháng/Năm như Chấm công (yêu cầu người dùng 2026-11-12) — thay ô "Ngày vào từ/đến".
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => initialYear + 1 - i),
    [initialYear],
  );
  const [companyFilter, setCompanyFilter] = useState<DsSaleSelectOption | null>(null);
  const [saleFilter, setSaleFilter] = useState<DsSaleSelectOption | null>(null);
  const [pickupFilter, setPickupFilter] = useState<DsSaleSelectOption | null>(null);
  const [paidFilter, setPaidFilter] = useState<"" | "yes" | "no">("");
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: "",
    year: initialYear,
    month: initialMonth,
    company_id: "",
    sale_user_id: "",
    pickup_user_id: "",
    paid: "" as "" | "yes" | "no",
  });

  // Realtime (useCallback) cần đọc kỳ đang xem mới nhất.
  const periodRef = useRef({ year: initialYear, month: initialMonth });
  useEffect(() => {
    periodRef.current = { year: appliedFilters.year, month: appliedFilters.month };
  }, [appliedFilters.year, appliedFilters.month]);

  const [addCountModalOpen, setAddCountModalOpen] = useState(false);
  const [addCountDraft, setAddCountDraft] = useState(5);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement | null>>(new Map());
  const focusFieldOnMount = useRef<string | null>(null);

  // Bấm tiêu đề STT/Ngày sinh/Ngày vào (yêu cầu người dùng 2026-10-30). Ref
  // để loadPage (useCallback) đọc được ngay giá trị mới.
  const [sort, setSort] = useState<SortState<DsSaleSortKey>>({ key: "stt", order: "asc" });
  const sortRef = useRef(sort);
  function handleSort(next: SortState<DsSaleSortKey>) {
    sortRef.current = next;
    setSort(next);
    void loadPage(1, appliedFilters, pageSize);
  }

  const loadSeqRef = useRef(0);
  const loadPage = useCallback(
    async (targetPage: number, filters = appliedFilters, size = pageSize) => {
      // Bỏ kết quả của lượt tải cũ về muộn (tìm kiếm khi gõ gọi liên tục).
      const seq = ++loadSeqRef.current;
      setLoading(true);
      try {
        const result = await listDsSaleRows({
          kind,
          page: targetPage,
          page_size: size,
          keyword: filters.keyword || undefined,
          year: filters.year,
          month: filters.month,
          company_id: filters.company_id || undefined,
          sale_user_id: filters.sale_user_id || undefined,
          pickup_user_id: filters.pickup_user_id || undefined,
          paid: filters.paid || undefined,
          sort: sortRef.current.key,
          order: sortRef.current.order,
        });
        if (seq !== loadSeqRef.current) return;
        setSheetRows(result.items.map(toSheetRow));
        setTotal(result.total);
        setTotalAmount(result.total_amount ?? 0);
        setPage(result.page);
        setSelected(new Set());
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        toast.error(err instanceof ApiError ? err.message : `Không tải được danh sách ${kindLabel}`);
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedFilters/pageSize truyền tường minh qua tham số ở nơi gọi, không cần liệt kê lại
    [toast, kind, kindLabel],
  );

  // Mục 9: luôn giữ đúng 1 dòng nháp trống ở cuối bảng để nhập nhanh — không
  // tự lưu khi còn trống. "Điều chỉnh state khi render" (mẫu React khuyến
  // nghị thay useEffect, đã dùng ở shuttle-client.tsx) thay vì effect phụ
  // thuộc [sheetRows] — tránh 1 lượt render thừa + lỗi lint set-state-in-effect.
  const lastRow = sheetRows[sheetRows.length - 1];
  if (!lastRow || lastRow.id !== null || !isRowBlank(lastRow, isSaleRole)) {
    setSheetRows((prev) => [...prev, makeDraftRow(isSaleRole ? selfOption : null)]);
  }

  useEffect(() => {
    if (!focusFieldOnMount.current) return;
    const el = cellRefs.current.get(focusFieldOnMount.current);
    el?.focus();
    focusFieldOnMount.current = null;
  }, [sheetRows]);

  function updateField<K extends keyof SheetRow>(localId: string, key: K, value: SheetRow[K]) {
    setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, [key]: value } : r)));
    scheduleSave(localId);
  }

  /**
   * Dùng cho các ô cần lưu NGAY trong cùng 1 tay cầm sự kiện (vd onChange
   * của dropdown Công ty/Sale/Đưa đón) — KHÔNG được gọi updateField() rồi
   * flushSave(localId) riêng rẽ: flushSave đọc rowsRef.current, nhưng ref
   * đó chỉ đồng bộ lại trong 1 effect (chạy SAU khi render commit), nên nếu
   * gọi ngay trong cùng lượt xử lý sự kiện thì flushSave sẽ đọc phải dữ
   * liệu CŨ (chưa có giá trị vừa đổi) — đã xác nhận bằng test thực tế
   * (chọn Sale nhưng lưu lên server vẫn null). Hàm này tự tính dòng mới
   * (không qua ref) rồi lưu thẳng.
   */
  function updateFieldAndSave<K extends keyof SheetRow>(localId: string, key: K, value: SheetRow[K]) {
    const current = rowsRef.current.find((r) => r.localId === localId);
    const merged = current ? { ...current, [key]: value } : null;
    setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, [key]: value } : r)));
    const timers = saveTimers.current;
    const existing = timers.get(localId);
    if (existing) {
      clearTimeout(existing);
      timers.delete(localId);
    }
    if (merged) void saveRow(merged);
  }

  function scheduleSave(localId: string) {
    const timers = saveTimers.current;
    const existing = timers.get(localId);
    if (existing) clearTimeout(existing);
    timers.set(
      localId,
      setTimeout(() => {
        timers.delete(localId);
        const row = rowsRef.current.find((r) => r.localId === localId);
        if (row) void saveRow(row);
      }, 600),
    );
  }

  function flushSave(localId: string) {
    const timers = saveTimers.current;
    const existing = timers.get(localId);
    if (existing) {
      clearTimeout(existing);
      timers.delete(localId);
    }
    const row = rowsRef.current.find((r) => r.localId === localId);
    if (row) void saveRow(row);
  }

  /** Tab Nhập thưởng: tính lại dòng "Tổng tiền" sau khi lưu/xoá (hỏi server, theo đúng bộ lọc đang xem). */
  async function refreshTotalAmount() {
    try {
      const result = await listDsSaleRows({
        kind,
        page: 1,
        page_size: 1,
        keyword: appliedFilters.keyword || undefined,
        year: appliedFilters.year,
        month: appliedFilters.month,
        company_id: appliedFilters.company_id || undefined,
        sale_user_id: appliedFilters.sale_user_id || undefined,
        paid: appliedFilters.paid || undefined,
      });
      setTotalAmount(result.total_amount ?? 0);
    } catch {
      // Không tính lại được thì giữ số cũ — lần tải trang kế tiếp sẽ đúng lại.
    }
  }

  async function saveRow(row: SheetRow) {
    const localId = row.localId;

    if (isRowBlank(row, isSaleRole)) {
      setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "idle" } : r)));
      return;
    }

    setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "saving" } : r)));
    try {
      // Dòng mới thuộc kỳ (tháng/năm) đang xem.
      const input = toInput(row, kind, { year: appliedFilters.year, month: appliedFilters.month });
      const response = row.id ? await updateDsSaleRow(row.id, input) : await createDsSaleRow(input);
      const wasDraft = row.id === null;
      setSheetRows((prev) =>
        prev.map((r) => (r.localId === localId ? { ...toSheetRow(response), localId } : r)),
      );
      if (wasDraft) setTotal((t) => t + 1);
      if (isBonus) void refreshTotalAmount();
    } catch (err) {
      setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "error" } : r)));
      toast.error(err instanceof ApiError ? err.message : `Lưu ${kindLabel} thất bại`);
    }
  }

  // ── Realtime — Mục 16: vá đúng dòng/hợp nhất, không reload toàn trang. ──
  useAppRealtime(
    useCallback((event: AppRealtimeEvent) => {
      if (event.module !== "sales-entry") return;
      if (event.action === "deleted") {
        const existed = rowsRef.current.some((r) => r.id === event.entity_id);
        if (!existed) return;
        setSheetRows((prev) => prev.filter((r) => r.id !== event.entity_id));
        setTotal((t) => Math.max(0, t - 1));
        return;
      }
      const payload = event.payload as DsSaleRow | undefined;
      if (!payload) return;
      // Dòng của tab nhỏ khác (DS Sale/Media/Tuyển dụng/Đưa đón) — không thuộc bảng này.
      if (payload.kind !== kind) return;
      // Dòng của tháng khác với tháng đang xem.
      const viewing = periodRef.current;
      if (payload.period_year !== viewing.year || payload.period_month !== viewing.month) return;
      const existingLocal = rowsRef.current.find((r) => r.id === payload.id);
      if (existingLocal) {
        setSheetRows((prev) => prev.map((r) => (r.id === payload.id ? { ...toSheetRow(payload), localId: r.localId } : r)));
      } else if (event.action === "created") {
        // Bỏ qua echo "created" của CHÍNH mình — saveRow() đã tự cập nhật
        // dòng nháp cục bộ (id null -> id thật) bằng response của chính
        // request đó. Nếu vẫn xử lý ở đây (id null lúc này chưa kịp cập
        // nhật do độ trễ mạng), sẽ chèn thêm 1 dòng trùng lặp.
        if (event.actor?.id === currentUserId) return;
        setSheetRows((prev) => [toSheetRow(payload), ...prev]);
        setTotal((t) => t + 1);
      }
    }, [currentUserId, kind]),
  );

  useRealtimeReconnect(
    useCallback(() => {
      void loadPage(page, appliedFilters, pageSize);
    }, [loadPage, page, appliedFilters, pageSize]),
  );

  /**
   * Gõ đến đâu lọc đến đó (yêu cầu người dùng 2026-10-29): chờ ngừng gõ
   * 350ms rồi lọc; xoá hết chữ = về toàn bộ data.
   */
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleKeywordChange(value: string) {
    setKeyword(value);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    keywordTimerRef.current = setTimeout(() => {
      const next = { ...appliedFilters, keyword: value };
      setAppliedFilters(next);
      void loadPage(1, next, pageSize);
    }, 350);
  }

  /**
   * Áp dụng bộ lọc. Đổi 1 ô chọn là gọi luôn với giá trị mới (overrides) —
   * lọc ngay, không cần bấm Tìm kiếm (yêu cầu người dùng 2026-10-30).
   */
  function applyFilters(overrides: Partial<typeof appliedFilters> = {}) {
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    const next = {
      keyword,
      year: appliedFilters.year,
      month: appliedFilters.month,
      company_id: companyFilter?.id ?? "",
      sale_user_id: saleFilter?.id ?? "",
      pickup_user_id: pickupFilter?.id ?? "",
      paid: paidFilter,
      ...overrides,
    };
    setAppliedFilters(next);
    void loadPage(1, next, pageSize);
  }

  function clearFilters() {
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    setKeyword("");
    setCompanyFilter(null);
    setSaleFilter(null);
    setPickupFilter(null);
    setPaidFilter("");
    const next = {
      keyword: "",
      // "Xóa lọc" không đổi kỳ đang xem.
      year: appliedFilters.year,
      month: appliedFilters.month,
      company_id: "",
      sale_user_id: "",
      pickup_user_id: "",
      paid: "" as const,
    };
    setAppliedFilters(next);
    void loadPage(1, next, pageSize);
  }

  function changePageSize(size: (typeof PAGE_SIZE_OPTIONS)[number]) {
    setPageSize(size);
    void loadPage(1, appliedFilters, size);
  }

  function addRow() {
    const row = makeDraftRow(isSaleRole ? selfOption : null);
    focusFieldOnMount.current = `${row.localId}:full_name`;
    setSheetRows((prev) => [...prev.slice(0, -1), row, prev[prev.length - 1]]);
  }

  function addMultipleRows(count: number) {
    const clamped = Math.min(Math.max(count, 1), 100);
    const rows = Array.from({ length: clamped }, () => makeDraftRow(isSaleRole ? selfOption : null));
    setSheetRows((prev) => [...prev.slice(0, -1), ...rows, prev[prev.length - 1]]);
    setAddCountModalOpen(false);
  }

  function toggleSelect(localId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  }

  const selectableRows = sheetRows.filter((r) => r.id !== null || !isRowBlank(r, isSaleRole));
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.localId));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableRows.map((r) => r.localId)));
    }
  }

  async function confirmDelete() {
    const ids = sheetRows.filter((r) => selected.has(r.localId));
    const draftIds = ids.filter((r) => r.id === null).map((r) => r.localId);
    const persistedIds = ids.filter((r) => r.id !== null).map((r) => r.id as string);

    setDeleting(true);
    try {
      if (persistedIds.length > 0) {
        await deleteDsSaleRows(persistedIds);
        setTotal((t) => Math.max(0, t - persistedIds.length));
      }
      setSheetRows((prev) => prev.filter((r) => !draftIds.includes(r.localId) && !persistedIds.includes(r.id ?? "")));
      setSelected(new Set());
      if (isBonus) void refreshTotalAmount();
      toast.success(`Đã xóa ${ids.length} dòng`);
      setDeleteConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Xóa thất bại");
    } finally {
      setDeleting(false);
    }
  }

  function focusNextRow(rowIndex: number, field: TextField) {
    const target = cellRefs.current.get(`${rowIndex + 1}:${field}`);
    target?.focus();
  }

  function handlePaste(rowIndex: number, field: TextField, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // 1 ô — để trình duyệt tự dán như bình thường
    e.preventDefault();

    const grid = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ""))
      .map((line) => line.split("\t"));

    const columns = isBonus ? BONUS_PASTE_COLUMNS : isSale ? SALE_PASTE_COLUMNS : STAFF_PASTE_COLUMNS;
    const startCol = columns.indexOf(field);
    const touchedLocalIds: string[] = [];

    setSheetRows((prev) => {
      const next = [...prev];
      grid.forEach((lineCells, r) => {
        const targetIndex = rowIndex + r;
        while (targetIndex >= next.length - 1) {
          next.splice(next.length - 1, 0, makeDraftRow(isSaleRole ? selfOption : null));
        }
        let updatedRow = next[targetIndex];
        lineCells.forEach((cellValue, c) => {
          const colIndex = startCol + c;
          const targetField = columns[colIndex];
          if (!targetField) return; // hết cột, hoặc cột là ô chọn
          const text = cellValue.trim();
          updatedRow = { ...updatedRow, [targetField]: DATE_FIELDS.has(targetField) ? normalizePastedDate(text) : text };
        });
        next[targetIndex] = updatedRow;
        touchedLocalIds.push(updatedRow.localId);
      });
      return next;
    });

    touchedLocalIds.forEach((localId) => scheduleSave(localId));
  }

  const headCellClass = cn(
    "sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white",
    Z_HEADER,
  );

  const keywordHint = isBonus
    ? "Tìm ID, tên, STK, người giới thiệu..."
    : isSale
      ? "Tìm mã NV, họ tên, CCCD, SĐT..."
      : "Tìm mã NV, họ tên, CMT, quê quán...";
  /** Có bộ lọc nào ngoài Tháng/Năm đang bật — mới hiện nút "Xóa lọc". */
  const hasActiveFilter = Boolean(
    keyword || companyFilter || saleFilter || pickupFilter || paidFilter,
  );

  const sttBase = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-17): "Ghim cố định thanh tiêu đề
   * ... không cho di chuyển khi cuộn". `position: sticky` trên <th> chỉ dính
   * được nếu khối bọc bảng có chiều cao BỊ GIỚI HẠN thật (overflow-x-auto
   * không tự khiến sticky hoạt động — hễ overflow-x khác "visible" thì
   * overflow-y cũng tự động thành "auto", nhưng nếu khối đó không có chiều
   * cao cố định thì nó không bao giờ thực sự cuộn, khiến sticky bị "khóa"
   * vào khối đó thay vì dính theo cuộn trang — lỗi thực tế đã gặp và ghi
   * chú lại ở attendance-client.tsx/shuttle-client.tsx). Đo header hệ thống
   * (layout.tsx) + thanh bộ lọc của trang này bằng ResizeObserver, cộng
   * `extraTopOffset` (chiều cao thanh tab ở component cha) — khớp đúng kỹ
   * thuật đã dùng ở 2 file trên.
   */
  const filterBarRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(56);
  const [filterHeight, setFilterHeight] = useState(50);
  const [footerHeight, setFooterHeight] = useState(32);

  useEffect(() => {
    const headerEl = document.querySelector("header");
    const filterEl = filterBarRef.current;
    const footerEl = footerRef.current;
    if (!headerEl || !filterEl || !footerEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.getBoundingClientRect().height;
        if (entry.target === headerEl) setHeaderHeight(height);
        else if (entry.target === filterEl) setFilterHeight(height);
        else if (entry.target === footerEl) setFooterHeight(height);
      }
    });
    observer.observe(headerEl);
    observer.observe(filterEl);
    observer.observe(footerEl);
    return () => observer.disconnect();
  }, []);

  /** Margin/border tự viết trong module này (space-y-2 x2, border khối bảng) — hằng số nhỏ ổn định, không phụ thuộc hệ thống. */
  const FIXED_SPACING = 8 + 8 + 2;
  const tableBoxHeight = `calc(100vh - ${headerHeight + extraTopOffset + filterHeight + footerHeight + FIXED_SPACING}px)`;

  const exportParams = useMemo(
    () => ({
      kind,
      keyword: appliedFilters.keyword || undefined,
      year: appliedFilters.year,
      month: appliedFilters.month,
      company_id: appliedFilters.company_id || undefined,
      sale_user_id: appliedFilters.sale_user_id || undefined,
      pickup_user_id: appliedFilters.pickup_user_id || undefined,
      paid: appliedFilters.paid || undefined,
    }),
    [appliedFilters, kind],
  );

  return (
    <div className="space-y-2">
      {isReadOnly && <ViewOnlyBadge />}
      {/* Thanh lọc một hàng mỏng (yêu cầu người dùng 2026-11-12): tên bộ lọc nằm ngay trong ô,
          lọc ngay khi đổi (không cần nút "Tìm kiếm"); bên trái là lọc, bên phải là thao tác. */}
      <div
        ref={filterBarRef}
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
      >
        <Field label="Tháng" title="Tháng" hideLabel uiSize="xs" className="w-[5.5rem]">
          <Select
            uiSize="xs"
            value={appliedFilters.month}
            onChange={(e) => applyFilters({ month: Number(e.target.value) })}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Năm" title="Năm" hideLabel uiSize="xs" className="w-[4.5rem]">
          <Select
            uiSize="xs"
            value={appliedFilters.year}
            onChange={(e) => applyFilters({ year: Number(e.target.value) })}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Từ khóa" title={keywordHint} hideLabel uiSize="xs" className="w-52">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              strokeWidth={2}
            />
            <Input
              uiSize="xs"
              className="pl-7"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder={keywordHint}
            />
          </div>
        </Field>
        <Field label={isSale ? "Công ty làm" : "Công ty"} title="Lọc theo công ty" hideLabel uiSize="xs" className="w-36">
          <DsSaleSearchSelect
            options={companies}
            value={companyFilter}
            onChange={(option) => {
              setCompanyFilter(option);
              applyFilters({ company_id: option?.id ?? "" });
            }}
            placeholder="Công ty: tất cả"
            emptyLabel="Chưa có dữ liệu công ty hợp tác"
          />
        </Field>
        {/* Sale luôn chỉ xem được dòng của chính mình (ép ở backend) — lọc theo Sale vô nghĩa nên ẩn hẳn ô này. */}
        {!isSaleRole && (
          <Field label={recruiterLabel} title={`Lọc theo ${recruiterLabel}`} hideLabel uiSize="xs" className="w-36">
            <DsSaleSearchSelect
              options={saleAccounts}
              value={saleFilter}
              onChange={(option) => {
                setSaleFilter(option);
                applyFilters({ sale_user_id: option?.id ?? "" });
              }}
              placeholder={`${recruiterLabel}: tất cả`}
              emptyLabel={isSale ? "Chưa có tài khoản Sale" : "Chưa có tài khoản"}
            />
          </Field>
        )}
        {isSale && (
          <Field label="Đưa đón" title="Lọc theo NV đưa đón" hideLabel uiSize="xs" className="w-36">
            <DsSaleSearchSelect
              options={pickupAccounts}
              value={pickupFilter}
              onChange={(option) => {
                setPickupFilter(option);
                applyFilters({ pickup_user_id: option?.id ?? "" });
              }}
              placeholder="Đưa đón: tất cả"
              emptyLabel="Chưa có tài khoản Đưa đón"
            />
          </Field>
        )}
        {isBonus && (
          <Field label="Tình trạng chi" title="Tình trạng chi" hideLabel uiSize="xs" className="w-28">
            <Select
              uiSize="xs"
              value={paidFilter}
              onChange={(e) => {
                const value = e.target.value as "" | "yes" | "no";
                setPaidFilter(value);
                applyFilters({ paid: value });
              }}
            >
              <option value="">Chi: tất cả</option>
              <option value="no">Chưa chi</option>
              <option value="yes">Đã chi</option>
            </Select>
          </Field>
        )}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Xóa lọc
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Field label="Thu phóng" title="Thu phóng bảng" hideLabel uiSize="xs" className="w-[4.25rem]">
            <Select
              uiSize="xs"
              value={String(zoomLevel)}
              onChange={(e) => setZoomLevel(Number(e.target.value) as (typeof ZOOM_LEVELS)[number])}
            >
              {ZOOM_LEVELS.map((zoom) => (
                <option key={zoom} value={zoom}>
                  {zoom}%
                </option>
              ))}
            </Select>
          </Field>
          <span className="h-4 w-px bg-slate-200" aria-hidden />
          <Button type="button" size="xs" variant="secondary" disabled={isReadOnly} onClick={addRow}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Thêm dòng
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={isReadOnly}
            onClick={() => setAddCountModalOpen(true)}
            title="Thêm nhiều dòng trống cùng lúc"
          >
            <Rows3 className="h-3.5 w-3.5" strokeWidth={2} />
            Thêm nhiều
          </Button>
          {selected.size > 0 && (
            <Button
              type="button"
              size="xs"
              variant="danger"
              disabled={isReadOnly}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Xóa ({selected.size})
            </Button>
          )}
          <a
            href={buildDsSaleExportUrl(exportParams)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#217346] px-2 py-1 text-xs font-medium text-white shadow-sm shadow-[#217346]/25 transition-colors hover:bg-[#1a5c38]"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Excel
          </a>
        </div>
      </div>

      {/* Mục 7 — bảng kiểu sheet, tận dụng tối đa chiều rộng, cuộn ngang nếu cần. */}
      <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ height: tableBoxHeight }}>
        {/* "zoom" (không phải transform: scale) — khớp đúng kỹ thuật đã dùng ở
            shuttle-client.tsx: zoom tính lại layout thật theo tỉ lệ mới nên
            cột sticky (STT/Mã NV/Họ tên) vẫn dính đúng vị trí, không để lại
            khoảng trắng thừa như scale. Chỉ zoom <table>, không zoom khối
            cuộn ngoài để tableBoxHeight (tính từ px thật) không bị lệch. */}
        <div style={{ zoom: zoomLevel / 100 }}>
        <table
          className="table-fixed border-separate border-spacing-0 text-xs"
          style={{ width: isBonus ? BONUS_TABLE_WIDTH : isSale ? SALE_TABLE_WIDTH : STAFF_TABLE_WIDTH }}
        >
          <colgroup>
            <col style={{ width: CHECK_COL_WIDTH }} />
            <col style={{ width: STT_COL_WIDTH }} />
            <col style={{ width: CODE_COL_WIDTH }} />
            <col style={{ width: NAME_COL_WIDTH }} />
            {!isBonus && (
              <>
                <col style={{ width: DOB_COL_WIDTH }} />
                <col style={{ width: IDENTITY_COL_WIDTH }} />
                <col style={{ width: HOMETOWN_COL_WIDTH }} />
              </>
            )}
            {isBonus ? (
              <>
                <col style={{ width: COMPANY_COL_WIDTH }} />
                <col style={{ width: JOIN_COL_WIDTH }} />
                <col style={{ width: AMOUNT_COL_WIDTH }} />
                <col style={{ width: BANK_NUMBER_COL_WIDTH }} />
                <col style={{ width: BANK_OWNER_COL_WIDTH }} />
                <col style={{ width: BANK_NAME_COL_WIDTH }} />
                <col style={{ width: REFERRER_COL_WIDTH }} />
                <col style={{ width: SALE_COL_WIDTH }} />
                <col style={{ width: BONUS_NOTE_COL_WIDTH }} />
                <col style={{ width: PAID_COL_WIDTH }} />
              </>
            ) : isSale ? (
              <>
                <col style={{ width: PHONE_COL_WIDTH }} />
                <col style={{ width: JOIN_COL_WIDTH }} />
                <col style={{ width: COMPANY_COL_WIDTH }} />
                <col style={{ width: SALE_COL_WIDTH }} />
                <col style={{ width: PICKUP_COL_WIDTH }} />
                <col style={{ width: NOTE_COL_WIDTH }} />
              </>
            ) : (
              <>
                <col style={{ width: COMPANY_COL_WIDTH }} />
                <col style={{ width: JOIN_COL_WIDTH }} />
                <col style={{ width: STATUS_COL_WIDTH }} />
                <col style={{ width: SALE_COL_WIDTH }} />
                <col style={{ width: CHECKER_COL_WIDTH }} />
                <col style={{ width: STAFF_NOTE_COL_WIDTH }} />
                <col style={{ width: DAYS_COL_WIDTH }} />
                <col style={{ width: HOURS_COL_WIDTH }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <th
                className={cn(
                  "sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-1 py-2 text-center text-white",
                  Z_HEADER_CORNER,
                )}
                style={{ position: "sticky", left: CHECK_LEFT }}
              >
                <Checkbox checked={allSelected} onChange={toggleSelectAll} className="border-white/40" />
              </th>
              <SortableTh
                sortKey="stt"
                sort={sort}
                onSort={handleSort}
                className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER_CORNER)}
                style={{ position: "sticky", left: STT_LEFT }}
              >
                STT
              </SortableTh>
              <th
                className={cn(
                  "sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white",
                  STICKY_EDGE_SHADOW,
                  Z_HEADER_CORNER,
                )}
                style={{ position: "sticky", left: CODE_LEFT }}
              >
                {isBonus ? "ID" : "Mã NV"}
              </th>
              <th
                className={cn(
                  "sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white",
                  STICKY_EDGE_SHADOW,
                  Z_HEADER_CORNER,
                )}
                style={{ position: "sticky", left: NAME_LEFT }}
              >
                {isBonus ? "Tên" : "Họ tên"}
              </th>
              {!isBonus && (
                <>
              <SortableTh
                sortKey="date_of_birth"
                sort={sort}
                onSort={handleSort}
                className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}
              >
                Ngày sinh
              </SortableTh>
              <th className={headCellClass}>{isSale ? "Số CMT/CCCD" : "Số CMT"}</th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Quê quán
              </th>
                </>
              )}
              {isBonus ? (
                <>
                  <th className={headCellClass}>Công ty</th>
                  <SortableTh sortKey="join_date" sort={sort} onSort={handleSort} className={headCellClass}>
                    Ngày vào
                  </SortableTh>
                  <th className={headCellClass}>Số tiền</th>
                  <th className={headCellClass}>STK</th>
                  <th className={headCellClass}>Tên TK</th>
                  <th className={headCellClass}>Ngân hàng</th>
                  <th className={headCellClass}>Người giới thiệu</th>
                  <th className={headCellClass}>Sale</th>
                  <th className={headCellClass}>Ghi chú</th>
                  <th className={headCellClass}>Ngày chi</th>
                </>
              ) : isSale ? (
                <>
                  <th className={headCellClass}>SĐT</th>
                  <SortableTh sortKey="join_date" sort={sort} onSort={handleSort} className={headCellClass}>
                    Ngày vào
                  </SortableTh>
                  <th className={headCellClass}>Công ty làm</th>
                  <th className={headCellClass}>Sale</th>
                  <th className={headCellClass}>Đưa đón</th>
                  <th className={headCellClass}>Ghi chú</th>
                </>
              ) : (
                <>
                  <th className={headCellClass}>Công ty</th>
                  <SortableTh sortKey="join_date" sort={sort} onSort={handleSort} className={headCellClass}>
                    Ngày vào
                  </SortableTh>
                  <th className={headCellClass}>Tình trạng</th>
                  <th className={headCellClass}>Người tuyển</th>
                  <th className={headCellClass}>Check</th>
                  <th className={headCellClass}>Ghi chú</th>
                  <th className={headCellClass}>Tổng công</th>
                  <th className={headCellClass}>Tổng giờ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className={cn(isReadOnly && "pointer-events-none opacity-60")}>
            {sheetRows.map((row, rowIndex) => {
              const isBlankDraft = row.id === null && isRowBlank(row, isSaleRole);
              const zebra = rowIndex % 2 === 1 ? "bg-slate-50" : "bg-white";
              // Các ô dùng chung cho cả 2 bộ cột (DS Sale / 3 tab còn lại) — chỉ khác thứ tự.
              const joinCell = (
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <CellInput
                      type="date"
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:join_date`, el)}
                      value={row.join_date}
                      onChange={(v) => updateField(row.localId, "join_date", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "join_date")}
                    />
                  </td>
              );
              const companyCell = (
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <DsSaleSearchSelect
                      options={companies}
                      value={row.company}
                      onChange={(v) => updateFieldAndSave(row.localId, "company", v)}
                      placeholder="Chọn công ty"
                      emptyLabel="Chưa có dữ liệu công ty hợp tác"
                    />
                  </td>
              );
              const recruiterCell = (
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    {isSaleRole ? (
                      // Yêu cầu trực tiếp người dùng (2026-07-27): Sale tự
                      // nhập doanh số cho chính mình — luôn hiện tên mình,
                      // không mở được ô chọn (đã ép ở backend, đây chỉ là
                      // phản ánh đúng UX, không phải lớp bảo mật).
                      <div className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        <span className="min-w-0 truncate text-center">{selfOption.label}</span>
                      </div>
                    ) : (
                      <DsSaleSearchSelect
                        options={saleAccounts}
                        value={row.sale}
                        onChange={(v) => updateFieldAndSave(row.localId, "sale", v)}
                        placeholder={recruiterLabel === "Sale" ? "Chọn Sale" : "Chọn người tuyển"}
                        emptyLabel={isSale ? "Chưa có tài khoản Sale" : "Chưa có tài khoản"}
                      />
                    )}
                  </td>
              );
              const noteCell = (
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <textarea
                      value={row.note}
                      onChange={(e) => updateField(row.localId, "note", e.target.value)}
                      onBlur={() => flushSave(row.localId)}
                      rows={1}
                      className="w-full resize-none rounded border border-transparent bg-transparent px-1.5 py-1 text-center text-xs text-slate-700 outline-none focus:border-brand-300 focus:bg-white"
                      placeholder="Ghi chú..."
                    />
                  </td>
              );
              return (
                <tr key={row.localId} className={cn(zebra, "group")}>
                  <td
                    className={cn("border-r border-b border-slate-100 px-1 py-1 text-center", zebra, Z_BODY_STICKY)}
                    style={{ position: "sticky", left: CHECK_LEFT }}
                  >
                    {!isBlankDraft && (
                      <Checkbox checked={selected.has(row.localId)} onChange={() => toggleSelect(row.localId)} />
                    )}
                  </td>
                  <td
                    className={cn("border-r border-b border-slate-100 px-2 py-1 text-slate-500", zebra, Z_BODY_STICKY)}
                    style={{ position: "sticky", left: STT_LEFT }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>
                        {isBlankDraft
                          ? ""
                          : sort.key === "stt" && sort.order === "desc"
                            ? total - (sttBase + rowIndex)
                            : sttBase + rowIndex + 1}
                      </span>
                      <SaveStatusDot status={row.status} />
                    </div>
                  </td>
                  <td
                    className={cn("border-r border-b border-slate-100 p-0.5", zebra, STICKY_EDGE_SHADOW, Z_BODY_STICKY)}
                    style={{ position: "sticky", left: CODE_LEFT }}
                  >
                    <CellInput
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:employee_code`, el)}
                      value={row.employee_code}
                      onChange={(v) => updateField(row.localId, "employee_code", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "employee_code")}
                      onPaste={(e) => handlePaste(rowIndex, "employee_code", e)}
                    />
                  </td>
                  <td
                    className={cn("border-r border-b border-slate-100 p-0.5", zebra, STICKY_EDGE_SHADOW, Z_BODY_STICKY)}
                    style={{ position: "sticky", left: NAME_LEFT }}
                  >
                    <CellInput
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:full_name`, el)}
                      value={row.full_name}
                      onChange={(v) => updateField(row.localId, "full_name", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "full_name")}
                      onPaste={(e) => handlePaste(rowIndex, "full_name", e)}
                    />
                  </td>
                  {!isBonus && (
                    <>
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <CellInput
                      type="date"
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:date_of_birth`, el)}
                      value={row.date_of_birth}
                      onChange={(v) => updateField(row.localId, "date_of_birth", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "date_of_birth")}
                    />
                  </td>
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <CellInput
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:identity_number`, el)}
                      value={row.identity_number}
                      onChange={(v) => updateField(row.localId, "identity_number", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "identity_number")}
                      onPaste={(e) => handlePaste(rowIndex, "identity_number", e)}
                    />
                  </td>
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <CellInput
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:hometown`, el)}
                      value={row.hometown}
                      onChange={(v) => updateField(row.localId, "hometown", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "hometown")}
                      onPaste={(e) => handlePaste(rowIndex, "hometown", e)}
                    />
                  </td>
                    </>
                  )}
                  {isBonus ? (
                    <>
                      {companyCell}
                      {joinCell}
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:amount`, el)}
                          value={row.amount}
                          onChange={(v) => updateField(row.localId, "amount", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "amount")}
                          onPaste={(e) => handlePaste(rowIndex, "amount", e)}
                        />
                      </td>
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:bank_account_number`, el)}
                          value={row.bank_account_number}
                          onChange={(v) => updateField(row.localId, "bank_account_number", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "bank_account_number")}
                          onPaste={(e) => handlePaste(rowIndex, "bank_account_number", e)}
                        />
                      </td>
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:bank_account_name`, el)}
                          value={row.bank_account_name}
                          onChange={(v) => updateField(row.localId, "bank_account_name", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "bank_account_name")}
                          onPaste={(e) => handlePaste(rowIndex, "bank_account_name", e)}
                        />
                      </td>
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:bank_name`, el)}
                          value={row.bank_name}
                          onChange={(v) => updateField(row.localId, "bank_name", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "bank_name")}
                          onPaste={(e) => handlePaste(rowIndex, "bank_name", e)}
                        />
                      </td>
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:referrer_name`, el)}
                          value={row.referrer_name}
                          onChange={(v) => updateField(row.localId, "referrer_name", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "referrer_name")}
                          onPaste={(e) => handlePaste(rowIndex, "referrer_name", e)}
                        />
                      </td>
                      {recruiterCell}
                      {noteCell}
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          type="date"
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:paid_date`, el)}
                          value={row.paid_date}
                          onChange={(v) => updateField(row.localId, "paid_date", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "paid_date")}
                        />
                      </td>
                    </>
                  ) : isSale ? (
                    <>
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <CellInput
                      innerRef={(el) => cellRefs.current.set(`${rowIndex}:phone`, el)}
                      value={row.phone}
                      onChange={(v) => updateField(row.localId, "phone", v)}
                      onBlur={() => flushSave(row.localId)}
                      onEnter={() => focusNextRow(rowIndex, "phone")}
                      onPaste={(e) => handlePaste(rowIndex, "phone", e)}
                    />
                  </td>
                      {joinCell}
                      {companyCell}
                      {recruiterCell}
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <DsSaleSearchSelect
                      options={pickupAccounts}
                      value={row.pickup}
                      onChange={(v) => updateFieldAndSave(row.localId, "pickup", v)}
                      placeholder="Chọn NV đưa đón"
                      emptyLabel="Chưa có tài khoản Đưa đón"
                    />
                  </td>
                      {noteCell}
                    </>
                  ) : (
                    <>
                      {companyCell}
                      {joinCell}
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:work_status`, el)}
                          value={row.work_status}
                          onChange={(v) => updateField(row.localId, "work_status", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "work_status")}
                          onPaste={(e) => handlePaste(rowIndex, "work_status", e)}
                        />
                      </td>
                      {recruiterCell}
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <DsSaleSearchSelect
                          options={checkAccounts}
                          value={row.check}
                          onChange={(v) => updateFieldAndSave(row.localId, "check", v)}
                          placeholder="Chọn người check"
                          emptyLabel="Chưa có tài khoản"
                        />
                      </td>
                      {noteCell}
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:total_days`, el)}
                          value={row.total_days}
                          onChange={(v) => updateField(row.localId, "total_days", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "total_days")}
                          onPaste={(e) => handlePaste(rowIndex, "total_days", e)}
                        />
                      </td>
                      <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                        <CellInput
                          innerRef={(el) => cellRefs.current.set(`${rowIndex}:total_hours`, el)}
                          value={row.total_hours}
                          onChange={(v) => updateField(row.localId, "total_hours", v)}
                          onBlur={() => flushSave(row.localId)}
                          onEnter={() => focusNextRow(rowIndex, "total_hours")}
                          onPaste={(e) => handlePaste(rowIndex, "total_hours", e)}
                        />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mục 11 — phân trang server-side, giữ nguyên bộ lọc khi chuyển trang. */}
      <div ref={footerRef} className="flex flex-wrap items-center gap-3 px-1 py-1 text-xs text-slate-500">
        <span>Tổng {total} bản ghi</span>
        {isBonus && (
          <span className="font-semibold text-slate-700">Tổng tiền: {formatAmount(totalAmount)} đ</span>
        )}
        <label className="flex items-center gap-1.5">
          Dòng/trang
          <Select uiSize="xs" value={pageSize} onChange={(e) => changePageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" size="xs" variant="outline" disabled={page <= 1 || loading} onClick={() => void loadPage(page - 1)}>
            Trước
          </Button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => void loadPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      {addCountModalOpen && (
        <Modal
          title="Thêm nhiều dòng"
          description="Nhập số dòng trống muốn thêm vào cuối bảng."
          footer={
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddCountModalOpen(false)}>
                Hủy
              </Button>
              <Button type="button" size="sm" onClick={() => addMultipleRows(addCountDraft)}>
                Thêm {addCountDraft} dòng
              </Button>
            </>
          }
        >
          <Field label="Số dòng" uiSize="sm">
            <Input
              type="number"
              min={1}
              max={100}
              uiSize="sm"
              value={addCountDraft}
              onChange={(e) => setAddCountDraft(Number(e.target.value))}
            />
          </Field>
        </Modal>
      )}

      {deleteConfirmOpen && (
        <Modal
          title="Xóa dòng đã chọn"
          description={`Bạn có chắc muốn xóa ${selected.size} dòng đã chọn? Hành động này không thể hoàn tác.`}
          footer={
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                Hủy
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Đang xóa..." : "Xóa"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-500">Xóa {selected.size} dòng khỏi {kindLabel}.</p>
        </Modal>
      )}
    </div>
  );
}

function SaveStatusDot({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") return <Loader2 className="h-3 w-3 animate-spin text-slate-400" strokeWidth={2.5} aria-label="Đang lưu" />;
  if (status === "saved")
    return <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" role="img" aria-label="Đã lưu" title="Đã lưu" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-red-500" role="img" aria-label="Lỗi lưu" title="Lỗi lưu" />;
}

function CellInput({
  value,
  onChange,
  onBlur,
  onEnter,
  onPaste,
  type = "text",
  innerRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onEnter: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  type?: "text" | "date";
  innerRef?: (el: HTMLInputElement | null) => void;
}) {
  return (
    <input
      ref={innerRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onPaste={onPaste}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onBlur();
          onEnter();
        }
      }}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-center text-xs text-slate-700 outline-none focus:border-brand-300 focus:bg-white"
    />
  );
}
