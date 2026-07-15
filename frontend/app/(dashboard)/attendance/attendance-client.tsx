"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, Loader2, Pencil, RotateCcw, Save, StickyNote } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  ACCOUNT_ROLE_LABEL,
  type AccountRole,
  type AttendanceBulkSavePayload,
  type AttendanceGrid,
  type AttendanceStatus,
  type Team,
  type TeamMember,
} from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { CheckinManagementPanel } from "./checkin-management-panel";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module hoàn toàn mới, yêu cầu trực tiếp người dùng): "Chấm
 * công thủ công" — thay gõ số "1" bằng click/tick. Xem attendance.service.ts
 * (backend) cho toàn bộ quy tắc RBAC/lưu dữ liệu; file này chỉ là giao diện.
 *
 * QUYẾT ĐỊNH ĐÃ GIẢN LƯỢC (Mục 4, bản đặc tả cho phép: "nếu thao tác nâng
 * cao làm phức tạp quá, ưu tiên ít nhất: click 1 lần = Có công / menu chọn
 * trạng thái khác / lưu hàng loạt"):
 * - Bỏ "chọn nhiều ô bằng kéo chuột" và "Sao chép tuần/tháng trước" — vẫn
 *   giữ thao tác nhanh "click tiêu đề ngày" (chấm hàng loạt cho cả ngày) +
 *   nút "Xóa toàn bộ trạng thái chưa lưu" thay cho Undo đầy đủ (đủ dùng làm
 *   lưới an toàn khi chấm hàng loạt). Riêng "click dòng nhân viên" ban đầu
 *   dùng để chấm cả tháng — ĐÃ ĐỔI công dụng, xem CẬP NHẬT 2026-07-15 bên dưới.
 * - "Đi muộn/về sớm...kèm ghi chú nếu cần" gộp thành 1 field ghi chú tự do
 *   đi kèm MỌI trạng thái (không tách thành trạng thái riêng, không có ký
 *   hiệu/màu riêng trong bản đặc tả Mục 3).
 * - Không có nút "Xuất Excel" — bản đặc tả chỉ yêu cầu "NẾU hệ thống đã có
 *   chức năng xuất dữ liệu" (Mục 1); đã rà soát toàn bộ codebase, chưa có
 *   export Excel ở bất kỳ trang nào (chỉ có NHẬP), nên bỏ qua theo đúng điều
 *   kiện đã nêu thay vì tự xây cả hạ tầng xuất file mới.
 * - Danh sách nhân viên hiện trong bảng = vai trò leader/mkt/sale — khớp
 *   đúng danh sách vai trò đã thấy nút "Chấm công" ở header (layout.tsx: mọi
 *   vai trò TRỪ Admin/Quản lý) — giả định hợp lý, CHƯA có tài liệu nghiệp vụ
 *   xác nhận riêng cho module này.
 * - "Đánh dấu có công toàn bộ ngày làm việc chưa chấm" (click dòng, "ngày
 *   làm việc" = Thứ 2–Thứ 7 loại Chủ nhật) — Ý NÀY ĐÃ BỊ THAY THẾ, xem CẬP
 *   NHẬT 2026-07-15 bên dưới, giữ lại đoạn này chỉ để biết lý do ban đầu của
 *   quy tắc "loại Chủ nhật" (khớp cách Chủ nhật tô màu riêng, Mục 1).
 *
 * CẬP NHẬT 2026-07-14 (yêu cầu trực tiếp người dùng, sau khi module đã chạy):
 * - Thêm "Thu phóng" (%) trên bộ lọc, y hệt trang Đưa đón — dùng CSS `zoom`
 *   (không phải `transform: scale`) bọc RIÊNG <table>, không bọc khối cuộn
 *   ngoài, cùng lý do đã ghi ở shuttle-client.tsx: zoom tính lại layout thật
 *   theo tỉ lệ mới nên thu nhỏ đúng sẽ hiện nhiều dòng hơn, không để lại
 *   khoảng trắng thừa như scale.
 * - Đúp chuột (double-click) vào 1 ô = xóa trạng thái ô đó (dù đang chờ lưu
 *   hay đã lưu trước đó) — thao tác nhanh để hoàn tác click nhầm, tách biệt
 *   khỏi luồng "click 2 lần rời rạc mở menu" cũ bằng cách trì hoãn click đơn
 *   ~220ms để phân biệt với dblclick thật (xem AttendanceCellButton).
 *
 * CẬP NHẬT 2026-07-15 (yêu cầu trực tiếp người dùng):
 * - Click tên nhân viên KHÔNG còn tự chấm "Có công" cả tháng nữa (hành vi
 *   cũ ở Mục 4 bản đặc tả gốc) — đổi thành mở modal "Thông tin nhân viên"
 *   (infoModalEmployee). Nội dung modal hiện chỉ gồm dữ liệu ĐÃ CÓ SẴN
 *   (vai trò, vị trí, nhóm, trạng thái tài khoản, tổng công tháng đang
 *   xem) + 1 dòng placeholder rõ ràng cho "số ngày phép còn lại" — người
 *   dùng xác nhận sẽ phát triển nghiệp vụ này sau, KHÔNG tự bịa số liệu.
 * - Thêm field Account.position (chức vụ tùy chỉnh, sửa tay được qua icon
 *   bút chì ở cột "Vị trí") — xem attendance.service.ts, không thay thế
 *   `role`. Header + cột "Vị trí" đã căn giữa (trước đó lệch trái).
 */

const STATUS_ORDER: AttendanceStatus[] = ["present", "half", "paid_leave", "unpaid_leave", "holiday", "compensatory_leave"];

const STATUS_META: Record<AttendanceStatus, { symbol: string; label: string; bg: string; text: string }> = {
  present: { symbol: "✓", label: "Có công", bg: "bg-emerald-100", text: "text-emerald-700" },
  half: { symbol: "½", label: "Nửa công", bg: "bg-amber-100", text: "text-amber-700" },
  paid_leave: { symbol: "NP", label: "Nghỉ phép", bg: "bg-sky-100", text: "text-sky-700" },
  unpaid_leave: { symbol: "N", label: "Nghỉ không phép", bg: "bg-red-100", text: "text-red-700" },
  holiday: { symbol: "L", label: "Nghỉ lễ", bg: "bg-purple-100", text: "text-purple-700" },
  compensatory_leave: { symbol: "B", label: "Nghỉ bù", bg: "bg-indigo-100", text: "text-indigo-700" },
};

const WORK_UNITS: Record<AttendanceStatus, number> = {
  present: 1,
  half: 0.5,
  paid_leave: 0,
  unpaid_leave: 0,
  holiday: 0,
  compensatory_leave: 0,
};

const EMPLOYEE_ROLES: AccountRole[] = ["leader", "mkt", "sale"];

/** Y hệt danh sách mức thu phóng của trang Đưa đón (shuttle-client.tsx) — yêu cầu trực tiếp người dùng. */
const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200] as const;

/** Trì hoãn phân biệt click đơn / đúp chuột (Mục yêu cầu người dùng 2026-07-14). */
const CLICK_DELAY_MS = 220;

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEAR_OPTIONS = (() => {
  const nowYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => nowYear - 3 + i);
})();

