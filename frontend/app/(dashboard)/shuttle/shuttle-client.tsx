"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy, GripVertical, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useRememberedFilters } from "@/lib/remembered-filters";
import { DaySeparatorRow } from "@/components/day-separator-row";
import { cn } from "@/lib/cn";
import { shuttleColorStyle } from "@/lib/shuttle-colors";
import { EMPTY_OPTION_STYLE } from "@/lib/zalo-friend-status";
import type {
  AccountOptionItem,
  AppRealtimeEvent,
  ModulePermissionLevel,
  ShuttleListResult,
  ShuttleOptionItem,
  ShuttleOptions,
  ShuttleRecord,
} from "@/lib/types";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { useToast } from "@/lib/toast-context";
import { useSetPageTitle } from "@/lib/page-title-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ColorPalette } from "@/components/ui/color-palette";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ViewOnlyBadge } from "@/components/ui/view-only-badge";
import { SortableTh, applySortParams, type SortState } from "@/components/ui/sortable-th";
import { EMPTY_DATE_RANGE, type DateRangeValue } from "@/lib/date-range";
import { ShuttleImportModal } from "./shuttle-import-modal";
import { ShuttleSheetSyncModal } from "./shuttle-sheet-sync-modal";

/**
 * Màu 1 tài khoản Sale/NV đưa đón trong bộ lọc (2026-11-06) — màu lưu ở
 * options.sales/options.drivers với value = account.id; chưa đặt màu = nền
 * trắng chữ tối.
 */
function accountOptionStyle(colors: ShuttleOptionItem[], accountId: string) {
  const item = colors.find((c) => c.value === accountId);
  return (item && shuttleColorStyle(item.color_key, item.text_color_key)) ?? EMPTY_OPTION_STYLE;
}

type ShuttleSortKey = "date" | "stt" | "interview_time";

/**
 * Dự án phụ — nâng cấp toàn diện: ô "thả ra", không đóng khung (yêu cầu
 * trực tiếp người dùng — riêng cột Ngày/Tên lao động/SĐT/Ghi chú, KHÁC
 * các ô ComboCell vẫn giữ khung). Không dùng chung <Input> vì fieldBaseClass
 * có sẵn "border border-slate-300 shadow-sm" — ghi đè cùng thuộc tính qua
 * className nối thêm không đáng tin cậy (cn() không dedup, đã gặp lỗi này
 * nhiều lần trong dự án), nên viết class riêng không đụng base nào cả.
 */
const PLAIN_FIELD_CLASS =
  "w-full resize-none rounded border-0 bg-transparent px-1 py-0.5 text-center text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-brand-400";

/**
 * Y hệt PLAIN_FIELD_CLASS nhưng căn trái — riêng ô Họ tên/SĐT (cột "Thông
 * tin lao động", yêu cầu trực tiếp người dùng). Viết riêng hẳn 1 class thay
 * vì nối "text-left" vào PLAIN_FIELD_CLASS qua cn(): "text-center" đã có sẵn
 * trong chuỗi gốc, nối thêm cùng thuộc tính text-align không đáng tin cậy
 * (thắng/thua phụ thuộc thứ tự rule trong stylesheet Tailwind sinh ra, không
 * phải thứ tự trong className — bài học lặp lại nhiều lần trong dự án).
 */
const PLAIN_FIELD_CLASS_LEFT =
  "w-full resize-none rounded border-0 bg-transparent px-1 py-0 text-left text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-brand-400";

const OPTION_FIELD_KEYS: Record<string, keyof ShuttleOptions> = {
  area: "areas",
  type: "types",
  contractor: "contractors",
  status: "statuses",
  interview_result: "interviewResults",
  interview_time: "interviewTimes",
  lead_source: "leadSources",
};

/**
 * Lựa chọn cố định (2026-11-04): Dashboard đếm Đến/Bùng/Đỗ/Trượt PV và tách CT/TV theo đúng
 * các chuỗi này → không xoá/đổi tên, chỉ đổi màu. Khớp LOCKED_SHUTTLE_OPTIONS ở backend.
 */
const LOCKED_OPTION_VALUES: Record<string, readonly string[]> = {
  type: ["CT", "TV"],
  status: ["Đã đón", "Chưa đón được"],
  interview_result: ["Đỗ PV", "Trượt PV"],
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300] as const;

/** Dự án phụ — nâng cấp toàn diện: mức thu phóng bảng, y hệt danh sách % của Google Sheet (yêu cầu trực tiếp người dùng). */
const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200] as const;

function todayISODate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> "dd/mm" (yêu cầu trực tiếp người dùng: cột Ngày chỉ hiện dd/mm). */
function isoToShortDate(iso: string): string {
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/**
 * Dự án phụ — nâng cấp toàn diện: ô Ngày gõ tay "dd/mm" thay vì lịch chọn
 * ngày của trình duyệt (yêu cầu trực tiếp người dùng) — năm giữ nguyên theo
 * giá trị đang có (hoặc năm hiện tại nếu chưa có), không hiện/không nhập
 * được năm. Tự quản lý buffer gõ tay riêng vì giá trị hợp lệ "dd/mm" chỉ
 * xác định được sau khi gõ đủ 2 phần, không thể commit theo từng ký tự.
 */
function DateShortInput({
  value,
  onCommit,
}: {
  value: string;
  /** Nhận thẳng ngày ISO đầy đủ mới — dùng onCommitField ở cha (không đọc lại state, tránh lưu nhầm giá trị cũ do setState bất đồng bộ). */
  onCommit: (iso: string) => void;
}) {
  const [text, setText] = useState(() => isoToShortDate(value));
  // "Điều chỉnh state khi render" (mẫu React khuyến nghị thay useEffect) —
  // đồng bộ buffer gõ tay với giá trị ISO từ cha mỗi khi nó đổi từ bên ngoài
  // (vd sau khi lưu thành công), không set trong effect để tránh render thừa.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(isoToShortDate(value));
  }

  function commit() {
    const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
      setText(isoToShortDate(value));
      return;
    }
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = value ? value.slice(0, 4) : String(new Date().getFullYear());
    onCommit(`${year}-${month}-${day}`);
  }

  return (
    <input
      className={PLAIN_FIELD_CLASS}
      placeholder="dd/mm"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
    />
  );
}

interface Filters {
  keyword: string;
  date: DateRangeValue;
  company_id: string;
  type: string;
  sale_user_id: string;
  driver_user_id: string;
  status: string;
  interview_result: string;
}

const EMPTY_FILTERS: Filters = {
  keyword: "",
  date: EMPTY_DATE_RANGE,
  company_id: "",
  type: "",
  sale_user_id: "",
  driver_user_id: "",
  status: "",
  interview_result: "",
};

interface ShuttleFormValue {
  date: string;
  full_name: string;
  phone_number: string;
  company_id: string;
  area: string;
  type: string;
  sale_user_id: string;
  driver_user_id: string;
  interview_time: string;
  contractor: string;
  status: string;
  interview_result: string;
  lead_source: string;
  note: string;
}

function emptyFormValue(): ShuttleFormValue {
  return {
    date: todayISODate(),
    full_name: "",
    phone_number: "",
    company_id: "",
    area: "",
    type: "",
    sale_user_id: "",
    driver_user_id: "",
    interview_time: "",
    contractor: "",
    status: "",
    interview_result: "",
    lead_source: "",
    note: "",
  };
}

function formValueFromRecord(record: ShuttleRecord): ShuttleFormValue {
  return {
    date: record.date,
    full_name: record.full_name,
    phone_number: record.phone_number,
    company_id: record.company_id ?? "",
    area: record.area ?? "",
    type: record.type ?? "",
    sale_user_id: record.sale?.id ?? "",
    driver_user_id: record.driver?.id ?? "",
    interview_time: record.interview_time ?? "",
    contractor: record.contractor ?? "",
    status: record.status ?? "",
    interview_result: record.interview_result ?? "",
    lead_source: record.lead_source ?? "",
    note: record.note ?? "",
  };
}

function buildRowDrafts(records: ShuttleRecord[]): Record<string, ShuttleFormValue> {
  const map: Record<string, ShuttleFormValue> = {};
  for (const record of records) map[record.id] = formValueFromRecord(record);
  return map;
}

function sameFormValue(a: ShuttleFormValue, b: ShuttleFormValue): boolean {
  return (Object.keys(a) as Array<keyof ShuttleFormValue>).every((key) => a[key] === b[key]);
}

/**
 * Gộp bản cập nhật realtime vào dòng đang hiển thị theo TỪNG Ô (yêu cầu
 * người dùng 2026-10-29: sửa xong tự cập nhật, không phải bấm "Tải lại").
 * - Ô mình không sửa (draft = base) → lấy giá trị mới.
 * - Ô mình đã sửa và giá trị mới trùng (chính mình vừa lưu) → xong.
 * - Ô mình đang sửa, người khác không đụng (remote = base) → giữ chữ đang gõ.
 * - Chỉ khi người khác đổi ĐÚNG ô mình đang gõ sang giá trị khác → xung đột.
 */
