"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Plus, Rows3, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast-context";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { ApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type {
  AppRealtimeEvent,
  DsSaleAccountOption,
  DsSaleCompanyOption,
  DsSaleRow,
  DsSaleRowInput,
  PaginatedResult,
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
  join_date: string;
  company: DsSaleSelectOption | null;
  sale: DsSaleSelectOption | null;
  pickup: DsSaleSelectOption | null;
  note: string;
  status: SaveStatus;
}

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

/** Yêu cầu trực tiếp người dùng (2026-07-18): "thêm chức năng thu phóng như trang Danh sách đưa đón" — khớp đúng ZOOM_LEVELS ở shuttle-client.tsx. */
const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200] as const;

// Mục 8, yêu cầu người dùng — kích thước cột gợi ý (px).
const CHECK_COL_WIDTH = 36;
const STT_COL_WIDTH = 56;
const CODE_COL_WIDTH = 100;
const NAME_COL_WIDTH = 200;
const DOB_COL_WIDTH = 120;
const IDENTITY_COL_WIDTH = 160;
const HOMETOWN_COL_WIDTH = 260;
const JOIN_COL_WIDTH = 120;
const COMPANY_COL_WIDTH = 170;
const SALE_COL_WIDTH = 160;
const PICKUP_COL_WIDTH = 160;
const NOTE_COL_WIDTH = 320;

const CHECK_LEFT = 0;
const STT_LEFT = CHECK_COL_WIDTH;
const CODE_LEFT = STT_LEFT + STT_COL_WIDTH;
const NAME_LEFT = CODE_LEFT + CODE_COL_WIDTH;

const TABLE_TOTAL_WIDTH =
  CHECK_COL_WIDTH +
  STT_COL_WIDTH +
  CODE_COL_WIDTH +
  NAME_COL_WIDTH +
  DOB_COL_WIDTH +
  IDENTITY_COL_WIDTH +
  HOMETOWN_COL_WIDTH +
  JOIN_COL_WIDTH +
  COMPANY_COL_WIDTH +
  SALE_COL_WIDTH +
  PICKUP_COL_WIDTH +
  NOTE_COL_WIDTH;

const STICKY_EDGE_SHADOW = "shadow-[2px_0_6px_-2px_rgba(15,23,42,0.18)]";
const Z_BODY_STICKY = "z-10";
const Z_HEADER = "z-20";
const Z_HEADER_CORNER = "z-30";

