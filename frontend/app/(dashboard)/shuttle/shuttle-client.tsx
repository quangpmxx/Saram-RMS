"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { SHUTTLE_OPTION_COLORS, shuttleColorStyle } from "@/lib/shuttle-colors";
import type {
  AppRealtimeEvent,
  PaginatedResult,
  SaleAccountItem,
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { EMPTY_DATE_RANGE, type DateRangeValue } from "@/lib/date-range";

/**
 * Dự án phụ — nâng cấp toàn diện: ô "thả ra", không đóng khung (yêu cầu
 * trực tiếp người dùng — riêng cột Ngày/Thông tin lao động/Ghi chú, KHÁC
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
  company: "companies",
  area: "areas",
  type: "types",
  driver: "drivers",
  contractor: "contractors",
  status: "statuses",
  interview_result: "interviewResults",
  interview_time: "interviewTimes",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

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
  company: string;
  type: string;
  sale: string;
  driver: string;
  status: string;
  interview_result: string;
}

const EMPTY_FILTERS: Filters = {
  keyword: "",
  date: EMPTY_DATE_RANGE,
  company: "",
  type: "",
  sale: "",
  driver: "",
  status: "",
  interview_result: "",
};

interface ShuttleFormValue {
  date: string;
  full_name: string;
  phone_number: string;
  company: string;
  area: string;
  type: string;
  sale: string;
  driver: string;
  interview_time: string;
  contractor: string;
  status: string;
  interview_result: string;
  note: string;
}

function emptyFormValue(): ShuttleFormValue {
  return {
    date: todayISODate(),
    full_name: "",
    phone_number: "",
    company: "",
    area: "",
    type: "",
    sale: "",
    driver: "",
    interview_time: "",
    contractor: "",
    status: "",
    interview_result: "",
    note: "",
  };
}

function formValueFromRecord(record: ShuttleRecord): ShuttleFormValue {
  return {
    date: record.date,
    full_name: record.full_name,
    phone_number: record.phone_number,
    company: record.company ?? "",
    area: record.area ?? "",
    type: record.type ?? "",
    sale: record.sale ?? "",
    driver: record.driver ?? "",
    interview_time: record.interview_time ?? "",
    contractor: record.contractor ?? "",
    status: record.status ?? "",
    interview_result: record.interview_result ?? "",
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
}: {
  value: string;
  options: ShuttleOptionItem[];
  onSelect: (value: string) => void;
  /**
   * Mở popup quản lý (thêm/sửa/xóa) toàn bộ danh sách gợi ý của trường này —
   * để trống (undefined) để ẩn hẳn nút "Chỉnh sửa", dùng cho trường "Sale"
   * (nguồn lấy từ danh sách tài khoản thật, không cho tự thêm/sửa/xóa ở đây
   * nữa — yêu cầu trực tiếp người dùng).
   */
  onManageOptions?: () => void;
  /** Thu nhỏ nút hiển thị — riêng 2 ô "Tình trạng đón"/"Kết quả PV" xếp chồng trong cùng 1 cột (yêu cầu trực tiếp người dùng). */
  compact?: boolean;
  /** Chỉ đổi riêng cỡ chữ, giữ nguyên kích thước/kiểu ô — riêng cột "Sale" (yêu cầu trực tiếp người dùng: "cỡ chữ của cột sale để bé lại"). Bỏ qua nếu compact=true (compact đã tự quyết cỡ chữ riêng). */
  textClassName?: string;
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

  const currentOption = options.find((option) => option.value === value);
  const triggerStyle = shuttleColorStyle(currentOption?.color_key, currentOption?.text_color_key);

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
          {value || <span className="text-slate-400">Chọn</span>}
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
                    onClick={() => selectValue(option.value)}
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
function ColorPalette({ selected, onPick }: { selected: string | null; onPick: (key: string | null) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {SHUTTLE_OPTION_COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          title={c.label}
          onClick={() => onPick(c.key)}
          style={{ backgroundColor: c.backgroundColor }}
          className={cn(
            "h-5 w-5 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110",
            selected === c.key && "ring-2 ring-brand-500 ring-offset-1",
          )}
        />
      ))}
      <button
        type="button"
        title="Không màu"
        onClick={() => onPick(null)}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-inset ring-slate-300 hover:scale-110",
          selected === null && "ring-2 ring-brand-500 ring-offset-1",
        )}
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Dự án phụ — nâng cấp toàn diện: popup CHỈ chỉnh màu nền cho cột Sale (yêu
 * cầu trực tiếp người dùng: "cho thêm 1 bảng màu cho phép sửa được màu nền
 * khi ấn vào chỉnh sửa") — KHÁC ShuttleOptionManagerModal bên dưới: không
 * cho đổi tên/thêm mới/xóa tài khoản (tên lấy thẳng từ tài khoản Sale thật,
 * để sau này làm báo cáo khớp đúng), mỗi tài khoản chỉ có 1 bảng màu để
 * chọn, lưu ngay khi bấm màu (không cần nút "Lưu" riêng).
 */
function SaleColorManagerModal({
  saleAccounts,
  saleOptions,
  onSetColor,
  onSetTextColor,
  onClose,
}: {
  saleAccounts: SaleAccountItem[];
  saleOptions: ShuttleOptionItem[];
  onSetColor: (accountName: string, colorKey: string | null) => Promise<void>;
  /** Dự án phụ — nâng cấp toàn diện: màu CHỮ riêng, độc lập với onSetColor (màu nền) — yêu cầu trực tiếp người dùng. */
  onSetTextColor: (accountName: string, textColorKey: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);

  async function handlePick(account: SaleAccountItem, colorKey: string | null) {
    setPendingAccountId(account.id);
    try {
      await onSetColor(account.full_name, colorKey);
    } catch {
      // Lỗi đã báo qua toast ở cha (handleAddOption) — không cần xử lý thêm ở đây.
    } finally {
      setPendingAccountId(null);
    }
  }

  async function handlePickText(account: SaleAccountItem, textColorKey: string | null) {
    setPendingAccountId(account.id);
    try {
      await onSetTextColor(account.full_name, textColorKey);
    } catch {
      // Lỗi đã báo qua toast ở cha (handleAddOption) — không cần xử lý thêm ở đây.
    } finally {
      setPendingAccountId(null);
    }
  }

  return (
    <Modal
      title="Chỉnh sửa màu — Sale"
      maxWidth="max-w-lg"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {saleAccounts.length === 0 && (
          <p className="text-sm text-slate-400">Chưa có tài khoản Sale nào đang hoạt động.</p>
        )}
        {saleAccounts.map((account) => {
          const option = saleOptions.find((o) => o.value === account.full_name);
          const colorKey = option?.color_key ?? null;
          const textColorKey = option?.text_color_key ?? null;
          return (
            <div key={account.id} className="rounded-lg border border-slate-200 p-2.5">
              <span className="text-sm font-medium text-slate-800">{account.full_name}</span>
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
}: {
  fieldLabel: string;
  options: ShuttleOptionItem[];
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
            const style = shuttleColorStyle(option.color_key, option.text_color_key);
            return (
              <div key={option.id} className="rounded-lg border border-slate-200 p-2.5">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <Input uiSize="sm" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />
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
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="xs" onClick={() => startEdit(option)}>
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                        Sửa
                      </Button>
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
 * 7 trường Công ty/Khu vực/Loại hình/Sale/Nhân viên đưa đón/Nhà thầu/Trạng
 * thái dùng ComboCell (chọn từ trình đơn thả xuống, không gõ tay trực tiếp
 * — yêu cầu trực tiếp người dùng, có ảnh minh họa trình đơn Google Sheet).
 */
function ShuttleRowFormCells({
  value,
  onChange,
  onBlurField,
  onCommitField,
  options,
  saleOptions,
  onManageOptions,
  onManageSaleColors,
}: {
  value: ShuttleFormValue;
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
  /** Mở popup quản lý danh sách gợi ý (thêm/sửa/xóa) của 1 trong 7 trường "chọn" (không áp dụng cho Sale). */
  onManageOptions: (field: string, label: string) => void;
  /** Mở popup CHỈ chỉnh màu nền cho từng tài khoản Sale — không đổi tên/thêm/xóa tài khoản. */
  onManageSaleColors: () => void;
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
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <div className="flex flex-col gap-0">
          <input
            className={cn(PLAIN_FIELD_CLASS_LEFT, "font-bold")}
            placeholder="Họ tên"
            value={value.full_name}
            onChange={(event) => set("full_name", event.target.value)}
            onBlur={onBlurField}
            onKeyDown={handleEnterToBlur}
          />
          <input
            className={cn(PLAIN_FIELD_CLASS_LEFT, "font-bold")}
            style={{ color: "#1e3a8a" }}
            placeholder="SĐT"
            value={value.phone_number}
            onChange={(event) => set("phone_number", event.target.value)}
            onBlur={onBlurField}
            onKeyDown={handleEnterToBlur}
          />
        </div>
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.company}
          options={options.companies}
          onSelect={(v) => selectCombo("company", v)}
          onManageOptions={() => onManageOptions("company", "Công ty")}
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
          value={value.sale}
          options={saleOptions}
          onSelect={(v) => selectCombo("sale", v)}
          onManageOptions={onManageSaleColors}
          textClassName="text-[10px]"
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <ComboCell
          value={value.driver}
          options={options.drivers}
          onSelect={(v) => selectCombo("driver", v)}
          onManageOptions={() => onManageOptions("driver", "Nhân viên đưa đón")}
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
      <td className="border-r border-slate-100 px-2 py-1 align-middle">
        <textarea
          className={cn(PLAIN_FIELD_CLASS, "h-full min-h-[42px]")}
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
  initialResult,
  initialOptions,
  initialSaleAccounts,
}: {
  initialResult: PaginatedResult<ShuttleRecord>;
  initialOptions: ShuttleOptions;
  initialSaleAccounts: SaleAccountItem[];
}) {
  useSetPageTitle("Danh sách đưa đón", "Quản lý lịch đưa đón lao động.");
  const toast = useToast();
  const [records, setRecords] = useState(initialResult.items);
  const [total, setTotal] = useState(initialResult.total);
  const [page, setPage] = useState(initialResult.page);
  const [pageSize, setPageSize] = useState(initialResult.page_size);
  const [options, setOptions] = useState(initialOptions);
  /**
   * Dựng lại thành ShuttleOptionItem[] để tái dùng ComboCell — TÊN lấy từ
   * tài khoản Sale thật (initialSaleAccounts), MÀU lấy từ options.sales
   * (ShuttleOption field="sale", khớp theo value=họ tên — yêu cầu trực tiếp
   * người dùng: "cho thêm 1 bảng màu cho phép sửa được màu nền"). Không cho
   * gõ tay thêm tên mới — chỉ chọn màu cho tên đã có sẵn.
   */
  const saleOptions: ShuttleOptionItem[] = initialSaleAccounts.map((account) => {
    const matched = options.sales.find((option) => option.value === account.full_name);
    return {
      id: account.id,
      value: account.full_name,
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
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(100);

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
    if (activeFilters.company) query.set("company", activeFilters.company);
    if (activeFilters.type) query.set("type", activeFilters.type);
    if (activeFilters.sale) query.set("sale", activeFilters.sale);
    if (activeFilters.driver) query.set("driver", activeFilters.driver);
    if (activeFilters.status) query.set("status", activeFilters.status);
    if (activeFilters.interview_result) query.set("interview_result", activeFilters.interview_result);
    return query;
  }

  async function refresh(targetPage: number, targetPageSize: number, activeFilters: Filters) {
    const query = buildShuttleQuery(targetPage, targetPageSize, activeFilters);
    const result = await clientApi<PaginatedResult<ShuttleRecord>>(`/shuttle?${query.toString()}`);
    setRecords(result.items);
    setRowDrafts(buildRowDrafts(result.items));
    setTotal(result.total);
    setPage(result.page);
    setPageSize(result.page_size);
  }

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
      const result = await clientApi<PaginatedResult<ShuttleRecord>>(`/shuttle?${query.toString()}`);
      const priorRecordById = new Map(records.map((r) => [r.id, r]));
      setRecords(result.items);
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
      const localDraft = rowDrafts[updated.id];
      const isDirty = localDraft ? !sameFormValue(localDraft, formValueFromRecord(existing)) : false;
      if (isDirty) {
        setConflictRowIds((prev) => new Set(prev).add(updated.id));
      } else {
        setRowDrafts((prev) => ({ ...prev, [updated.id]: formValueFromRecord(updated) }));
      }
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
      <div ref={filterBarRef} className="sticky z-20 bg-slate-50" style={{ top: headerHeight }}>
      <Card className="mb-2 flex flex-col gap-1.5 p-1.5">
      <div className="flex flex-wrap items-end gap-1.5">
        <Field uiSize="xs" label="Tìm theo tên hoặc SĐT" className="min-w-[160px] flex-1">
          <Input
            uiSize="xs"
            value={filters.keyword}
            onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
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
            onChange={(next) => setFilters((prev) => ({ ...prev, date: next }))}
            placeholder="Tất cả"
            allowClear
          />
        </Field>
        <Field uiSize="xs" label="Công ty" className="w-28">
          <Select
            uiSize="xs"
            value={filters.company}
            onChange={(event) => setFilters((prev) => ({ ...prev, company: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {options.companies.map((item) => (
              <option key={item.id} value={item.value}>
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Loại hình" className="w-28">
          <Select
            uiSize="xs"
            value={filters.type}
            onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {options.types.map((item) => (
              <option key={item.id} value={item.value}>
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Sale" className="w-28">
          <Select
            uiSize="xs"
            value={filters.sale}
            onChange={(event) => setFilters((prev) => ({ ...prev, sale: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {initialSaleAccounts.map((account) => (
              <option key={account.id} value={account.full_name}>
                {account.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Nhân viên đưa đón" className="w-32">
          <Select
            uiSize="xs"
            value={filters.driver}
            onChange={(event) => setFilters((prev) => ({ ...prev, driver: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {options.drivers.map((item) => (
              <option key={item.id} value={item.value}>
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Tình trạng" className="w-28">
          <Select
            uiSize="xs"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {options.statuses.map((item) => (
              <option key={item.id} value={item.value}>
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Kết quả" className="w-28">
          <Select
            uiSize="xs"
            value={filters.interview_result}
            onChange={(event) => setFilters((prev) => ({ ...prev, interview_result: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {options.interviewResults.map((item) => (
              <option key={item.id} value={item.value}>
                {item.value}
              </option>
            ))}
          </Select>
        </Field>
        <div className="ml-auto flex flex-col gap-1">
          <Button type="button" size="xs" variant="secondary" onClick={() => void handleSearch()}>
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            Tìm kiếm
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => void handleClearFilters()}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Xóa bộ lọc
          </Button>
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
              <col className="w-[190px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[90px]" />
              <col className="w-[98px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[220px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#3f5d52] text-[11px] font-bold tracking-wide text-white uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)]">
              <tr>
                <th className="border-r border-slate-100 px-3 py-2.5">Ngày</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Thông tin lao động</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Công ty</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Khu vực</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Loại hình</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Sale</th>
                <th className="border-r border-slate-100 px-3 py-2.5">NV Đưa đón</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Giờ PV</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Nhà thầu</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Tình trạng</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Kết quả</th>
                <th className="border-r border-slate-100 px-3 py-2.5">Ghi chú</th>
                <th className="px-3 py-2.5">HĐ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-400">
              {/* Dòng nháp thêm mới — luôn hiện đầu bảng, nhập trực tiếp không cần popup. Yêu cầu trực tiếp người dùng (2026-07-18): nền màu xám để phân biệt rõ với các dòng dữ liệu đã có. */}
              <tr className="bg-slate-200">
                <ShuttleRowFormCells
                  value={draft}
                  onChange={setDraft}
                  options={options}
                  saleOptions={saleOptions}
                  onManageOptions={(field, label) => setManageField({ field, label })}
                  onManageSaleColors={() => setIsManagingSaleColors(true)}
                />
                <td className="px-2 py-1 align-middle">
                  <Button type="button" size="sm" disabled={isSavingDraft} onClick={() => void handleAddRow()}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Thêm
                  </Button>
                </td>
              </tr>

              {/* Mọi dòng dữ liệu đã có đều ở dạng nhập được ngay — không cần bấm "Sửa". */}
              {records.map((record) => {
                const value = rowDrafts[record.id] ?? formValueFromRecord(record);
                const hasConflict = conflictRowIds.has(record.id);
                return (
                  <tr
                    key={record.id}
                    className={cn(
                      "align-top transition-colors hover:bg-slate-50",
                      hasConflict && "bg-amber-50 hover:bg-amber-100",
                    )}
                  >
                    <ShuttleRowFormCells
                      value={value}
                      onChange={(next) => setRowDrafts((prev) => ({ ...prev, [record.id]: next }))}
                      onBlurField={() => void handleBlurRow(record)}
                      onCommitField={(next) => void saveRowIfChanged(record, next)}
                      options={options}
                      saleOptions={saleOptions}
                      onManageOptions={(field, label) => setManageField({ field, label })}
                      onManageSaleColors={() => setIsManagingSaleColors(true)}
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
                          size="sm"
                          disabled={pendingId === record.id}
                          onClick={() => void handleDelete(record)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          Xóa
                        </Button>
                      </div>
                    </td>
                  </tr>
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
        />
      )}

      {isManagingSaleColors && (
        <SaleColorManagerModal
          saleAccounts={initialSaleAccounts}
          saleOptions={options.sales}
          onSetColor={(accountName, colorKey) => handleAddOption("sale", accountName, colorKey)}
          onSetTextColor={(accountName, textColorKey) => handleAddOption("sale", accountName, undefined, textColorKey)}
          onClose={() => setIsManagingSaleColors(false)}
        />
      )}
    </div>
  );
}