function mergeRemoteFormValue(
  draft: ShuttleFormValue,
  base: ShuttleFormValue,
  remote: ShuttleFormValue,
): { value: ShuttleFormValue; conflict: boolean } {
  const value = { ...remote };
  let conflict = false;
  for (const key of Object.keys(remote) as Array<keyof ShuttleFormValue>) {
    if (draft[key] === base[key] || draft[key] === remote[key]) continue;
    (value as Record<keyof ShuttleFormValue, unknown>)[key] = draft[key];
    if (remote[key] !== base[key]) conflict = true;
  }
  return { value, conflict };
}

/**
 * Dự án phụ — nâng cấp toàn diện: ô "chọn" (không gõ tay trực tiếp) — bấm mở
 * trình đơn thả xuống liệt kê các giá trị đã có (dạng chip màu), có nút
 * "Chỉnh sửa" ở cuối mở popup quản lý danh sách (ShuttleOptionManagerModal)
 * — y hệt trình đơn thả xuống của Google Sheet (yêu cầu trực tiếp người
 * dùng, có ảnh chụp minh họa). Render panel qua Portal thẳng vào
 * document.body (giống Modal/NotificationBell) vì bảng nằm trong khối cuộn
 * ngang (overflow-x-auto) — không portal thì panel sẽ bị cắt cụt khi tràn
 * ra ngoài vùng cuộn.
 */
function ComboCell({
  value,
  options,
  onSelect,
  onManageOptions,
  compact,
  textClassName,
  matchBy = "value",
}: {
  value: string;
  options: ShuttleOptionItem[];
  onSelect: (value: string) => void;
  /**
   * Mở popup quản lý (thêm/sửa/xóa) toàn bộ danh sách gợi ý của trường này —
   * để trống (undefined) để ẩn hẳn nút "Chỉnh sửa", dùng cho trường "Sale"
   * (nguồn lấy từ danh sách tài khoản thật, không cho tự thêm/sửa/xóa ở đây
   * nữa — yêu cầu trực tiếp người dùng) và "Công ty" (quản lý riêng ở trang
   * Quản lý đơn hàng — yêu cầu trực tiếp người dùng, 2026-07-26: "công ty
   * chính là đơn hàng").
   */
  onManageOptions?: () => void;
  /** Thu nhỏ nút hiển thị — riêng 2 ô "Tình trạng đón"/"Kết quả PV" xếp chồng trong cùng 1 cột (yêu cầu trực tiếp người dùng). */
  compact?: boolean;
  /** Chỉ đổi riêng cỡ chữ, giữ nguyên kích thước/kiểu ô — riêng cột "Sale" (yêu cầu trực tiếp người dùng: "cỡ chữ của cột sale để bé lại"). Bỏ qua nếu compact=true (compact đã tự quyết cỡ chữ riêng). */
  textClassName?: string;
  /**
   * "value" (mặc định): 7 trường "chọn" gốc lưu thẳng CHUỖI HIỂN THỊ (vd
   * "Bắc Ninh") — value prop CHÍNH LÀ nhãn hiển thị, khớp option.value.
   * "id": riêng "Công ty" (2026-07-26, "công ty chính là đơn hàng") lưu
   * company_id (khóa ngoại OrderRecord) — value prop là ID, khác nhãn hiển
   * thị, phải tra theo option.id rồi hiển thị option.value (tên đơn hàng).
   */
  matchBy?: "value" | "id";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  /**
   * Dự án phụ — nâng cấp toàn diện: tự lật panel lên TRÊN nút bấm nếu không
   * đủ chỗ bên dưới (yêu cầu trực tiếp người dùng — các dòng gần cuối trang
   * bị tràn ra ngoài khi mở trình đơn thả xuống, vì trước đó luôn mở xuống
   * dưới bất kể còn bao nhiêu chỗ). Giới hạn maxHeight theo đúng khoảng
   * trống thực tế để panel luôn cuộn được bên trong thay vì tràn viewport.
   */
  function openDropdown() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 4;
    const PREFERRED_HEIGHT = 320;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUpward = spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow;

    setPosition({
      top: openUpward ? undefined : rect.bottom + GAP,
      bottom: openUpward ? window.innerHeight - rect.top + GAP : undefined,
      left: rect.left,
      width: Math.max(rect.width, 190),
      maxHeight: Math.max(120, Math.min(PREFERRED_HEIGHT, openUpward ? spaceAbove : spaceBelow)),
    });
    setIsOpen(true);
  }

  function selectValue(next: string) {
    onSelect(next);
    setIsOpen(false);
  }

  const currentOption = options.find((option) =>
    matchBy === "id" ? option.id === value : option.value === value,
  );
  const triggerStyle = shuttleColorStyle(currentOption?.color_key, currentOption?.text_color_key);
  // matchBy="value": currentOption?.value luôn trùng value khi tìm thấy (giữ nguyên hành vi cũ y hệt).
  // matchBy="id": value là company_id (không phải nhãn) — PHẢI hiện currentOption?.value (tên), không hiện thẳng id.
  const triggerLabel = matchBy === "id" ? (currentOption?.value ?? "") : (currentOption?.value ?? value);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        style={triggerStyle}
        className={cn(
          compact
            ? "relative flex w-full items-center justify-center rounded-md border border-slate-300 bg-white py-0 pr-4 pl-1 text-[10px] text-slate-800 shadow-sm"
            : cn(
                "relative flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white py-0.5 pr-5 pl-2 text-slate-800 shadow-sm",
                textClassName ?? "text-xs",
              ),
          triggerStyle && "border-transparent font-medium",
        )}
      >
        <span className="min-w-0 text-center break-words whitespace-normal">
          {triggerLabel || <span className="text-slate-400">Chọn</span>}
        </span>
        <ChevronDown
          className={cn(
            "absolute top-1/2 shrink-0 -translate-y-1/2 opacity-60",
            compact ? "right-1 h-2.5 w-2.5" : "right-1.5 h-3 w-3",
          )}
          strokeWidth={2}
        />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              minWidth: position.width,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-30 w-max max-w-xs overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10"
          >
            <button
              type="button"
              onClick={() => selectValue("")}
              className="mb-1 block w-full rounded px-2 py-1 text-left text-xs text-slate-400 hover:bg-slate-50"
            >
              — Bỏ trống —
            </button>
            <div className="flex flex-col gap-1">
              {options.map((option) => {
                const optionStyle = shuttleColorStyle(option.color_key, option.text_color_key);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectValue(matchBy === "id" ? option.id : option.value)}
                    style={optionStyle}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-left text-xs font-medium break-words whitespace-normal",
                      !optionStyle && "bg-slate-100 text-slate-700 hover:bg-slate-200",
                    )}
                  >
                    {option.value}
                  </button>
                );
              })}
              {options.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Chưa có giá trị nào</p>}
            </div>
            {onManageOptions && (
              <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onManageOptions();
                  }}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                  Chỉnh sửa
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Bảng 20 màu để chọn khi thêm/sửa 1 giá trị gợi ý — dùng chung cho form "thêm mới" và từng dòng đang sửa trong ShuttleOptionManagerModal. */
/**
 * Dự án phụ — nâng cấp toàn diện: lưới 10 cột (10 xám + 10 tông màu x 7 sắc
 * độ) — khớp đúng cấu trúc bảng màu người dùng gửi ảnh yêu cầu, thay vì
 * flex-wrap tự do như trước.
 */
/**
 * Dự án phụ — nâng cấp toàn diện: popup CHỈ chỉnh màu nền cho cột Sale/Đưa
 * đón (yêu cầu trực tiếp người dùng: "cho thêm 1 bảng màu cho phép sửa được
 * màu nền khi ấn vào chỉnh sửa") — KHÁC ShuttleOptionManagerModal bên dưới:
 * không cho đổi tên/thêm mới/xóa tài khoản (tên lấy thẳng từ tài khoản thật,
 * để sau này làm báo cáo khớp đúng), mỗi tài khoản chỉ có 1 bảng màu để
 * chọn, lưu ngay khi bấm màu (không cần nút "Lưu" riêng). Dùng chung cho cả
 * Sale (role='sale') và Đưa đón (role='shuttle_staff', bổ sung 2026-07-28 —
 * "chuyển cả 2 cột sang liên kết tài khoản thật") — trước đó chỉ có Sale
 * (SaleColorManagerModal), giờ tổng quát hóa theo account.id thay vì tên.
 */