function cellKey(accountId: string, date: string): string {
  return `${accountId}__${date}`;
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" cho dễ đọc — dùng ở modal "Thông tin nhân viên". */
function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

interface PendingCell {
  status: AttendanceStatus;
  note?: string;
}

interface MenuState {
  anchorRect: DOMRect;
  /** null = menu của tiêu đề ngày (áp cho toàn bộ nhân viên đang hiện), khác null = menu của 1 ô */
  accountId: string | null;
  date: string;
}

/**
 * Popup ghi chú tự do cho 1 ô (yêu cầu trực tiếp người dùng, 2026-07-15):
 * "cho phép sửa ghi chú... giống như Google Sheet" — thay tooltip hover
 * (gây khó chịu, hiện ngay cả khi không cần) bằng: 1 tam giác nhỏ báo hiệu
 * ô đang có ghi chú (góc trên-phải), mở popup nhập tự do qua menu chuột
 * phải/menu trạng thái. Chỉ áp dụng cho 1 ô cụ thể (accountId khác null) —
 * ô phải có sẵn trạng thái vì `note` gắn liền `status` ở backend
 * (attendance_records.status NOT NULL).
 */
interface NoteEditorState {
  anchorRect: DOMRect;
  accountId: string;
  date: string;
  initialValue: string;
}

function StatusMenu({
  state,
  npDisabled,
  hasStatus,
  onPick,
  onClear,
  onEditNote,
  onClose,
}: {
  state: MenuState;
  /** Yêu cầu trực tiếp người dùng (2026-07-15): hết ngày phép thì không tick được NP nữa — làm mờ + khóa nút này. */
  npDisabled: boolean;
  /** Ô đã có trạng thái chưa — "Ghi chú" chỉ dùng được khi có, vì note gắn liền status ở backend. */
  hasStatus: boolean;
  onPick: (status: AttendanceStatus) => void;
  onClear: () => void;
  onEditNote: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const { anchorRect } = state;
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 260);
  const left = Math.min(anchorRect.left, window.innerWidth - 176);

  return createPortal(
    <div
      ref={ref}
      style={{ top, left }}
      className="fixed z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg shadow-slate-900/10"
    >
      {state.accountId === null && (
        <p className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
          Áp dụng cho cả ngày
        </p>
      )}
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const disabled = status === "paid_leave" && npDisabled;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            title={disabled ? "Đã hết ngày phép còn lại" : undefined}
            onClick={() => onPick(status)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50",
              disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold", meta.bg, meta.text)}>
              {meta.symbol}
            </span>
            {meta.label}
            {disabled && <span className="ml-auto text-[10px] text-slate-400">Hết phép</span>}
          </button>
        );
      })}
      <div className="my-1 border-t border-slate-100" />
      <button
        type="button"
        onClick={onClear}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300">—</span>
        Xóa trạng thái
      </button>
      {state.accountId !== null && (
        <button
          type="button"
          disabled={!hasStatus}
          title={!hasStatus ? "Chọn trạng thái cho ô này trước khi thêm ghi chú" : undefined}
          onClick={onEditNote}
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50",
            !hasStatus && "cursor-not-allowed opacity-40 hover:bg-transparent",
          )}
        >
          <StickyNote className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} />
          Ghi chú...
        </button>
      )}
    </div>,
    document.body,
  );
}

/**
 * Popup nhập ghi chú tự do (yêu cầu trực tiếp người dùng, 2026-07-15) —
 * "giống như Google Sheet": textarea nhỏ neo cạnh ô, gõ xong bấm ra ngoài
 * để lưu (auto-save khi blur, giống Sheets), Escape để hủy không lưu.
 */
function NoteEditorPopover({
  anchorRect,
  initialValue,
  onSave,
  onClose,
}: {
  anchorRect: DOMRect;
  initialValue: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onSave(value);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [value, onSave, onClose]);

  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 140);
  const left = Math.min(anchorRect.left, window.innerWidth - 224);

  return createPortal(
    <div
      ref={ref}
      style={{ top, left }}
      className="fixed z-30 w-56 rounded-lg border border-amber-300 bg-amber-50 p-2 shadow-lg shadow-slate-900/10"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Nhập ghi chú cho ngày này..."
        rows={3}
        maxLength={255}
        className="w-full resize-y rounded border border-amber-200 bg-white p-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">Bấm ra ngoài để lưu</span>
        {value && (
          <button
            type="button"
            onClick={() => onSave("")}
            className="text-[10px] font-medium text-red-500 hover:text-red-600"
          >
            Xóa ghi chú
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Đúp chuột = xóa trạng thái (Mục yêu cầu người dùng 2026-07-14). Trình
 * duyệt bắn 2 sự kiện `click` RỜI RẠC trước khi bắn `dblclick` — nếu xử lý
 * click ngay lập tức, đúp chuột sẽ vô tình mở menu (từ click #2, vì lúc đó
 * ô đã có trạng thái từ click #1) TRƯỚC khi dblclick kịp xóa. Khắc phục
 * bằng cách trì hoãn hành động click đơn ~220ms trong 1 timer cục bộ; nếu
 * dblclick tới trước khi timer chạy, hủy timer đó và xóa ô thay vào đó.
 */
function AttendanceCellButton({
  cell,
  isSunday,
  canEdit,
  onMark,
  onOpenMenu,
  onClear,
}: {
  cell: PendingCell | null;
  isSunday: boolean;
  canEdit: boolean;
  /** Click đơn trên ô trống — chấm nhanh "Có công". */
  onMark: () => void;
  /** Click đơn trên ô đã có trạng thái, hoặc chuột phải bất kỳ lúc nào — mở menu chọn trạng thái khác. */
  onOpenMenu: (anchorRect: DOMRect) => void;
  /** Đúp chuột — xóa hẳn trạng thái ô này. */
  onClear: () => void;
}) {
  const meta = cell ? STATUS_META[cell.status] : null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  function handleClick() {
    if (!canEdit) return;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (cell === null) {
        onMark();
      } else if (buttonRef.current) {
        onOpenMenu(buttonRef.current.getBoundingClientRect());
      }
    }, CLICK_DELAY_MS);
  }

  function handleDoubleClick() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (!canEdit) return;
    onClear();
  }

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (!canEdit || !buttonRef.current) return;
    onOpenMenu(buttonRef.current.getBoundingClientRect());
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={!canEdit}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "relative flex h-9 w-12 items-center justify-center border-r border-b border-slate-200 text-[11px] font-bold transition-colors",
        meta ? `${meta.bg} ${meta.text}` : isSunday ? "bg-red-50/60 hover:bg-red-100/70" : "bg-white hover:bg-slate-50",
        canEdit ? "cursor-pointer" : "cursor-default",
      )}
    >
      {meta?.symbol ?? ""}
      {/* Tam giác báo hiệu ô có ghi chú, giống Google Sheets/Excel — chỉ hover
          đúng góc này mới hiện tooltip nội dung ghi chú (yêu cầu trực tiếp
          người dùng, 2026-07-15: bỏ tooltip hiện trên toàn ô). */}
      {cell?.note && (
        <span
          title={cell.note}
          className="absolute top-0 right-0 h-0 w-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent"
        />
      )}
    </button>
  );
}