/** Thứ tự cột có thể focus/điều hướng bằng Enter — khớp đúng thứ tự hiển thị trên bảng (Mục 2). */
const TEXT_FIELDS = ["employee_code", "full_name", "date_of_birth", "identity_number", "hometown", "join_date"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

function toOption(account: DsSaleAccountOption): DsSaleSelectOption {
  return { id: account.id, label: account.full_name, sublabel: account.team_name, avatarUrl: account.avatar_url };
}

function makeDraftRow(): SheetRow {
  return {
    localId: `draft-${crypto.randomUUID()}`,
    id: null,
    employee_code: "",
    full_name: "",
    date_of_birth: "",
    identity_number: "",
    hometown: "",
    join_date: "",
    company: null,
    sale: null,
    pickup: null,
    note: "",
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
    join_date: row.join_date ?? "",
    company: row.company ? { id: row.company.id, label: row.company.name } : null,
    sale: row.sale ? toOption(row.sale) : null,
    pickup: row.pickup ? toOption(row.pickup) : null,
    note: row.note ?? "",
    status: "saved",
  };
}

function isRowBlank(row: SheetRow): boolean {
  return (
    !row.employee_code.trim() &&
    !row.full_name.trim() &&
    !row.date_of_birth &&
    !row.identity_number.trim() &&
    !row.hometown.trim() &&
    !row.join_date &&
    !row.company &&
    !row.sale &&
    !row.pickup &&
    !row.note.trim()
  );
}

function toInput(row: SheetRow): DsSaleRowInput {
  return {
    employee_code: row.employee_code.trim(),
    full_name: row.full_name.trim(),
    date_of_birth: row.date_of_birth || null,
    identity_number: row.identity_number.trim(),
    hometown: row.hometown.trim(),
    join_date: row.join_date || null,
    company_id: row.company?.id ?? null,
    sale_user_id: row.sale?.id ?? null,
    pickup_user_id: row.pickup?.id ?? null,
    note: row.note.trim(),
  };
}

export function DsSaleClient({
  currentUserId,
  initialRows,
  initialSaleAccounts,
  initialPickupAccounts,
  initialCompanies,
  extraTopOffset = 0,
}: {
  currentUserId: string;
  initialRows: PaginatedResult<DsSaleRow>;
  initialSaleAccounts: DsSaleAccountOption[];
  initialPickupAccounts: DsSaleAccountOption[];
  initialCompanies: DsSaleCompanyOption[];
  /** Chiều cao thanh tab "DS Sale" ở component cha (sales-entry-client.tsx) — cộng vào phần đo chiều cao khối cuộn bảng bên dưới. */
  extraTopOffset?: number;
}) {
  const toast = useToast();

  // Nguồn dropdown tải sẵn từ SERVER (page.tsx, Mục 4/5/6) — không đổi trong
  // phiên xem trang này nên chỉ cần chuyển dạng 1 lần, không cần useState riêng.
  const saleAccounts = useMemo(() => initialSaleAccounts.map(toOption), [initialSaleAccounts]);
  const pickupAccounts = useMemo(() => initialPickupAccounts.map(toOption), [initialPickupAccounts]);
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
  const [page, setPage] = useState(initialRows.page);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(100);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(100);

  const [keyword, setKeyword] = useState("");
  const [joinFrom, setJoinFrom] = useState("");
  const [joinTo, setJoinTo] = useState("");
  const [companyFilter, setCompanyFilter] = useState<DsSaleSelectOption | null>(null);
  const [saleFilter, setSaleFilter] = useState<DsSaleSelectOption | null>(null);
  const [pickupFilter, setPickupFilter] = useState<DsSaleSelectOption | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: "",
    join_date_from: "",
    join_date_to: "",
    company_id: "",
    sale_user_id: "",
    pickup_user_id: "",
  });

  const [addCountModalOpen, setAddCountModalOpen] = useState(false);
  const [addCountDraft, setAddCountDraft] = useState(5);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement | null>>(new Map());
  const focusFieldOnMount = useRef<string | null>(null);

  const loadPage = useCallback(
    async (targetPage: number, filters = appliedFilters, size = pageSize) => {
      setLoading(true);
      try {
        const result = await listDsSaleRows({
          page: targetPage,
          page_size: size,
          keyword: filters.keyword || undefined,
          join_date_from: filters.join_date_from || undefined,
          join_date_to: filters.join_date_to || undefined,
          company_id: filters.company_id || undefined,
          sale_user_id: filters.sale_user_id || undefined,
          pickup_user_id: filters.pickup_user_id || undefined,
        });
        setSheetRows(result.items.map(toSheetRow));
        setTotal(result.total);
        setPage(result.page);
        setSelected(new Set());
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Không tải được danh sách DS Sale");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedFilters/pageSize truyền tường minh qua tham số ở nơi gọi, không cần liệt kê lại
    [toast],
  );

  // Mục 9: luôn giữ đúng 1 dòng nháp trống ở cuối bảng để nhập nhanh — không
  // tự lưu khi còn trống. "Điều chỉnh state khi render" (mẫu React khuyến
  // nghị thay useEffect, đã dùng ở shuttle-client.tsx) thay vì effect phụ
  // thuộc [sheetRows] — tránh 1 lượt render thừa + lỗi lint set-state-in-effect.
  const lastRow = sheetRows[sheetRows.length - 1];
  if (!lastRow || lastRow.id !== null || !isRowBlank(lastRow)) {
    setSheetRows((prev) => [...prev, makeDraftRow()]);
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

  async function saveRow(row: SheetRow) {
    const localId = row.localId;

    if (isRowBlank(row)) {
      setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "idle" } : r)));
      return;
    }

    setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "saving" } : r)));
    try {
      const input = toInput(row);
      const response = row.id ? await updateDsSaleRow(row.id, input) : await createDsSaleRow(input);
      const wasDraft = row.id === null;
      setSheetRows((prev) =>
        prev.map((r) => (r.localId === localId ? { ...toSheetRow(response), localId } : r)),
      );
      if (wasDraft) setTotal((t) => t + 1);
    } catch (err) {
      setSheetRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "error" } : r)));
      toast.error(err instanceof ApiError ? err.message : "Lưu DS Sale thất bại");
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
    }, [currentUserId]),
  );

  useRealtimeReconnect(
    useCallback(() => {
      void loadPage(page, appliedFilters, pageSize);
    }, [loadPage, page, appliedFilters, pageSize]),
  );

  function applyFilters() {
    const next = {
      keyword,
      join_date_from: joinFrom,
      join_date_to: joinTo,
      company_id: companyFilter?.id ?? "",
      sale_user_id: saleFilter?.id ?? "",
      pickup_user_id: pickupFilter?.id ?? "",
    };
    setAppliedFilters(next);
    void loadPage(1, next, pageSize);
  }

  function clearFilters() {
    setKeyword("");
    setJoinFrom("");
    setJoinTo("");
    setCompanyFilter(null);
    setSaleFilter(null);
    setPickupFilter(null);
    const next = { keyword: "", join_date_from: "", join_date_to: "", company_id: "", sale_user_id: "", pickup_user_id: "" };
    setAppliedFilters(next);
    void loadPage(1, next, pageSize);
  }

  function changePageSize(size: (typeof PAGE_SIZE_OPTIONS)[number]) {
    setPageSize(size);
    void loadPage(1, appliedFilters, size);
  }

  function addRow() {
    const row = makeDraftRow();
    focusFieldOnMount.current = `${row.localId}:full_name`;
    setSheetRows((prev) => [...prev.slice(0, -1), row, prev[prev.length - 1]]);
  }

  function addMultipleRows(count: number) {
    const clamped = Math.min(Math.max(count, 1), 100);
    const rows = Array.from({ length: clamped }, () => makeDraftRow());
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

  const selectableRows = sheetRows.filter((r) => r.id !== null || !isRowBlank(r));
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

    const startCol = TEXT_FIELDS.indexOf(field);
    const touchedLocalIds: string[] = [];

    setSheetRows((prev) => {
      const next = [...prev];
      grid.forEach((lineCells, r) => {
        const targetIndex = rowIndex + r;
        while (targetIndex >= next.length - 1) {
          next.splice(next.length - 1, 0, makeDraftRow());
        }
        let updatedRow = next[targetIndex];
        lineCells.forEach((cellValue, c) => {
          const colIndex = startCol + c;
          if (colIndex >= TEXT_FIELDS.length) return;
          const targetField = TEXT_FIELDS[colIndex];
          updatedRow = { ...updatedRow, [targetField]: cellValue.trim() };
        });
        next[targetIndex] = updatedRow;
        touchedLocalIds.push(updatedRow.localId);
      });
      return next;
    });

    touchedLocalIds.forEach((localId) => scheduleSave(localId));
  }

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
      keyword: appliedFilters.keyword || undefined,
      join_date_from: appliedFilters.join_date_from || undefined,
      join_date_to: appliedFilters.join_date_to || undefined,
      company_id: appliedFilters.company_id || undefined,
      sale_user_id: appliedFilters.sale_user_id || undefined,
      pickup_user_id: appliedFilters.pickup_user_id || undefined,
    }),
    [appliedFilters],
  );

  return (
    <div className="space-y-2">
      {/* Mục 10 — bộ lọc gọn, không chiếm quá nhiều chiều cao. */}
      <div ref={filterBarRef} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <Field label="Từ khóa" uiSize="xs" className="w-48">
          <Input
            uiSize="xs"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Mã NV, họ tên, CCCD, quê quán..."
          />
        </Field>
        <Field label="Thu phóng" uiSize="xs">
          <Select
            uiSize="xs"
            className="w-16"
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
        <Field label="Ngày vào từ" uiSize="xs" className="w-32">
          <Input uiSize="xs" type="date" value={joinFrom} onChange={(e) => setJoinFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày" uiSize="xs" className="w-32">
          <Input uiSize="xs" type="date" value={joinTo} onChange={(e) => setJoinTo(e.target.value)} />
        </Field>
        <Field label="Công ty làm" uiSize="xs" className="w-36">
          <DsSaleSearchSelect
            options={companies}
            value={companyFilter}
            onChange={setCompanyFilter}
            placeholder="Tất cả"
            emptyLabel="Chưa có dữ liệu công ty hợp tác"
          />
        </Field>
        <Field label="Sale" uiSize="xs" className="w-36">
          <DsSaleSearchSelect
            options={saleAccounts}
            value={saleFilter}
            onChange={setSaleFilter}
            placeholder="Tất cả"
            emptyLabel="Chưa có tài khoản Sale"
          />
        </Field>
        <Field label="Đưa đón" uiSize="xs" className="w-36">
          <DsSaleSearchSelect
            options={pickupAccounts}
            value={pickupFilter}
            onChange={setPickupFilter}
            placeholder="Tất cả"
            emptyLabel="Chưa có tài khoản Đưa đón"
          />
        </Field>

        <div className="ml-auto flex items-center gap-1.5">
          <Button type="button" size="xs" variant="primary" onClick={applyFilters}>
            Tìm kiếm
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={clearFilters}>
            Xóa lọc
          </Button>
          <Button type="button" size="xs" variant="secondary" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Thêm dòng
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => setAddCountModalOpen(true)}>
            <Rows3 className="h-3.5 w-3.5" strokeWidth={2} />
            Thêm nhiều dòng
          </Button>
          <Button
            type="button"
            size="xs"
            variant="danger"
            disabled={selected.size === 0}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Xóa đã chọn ({selected.size})
          </Button>
          <a
            href={buildDsSaleExportUrl(exportParams)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#217346] px-2 py-1 text-xs font-medium text-white shadow-sm shadow-[#217346]/25 transition-colors hover:bg-[#1a5c38]"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Tải Excel
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
          style={{ width: TABLE_TOTAL_WIDTH }}
        >
          <colgroup>
            <col style={{ width: CHECK_COL_WIDTH }} />
            <col style={{ width: STT_COL_WIDTH }} />
            <col style={{ width: CODE_COL_WIDTH }} />
            <col style={{ width: NAME_COL_WIDTH }} />
            <col style={{ width: DOB_COL_WIDTH }} />
            <col style={{ width: IDENTITY_COL_WIDTH }} />
            <col style={{ width: HOMETOWN_COL_WIDTH }} />
            <col style={{ width: JOIN_COL_WIDTH }} />
            <col style={{ width: COMPANY_COL_WIDTH }} />
            <col style={{ width: SALE_COL_WIDTH }} />
            <col style={{ width: PICKUP_COL_WIDTH }} />
            <col style={{ width: NOTE_COL_WIDTH }} />
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
              <th
                className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER_CORNER)}
                style={{ position: "sticky", left: STT_LEFT }}
              >
                STT
              </th>
              <th
                className={cn(
                  "sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white",
                  STICKY_EDGE_SHADOW,
                  Z_HEADER_CORNER,
                )}
                style={{ position: "sticky", left: CODE_LEFT }}
              >
                Mã NV
              </th>
              <th
                className={cn(
                  "sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white",
                  STICKY_EDGE_SHADOW,
                  Z_HEADER_CORNER,
                )}
                style={{ position: "sticky", left: NAME_LEFT }}
              >
                Họ tên
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Ngày sinh
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Số CMT/CCCD
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Quê quán
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Ngày vào
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Công ty làm
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Sale
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Đưa đón
              </th>
              <th className={cn("sticky top-0 border-r border-b border-slate-200 bg-brand-800 px-2 py-2 text-center font-semibold text-white", Z_HEADER)}>
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {sheetRows.map((row, rowIndex) => {
              const isBlankDraft = row.id === null && isRowBlank(row);
              const zebra = rowIndex % 2 === 1 ? "bg-slate-50" : "bg-white";
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
                      <span>{isBlankDraft ? "" : sttBase + rowIndex + 1}</span>
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
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <DsSaleSearchSelect
                      options={companies}
                      value={row.company}
                      onChange={(v) => updateFieldAndSave(row.localId, "company", v)}
                      placeholder="Chọn công ty"
                      emptyLabel="Chưa có dữ liệu công ty hợp tác"
                    />
                  </td>
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <DsSaleSearchSelect
                      options={saleAccounts}
                      value={row.sale}
                      onChange={(v) => updateFieldAndSave(row.localId, "sale", v)}
                      placeholder="Chọn Sale"
                      emptyLabel="Chưa có tài khoản Sale"
                    />
                  </td>
                  <td className={cn("border-r border-b border-slate-100 p-0.5", zebra)}>
                    <DsSaleSearchSelect
                      options={pickupAccounts}
                      value={row.pickup}
                      onChange={(v) => updateFieldAndSave(row.localId, "pickup", v)}
                      placeholder="Chọn NV đưa đón"
                      emptyLabel="Chưa có tài khoản Đưa đón"
                    />
                  </td>
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
          <p className="text-sm text-slate-500">Xóa {selected.size} dòng khỏi DS Sale.</p>
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