function AccountColorManagerModal({
  title,
  emptyLabel,
  accounts,
  colorOptions,
  onSetColor,
  onSetTextColor,
  onClose,
}: {
  title: string;
  emptyLabel: string;
  accounts: AccountOptionItem[];
  colorOptions: ShuttleOptionItem[];
  onSetColor: (accountId: string, colorKey: string | null) => Promise<void>;
  /** Dự án phụ — nâng cấp toàn diện: màu CHỮ riêng, độc lập với onSetColor (màu nền) — yêu cầu trực tiếp người dùng. */
  onSetTextColor: (accountId: string, textColorKey: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);

  async function handlePick(account: AccountOptionItem, colorKey: string | null) {
    setPendingAccountId(account.id);
    try {
      await onSetColor(account.id, colorKey);
    } catch {
      // Lỗi đã báo qua toast ở cha (handleAddOption) — không cần xử lý thêm ở đây.
    } finally {
      setPendingAccountId(null);
    }
  }

  async function handlePickText(account: AccountOptionItem, textColorKey: string | null) {
    setPendingAccountId(account.id);
    try {
      await onSetTextColor(account.id, textColorKey);
    } catch {
      // Lỗi đã báo qua toast ở cha (handleAddOption) — không cần xử lý thêm ở đây.
    } finally {
      setPendingAccountId(null);
    }
  }

  return (
    <Modal
      title={title}
      maxWidth="max-w-lg"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {accounts.length === 0 && <p className="text-sm text-slate-400">{emptyLabel}</p>}
        {accounts.map((account) => {
          const option = colorOptions.find((o) => o.value === account.id);
          const colorKey = option?.color_key ?? null;
          const textColorKey = option?.text_color_key ?? null;
          const label = account.nickname ?? account.full_name;
          return (
            <div key={account.id} className="rounded-lg border border-slate-200 p-2.5">
              <span className="text-sm font-medium text-slate-800">{label}</span>
              <fieldset disabled={pendingAccountId === account.id} className="mt-2 flex flex-col gap-2">
                <div>
                  <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu nền</p>
                  <ColorPalette selected={colorKey} onPick={(next) => void handlePick(account, next)} />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu chữ</p>
                  <ColorPalette selected={textColorKey} onPick={(next) => void handlePickText(account, next)} />
                </div>
              </fieldset>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/**
 * Dự án phụ — nâng cấp toàn diện: popup quản lý TOÀN BỘ danh sách gợi ý của
 * 1 trường — đổi tên/màu từng giá trị đã có, xóa, và thêm giá trị mới kèm
 * bảng 20 màu (yêu cầu trực tiếp người dùng: "khi ấn vào chỉnh sửa thì sẽ có
 * 1 popup hiện lên trong đó có những lựa chọn đã cài sẵn, có thể chỉnh
 * sửa... thêm giá trị mới kèm bảng màu tầm 20 màu").
 */
function ShuttleOptionManagerModal({
  fieldLabel,
  options,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onClose,
  lockedValues = [],
}: {
  fieldLabel: string;
  options: ShuttleOptionItem[];
  /** Giá trị cố định (vd Loại hình CT/TV): không xoá, không đổi tên — chỉ đổi màu. */
  lockedValues?: readonly string[];
  onAddOption: (value: string, colorKey: string | null, textColorKey: string | null) => Promise<void>;
  onUpdateOption: (
    optionId: string,
    value: string,
    colorKey: string | null,
    textColorKey: string | null,
  ) => Promise<void>;
  onDeleteOption: (optionId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [newColorKey, setNewColorKey] = useState<string | null>(null);
  const [newTextColorKey, setNewTextColorKey] = useState<string | null>(null);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editColorKey, setEditColorKey] = useState<string | null>(null);
  const [editTextColorKey, setEditTextColorKey] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function startEdit(option: ShuttleOptionItem) {
    setEditingId(option.id);
    setEditValue(option.value);
    setEditColorKey(option.color_key);
    setEditTextColorKey(option.text_color_key);
  }

  async function handleSaveEdit() {
    if (!editingId || !editValue.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await onUpdateOption(editingId, editValue.trim(), editColorKey, editTextColorKey);
      setEditingId(null);
    } catch {
      // Lỗi đã báo qua toast ở cha — giữ nguyên form để thử lại.
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(optionId: string) {
    setPendingDeleteId(optionId);
    try {
      await onDeleteOption(optionId);
      if (editingId === optionId) setEditingId(null);
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleAddConfirm() {
    const trimmed = newValue.trim();
    if (!trimmed || isSubmittingNew) return;
    setIsSubmittingNew(true);
    try {
      await onAddOption(trimmed, newColorKey, newTextColorKey);
      setNewValue("");
      setNewColorKey(null);
      setNewTextColorKey(null);
    } catch {
      // Lỗi đã báo qua toast ở cha — giữ nguyên form để thử lại.
    } finally {
      setIsSubmittingNew(false);
    }
  }

  return (
    <Modal
      title={`Chỉnh sửa danh sách — ${fieldLabel}`}
      maxWidth="max-w-lg"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {options.length === 0 && <p className="text-sm text-slate-400">Chưa có giá trị nào.</p>}
          {options.map((option) => {
            const isEditing = editingId === option.id;
            const isLocked = lockedValues.includes(option.value);
            const style = shuttleColorStyle(option.color_key, option.text_color_key);
            return (
              <div key={option.id} className="rounded-lg border border-slate-200 p-2.5">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      uiSize="sm"
                      value={editValue}
                      disabled={isLocked}
                      title={isLocked ? "Giá trị cố định — chỉ đổi được màu" : undefined}
                      onChange={(event) => setEditValue(event.target.value)}
                      autoFocus={!isLocked}
                    />
                    <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu nền</p>
                    <ColorPalette selected={editColorKey} onPick={setEditColorKey} />
                    <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu chữ</p>
                    <ColorPalette selected={editTextColorKey} onPick={setEditTextColorKey} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="xs" onClick={() => setEditingId(null)}>
                        Hủy
                      </Button>
                      <Button type="button" size="xs" disabled={isSavingEdit} onClick={() => void handleSaveEdit()}>
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                        {isSavingEdit ? "Đang lưu..." : "Lưu"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={style}
                      className={cn(
                        "min-w-0 flex-1 rounded-full px-2.5 py-1 text-xs font-medium break-words whitespace-normal",
                        !style && "bg-slate-100 text-slate-700",
                      )}
                    >
                      {option.value}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="xs" onClick={() => startEdit(option)}>
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                        {isLocked ? "Đổi màu" : "Sửa"}
                      </Button>
                      {isLocked ? (
                        <span className="px-1 text-[11px] text-slate-400" title="Dashboard tách số theo giá trị này nên không xoá/đổi tên được">
                          Cố định
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={pendingDeleteId === option.id}
                          onClick={() => void handleDelete(option.id)}
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2} />
                          Xóa
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Thêm giá trị mới</p>
          <div className="flex flex-col gap-2">
            <Input
              uiSize="sm"
              placeholder={`${fieldLabel} mới...`}
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleAddConfirm()}
            />
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu nền</p>
            <ColorPalette selected={newColorKey} onPick={setNewColorKey} />
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu chữ</p>
            <ColorPalette selected={newTextColorKey} onPick={setNewTextColorKey} />
            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={isSubmittingNew} onClick={() => void handleAddConfirm()}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                {isSubmittingNew ? "Đang lưu..." : "Thêm"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Dự án phụ — nâng cấp toàn diện: mọi ô LUÔN Ở DẠNG NHẬP ĐƯỢC, không cần bấm
 * "Sửa" trước (yêu cầu trực tiếp người dùng: "cho phép chỉnh sửa tự do tất
 * cả nội dung y hệt Google Sheet" — "không cần phải ấn sửa rồi mới sửa
 * được"). Dùng chung cho cả dòng nháp thêm mới lẫn từng dòng dữ liệu đã có.
 * Công ty/Khu vực/Loại hình/Sale/Nhân viên đưa đón/Nhà thầu/Trạng thái/Kết
 * quả PV/Giờ phỏng vấn đều dùng ComboCell (chọn từ trình đơn thả xuống,
 * không gõ tay trực tiếp — yêu cầu trực tiếp người dùng, có ảnh minh họa
 * trình đơn Google Sheet). Riêng "Công ty" (2026-07-26, "công ty chính là
 * đơn hàng") dùng ComboCell với matchBy="id" — value lưu company_id (khóa
 * ngoại OrderRecord), không phải chuỗi hiển thị như 8 trường còn lại; quản
 * lý thêm/sửa/xóa/màu tại trang Quản lý đơn hàng, không có nút "Chỉnh sửa"
 * ở đây.
 */
/**
 * Nút copy SĐT cạnh ô SĐT mỗi dòng — ai vào được trang (kể cả chỉ có quyền
 * xem) đều dùng được (yêu cầu người dùng 2026-11-09). "pointer-events-auto"
 * để vẫn bấm được khi <tbody> bị "pointer-events-none" ở chế độ chỉ xem.
 */
function CopyPhoneButton({ phone }: { phone: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(phone);
      } else {
        // Dự phòng khi trang chạy qua http thường (clipboard API bị chặn).
        const area = document.createElement("textarea");
        area.value = phone;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopied(true);
      toast.success(`Đã copy SĐT ${phone}`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không copy được SĐT");
    }
  }

  return (
    <button
      type="button"
      title="Copy SĐT"
      onClick={() => void handleCopy()}
      className="pointer-events-auto shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}

function ShuttleRowFormCells({
  value,
  stt,
  dragHandle,
  onChange,
  onBlurField,
  onCommitField,
  options,
  saleOptions,
  driverOptions,
  companyOptions,
  onManageOptions,
  onManageSaleColors,
  onManageDriverColors,
}: {
  value: ShuttleFormValue;
  /** STT trong ngày — undefined ở dòng nháp thêm mới (ô để trống). */
  stt?: number;
  /** Tay nắm kéo thả đổi thứ tự trong ngày (2026-11-10) — không có ở dòng nháp. */
  dragHandle?: React.ReactNode;
  onChange: (next: ShuttleFormValue) => void;
  /** Gọi khi rời khỏi 1 ô nhập tay — undefined ở dòng nháp thêm mới (chỉ lưu khi bấm "Thêm"). */
  onBlurField?: () => void;
  /**
   * Gọi ngay khi chọn xong 1 giá trị trong ComboCell — khác onBlurField vì
   * chọn xong không có sự kiện "blur" thật để bắt; nhận thẳng giá trị mới
   * (không đọc lại state cha) để tránh lưu giá trị cũ do setState bất đồng
   * bộ. undefined ở dòng nháp thêm mới (chỉ lưu khi bấm "Thêm").
   */
  onCommitField?: (next: ShuttleFormValue) => void;
  options: ShuttleOptions;
  /** Danh sách tài khoản role=sale (từ /shuttle/sale-accounts), dựng lại thành dạng ShuttleOptionItem[] để dùng chung ComboCell — TÊN không cho tự thêm/sửa/xóa, chỉ MÀU chỉnh được (yêu cầu trực tiếp người dùng). */
  saleOptions: ShuttleOptionItem[];
  /** Bổ sung 2026-07-28 — y hệt saleOptions nhưng nguồn là tài khoản role=shuttle_staff (/shuttle/driver-accounts), dùng cho cột "Đưa đón". */
  driverOptions: ShuttleOptionItem[];
  /** Danh sách đơn hàng (từ /shuttle/companies, đọc từ OrderRecord) — yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng". Không cho tự thêm/sửa/xóa ở đây — quản lý riêng tại trang Quản lý đơn hàng. */
  companyOptions: ShuttleOptionItem[];
  /** Mở popup quản lý danh sách gợi ý (thêm/sửa/xóa) của 1 trong 5 trường "chọn" (không áp dụng cho Sale/Đưa đón/Công ty). */
  onManageOptions: (field: string, label: string) => void;
  /** Mở popup CHỈ chỉnh màu nền cho từng tài khoản Sale — không đổi tên/thêm/xóa tài khoản. */
  onManageSaleColors: () => void;
  /** Bổ sung 2026-07-28 — y hệt onManageSaleColors nhưng cho tài khoản Đưa đón. */
  onManageDriverColors: () => void;
}) {
  function set<K extends keyof ShuttleFormValue>(key: K, val: string) {
    onChange({ ...value, [key]: val });
  }

  function selectCombo<K extends keyof ShuttleFormValue>(key: K, val: string) {
    const next = { ...value, [key]: val };
    onChange(next);
    onCommitField?.(next);
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: ấn Enter là lưu ngay + thoát khỏi ô nhập
   * (blur) thay vì phải trỏ chuột ra ngoài mới lưu (yêu cầu trực tiếp người
   * dùng). Giữ Shift+Enter để xuống dòng trong ô Ghi chú (textarea nhiều
   * dòng) — chỉ Enter đơn thuần mới coi là "xong, lưu lại".
   */
  function handleEnterToBlur(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  return (
    <>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <DateShortInput value={value.date} onCommit={(iso) => selectCombo("date", iso)} />
      </td>
      <td className="border-r border-slate-100 px-1 py-1 align-middle text-xs text-slate-500 tabular-nums">
        <span className="flex items-center gap-0.5">
          {dragHandle}
          {stt ?? ""}
        </span>
      </td>
      {/* Tên lao động và SĐT tách 2 cột riêng (yêu cầu người dùng 2026-11-09). */}
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <input
          className={cn(PLAIN_FIELD_CLASS_LEFT, "font-bold")}
          placeholder="Họ tên"
          value={value.full_name}
          onChange={(event) => set("full_name", event.target.value)}
          onBlur={onBlurField}
          onKeyDown={handleEnterToBlur}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <div className="flex items-center gap-0.5">
          <input
            className={cn(PLAIN_FIELD_CLASS_LEFT, "min-w-0 font-bold")}
            style={{ color: "#1e3a8a" }}
            placeholder="SĐT"
            value={value.phone_number}
            onChange={(event) => set("phone_number", event.target.value)}
            onBlur={onBlurField}
            onKeyDown={handleEnterToBlur}
          />
          {value.phone_number.trim() && <CopyPhoneButton phone={value.phone_number.trim()} />}
        </div>
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.company_id}
          options={companyOptions}
          onSelect={(v) => selectCombo("company_id", v)}
          matchBy="id"
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.area}
          options={options.areas}
          onSelect={(v) => selectCombo("area", v)}
          onManageOptions={() => onManageOptions("area", "Khu vực")}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.type}
          options={options.types}
          onSelect={(v) => selectCombo("type", v)}
          onManageOptions={() => onManageOptions("type", "Loại hình")}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.sale_user_id}
          options={saleOptions}
          onSelect={(v) => selectCombo("sale_user_id", v)}
          onManageOptions={onManageSaleColors}
          textClassName="text-xs"
          matchBy="id"
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.driver_user_id}
          options={driverOptions}
          onSelect={(v) => selectCombo("driver_user_id", v)}
          onManageOptions={onManageDriverColors}
          matchBy="id"
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.interview_time}
          options={options.interviewTimes}
          onSelect={(v) => selectCombo("interview_time", v)}
          onManageOptions={() => onManageOptions("interview_time", "Giờ phỏng vấn")}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.contractor}
          options={options.contractors}
          onSelect={(v) => selectCombo("contractor", v)}
          onManageOptions={() => onManageOptions("contractor", "Nhà thầu")}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.status}
          options={options.statuses}
          onSelect={(v) => selectCombo("status", v)}
          onManageOptions={() => onManageOptions("status", "Tình trạng")}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.interview_result}
          options={options.interviewResults}
          onSelect={(v) => selectCombo("interview_result", v)}
          onManageOptions={() => onManageOptions("interview_result", "Kết quả")}
        />
      </td>
      <td className="border-r border-slate-100 px-1 py-1 align-middle">
        <ComboCell
          value={value.lead_source}
          options={options.leadSources}
          onSelect={(v) => selectCombo("lead_source", v)}
          onManageOptions={() => onManageOptions("lead_source", "Nguồn")}
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <textarea
          // Thấp hơn (30px, trước 42px khi Họ tên/SĐT còn chồng 2 dòng) — dòng bảng gọn hơn (yêu cầu người dùng 2026-11-09).
          rows={1}
          className={cn(PLAIN_FIELD_CLASS, "h-full min-h-[30px]")}
          style={{ color: "#7f1d1d" }}
          placeholder="Ghi chú"
          value={value.note}
          onChange={(event) => set("note", event.target.value)}
          onBlur={onBlurField}
          onKeyDown={handleEnterToBlur}
        />
      </td>
    </>
  );
}

export function ShuttleClient({
  permissionLevel,
  initialResult,
  initialOptions,
  initialSaleAccounts,
  initialDriverAccounts,
  initialCompanies,
  canImport,
  canSheetSync,
  canSheetConfig,
}: {
  /** Quyền nhỏ (trang Phân quyền): Nhập Excel danh sách cũ / Đồng bộ Google Sheet / Cài đặt đồng bộ. */
  canImport: boolean;
  canSheetSync: boolean;
  canSheetConfig: boolean;
  permissionLevel: ModulePermissionLevel;
  initialResult: ShuttleListResult;
  initialOptions: ShuttleOptions;
  initialSaleAccounts: AccountOptionItem[];
  /** Bổ sung 2026-07-28 (yêu cầu trực tiếp người dùng: "chuyển cả 2 cột sang liên kết tài khoản thật") — GET /shuttle/driver-accounts (role='shuttle_staff'). */
  initialDriverAccounts: AccountOptionItem[];
  /** Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng" — GET /shuttle/companies, đọc từ OrderRecord (module Quản lý đơn hàng). */
  initialCompanies: ShuttleOptionItem[];
}) {
  useSetPageTitle("Danh sách đưa đón");
  // Dự án phụ — nâng cấp toàn diện (2026-07-24, "Phân quyền" phiên bản đơn
  // giản, Mục 2/6): "Chỉ xem" — khóa toàn bộ khối bảng bằng pointer-events
  // (chặn click/gõ chuột vào MỌI ô nhập/ComboCell/nút trong bảng mà không
  // cần sửa từng field riêng lẻ — ShuttleRowFormCells dùng chung cho cả
  // dòng nháp lẫn dòng dữ liệu, rất nhiều field). Backend (ModulePermissionGuard)
  // vẫn là lớp chặn thật sự — CSS này chỉ hỗ trợ UX, không phải bảo mật.
  const isReadOnly = permissionLevel === "view";
  const toast = useToast();
  const [records, setRecords] = useState(initialResult.items);
  const [total, setTotal] = useState(initialResult.total);
  const [page, setPage] = useState(initialResult.page);
  const [pageSize, setPageSize] = useState(initialResult.page_size);
  const [firstDayOffset, setFirstDayOffset] = useState(initialResult.first_day_offset ?? 0);
  // Bấm tiêu đề Ngày/STT/Giờ PV (yêu cầu người dùng 2026-10-30). Ref để
  // buildShuttleQuery đọc được ngay giá trị mới.
  const [sort, setSort] = useState<SortState<ShuttleSortKey>>({ key: "date", order: "desc" });
  const sortRef = useRef(sort);
  /** Chỉ có khi STT giảm dần: tổng số dòng từng ngày để đếm ngược STT. */
  const [dayCounts, setDayCounts] = useState<Record<string, number> | null>(null);
  /**
   * Cột STT (yêu cầu người dùng 2026-10-28): đánh số riêng theo từng ngày
   * (28/10: 1,2,3...; 29/10: 1,2...) theo đúng thứ tự đang hiển thị. Ngày
   * của dòng đầu trang có thể đã bắt đầu ở trang trước → nối tiếp từ
   * first_day_offset của backend.
   */
  const sttByRecordId = useMemo(() => {
    const map = new Map<string, number>();
    let currentDate: string | null = null;
    let n = 0;
    records.forEach((record, index) => {
      if (record.date !== currentDate) {
        currentDate = record.date;
        n = index === 0 ? firstDayOffset : 0;
      }
      ++n;
      // STT giảm dần: đếm ngược từ tổng số dòng của ngày.
      const dayTotal = dayCounts?.[record.date];
      map.set(record.id, dayTotal ? dayTotal - n + 1 : n);
    });
    return map;
  }, [records, firstDayOffset, dayCounts]);
  const [options, setOptions] = useState(initialOptions);
  // Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng"
  // — KHÔNG có cơ chế thêm/sửa/xóa nào trong trang Đưa đón nữa (quản lý
  // riêng ở trang Quản lý đơn hàng), nên chỉ đọc thẳng từ props, khớp đúng
  // cách saleOptions bên dưới derive từ initialSaleAccounts (không dùng
  // useState vì không có nơi nào trong file này setCompanies).
  const companies = initialCompanies;
  /**
   * Dựng lại thành ShuttleOptionItem[] để tái dùng ComboCell — TÊN (biệt
   * danh nếu có, khớp Mục biệt danh 2026-07-26 — không thì họ tên đầy đủ)
   * lấy từ tài khoản Sale thật (initialSaleAccounts), MÀU lấy từ
   * options.sales (ShuttleOption field="sale", khớp theo value=account.id
   * từ 2026-07-28 — trước đó khớp theo tên, xem "chuyển cả 2 cột sang liên
   * kết tài khoản thật"). Không cho gõ tay thêm tên mới — chỉ chọn màu cho
   * tài khoản đã có sẵn. `id` ở đây LÀ account.id thật (matchBy="id").
   */
  const saleOptions: ShuttleOptionItem[] = initialSaleAccounts.map((account) => {
    const matched = options.sales.find((option) => option.value === account.id);
    return {
      id: account.id,
      value: account.nickname ?? account.full_name,
      color_key: matched?.color_key ?? null,
      text_color_key: matched?.text_color_key ?? null,
    };
  });
  /** Bổ sung 2026-07-28 — y hệt saleOptions nhưng cho tài khoản Đưa đón (role='shuttle_staff'), khớp ShuttleOption field="driver". */
  const driverOptions: ShuttleOptionItem[] = initialDriverAccounts.map((account) => {
    const matched = options.drivers.find((option) => option.value === account.id);
    return {
      id: account.id,
      value: account.nickname ?? account.full_name,
      color_key: matched?.color_key ?? null,
      text_color_key: matched?.text_color_key ?? null,
    };
  });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<ShuttleFormValue>(emptyFormValue());
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [rowDrafts, setRowDrafts] = useState<Record<string, ShuttleFormValue>>(() => buildRowDrafts(initialResult.items));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [manageField, setManageField] = useState<{ field: string; label: string } | null>(null);
  const [isManagingSaleColors, setIsManagingSaleColors] = useState(false);
  const [isManagingDriverColors, setIsManagingDriverColors] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(100);
  const [showImport, setShowImport] = useState(false);
  const [showSheetSync, setShowSheetSync] = useState(false);

  /**
   * Dự án phụ — nâng cấp toàn diện: đo chiều cao THẬT của header hệ thống
   * (layout.tsx), thanh bộ lọc và chân trang bằng ResizeObserver — để bộ lọc
   * ghim đúng ngay dưới header, và khối cuộn của bảng có chiều cao TÍNH TRỰC
   * TIẾP bằng số (không dùng flex-1/flex-grow xuyên qua <table>) — đã thử
   * flex-1 2 lần liên tiếp nhưng <table> có thuật toán tính kích thước riêng,
   * không co giãn đúng theo flex-grow như div thường, khiến khối cuộn không
   * bị giới hạn chiều cao thật và cả trang bị cuộn theo thay vì chỉ cuộn nội
   * bộ bảng. Dùng chiều cao numeric tính từ 3 số đo thật (header + bộ lọc +
   * chân trang) — đúng kỹ thuật đã chứng minh hoạt động ở trang Data lao động
   * (candidates-client.tsx) — chỉ còn 1 hằng số nhỏ, ổn định (khoảng cách
   * margin/border tự viết, không phụ thuộc hệ thống) thay vì đoán cả khối.
   */
  const filterBarRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(48);
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

  /** Margin/border tự viết trong module này (mb-2 dưới bộ lọc, pt-3 trên chân trang, border Card) — hằng số nhỏ, ổn định, không phụ thuộc hệ thống. */
  const FIXED_SPACING = 8 + 12 + 2;
  const tableBoxHeight = `calc(100vh - ${headerHeight + filterHeight + footerHeight + FIXED_SPACING}px)`;

  function buildShuttleQuery(targetPage: number, targetPageSize: number, activeFilters: Filters): URLSearchParams {
    const query = new URLSearchParams({ page: String(targetPage), page_size: String(targetPageSize) });
    if (activeFilters.keyword) query.set("keyword", activeFilters.keyword);
    if (activeFilters.date.from) query.set("date_from", activeFilters.date.from);
    if (activeFilters.date.to) query.set("date_to", activeFilters.date.to);
    if (activeFilters.company_id) query.set("company_id", activeFilters.company_id);
    if (activeFilters.type) query.set("type", activeFilters.type);
    if (activeFilters.sale_user_id) query.set("sale_user_id", activeFilters.sale_user_id);
    if (activeFilters.driver_user_id) query.set("driver_user_id", activeFilters.driver_user_id);
    if (activeFilters.status) query.set("status", activeFilters.status);
    if (activeFilters.interview_result) query.set("interview_result", activeFilters.interview_result);
    applySortParams(query, sortRef.current);
    return query;
  }

  async function refresh(targetPage: number, targetPageSize: number, activeFilters: Filters) {
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    // Bỏ kết quả của lượt tải cũ về muộn (tìm kiếm khi gõ gọi liên tục).
    const seq = ++refreshSeqRef.current;
    const query = buildShuttleQuery(targetPage, targetPageSize, activeFilters);
    const result = await clientApi<ShuttleListResult>(`/shuttle?${query.toString()}`);
    if (seq !== refreshSeqRef.current) return;
    setRecords(result.items);
    setFirstDayOffset(result.first_day_offset ?? 0);
    setDayCounts(result.day_counts ?? null);
    setRowDrafts(buildRowDrafts(result.items));
    setTotal(result.total);
    setPage(result.page);
    setPageSize(result.page_size);
  }

  // Ghi nhớ bộ lọc + trang đang xem khi rời trang rồi quay lại (2026-11-10).
  useRememberedFilters("shuttle", { filters, page, pageSize }, (saved) => {
    setFilters(saved.filters);
    refresh(saved.page, saved.pageSize, saved.filters).catch(() => {});
  });

  /**
   * Yêu cầu người dùng (Mục 1, 7) — refetch nền cho realtime khi có dòng
   * MỚI xuất hiện, nhưng KHÔNG được ghi đè draft đang gõ dở của người dùng
   * (mọi ô ở trang này đều "luôn nhập được ngay", không có nút Sửa riêng —
   * xem comment "Mọi dòng dữ liệu đã có đều ở dạng nhập được ngay" phía
   * dưới) — so khớp draft hiện có với dữ liệu record CŨ (trước khi refetch)
   * để biết dòng nào đang dở dang, giữ nguyên draft đó thay vì ghi đè.
   */
  async function silentRefreshPreservingDrafts() {
    try {
      const query = buildShuttleQuery(page, pageSize, filters);
      const result = await clientApi<ShuttleListResult>(`/shuttle?${query.toString()}`);
      const priorRecordById = new Map(records.map((r) => [r.id, r]));
      setRecords(result.items);
      setFirstDayOffset(result.first_day_offset ?? 0);
      setDayCounts(result.day_counts ?? null);
      setTotal(result.total);
      setRowDrafts((prev) => {
        const next: Record<string, ShuttleFormValue> = {};
        for (const record of result.items) {
          const priorDraft = prev[record.id];
          const priorRecord = priorRecordById.get(record.id);
          const isDirty = priorDraft && priorRecord && !sameFormValue(priorDraft, formValueFromRecord(priorRecord));
          next[record.id] = isDirty ? priorDraft! : formValueFromRecord(record);
        }
        return next;
      });
    } catch {
      // bỏ qua lỗi tải nền — dữ liệu cũ vẫn hiển thị.
    }
  }

  /**
   * Mục 7, yêu cầu người dùng — "không tự ghi đè modal/form người dùng
   * đang nhập dở... hiển thị cảnh báo nhỏ". Đánh dấu dòng đang có xung đột
   * (người khác vừa cập nhật trong lúc mình đang gõ dở) — xem badge cảnh
   * báo ở phần render bảng bên dưới.
   */
  const [conflictRowIds, setConflictRowIds] = useState<Set<string>>(new Set());

  /**
   * Kéo thả đổi thứ tự dòng trong CÙNG 1 ngày, giống Excel (yêu cầu người
   * dùng 2026-11-10). Nắm biểu tượng ⋮⋮ ở ô STT kéo lên/xuống. Không kéo sang
   * ngày khác (đổi ngày thì sửa ô Ngày). Tắt khi đang sắp theo Giờ PV.
   */
  const canReorder = !isReadOnly && sort.key !== "interview_time";
  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);

  function endDrag() {
    dragIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  async function handleReorderDrop(targetId: string, after: boolean) {
    const sourceId = dragIdRef.current;
    endDrag();
    const source = records.find((r) => r.id === sourceId);
    if (!source || source.id === targetId) return;
    const date = source.date;
    const dayIds = records.filter((r) => r.date === date).map((r) => r.id);
    const without = dayIds.filter((id) => id !== source.id);
    const targetIndex = without.indexOf(targetId);
    if (targetIndex < 0) return;
    const nextDayIds = [...without];
    nextDayIds.splice(after ? targetIndex + 1 : targetIndex, 0, source.id);
    if (nextDayIds.every((id, i) => id === dayIds[i])) return;

    // Hiện ngay thứ tự mới (các dòng của 1 ngày luôn liền nhau trên trang).
    const byId = new Map(records.map((r) => [r.id, r]));
    let k = 0;
    setRecords(records.map((r) => (r.date === date ? byId.get(nextDayIds[k++])! : r)));

    // Máy chủ nhận thứ tự "STT tăng"; đang xem STT giảm thì đảo lại.
    const ids = sort.key === "stt" && sort.order === "desc" ? [...nextDayIds].reverse() : nextDayIds;
    try {
      await clientApi("/shuttle/reorder", { method: "PUT", body: JSON.stringify({ date, ids }) });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không lưu được thứ tự mới");
      await refresh(page, pageSize, filters).catch(() => {});
    }
  }

  function handleReloadConflictedRow(record: ShuttleRecord) {
    setRowDrafts((prev) => ({ ...prev, [record.id]: formValueFromRecord(record) }));
    setConflictRowIds((prev) => {
      if (!prev.has(record.id)) return prev;
      const next = new Set(prev);
      next.delete(record.id);
      return next;
    });
  }

  /**
   * Mục 1, 3, 4, 7 — đồng bộ realtime Danh sách đưa đón. Module này KHÔNG
   * có giới hạn RBAC theo bản ghi (mọi vai trò xem/sửa tự do — xem
   * shuttle.controller.ts), nên MỌI kết nối đều nhận event này; frontend
   * chỉ cần lọc đúng `module`.
   */
  function handleAppRealtimeEvent(event: AppRealtimeEvent) {
    if (event.module !== "transportation") return;
    if (event.action === "invalidate") {
      void silentRefreshPreservingDrafts();
      return;
    }

    if (event.action === "deleted") {
      const id = event.entity_id;
      if (!id) return;
      const wasShown = records.some((r) => r.id === id);
      if (!wasShown) return;
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTotal((t) => Math.max(0, t - 1));
      setConflictRowIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    const updated = event.payload as ShuttleRecord | undefined;
    if (!updated) return;

    const existing = records.find((r) => r.id === updated.id);
    if (existing) {
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const remote = formValueFromRecord(updated);
      const localDraft = rowDrafts[updated.id];
      const { value, conflict } = localDraft
        ? mergeRemoteFormValue(localDraft, formValueFromRecord(existing), remote)
        : { value: remote, conflict: false };
      setRowDrafts((prev) => ({ ...prev, [updated.id]: value }));
      setConflictRowIds((prev) => {
        if (conflict === prev.has(updated.id)) return prev;
        const next = new Set(prev);
        if (conflict) next.add(updated.id);
        else next.delete(updated.id);
        return next;
      });
      return;
    }

    if (event.action === "created") {
      void silentRefreshPreservingDrafts();
    }
  }

  useAppRealtime(handleAppRealtimeEvent);
  useRealtimeReconnect(() => void silentRefreshPreservingDrafts());

  async function refreshOptions() {
    const result = await clientApi<ShuttleOptions>("/shuttle/options");
    setOptions(result);
  }

  async function handleSearch() {
    await refresh(1, pageSize, filters);
  }

  /**
   * Gõ đến đâu lọc đến đó (yêu cầu người dùng 2026-10-29): chờ ngừng gõ
   * 350ms rồi lọc; xoá hết chữ = về toàn bộ data.
   */
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSeqRef = useRef(0);
  function handleSort(next: SortState<ShuttleSortKey>) {
    sortRef.current = next;
    setSort(next);
    void refresh(1, pageSize, filters);
  }
  function handleKeywordChange(keyword: string) {
    applyFiltersNow({ ...filters, keyword }, 350);
  }

  /** Đổi bộ lọc là lọc luôn, không cần bấm Tìm kiếm (yêu cầu người dùng 2026-10-30); ô gõ chữ chờ ngừng gõ. */
  function applyFiltersNow(nextFilters: Filters, delayMs = 0) {
    setFilters(nextFilters);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    keywordTimerRef.current = setTimeout(() => {
      refresh(1, pageSize, nextFilters).catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "Không tải được kết quả tìm kiếm");
      });
    }, delayMs);
  }

  async function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    await refresh(1, pageSize, EMPTY_FILTERS);
  }

  async function handlePageSizeChange(nextSize: number) {
    await refresh(1, nextSize, filters);
  }

  async function handleAddRow() {
    if (!draft.date || !draft.full_name.trim() || !draft.phone_number.trim()) {
      toast.error("Ngày, họ tên và số điện thoại không được để trống");
      return;
    }
    setIsSavingDraft(true);
    try {
      await clientApi("/shuttle", { method: "POST", body: JSON.stringify(draft) });
      setDraft(emptyFormValue());
      await Promise.all([refresh(1, pageSize, filters), refreshOptions()]);
      toast.success("Đã thêm dòng đưa đón mới");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsSavingDraft(false);
    }
  }

  /**
   * Lưu ngay khi rời khỏi 1 ô nhập tay, hoặc ngay khi chọn xong 1 giá trị
   * trong ComboCell (giống Google Sheet — không cần bấm nút "Lưu"). Nhận
   * thẳng giá trị cần lưu qua tham số `current` (không đọc lại rowDrafts từ
   * state cha) — ComboCell gọi hàm này ngay sau onChange trong cùng 1 lượt
   * xử lý sự kiện, setState của React chưa kịp áp dụng nên đọc lại state cũ
   * sẽ bị lưu nhầm giá trị trước đó. Bỏ qua nếu không có gì thay đổi so với
   * dữ liệu gốc, tránh gọi API thừa.
   */
  async function saveRowIfChanged(record: ShuttleRecord, current: ShuttleFormValue) {
    const original = formValueFromRecord(record);
    if (sameFormValue(current, original)) return;

    if (!current.date || !current.full_name.trim() || !current.phone_number.trim()) {
      toast.error("Ngày, họ tên và số điện thoại không được để trống");
      setRowDrafts((prev) => ({ ...prev, [record.id]: original }));
      return;
    }

    try {
      const updated = await clientApi<ShuttleRecord>(`/shuttle/${record.id}`, {
        method: "PUT",
        body: JSON.stringify(current),
      });
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setRowDrafts((prev) => ({ ...prev, [updated.id]: formValueFromRecord(updated) }));
      void refreshOptions();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
      setRowDrafts((prev) => ({ ...prev, [record.id]: original }));
    }
  }

  async function handleBlurRow(record: ShuttleRecord) {
    const current = rowDrafts[record.id];
    if (!current) return;
    await saveRowIfChanged(record, current);
  }

  async function handleDelete(record: ShuttleRecord) {
    // Giữ hỏi lại: xóa không hoàn tác được (người dùng xác nhận giữ, 2026-10-28).
    if (!window.confirm(`Xóa dòng đưa đón của "${record.full_name}"? Hành động này không thể hoàn tác.`)) {
      return;
    }
    setPendingId(record.id);
    try {
      await clientApi(`/shuttle/${record.id}`, { method: "DELETE" });
      await refresh(page, pageSize, filters);
      toast.success("Đã xóa dòng đưa đón");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    } finally {
      setPendingId(null);
    }
  }

  /**
   * Lưu 1 giá trị mới (kèm màu đã chọn) vào danh sách gợi ý dùng chung
   * (yêu cầu trực tiếp người dùng: "dữ liệu mới khi thêm thì được chọn màu
   * nền"). Ném lại lỗi để ComboCell biết dừng, không chọn giá trị chưa lưu
   * được vào ô.
   */
  /**
   * `textColorKey` là `undefined` (không truyền) khi gọi từ nơi CHỈ đổi màu
   * nền độc lập (vd SaleColorManagerModal — bấm 1 màu là lưu ngay) — dùng
   * JSON.stringify tự bỏ qua field "undefined" để backend GIỮ NGUYÊN màu
   * chữ đang có, không vô tình xóa mất khi chỉ đổi màu nền (và ngược lại).
   */
  async function handleAddOption(
    field: string,
    value: string,
    colorKey?: string | null,
    textColorKey?: string | null,
  ) {
    try {
      await clientApi("/shuttle/options", {
        method: "POST",
        body: JSON.stringify({ field, value, color_key: colorKey, text_color_key: textColorKey }),
      });
      await refreshOptions();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
      throw error;
    }
  }

  /** Sửa tên/màu 1 giá trị gợi ý đã có (yêu cầu trực tiếp người dùng: "nút chỉnh sửa những dữ liệu đã thêm"). */
  async function handleUpdateOption(
    optionId: string,
    value: string,
    colorKey: string | null,
    textColorKey?: string | null,
  ) {
    try {
      await clientApi(`/shuttle/options/${optionId}`, {
        method: "PUT",
        body: JSON.stringify({ value, color_key: colorKey, text_color_key: textColorKey }),
      });
      await refreshOptions();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
      throw error;
    }
  }

  /** Chỉ xóa khỏi danh sách gợi ý — không đụng dữ liệu các dòng đưa đón đã nhập (yêu cầu trực tiếp người dùng: "cho phép xoá dữ liệu cũ"). */
  async function handleDeleteOption(optionId: string) {
    try {
      await clientApi(`/shuttle/options/${optionId}`, { method: "DELETE" });
      await refreshOptions();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra");
    }
  }

  return (
    <div className="-mt-3 mx-auto max-w-[1700px]">
      {isReadOnly && (
        <div className="mb-2">
          <ViewOnlyBadge />
        </div>
      )}
      <div ref={filterBarRef} className="sticky z-20 bg-slate-50" style={{ top: headerHeight }}>
      <Card className="mb-2 flex flex-col gap-1.5 p-1.5">
      {/* Màn hình rộng: bộ lọc + nút Tìm kiếm/Xóa bộ lọc luôn 1 hàng (2026-11-08); điện thoại vẫn xuống dòng. */}
      <div className="flex flex-wrap items-end gap-1.5 xl:flex-nowrap">
        <Field uiSize="xs" label="Tìm theo tên hoặc SĐT" className="min-w-[160px] flex-1">
          <Input
            uiSize="xs"
            value={filters.keyword}
            onChange={(event) => handleKeywordChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
            placeholder="Tên hoặc số điện thoại"
          />
        </Field>
        <Field uiSize="xs" label="Thu phóng">
          <Select
            uiSize="xs"
            className="w-16"
            value={String(zoomLevel)}
            onChange={(event) => setZoomLevel(Number(event.target.value) as (typeof ZOOM_LEVELS)[number])}
          >
            {ZOOM_LEVELS.map((zoom) => (
              <option key={zoom} value={zoom}>
                {zoom}%
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Ngày" className="w-36">
          <DateRangePicker
            value={filters.date}
            onChange={(next) => applyFiltersNow({ ...filters, date: next })}
            placeholder="Tất cả"
            allowClear
          />
        </Field>
        <Field uiSize="xs" label="Công ty" className="w-28">
          <Select
            uiSize="xs"
            value={filters.company_id}
            onChange={(event) => applyFiltersNow({ ...filters, company_id: event.target.value })}
          >
            <option value="" style={EMPTY_OPTION_STYLE}>
              Tất cả
            </option>
            {companies.map((item) => (
              <option
                key={item.id}
                value={item.id}
                style={shuttleColorStyle(item.color_key, item.text_color_key) ?? EMPTY_OPTION_STYLE}
              >
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Loại hình" className="w-28">
          <Select
            uiSize="xs"
            value={filters.type}
            onChange={(event) => applyFiltersNow({ ...filters, type: event.target.value })}
          >
            <option value="" style={EMPTY_OPTION_STYLE}>
              Tất cả
            </option>
            {options.types.map((item) => (
              <option
                key={item.id}
                value={item.value}
                style={shuttleColorStyle(item.color_key, item.text_color_key) ?? EMPTY_OPTION_STYLE}
              >
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Sale" className="w-28">
          <Select
            uiSize="xs"
            value={filters.sale_user_id}
            onChange={(event) => applyFiltersNow({ ...filters, sale_user_id: event.target.value })}
          >
            <option value="" style={EMPTY_OPTION_STYLE}>
              Tất cả
            </option>
            {initialSaleAccounts.map((account) => (
              <option key={account.id} value={account.id} style={accountOptionStyle(options.sales, account.id)}>
                {account.nickname ?? account.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Nhân viên đưa đón" className="w-32">
          <Select
            uiSize="xs"
            value={filters.driver_user_id}
            onChange={(event) => applyFiltersNow({ ...filters, driver_user_id: event.target.value })}
          >
            <option value="" style={EMPTY_OPTION_STYLE}>
              Tất cả
            </option>
            {initialDriverAccounts.map((account) => (
              <option key={account.id} value={account.id} style={accountOptionStyle(options.drivers, account.id)}>
                {account.nickname ?? account.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Tình trạng" className="w-28">
          <Select
            uiSize="xs"
            value={filters.status}
            onChange={(event) => applyFiltersNow({ ...filters, status: event.target.value })}
          >
            <option value="" style={EMPTY_OPTION_STYLE}>
              Tất cả
            </option>
            {options.statuses.map((item) => (
              <option
                key={item.id}
                value={item.value}
                // Từng dòng tô đúng màu của lựa chọn (2026-11-06).
                style={shuttleColorStyle(item.color_key, item.text_color_key) ?? EMPTY_OPTION_STYLE}
              >
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Kết quả" className="w-28">
          <Select
            uiSize="xs"
            value={filters.interview_result}
            onChange={(event) => applyFiltersNow({ ...filters, interview_result: event.target.value })}
          >
            <option value="" style={EMPTY_OPTION_STYLE}>
              Tất cả
            </option>
            {options.interviewResults.map((item) => (
              <option
                key={item.id}
                value={item.value}
                // Từng dòng tô đúng màu của lựa chọn (2026-11-06).
                style={shuttleColorStyle(item.color_key, item.text_color_key) ?? EMPTY_OPTION_STYLE}
              >
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <div className="ml-auto flex shrink-0 items-end gap-1 whitespace-nowrap">
          <Button type="button" size="xs" variant="secondary" onClick={() => void handleSearch()}>
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            Tìm kiếm
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => void handleClearFilters()}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Xóa bộ lọc
          </Button>
          {canSheetSync && !isReadOnly && (
            <Button
              type="button"
              size="xs"
              variant="primary"
              className="!bg-emerald-600 !shadow-emerald-600/25 hover:!bg-emerald-700 focus-visible:!outline-emerald-600"
              title="Đồng bộ danh sách từ Google Sheet"
              onClick={() => setShowSheetSync(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Đồng bộ
            </Button>
          )}
          {canImport && !isReadOnly && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              title="Nhập Excel"
              aria-label="Nhập Excel"
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            </Button>
          )}
        </div>
      </div>
      </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-auto" style={{ height: tableBoxHeight }}>
          {/* Dự án phụ — nâng cấp toàn diện: bọc riêng <table> trong 1 div có
              "zoom" (không phải transform: scale) — zoom tính lại layout
              thật theo tỉ lệ mới nên bảng thu nhỏ đúng sẽ hiện được nhiều
              dòng hơn, không để lại khoảng trắng thừa như scale thường gặp;
              không zoom khối cuộn ngoài để chiều cao tableBoxHeight (tính từ
              px thật) không bị lệch. */}
          <div style={{ zoom: zoomLevel / 100 }}>
          <table
            className="w-full table-fixed border-collapse text-center text-sm"
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            <colgroup>
              <col className="w-[66px]" />
              <col className="w-[46px]" />
              {/* Tên lao động + SĐT tách 2 cột (trước gộp 1 cột 190px) — yêu cầu người dùng 2026-11-09. */}
              <col className="w-[160px]" />
              {/* SĐT 110→130 cho nút copy, rồi thu 10% còn 117 (2026-11-09). */}
              <col className="w-[117px]" />
              <col className="w-[130px]" />
              {/* Khu vực, Loại hình thu vừa tiêu đề (120→84, 110→94) — yêu cầu người dùng 2026-11-09. */}
              <col className="w-[84px]" />
              <col className="w-[94px]" />
              <col className="w-[120px]" />
              {/* NV Đưa đón +20% (140→168), Tình trạng +25% (110→138) — yêu cầu người dùng 2026-11-06. */}
              <col className="w-[168px]" />
              <col className="w-[90px]" />
              <col className="w-[98px]" />
              <col className="w-[138px]" />
              <col className="w-[110px]" />
              {/* Nguồn (Data/GT) — vừa đủ dữ liệu (yêu cầu người dùng 2026-11-04). */}
              <col className="w-[76px]" />
              <col className="w-[220px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#3f5d52] text-[11px] font-bold tracking-wide text-white uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)]">
              <tr>
                <SortableTh sortKey="date" sort={sort} onSort={handleSort} className="border-r border-slate-100 px-3 py-2.5">
                  Ngày
                </SortableTh>
                <SortableTh sortKey="stt" sort={sort} onSort={handleSort} className="border-r border-slate-100 px-1 py-2.5">
                  STT
                </SortableTh>
                <th className="border-r border-slate-100 px-3 py-2.5">Tên lao động</th>
                <th className="border-r border-slate-100 px-3 py-2.5">SĐT</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Công ty</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Khu vực</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Loại hình</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Sale</th>
                <th className="border-r border-slate-100 px-3 py-2.5">NV Đưa đón</th>
                <SortableTh
                  sortKey="interview_time"
                  sort={sort}
                  onSort={handleSort}
                  className="border-r border-slate-100 px-3 py-2.5"
                >
                  Giờ PV
                </SortableTh>
                <th className="border-r border-slate-100 px-3 py-2.5">Nhà thầu</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Tình trạng</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Kết quả</th>
                <th className="border-r border-slate-100 px-1 py-2.5">Nguồn</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Ghi chú</th>
                <th className="px-3 py-2.5">HĐ</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-brand-400", isReadOnly && "pointer-events-none")}>
              {/* Dòng nháp thêm mới — luôn hiện đầu bảng, nhập trực tiếp không cần popup. Yêu cầu trực tiếp người dùng (2026-07-18): nền màu xám để phân biệt rõ với các dòng dữ liệu đã có. */}
              <tr className="bg-slate-200">
                <ShuttleRowFormCells
                  value={draft}
                  onChange={setDraft}
                  options={options}
                  saleOptions={saleOptions}
                  driverOptions={driverOptions}
                  companyOptions={companies}
                  onManageOptions={(field, label) => setManageField({ field, label })}
                  onManageSaleColors={() => setIsManagingSaleColors(true)}
                  onManageDriverColors={() => setIsManagingDriverColors(true)}
                />
                <td className="px-2 py-1 align-middle">
                  <Button type="button" size="xs" disabled={isSavingDraft} onClick={() => void handleAddRow()}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Thêm
                  </Button>
                </td>
              </tr>

              {/* Mọi dòng dữ liệu đã có đều ở dạng nhập được ngay — không cần bấm "Sửa". */}
              {records.map((record, index) => {
                const value = rowDrafts[record.id] ?? formValueFromRecord(record);
                const hasConflict = conflictRowIds.has(record.id);
                // Sang ngày mới → dải xanh đậm ngăn cách (không chèn giữa dòng nháp và dòng đầu).
                const isNewDay = index > 0 && records[index - 1].date !== record.date;
                return (
                  <Fragment key={record.id}>
                  {isNewDay && <DaySeparatorRow colSpan={16} />}
                  <tr
                    className={cn(
                      "align-top transition-colors hover:bg-slate-50",
                      hasConflict && "bg-amber-50 hover:bg-amber-100",
                      draggingId === record.id && "opacity-40",
                      dropTarget?.id === record.id &&
                        (dropTarget.after
                          ? "shadow-[inset_0_-3px_0_0_#2563eb]"
                          : "shadow-[inset_0_3px_0_0_#2563eb]"),
                    )}
                    onDragOver={(event) => {
                      const source = records.find((r) => r.id === dragIdRef.current);
                      if (!source || source.date !== record.date || source.id === record.id) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      const rect = event.currentTarget.getBoundingClientRect();
                      const after = event.clientY > rect.top + rect.height / 2;
                      if (dropTarget?.id !== record.id || dropTarget.after !== after) {
                        setDropTarget({ id: record.id, after });
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dropTarget?.id === record.id) void handleReorderDrop(record.id, dropTarget.after);
                      else endDrag();
                    }}
                  >
                    <ShuttleRowFormCells
                      value={value}
                      stt={sttByRecordId.get(record.id)}
                      dragHandle={
                        canReorder ? (
                          <span
                            draggable
                            title="Kéo lên/xuống để đổi thứ tự trong ngày"
                            onDragStart={(event) => {
                              dragIdRef.current = record.id;
                              setDraggingId(record.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", record.id);
                              const row = event.currentTarget.closest("tr");
                              if (row) event.dataTransfer.setDragImage(row, 16, 12);
                            }}
                            onDragEnd={endDrag}
                            className="cursor-grab text-slate-300 hover:text-slate-600 active:cursor-grabbing"
                          >
                            <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                        ) : undefined
                      }
                      onChange={(next) => setRowDrafts((prev) => ({ ...prev, [record.id]: next }))}
                      onBlurField={() => void handleBlurRow(record)}
                      onCommitField={(next) => void saveRowIfChanged(record, next)}
                      options={options}
                      saleOptions={saleOptions}
                      driverOptions={driverOptions}
                      companyOptions={companies}
                      onManageOptions={(field, label) => setManageField({ field, label })}
                      onManageSaleColors={() => setIsManagingSaleColors(true)}
                      onManageDriverColors={() => setIsManagingDriverColors(true)}
                    />
                    <td className="px-2 py-1 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        {hasConflict && (
                          <button
                            type="button"
                            title="Dữ liệu này vừa được cập nhật bởi người khác — bấm để tải lại"
                            onClick={() => handleReloadConflictedRow(record)}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-amber-800 hover:bg-amber-200"
                          >
                            Vừa cập nhật — Tải lại
                          </button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={pendingId === record.id}
                          onClick={() => void handleDelete(record)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          Xóa
                        </Button>
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        {records.length === 0 && (
          <EmptyState
            title="Chưa có dòng đưa đón nào khớp bộ lọc"
            icon={<Search className="h-5 w-5" strokeWidth={1.75} />}
          />
        )}
      </Card>

      <div ref={footerRef} className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-slate-500">
        <span>
          Trang {page} — hiển thị {records.length} / {total} dòng
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs whitespace-nowrap">Số dòng/trang</span>
            <Select
              uiSize="xs"
              className="w-16"
              value={String(pageSize)}
              onChange={(event) => void handlePageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={page <= 1}
              onClick={() => void refresh(page - 1, pageSize, filters)}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={page * pageSize >= total}
              onClick={() => void refresh(page + 1, pageSize, filters)}
            >
              Sau
            </Button>
          </div>
        </div>
      </div>

      {manageField && (
        <ShuttleOptionManagerModal
          fieldLabel={manageField.label}
          options={options[OPTION_FIELD_KEYS[manageField.field]]}
          onAddOption={(value, colorKey, textColorKey) => handleAddOption(manageField.field, value, colorKey, textColorKey)}
          onUpdateOption={handleUpdateOption}
          onDeleteOption={handleDeleteOption}
          onClose={() => setManageField(null)}
          // Giá trị cố định Dashboard đếm theo — khớp LOCKED_SHUTTLE_OPTIONS ở backend.
          lockedValues={LOCKED_OPTION_VALUES[manageField.field]}
        />
      )}

      {isManagingSaleColors && (
        <AccountColorManagerModal
          title="Chỉnh sửa màu — Sale"
          emptyLabel="Chưa có tài khoản Sale nào đang hoạt động."
          accounts={initialSaleAccounts}
          colorOptions={options.sales}
          onSetColor={(accountId, colorKey) => handleAddOption("sale", accountId, colorKey)}
          onSetTextColor={(accountId, textColorKey) => handleAddOption("sale", accountId, undefined, textColorKey)}
          onClose={() => setIsManagingSaleColors(false)}
        />
      )}

      {isManagingDriverColors && (
        <AccountColorManagerModal
          title="Chỉnh sửa màu — Đưa đón"
          emptyLabel="Chưa có tài khoản Đưa đón nào đang hoạt động."
          accounts={initialDriverAccounts}
          colorOptions={options.drivers}
          onSetColor={(accountId, colorKey) => handleAddOption("driver", accountId, colorKey)}
          onSetTextColor={(accountId, textColorKey) => handleAddOption("driver", accountId, undefined, textColorKey)}
          onClose={() => setIsManagingDriverColors(false)}
        />
      )}

      {showSheetSync && (
        <ShuttleSheetSyncModal
          isAdmin={canSheetConfig}
          onClose={() => setShowSheetSync(false)}
          onSynced={() => void handleSearch()}
        />
      )}
      {showImport && (
        <ShuttleImportModal onClose={() => setShowImport(false)} onImported={() => void handleSearch()} />
      )}
    </div>
  );
}