export function AttendanceClient({
  currentUserRole,
  canFilterByTeam,
  canFilterByAccount,
  teams,
  accountOptions,
  initialYear,
  initialMonth,
  initialGrid,
}: {
  currentUserId: string;
  currentUserRole: AccountRole;
  canFilterByTeam: boolean;
  canFilterByAccount: boolean;
  teams: Team[];
  accountOptions: TeamMember[];
  initialYear: number;
  initialMonth: number;
  initialGrid: AttendanceGrid;
}) {
  useSetPageTitle("Chấm công nhân viên");
  const toast = useToast();

  /**
   * Tab "Check in GPS" (2026-07-15, yêu cầu trực tiếp người dùng, Mục 11):
   * "trang quản lý Check in" nằm TRONG module Chấm công hiện có — thêm 1 tab
   * bên cạnh bảng chấm công thủ công thay vì route riêng, để không đụng vào
   * chức năng chấm công thủ công (Mục 12: "Không sửa chức năng chấm công
   * thủ công hiện tại"). Tab "manual" giữ nguyên state/logic cũ y hệt.
   */
  const [activeTab, setActiveTab] = useState<"manual" | "checkin">("manual");

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [teamId, setTeamId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(100);
  const [grid, setGrid] = useState(initialGrid);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);
  /**
   * Yêu cầu trực tiếp người dùng (2026-07-15): bấm tên nhân viên TRƯỚC ĐÂY
   * tự chấm công cả tháng (Mục 4, bản đặc tả gốc) — nay đổi thành mở bảng
   * thông tin cá nhân. Nội dung thông tin (số ngày phép còn lại...) sẽ phát
   * triển sau — hiện chỉ hiện các trường đã có sẵn + 1 dòng "đang phát
   * triển", không tự bịa số liệu.
   */
  const [infoModalEmployee, setInfoModalEmployee] = useState<AttendanceGrid["employees"][number] | null>(null);

  // Sửa tay tên vị trí (yêu cầu trực tiếp người dùng, 2026-07-15) — lưu
  // ngay khi rời ô/Enter (khác cơ chế "Lưu thay đổi" hàng loạt của lưới
  // chấm công, vì đây là 1 field riêng của account, không phải 1 ô trong
  // pending Map).
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [positionDraft, setPositionDraft] = useState("");
  const [savingPosition, setSavingPosition] = useState(false);

  const [pending, setPending] = useState<Map<string, PendingCell | null>>(new Map());

  /**
   * Ghim cố định thanh tiêu đề bảng khi cuộn (yêu cầu trực tiếp người dùng,
   * 2026-07-14) — y hệt kỹ thuật đã dùng ở shuttle-client.tsx: cho khối cuộn
   * bảng 1 CHIỀU CAO THẬT tính bằng số (không dùng flex-1 xuyên qua
   * <table> — <table> có thuật toán kích thước riêng, không co giãn đúng
   * theo flex-grow), đo bằng ResizeObserver 3 phần: header hệ thống
   * (layout.tsx) + bộ lọc + chú thích màu bên dưới bảng. Bảng tự cuộn nội
   * bộ (cả ngang lẫn dọc) trong khối này — sticky header dính đúng vào
   * khối cuộn NÀY. Lý do BẮT BUỘC cần cách này thay vì chỉ "sticky top-0"
   * đơn thuần trên khối overflow-x-auto: theo chuẩn CSS, hễ overflow-x
   * khác "visible" thì overflow-y cũng TỰ ĐỘNG được trình duyệt tính thành
   * "auto" (không có cách nào ép về "visible" lại bằng CSS) — nghĩa là
   * khối cuộn ngang của bảng luôn tự trở thành "vùng cuộn" cho
   * position:sticky, khiến header chỉ dính khi cuộn NỘI BỘ khối đó, không
   * bao giờ dính được theo cuộn của cả trang nếu khối đó không tự giới hạn
   * chiều cao — đã xác nhận lỗi này bằng đo trực tiếp DOM qua Chrome thật.
   */
  const filterBarRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [filterHeight, setFilterHeight] = useState(50);
  const [legendHeight, setLegendHeight] = useState(32);

  useEffect(() => {
    const headerEl = document.querySelector("header");
    const filterEl = filterBarRef.current;
    const legendEl = legendRef.current;
    if (!headerEl || !filterEl || !legendEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.getBoundingClientRect().height;
        if (entry.target === headerEl) setHeaderHeight(height);
        else if (entry.target === filterEl) setFilterHeight(height);
        else if (entry.target === legendEl) setLegendHeight(height);
      }
    });
    observer.observe(headerEl);
    observer.observe(filterEl);
    observer.observe(legendEl);
    return () => observer.disconnect();
  }, []);

  /** Margin/border tự viết trong module này (space-y-4 x2, border Card) — hằng số nhỏ ổn định, không phụ thuộc hệ thống. */
  const FIXED_SPACING = 16 + 16 + 2;
  const tableBoxHeight = `calc(100vh - ${headerHeight + filterHeight + legendHeight + FIXED_SPACING}px)`;

  const isDirty = pending.size > 0;

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const savedByKey = useMemo(() => {
    const map = new Map<string, PendingCell>();
    for (const record of grid.records) {
      map.set(cellKey(record.account_id, record.date), { status: record.status, note: record.note ?? undefined });
    }
    return map;
  }, [grid.records]);

  function effectiveCell(accountId: string, date: string): PendingCell | null {
    const key = cellKey(accountId, date);
    if (pending.has(key)) return pending.get(key) ?? null;
    return savedByKey.get(key) ?? null;
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-15): "tick NP thì trừ 1 ngày phép,
   * hết phép thì không tick được NP nữa". Số dư HIỆU LỰC = số đã lưu
   * (employee.remaining_leave_days, `null` coi như 0) trừ đi NET số ô NP
   * đang thay đổi CỤC BỘ (chưa lưu) — logic tính NET giống hệt
   * checkAndComputeNpBalanceChanges() ở backend (attendance.service.ts) để
   * giao diện chặn đúng những gì backend sẽ chặn, tránh trải nghiệm
   * "tưởng chấm được nhưng lưu lại báo lỗi".
   */
  const effectiveLeaveBalanceByAccount = useMemo(() => {
    const deltaByAccount = new Map<string, number>();
    for (const [key, pendingCell] of pending) {
      const separatorIndex = key.indexOf("__");
      const accId = key.slice(0, separatorIndex);
      const wasNP = savedByKey.get(key)?.status === "paid_leave";
      const willBeNP = pendingCell?.status === "paid_leave";
      if (wasNP !== willBeNP) {
        const delta = (willBeNP ? 1 : 0) - (wasNP ? 1 : 0);
        deltaByAccount.set(accId, (deltaByAccount.get(accId) ?? 0) + delta);
      }
    }
    const map = new Map<string, number>();
    for (const employee of grid.employees) {
      const base = employee.remaining_leave_days ?? 0;
      map.set(employee.account_id, base - (deltaByAccount.get(employee.account_id) ?? 0));
    }
    return map;
  }, [grid.employees, savedByKey, pending]);

  /** Có thể chấm NP cho (accountId, date) này không — đã là NP rồi (re-pick, không tốn thêm) hoặc còn số dư > 0. */
  function canPickNP(accountId: string, date: string): boolean {
    const alreadyNP = effectiveCell(accountId, date)?.status === "paid_leave";
    if (alreadyNP) return true;
    return (effectiveLeaveBalanceByAccount.get(accountId) ?? 0) > 0;
  }

  async function loadGrid(overrides?: { year?: number; month?: number; teamId?: string; accountId?: string; includeInactive?: boolean }) {
    if (isDirty) {
      const proceed = window.confirm("Bạn có thay đổi chưa lưu. Chuyển bộ lọc sẽ mất các thay đổi này — tiếp tục?");
      if (!proceed) return;
    }
    const nextYear = overrides?.year ?? year;
    const nextMonth = overrides?.month ?? month;
    const nextTeamId = overrides?.teamId ?? teamId;
    const nextAccountId = overrides?.accountId ?? accountId;
    const nextIncludeInactive = overrides?.includeInactive ?? includeInactive;

    const query = new URLSearchParams({ year: String(nextYear), month: String(nextMonth) });
    if (canFilterByTeam && nextTeamId) query.set("team_id", nextTeamId);
    if (canFilterByAccount && nextAccountId) query.set("account_id", nextAccountId);
    if (nextIncludeInactive) query.set("include_inactive", "true");

    setLoading(true);
    try {
      const nextGrid = await clientApi<AttendanceGrid>(`/attendance?${query.toString()}`);
      setGrid(nextGrid);
      setPending(new Map());
      setYear(nextYear);
      setMonth(nextMonth);
      setTeamId(nextTeamId);
      setAccountId(nextAccountId);
      setIncludeInactive(nextIncludeInactive);
    } catch {
      toast.error("Không tải được dữ liệu chấm công, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (2026-07-15, yêu cầu trực tiếp người
   * dùng): "tải xuống Excel cho bảng chấm công" — xuất ĐÚNG bộ lọc đang xem
   * trên màn hình (cùng tham số với loadGrid()). Đây là file tải xuống thật
   * (Content-Disposition: attachment từ backend), không phải JSON, nên
   * không dùng clientApi() — mở thẳng URL bằng window.open(), cookie phiên
   * đăng nhập vẫn tự đính kèm vì backend/frontend cùng domain "localhost"
   * (cookie không phân biệt theo port), khớp cách clientApi() đã hoạt động.
   */
  function buildExportUrl(): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const query = new URLSearchParams({ year: String(year), month: String(month) });
    if (canFilterByTeam && teamId) query.set("team_id", teamId);
    if (canFilterByAccount && accountId) query.set("account_id", accountId);
    if (includeInactive) query.set("include_inactive", "true");
    return `${base}/attendance/export?${query.toString()}`;
  }

  function startEditPosition(employee: AttendanceGrid["employees"][number]) {
    if (!grid.can_edit) return;
    setEditingPositionId(employee.account_id);
    setPositionDraft(employee.position ?? ACCOUNT_ROLE_LABEL[employee.role]);
  }

  function cancelEditPosition() {
    setEditingPositionId(null);
    setPositionDraft("");
  }

  async function saveEditPosition(accountId: string) {
    setSavingPosition(true);
    try {
      const result = await clientApi<{ account_id: string; position: string | null }>(
        `/attendance/employee/${accountId}/position`,
        { method: "PUT", body: JSON.stringify({ position: positionDraft }) },
      );
      setGrid((prev) => ({
        ...prev,
        employees: prev.employees.map((e) => (e.account_id === accountId ? { ...e, position: result.position } : e)),
      }));
      toast.success("Đã cập nhật vị trí.");
    } catch {
      toast.error("Không cập nhật được vị trí, vui lòng thử lại.");
    } finally {
      setSavingPosition(false);
      setEditingPositionId(null);
      setPositionDraft("");
    }
  }

  function setCellLocal(accountId: string, date: string, status: AttendanceStatus) {
    // Giữ nguyên ghi chú đã có khi chỉ đổi trạng thái — tránh mất ghi chú
    // vừa nhập chỉ vì đổi ý trạng thái (yêu cầu trực tiếp người dùng, 2026-07-15).
    const existingNote = effectiveCell(accountId, date)?.note;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(cellKey(accountId, date), { status, note: existingNote });
      return next;
    });
  }

  function setCellNoteLocal(accountId: string, date: string, note: string) {
    const current = effectiveCell(accountId, date);
    if (!current) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(cellKey(accountId, date), { status: current.status, note: note.trim() ? note.trim() : undefined });
      return next;
    });
  }

  function clearCellLocal(accountId: string, date: string) {
    const key = cellKey(accountId, date);
    setPending((prev) => {
      const next = new Map(prev);
      if (savedByKey.has(key)) {
        next.set(key, null); // đánh dấu XÓA (khác với "chưa đụng tới")
      } else {
        next.delete(key); // chưa từng lưu — bỏ khỏi danh sách chờ lưu là đủ
      }
      return next;
    });
  }

  function openMenuForCell(accountId: string, date: string, anchorRect: DOMRect) {
    if (!grid.can_edit) return;
    setMenu({ anchorRect, accountId, date });
  }

  function openColumnMenu(event: React.MouseEvent, date: string) {
    if (!grid.can_edit) return;
    setMenu({
      anchorRect: (event.currentTarget as HTMLElement).getBoundingClientRect(),
      accountId: null,
      date,
    });
  }

  function handleMenuPick(status: AttendanceStatus) {
    if (!menu) return;
    if (menu.accountId) {
      if (status === "paid_leave" && !canPickNP(menu.accountId, menu.date)) {
        toast.error("Nhân viên đã hết ngày phép, không thể chấm Nghỉ phép (NP).");
        setMenu(null);
        return;
      }
      setCellLocal(menu.accountId, menu.date, status);
    } else {
      let skipped = 0;
      for (const employee of grid.employees) {
        if (status === "paid_leave" && !canPickNP(employee.account_id, menu.date)) {
          skipped += 1;
          continue;
        }
        setCellLocal(employee.account_id, menu.date, status);
      }
      if (skipped > 0) {
        toast.warning(`Đã bỏ qua ${skipped} nhân viên do hết ngày phép.`);
      }
    }
    setMenu(null);
  }

  function handleMenuClear() {
    if (!menu) return;
    if (menu.accountId) {
      clearCellLocal(menu.accountId, menu.date);
    } else {
      for (const employee of grid.employees) {
        clearCellLocal(employee.account_id, menu.date);
      }
    }
    setMenu(null);
  }

  function openNoteEditorFromMenu() {
    if (!menu || !menu.accountId) return;
    const current = effectiveCell(menu.accountId, menu.date);
    if (!current) return;
    setNoteEditor({
      anchorRect: menu.anchorRect,
      accountId: menu.accountId,
      date: menu.date,
      initialValue: current.note ?? "",
    });
    setMenu(null);
  }

  function handleNoteSave(note: string) {
    if (!noteEditor) return;
    setCellNoteLocal(noteEditor.accountId, noteEditor.date, note);
    setNoteEditor(null);
  }

  function handleDiscardPending() {
    setPending(new Map());
  }

  async function handleSave() {
    const upserts: AttendanceBulkSavePayload["upserts"] = [];
    const deletes: AttendanceBulkSavePayload["deletes"] = [];
    for (const [key, cell] of pending) {
      const separatorIndex = key.indexOf("__");
      const accId = key.slice(0, separatorIndex);
      const date = key.slice(separatorIndex + 2);
      if (cell === null) {
        deletes.push({ account_id: accId, date });
      } else {
        upserts.push({ account_id: accId, date, status: cell.status, note: cell.note });
      }
    }
    if (upserts.length === 0 && deletes.length === 0) return;

    setSaving(true);
    try {
      await clientApi("/attendance/bulk", { method: "POST", body: JSON.stringify({ upserts, deletes }) });
      const nextGrid = await clientApi<AttendanceGrid>(
        `/attendance?${new URLSearchParams({
          year: String(year),
          month: String(month),
          ...(canFilterByTeam && teamId ? { team_id: teamId } : {}),
          ...(canFilterByAccount && accountId ? { account_id: accountId } : {}),
          ...(includeInactive ? { include_inactive: "true" } : {}),
        }).toString()}`,
      );
      setGrid(nextGrid);
      setPending(new Map());
      setLastSavedAt(new Date());
      toast.success("Đã lưu chấm công thành công.");
    } catch (error) {
      // Hiện đúng lý do cụ thể từ backend (VD: hết ngày phép còn lại) thay
      // vì thông báo chung chung — yêu cầu trực tiếp người dùng, 2026-07-15.
      toast.error(error instanceof ApiError ? error.message : "Lưu chấm công thất bại, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const totalByEmployee = useMemo(() => {
    const totals = new Map<string, number>();
    for (const employee of grid.employees) {
      let sum = 0;
      for (const day of grid.days) {
        const cell = effectiveCell(employee.account_id, day.date);
        if (cell) sum += WORK_UNITS[cell.status];
      }
      totals.set(employee.account_id, sum);
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid.employees, grid.days, savedByKey, pending]);

  const filteredAccountOptions = accountOptions.filter((a) => EMPLOYEE_ROLES.includes(a.role));

  // Sửa lỗi khe hở/lộ nền ở 3 cột sticky đầu (yêu cầu trực tiếp người dùng,
  // 2026-07-14) — NGUYÊN NHÂN GỐC: header/body trước đây khai báo width rời
  // rạc (Tailwind class ở th, KHÔNG có ở td) nên có thể lệch nhau; sticky
  // "left" tính tay đúng nhưng không có nguồn chân lý duy nhất cho width.
  // FIX: dùng <colgroup> — CHỈ nơi DUY NHẤT quyết định width mỗi cột (thead
  // + tbody bắt buộc dùng chung, không thể lệch được nữa), kết hợp
  // table-fixed + border-separate (border-collapse phá sticky, xem commit
  // trước). "left" của mỗi cột sticky CỘNG DỒN đúng width các cột sticky
  // đứng trước nó (không phải cột liền trước bất kỳ).
  const STT_COL_WIDTH = 40;
  const NAME_COL_WIDTH = 176;
  const POSITION_COL_WIDTH = 110;
  const DAY_COL_WIDTH = 48;
  const TOTAL_COL_WIDTH = 64;

  const STT_COL_LEFT = 0;
  const NAME_COL_LEFT = STT_COL_WIDTH;
  const POSITION_COL_LEFT = STT_COL_WIDTH + NAME_COL_WIDTH;

  // 3 tầng z-index cố định (yêu cầu trực tiếp người dùng) — áp dụng cho MỌI
  // cell sticky, không lẫn lộn: cell chỉ sticky-left (thân bảng) < cell chỉ
  // sticky-top (header ngày) < cell sticky CẢ 2 trục (góc giao giữa header
  // và cột cố định — STT/Họ và tên/Vị trí ở hàng tiêu đề, và Tổng công vì
  // cũng sticky top+right nên xếp cùng tầng góc để không bị "hòa" z-index
  // với header ngày thường).
  const Z_BODY_STICKY = "z-20";
  const Z_HEADER = "z-30";
  const Z_HEADER_CORNER = "z-40";

  // Viền phải "Vị trí" tách vùng cố định khỏi vùng cuộn (Mục 5, yêu cầu
  // người dùng) — border-r (đã có) + box-shadow nhẹ đổ sang phải, đây là
  // phần tử trang trí được yêu cầu rõ, KHÔNG phải miếng vá che lỗi sticky.
  const STICKY_EDGE_SHADOW = "shadow-[2px_0_6px_-2px_rgba(15,23,42,0.18)]";

  // NGUYÊN NHÂN GỐC THẬT SỰ của lỗi "cột tách rời khi cuộn ngang" (đã xác
  // minh bằng đo trực tiếp DOM qua Chrome thật, KHÔNG phải đoán): với
  // table-layout:fixed + <colgroup>, nếu để width của chính thẻ <table> là
  // "auto", Chrome tính SAI khi bảng có nhiều cột (~30+ cột ngày) và tổng
  // độ rộng colgroup vượt quá độ rộng khung cuộn — nó tự co MỌI cột hẹp hơn
  // giá trị đã khai trong colgroup (trái với chuẩn CSS: width phải bằng
  // max(khung chứa, tổng colgroup)). KHÔNG liên quan đến position:sticky
  // (đã tắt thử sticky ở toàn bộ 119 cell, lỗi vẫn y hệt) — tái hiện được
  // lỗi này cả ở 1 trang HTML thuần không React/Tailwind khi đủ 31 cột, và
  // hết lỗi hoàn toàn khi gán width tường minh cho <table>. FIX: tính đúng
  // TỔNG width bảng rồi gán thẳng vào <table style={{width}}> — không để
  // Chrome tự suy ra "auto" nữa.
  const TABLE_TOTAL_WIDTH =
    STT_COL_WIDTH + NAME_COL_WIDTH + POSITION_COL_WIDTH + grid.days.length * DAY_COL_WIDTH + TOTAL_COL_WIDTH;

  return (
    <div className="relative -top-3 mx-auto max-w-[1600px] space-y-4 md:-top-5">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            activeTab === "manual" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
          )}
        >
          Chấm công thủ công
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("checkin")}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            activeTab === "checkin" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
          )}
        >
          Check in GPS
        </button>
      </div>

      {activeTab === "checkin" && (
        <CheckinManagementPanel
          canFilterByTeam={canFilterByTeam}
          teams={teams}
          accountOptions={accountOptions}
          currentUserRole={currentUserRole}
        />
      )}

      <div className={activeTab === "manual" ? "space-y-4" : "hidden"}>
      <div ref={filterBarRef}>
      <Card className="p-2">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tháng" uiSize="xs" className="w-20">
            <Select uiSize="xs" value={month} onChange={(e) => void loadGrid({ month: Number(e.target.value) })}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Năm" uiSize="xs" className="w-20">
            <Select uiSize="xs" value={year} onChange={(e) => void loadGrid({ year: Number(e.target.value) })}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Thu phóng" uiSize="xs" className="w-18">
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
          {canFilterByTeam && (
            <Field label="Nhóm" uiSize="xs" className="w-32">
              <Select uiSize="xs" value={teamId} onChange={(e) => void loadGrid({ teamId: e.target.value })}>
                <option value="">Tất cả nhóm</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {canFilterByAccount && (
            <Field label="Nhân viên" uiSize="xs" className="w-36">
              <Select uiSize="xs" value={accountId} onChange={(e) => void loadGrid({ accountId: e.target.value })}>
                <option value="">Tất cả nhân viên</option>
                {filteredAccountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <label className="flex items-center gap-1.5 pb-1 text-xs text-slate-600">
            <Checkbox
              checked={includeInactive}
              onChange={(e) => void loadGrid({ includeInactive: e.target.checked })}
            />
            Hiện tài khoản đã nghỉ việc
          </label>

          <div className="ml-auto flex items-start gap-2">
            {/* Yêu cầu trực tiếp người dùng (2026-07-15): "Tháng hiện tại"
                và "Tải Excel" nằm cạnh nhau ở hàng trên, dòng trạng thái
                "Chưa lưu.../Đã lưu" dời xuống hàng dưới. */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const now = new Date();
                    void loadGrid({ year: now.getFullYear(), month: now.getMonth() + 1 });
                  }}
                >
                  Tháng hiện tại
                </Button>
                {/* Màu xanh lá đặc trưng của Excel (yêu cầu trực tiếp người
                    dùng) — viết nút riêng thay vì dùng variant có sẵn của
                    Button (chỉ có accent/brand/outline/ghost/danger, không
                    có màu này), giữ nguyên kích thước khớp nút "xs" bên cạnh. */}
                <button
                  type="button"
                  onClick={() => window.open(buildExportUrl(), "_blank")}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#217346] px-2 py-1 text-xs font-medium text-white shadow-sm shadow-[#217346]/25 transition-colors hover:bg-[#1a5c38]"
                >
                  <Download className="h-3 w-3" strokeWidth={2} />
                  Tải Excel
                </button>
              </div>
              {isDirty && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Chưa lưu {pending.size} thay đổi
                </span>
              )}
              {!isDirty && lastSavedAt && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Đã lưu
                </span>
              )}
            </div>
            {grid.can_edit && (
              // Yêu cầu người dùng: "Lưu thay đổi" to hơn đúng 1 cỡ so với
              // trước (xs -> sm), "Xóa thay đổi chưa lưu" giữ nguyên bé (nút
              // tự viết riêng, không sửa components/ui/button.tsx để tránh
              // ảnh hưởng mọi nút khác trong toàn app).
              <div className="flex flex-col gap-1">
                <Button type="button" variant="primary" size="sm" disabled={!isDirty || saving} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
                  Lưu thay đổi
                </Button>
                <button
                  type="button"
                  disabled={!isDirty}
                  onClick={handleDiscardPending}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-2.5 w-2.5" strokeWidth={2} />
                  Xóa thay đổi chưa lưu
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
      </div>

      <div className={cn(loading && "opacity-60", "transition-opacity")}>
        {/* Ghim cố định thanh tiêu đề (yêu cầu trực tiếp người dùng,
            2026-07-14) — khối cuộn của bảng PHẢI có chiều cao THẬT tính bằng
            số (tableBoxHeight, đo bằng ResizeObserver ở trên) thay vì để
            overflow-x-auto tự cao theo nội dung: theo chuẩn CSS, hễ
            overflow-x khác "visible" thì overflow-y cũng TỰ ĐỘNG bị tính
            thành "auto" (không tắt được bằng CSS thuần) — nên khối cuộn
            ngang của bảng luôn tự trở thành "vùng cuộn" mà sticky header
            bám vào; nếu khối đó không tự giới hạn chiều cao, header không
            bao giờ dính được khi cuộn (đã xác nhận lỗi này bằng đo trực
            tiếp DOM qua Chrome thật). Kỹ thuật y hệt shuttle-client.tsx. */}
        <Card className="overflow-hidden p-0">
          {/* Đúng 1 container cuộn duy nhất (Mục 6, yêu cầu người dùng) —
              không transform/filter/perspective trên bất kỳ tổ tiên nào của
              bảng (đã rà soát Card + div này), không phá containing block
              mà sticky cần. */}
          <div className="overflow-auto" style={{ height: tableBoxHeight }}>
            {/* "Thu phóng" (y hệt trang Đưa đón, shuttle-client.tsx) — dùng
                CSS "zoom" (KHÔNG phải transform:scale) bọc riêng <table>,
                không bọc khối cuộn ngoài, để chiều cao tableBoxHeight (tính
                từ px thật) không bị lệch. */}
            <div style={{ zoom: zoomLevel / 100 }}>
            <table className="table-fixed border-separate border-spacing-0 text-xs" style={{ width: TABLE_TOTAL_WIDTH }}>
              {/* <colgroup> = NGUỒN CHÂN LÝ DUY NHẤT cho width mỗi cột — thead
                  và tbody bắt buộc dùng chung, không còn cách nào để lệch
                  nhau nữa (Mục 1/6, yêu cầu người dùng). */}
              <colgroup>
                <col style={{ width: STT_COL_WIDTH }} />
                <col style={{ width: NAME_COL_WIDTH }} />
                <col style={{ width: POSITION_COL_WIDTH }} />
                {grid.days.map((day) => (
                  <col key={day.date} style={{ width: DAY_COL_WIDTH }} />
                ))}
                <col style={{ width: TOTAL_COL_WIDTH }} />
              </colgroup>
              <thead>
                {/* Yêu cầu trực tiếp người dùng (2026-07-15): "thanh tiêu đề
                    căn lề giữa" — text-center trên MỌI ô tiêu đề (mặc định
                    Tailwind Preflight reset <th> về text-align:left, không
                    tự căn giữa như UA stylesheet gốc). */}
                <tr>
                  <th
                    className={cn(
                      "sticky top-0 h-14 border-r border-b border-slate-200 bg-brand-50 bg-clip-padding text-center text-[10px] font-semibold text-brand-900",
                      Z_HEADER_CORNER,
                    )}
                    style={{ left: STT_COL_LEFT, width: STT_COL_WIDTH }}
                  >
                    STT
                  </th>
                  <th
                    className={cn(
                      "sticky top-0 h-14 border-r border-b border-slate-200 bg-brand-50 bg-clip-padding px-2 text-center text-[10px] font-semibold text-brand-900",
                      Z_HEADER_CORNER,
                    )}
                    style={{ left: NAME_COL_LEFT, width: NAME_COL_WIDTH }}
                  >
                    Họ và tên
                  </th>
                  <th
                    className={cn(
                      "sticky top-0 h-14 border-b border-slate-200 bg-brand-50 bg-clip-padding px-2 text-center text-[10px] font-semibold text-brand-900",
                      Z_HEADER_CORNER,
                      STICKY_EDGE_SHADOW,
                    )}
                    style={{ left: POSITION_COL_LEFT, width: POSITION_COL_WIDTH }}
                  >
                    Vị trí
                  </th>
                  {grid.days.map((day) => (
                    <th
                      key={day.date}
                      onClick={(e) => openColumnMenu(e, day.date)}
                      title="Bấm để chấm cùng trạng thái cho cả ngày này"
                      className={cn(
                        "sticky top-0 h-14 cursor-pointer border-r border-b border-slate-200 bg-clip-padding text-center text-[11px] font-semibold hover:brightness-95",
                        Z_HEADER,
                        day.is_sunday ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-900",
                      )}
                    >
                      <div>{String(day.day).padStart(2, "0")}</div>
                      <div className="text-[9px] font-medium opacity-70">{day.weekday_label}</div>
                    </th>
                  ))}
                  <th
                    className={cn(
                      "sticky top-0 right-0 h-14 border-b border-slate-200 bg-brand-50 bg-clip-padding text-center text-[10px] font-semibold text-brand-900",
                      Z_HEADER_CORNER,
                    )}
                  >
                    Tổng công
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.employees.map((employee, index) => (
                  <tr key={employee.account_id} className="even:bg-slate-50/40">
                    <td
                      className={cn(
                        "sticky border-r border-b border-slate-200 bg-white bg-clip-padding text-center text-slate-500",
                        Z_BODY_STICKY,
                      )}
                      style={{ left: STT_COL_LEFT, width: STT_COL_WIDTH }}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={cn(
                        "sticky cursor-pointer truncate border-r border-b border-slate-200 bg-white bg-clip-padding px-2 py-2 font-medium text-slate-800 hover:text-brand-700",
                        Z_BODY_STICKY,
                      )}
                      style={{ left: NAME_COL_LEFT, width: NAME_COL_WIDTH }}
                      title="Bấm để xem thông tin nhân viên"
                      onClick={() => setInfoModalEmployee(employee)}
                    >
                      {employee.full_name}
                      {employee.status === "inactive" && (
                        <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                          Đã nghỉ
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "sticky border-b border-slate-200 bg-white bg-clip-padding px-1.5 py-1 text-center text-slate-500",
                        Z_BODY_STICKY,
                        STICKY_EDGE_SHADOW,
                      )}
                      style={{ left: POSITION_COL_LEFT, width: POSITION_COL_WIDTH }}
                    >
                      {/* Sửa tay tên vị trí (yêu cầu trực tiếp người dùng,
                          2026-07-15) — chỉ hiện icon bút chì khi grid.can_edit
                          (khớp đúng quyền chỉnh sửa chấm công, không phát
                          minh quyền riêng cho việc đổi tên vị trí). Click bút
                          chì -> ô chuyển thành input, Enter/rời ô để lưu,
                          Escape để hủy. */}
                      {editingPositionId === employee.account_id ? (
                        <input
                          autoFocus
                          value={positionDraft}
                          disabled={savingPosition}
                          onChange={(e) => setPositionDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEditPosition(employee.account_id);
                            if (e.key === "Escape") cancelEditPosition();
                          }}
                          onBlur={() => void saveEditPosition(employee.account_id)}
                          className="w-full rounded border border-brand-300 bg-white px-1 py-0.5 text-center text-xs text-slate-700 outline-none focus:border-brand-500"
                        />
                      ) : (
                        <div className="group flex items-center justify-center gap-1">
                          <span className="truncate">{employee.position ?? ACCOUNT_ROLE_LABEL[employee.role]}</span>
                          {grid.can_edit && (
                            <button
                              type="button"
                              title="Sửa tên vị trí"
                              onClick={() => startEditPosition(employee)}
                              className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-600 group-hover:opacity-100"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    {grid.days.map((day) => (
                      <td key={day.date} className="p-0">
                        <AttendanceCellButton
                          cell={effectiveCell(employee.account_id, day.date)}
                          isSunday={day.is_sunday}
                          canEdit={grid.can_edit}
                          onMark={() => setCellLocal(employee.account_id, day.date, "present")}
                          onOpenMenu={(rect) => openMenuForCell(employee.account_id, day.date, rect)}
                          onClear={() => clearCellLocal(employee.account_id, day.date)}
                        />
                      </td>
                    ))}
                    <td
                      className={cn(
                        "sticky right-0 border-b border-slate-200 bg-white bg-clip-padding text-center font-semibold text-slate-800",
                        Z_BODY_STICKY,
                      )}
                    >
                      {totalByEmployee.get(employee.account_id)}
                    </td>
                  </tr>
                ))}
                {grid.employees.length === 0 && (
                  <tr>
                    <td colSpan={4 + grid.days.length} className="py-10 text-center text-sm text-slate-400">
                      Không có nhân viên nào trong phạm vi đang lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </Card>
      </div>

      <div ref={legendRef} className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          return (
            <span key={status} className="flex items-center gap-1.5">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold", meta.bg, meta.text)}>
                {meta.symbol}
              </span>
              {meta.label}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-red-100 text-[10px] font-bold text-red-700">CN</span>
          Chủ nhật
        </span>
      </div>

      {menu && (
        <StatusMenu
          state={menu}
          npDisabled={
            menu.accountId
              ? !canPickNP(menu.accountId, menu.date)
              : grid.employees.every((e) => !canPickNP(e.account_id, menu.date))
          }
          hasStatus={Boolean(menu.accountId && effectiveCell(menu.accountId, menu.date))}
          onPick={handleMenuPick}
          onClear={handleMenuClear}
          onEditNote={openNoteEditorFromMenu}
          onClose={() => setMenu(null)}
        />
      )}

      {noteEditor && (
        <NoteEditorPopover
          anchorRect={noteEditor.anchorRect}
          initialValue={noteEditor.initialValue}
          onSave={handleNoteSave}
          onClose={() => setNoteEditor(null)}
        />
      )}

      {infoModalEmployee && (
        <Modal
          title="Thông tin nhân viên"
          footer={
            <Button type="button" variant="outline" size="sm" onClick={() => setInfoModalEmployee(null)}>
              Đóng
            </Button>
          }
        >
          <div className="flex items-center gap-3">
            <Avatar fullName={infoModalEmployee.full_name} avatarUrl={infoModalEmployee.avatar_url} className="h-12 w-12 text-base" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{infoModalEmployee.full_name}</p>
              <p className="truncate text-xs text-slate-500">
                {infoModalEmployee.position ?? ACCOUNT_ROLE_LABEL[infoModalEmployee.role]}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Vai trò</dt>
              <dd className="font-medium text-slate-800">{ACCOUNT_ROLE_LABEL[infoModalEmployee.role]}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Nhóm</dt>
              <dd className="font-medium text-slate-800">{infoModalEmployee.team_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Trạng thái tài khoản</dt>
              <dd className="font-medium text-slate-800">{infoModalEmployee.status === "active" ? "Đang hoạt động" : "Đã nghỉ việc"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Tổng công tháng {month}/{year}</dt>
              <dd className="font-medium text-slate-800">{totalByEmployee.get(infoModalEmployee.account_id) ?? 0}</dd>
            </div>
          </dl>
          {/* Yêu cầu trực tiếp người dùng (2026-07-15): nối 5 field hồ sơ
              nhân sự vừa thêm ở trang Quản lý tài khoản sang đây — chỉ ĐỌC,
              sửa vẫn qua trang Quản lý tài khoản (đúng phân quyền đã chốt:
              chỉ Admin sửa được). */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">Thông tin nhân sự</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Ngày sinh</dt>
                <dd className="font-medium text-slate-800">{formatDateOnly(infoModalEmployee.date_of_birth)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Ngày bắt đầu làm việc</dt>
                <dd className="font-medium text-slate-800">{formatDateOnly(infoModalEmployee.hire_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Số điện thoại cá nhân</dt>
                <dd className="font-medium text-slate-800">{infoModalEmployee.personal_phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email cá nhân</dt>
                <dd className="truncate font-medium text-slate-800">{infoModalEmployee.personal_email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Số ngày phép còn lại</dt>
                <dd className="font-medium text-slate-800">
                  {effectiveLeaveBalanceByAccount.get(infoModalEmployee.account_id) ?? "—"}
                  {isDirty && (
                    <span className="ml-1 text-xs font-normal text-amber-600" title="Tính cả thay đổi chưa lưu">
                      (tạm tính)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Số CCCD</dt>
                <dd className="font-medium text-slate-800">{infoModalEmployee.citizen_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Số tài khoản ngân hàng</dt>
                <dd className="font-medium text-slate-800">{infoModalEmployee.bank_account_number ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
