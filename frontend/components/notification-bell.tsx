"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Bell, CalendarClock, FileStack, FileText, Megaphone, Phone, PhoneCall, X } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type AppNotification, type AppRealtimeEvent, type PaginatedResult } from "@/lib/types";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { roleAccentTextStyle } from "@/lib/role-accent";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

const TYPE_LABEL: Record<AppNotification["type"], string> = {
  callback_reminder: "Nhắc lịch gọi lại",
  interview_reminder: "Nhắc lịch phỏng vấn",
  admin_message: "Thông báo từ quản trị viên",
  new_data_uploaded: "Data mới về nhóm",
  manual_callback_reminder: "Nhắc gọi lại",
  leave_request_pending_leader: "Đơn xin nghỉ phép cần duyệt",
  leave_request_pending_admin: "Đơn xin nghỉ phép cần duyệt",
  leave_request_decided: "Kết quả đơn xin nghỉ phép",
};

const STATUS_LABEL: Record<AppNotification["status"], string> = {
  pending: "Chờ gửi",
  sent: "Đã gửi",
  failed: "Gửi lỗi",
};

const STATUS_CLASS: Record<AppNotification["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

/**
 * Dự án phụ — nâng cấp toàn diện: "Nhắc lịch gọi lại" hiện nổi 1 phút (yêu
 * cầu trực tiếp người dùng), các loại còn lại giữ nguyên 30s như trước.
 */
const TOAST_DURATION_MS: Record<AppNotification["type"], number> = {
  callback_reminder: 60_000,
  interview_reminder: 30_000,
  admin_message: 30_000,
  new_data_uploaded: 30_000,
  manual_callback_reminder: 60_000,
  leave_request_pending_leader: 60_000,
  leave_request_pending_admin: 60_000,
  leave_request_decided: 60_000,
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

/** Admin_message hiện đúng nội dung đã soạn; 2 loại nhắc lịch cũ vẫn hiện nhãn cố định như trước. */
function notificationTitle(n: AppNotification): string {
  return n.content ?? TYPE_LABEL[n.type];
}

function NotificationIcon({ type, className }: { type: AppNotification["type"]; className: string }) {
  if (type === "callback_reminder") return <Phone className={className} strokeWidth={2} />;
  if (type === "admin_message") return <Megaphone className={className} strokeWidth={2} />;
  if (type === "new_data_uploaded") return <FileStack className={className} strokeWidth={2} />;
  if (type === "manual_callback_reminder") return <PhoneCall className={className} strokeWidth={2} />;
  if (type.startsWith("leave_request_")) return <FileText className={className} strokeWidth={2} />;
  return <CalendarClock className={className} strokeWidth={2} />;
}

/**
 * Dự án phụ — nâng cấp toàn diện: hiện avatar + tên (vai trò) người gửi
 * trước mỗi thông báo. 2 loại nhắc lịch cũ không có người gửi cụ thể (hệ
 * thống tự tạo) nên hiện nhãn "Hệ thống" thay vì bỏ trống.
 */
function NotificationSenderRow({ n }: { n: AppNotification }) {
  const name = n.sender?.name ?? "Hệ thống";
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <Avatar fullName={name} avatarUrl={n.sender?.avatar_url} className="h-[19.6px] w-[19.6px] shrink-0 text-[10px]" />
      <span className="truncate text-[13px] font-medium text-slate-600">
        {name}
        {n.sender && (
          <>
            {" ("}
            <span style={roleAccentTextStyle(n.sender.role)}>{ACCOUNT_ROLE_LABEL[n.sender.role]}</span>
            {")"}
          </>
        )}
      </span>
    </div>
  );
}

function seenStorageKey(userId: string): string {
  return `saram_rms_notif_seen_${userId}`;
}

function knownStorageKey(userId: string): string {
  return `saram_rms_notif_known_${userId}`;
}

function dismissedStorageKey(userId: string): string {
  return `saram_rms_notif_dismissed_${userId}`;
}

function loadIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // localStorage không khả dụng — bỏ qua, chỉ mất trạng thái khi tải lại trang.
  }
}

// Chuỗi 3 nốt tăng dần (Mi-Sol-Đô, giống chuông thông báo phổ biến) — âm to
// và rõ hơn bản 1 tiếng "beep" cũ (gain 0.15 → 0.4).
const CHIME_NOTES_HZ = [659.25, 987.77, 1318.51];
const CHIME_NOTE_GAP_S = 0.14;
const CHIME_NOTE_DURATION_S = 0.22;

/** Phát chuỗi 3 tiếng "chime" bằng Web Audio API — không cần thêm file âm thanh. */
function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    CHIME_NOTES_HZ.forEach((frequency, index) => {
      const startAt = ctx.currentTime + index * CHIME_NOTE_GAP_S;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(1, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + CHIME_NOTE_DURATION_S);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + CHIME_NOTE_DURATION_S);
    });

    const totalDuration = (CHIME_NOTES_HZ.length - 1) * CHIME_NOTE_GAP_S + CHIME_NOTE_DURATION_S;
    setTimeout(() => void ctx.close(), (totalDuration + 0.1) * 1000);
  } catch {
    // Trình duyệt chặn autoplay âm thanh hoặc không hỗ trợ — bỏ qua, không chặn UI.
  }
}

/**
 * Dự án phụ — nâng cấp toàn diện: nút chuông thông báo ở header, cạnh tên
 * bên trái UserMenu. Đây là NƠI DUY NHẤT hiển thị thông báo từ nay về sau
 * — mọi cài đặt/tính năng thông báo trong tương lai gộp vào đây thay vì
 * tạo chỗ hiển thị riêng lẻ. Dùng thẳng GET /notification đã có sẵn (Mục 7,
 * docs/13) — không đổi API, chỉ thêm UI hiển thị.
 *
 * "Đã xem"/"đã biết" chỉ lưu cục bộ trên trình duyệt (localStorage, theo
 * từng tài khoản) — backend không có khái niệm đã đọc/chưa đọc ở tầng DB
 * (không có cột is_read), nên KHÔNG có API mark-as-read thật để đồng bộ.
 *
 * Yêu cầu trực tiếp người dùng (2026-07-16, mở rộng realtime — Thông báo):
 * (1) Thay polling 20s bằng đẩy realtime thật qua WebSocket (kênh chung
 *     `app:event`, module `notification`, xem lib/realtime.ts) — chỉ còn 1
 *     lần tải ban đầu lúc mount, KHÔNG còn setInterval nào cả.
 * (2) "Đồng bộ trạng thái đã đọc giữa nhiều tab của cùng 1 tài khoản" — vì
 *     trạng thái này CHỈ tồn tại ở localStorage (không có gì ở server để
 *     đẩy realtime), dùng đúng cơ chế native của trình duyệt cho việc này:
 *     sự kiện `storage` (tự bắn ở các TAB KHÁC khi 1 tab ghi localStorage
 *     cùng origin) — không cần bất kỳ API/DB nào, không đổi phạm vi "chỉ lưu
 *     cục bộ" đã có.
 *
 * Quy tắc hiển thị GIỮ NGUYÊN như cũ: thông báo mới → hiện toast nổi + phát
 * âm thanh + thêm vào danh sách trong chuông. Toast tự biến mất sau thời
 * gian cấu hình theo loại (KHÔNG đánh dấu đã xem → chuông vẫn sáng đỏ + hiện
 * số). Bấm X đóng toast → đánh dấu đã xem ngay (chuông không sáng cho thông
 * báo đó), vẫn còn trong danh sách chuông.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadIdSet(seenStorageKey(userId)));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadIdSet(dismissedStorageKey(userId)));
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(loadIdSet(knownStorageKey(userId)));
  const isFirstFetchRef = useRef(true);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function markSeen(ids: Iterable<string>) {
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      saveIdSet(seenStorageKey(userId), next);
      return next;
    });
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: "Xóa tất cả" — áp dụng cho mọi vai trò
   * (lưu cục bộ theo userId, tự nhiên đúng cho từng người dùng). Chỉ ẩn khỏi
   * danh sách trên trình duyệt này, KHÔNG xóa dữ liệu Notification thật ở
   * server (đồng bộ đúng nguyên tắc "đã xem"/"đã biết" đã dùng cho tính năng
   * này — backend không có khái niệm đã đọc/chưa đọc hay đã xóa).
   */
  function handleClearAll() {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      saveIdSet(dismissedStorageKey(userId), next);
      return next;
    });
  }

  function dismissToast(id: string, markAsSeen: boolean) {
    const timeout = toastTimeoutsRef.current.get(id);
    if (timeout) clearTimeout(timeout);
    toastTimeoutsRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (markAsSeen) markSeen([id]);
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-16): "ấn vào thông báo nổi hoặc
   * trong quả chuông sẽ link thẳng đến lao động/đơn đang nhắc tới" — áp dụng
   * chung cho MỌI loại thông báo có gắn `lead_id` hoặc `leave_request_id`,
   * không cần liệt kê riêng từng loại vì đều dùng chung 2 field này.
   *
   * Yêu cầu trực tiếp người dùng (bổ sung, cùng ngày): "thông báo nào đã ấn
   * vào thì nền trắng, chưa ấn thì nền đậm" — LUÔN đánh dấu đã xem ngay khi
   * bấm (kể cả loại admin_message/cảnh báo không đưa đón, KHÔNG gắn
   * lead_id/leave_request_id nên bấm vào không điều hướng đi đâu) — nếu
   * không, thông báo loại đó sẽ mãi mãi hiện nền đậm không cách nào xóa.
   */
  function handleNotificationClick(n: AppNotification) {
    markSeen([n.id]);
    dismissToast(n.id, false);
    const target = n.lead_id
      ? `/candidates/${n.lead_id}`
      : n.leave_request_id
        ? // "Đơn xin nghỉ phép" không còn là trang riêng — nay là 1 tab
          // trong "Chấm công" (xem attendance-client.tsx, tab "requests").
          `/attendance?tab=requests&open=${n.leave_request_id}`
        : null;
    if (!target) return;
    setIsOpen(false);
    router.push(target);
  }

  function markKnown(ids: Iterable<string>) {
    for (const id of ids) knownIdsRef.current.add(id);
    saveIdSet(knownStorageKey(userId), knownIdsRef.current);
  }

  function scheduleToastDismiss(n: AppNotification) {
    const timeout = setTimeout(() => dismissToast(n.id, false), TOAST_DURATION_MS[n.type]);
    toastTimeoutsRef.current.set(n.id, timeout);
  }

  async function fetchNotifications() {
    const result = await clientApi<PaginatedResult<AppNotification>>("/notification?page_size=20");
    setNotifications(result.items);

    if (isFirstFetchRef.current) {
      // Lần tải đầu tiên = mốc gốc — không toast cho thông báo đã có sẵn từ trước.
      isFirstFetchRef.current = false;
      markKnown(result.items.map((n) => n.id));
      return;
    }

    const freshOnes = result.items.filter((n) => !knownIdsRef.current.has(n.id));
    if (freshOnes.length === 0) return;

    markKnown(freshOnes.map((n) => n.id));
    playNotificationSound();
    setToasts((prev) => [...prev, ...freshOnes]);
    for (const n of freshOnes) scheduleToastDismiss(n);
  }

  /**
   * Yêu cầu người dùng (Mục 3, mở rộng realtime) — thay polling: mỗi
   * notification.created đẩy tới ĐÚNG account_id (đã lọc phòng ở backend,
   * xem realtime.gateway.ts#userRoom) hiện ngay chuông/badge/toast, không
   * cần đợi tới lượt poll kế tiếp. Kiểm tra `knownIdsRef` trước khi xử lý —
   * tránh thêm trùng nếu cùng 1 sự kiện lỡ tới nhiều lần (reconnect dồn dập,
   * Socket.IO gửi lại...).
   */
  function handleAppRealtimeEvent(event: AppRealtimeEvent) {
    if (event.module !== "notification" || event.action !== "created") return;
    const n = event.payload as AppNotification | undefined;
    if (!n || n.account_id !== userId || knownIdsRef.current.has(n.id)) return;

    markKnown([n.id]);
    setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
    playNotificationSound();
    setToasts((prev) => [...prev, n]);
    scheduleToastDismiss(n);
  }

  useAppRealtime(handleAppRealtimeEvent);
  /** Mục 8: sau khi mất mạng rồi kết nối lại, refetch 1 lần để không bỏ sót sự kiện đã lỡ trong lúc mất kết nối. */
  useRealtimeReconnect(() => void fetchNotifications());

  /**
   * Mục 3, yêu cầu người dùng — "đồng bộ trạng thái đã đọc giữa nhiều tab
   * của cùng 1 tài khoản": trạng thái "đã xem"/"đã biết"/"đã xóa" CHỈ tồn
   * tại ở localStorage (không có gì ở server để đẩy realtime) — dùng đúng
   * sự kiện `storage` chuẩn của trình duyệt (tự bắn ở các TAB KHÁC, cùng
   * origin, khi 1 tab ghi localStorage) để đồng bộ, không cần thêm API/DB.
   */
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === seenStorageKey(userId)) {
        setSeenIds(loadIdSet(seenStorageKey(userId)));
      } else if (event.key === dismissedStorageKey(userId)) {
        setDismissedIds(loadIdSet(dismissedStorageKey(userId)));
      } else if (event.key === knownStorageKey(userId)) {
        knownIdsRef.current = loadIdSet(knownStorageKey(userId));
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    // Gọi lần đầu qua setTimeout(0) (thay vì gọi trực tiếp) — tránh lỗi lint
    // "setState trong effect" (rule chỉ cảnh báo lệnh gọi hàm trực tiếp,
    // không cảnh báo lệnh gọi bên trong callback của timer/promise). Đây là
    // lần tải DUY NHẤT qua REST — các cập nhật sau đó đến từ realtime
    // (useAppRealtime ở trên), không còn polling định kỳ nữa.
    const immediate = setTimeout(() => {
      fetchNotifications()
        .catch(() => {
          // Bỏ qua lỗi tải nền — không chặn UI, realtime/lần mở chuông sau sẽ tự cập nhật.
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
            setHasLoadedOnce(true);
          }
        });
    }, 0);
    const timeouts = toastTimeoutsRef.current;
    return () => {
      cancelled = true;
      clearTimeout(immediate);
      for (const timeout of timeouts.values()) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideButton = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideButton && !insideDropdown) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));
  const unseenCount = visibleNotifications.filter((n) => !seenIds.has(n.id)).length;

  async function handleToggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (!next) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    try {
      // Yêu cầu trực tiếp người dùng: "thông báo nào đã ấn vào thì nền
      // trắng, chưa ấn thì nền đậm" — KHÔNG được tự đánh dấu "đã xem" hàng
      // loạt chỉ vì mở quả chuông ra xem (trước đây làm vậy) — phải giữ
      // nguyên trạng thái nền đậm cho tới khi người dùng bấm vào ĐÚNG dòng
      // đó (xem handleNotificationClick).
      const result = await clientApi<PaginatedResult<AppNotification>>("/notification?page_size=20");
      setNotifications(result.items);
    } finally {
      setHasLoadedOnce(true);
    }
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title="Thông báo"
          onClick={() => void handleToggleOpen()}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className={cn("h-4.5 w-4.5", unseenCount > 0 && "text-red-500")} strokeWidth={2} />
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </button>
      </div>

      {/*
        Dropdown danh sách — render qua Portal (giống Modal/toast, xem ghi chú
        ở components/ui/modal.tsx) — nút chuông nằm trong thanh header có
        "backdrop-blur", CSS backdrop-filter tạo stacking context mới cho cả
        khối header, khiến z-30 của dropdown chỉ so được với nội dung TRONG
        header thay vì so với toàn trang — nội dung trang (vd tiêu đề bảng
        dính "sticky") vẫn đè lên trên được dù dropdown có z-30. Portal +
        tính vị trí theo getBoundingClientRect() của nút để dropdown vẫn nằm
        đúng ngay dưới quả chuông sau khi thoát khỏi header.
      */}
      {isOpen &&
        dropdownPosition &&
        createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
            className="fixed z-30 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg shadow-slate-900/10"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2">
              <p className="text-sm font-semibold text-slate-800">Thông báo</p>
              {visibleNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {isLoading && !hasLoadedOnce ? (
                <p className="px-3.5 py-4 text-center text-xs text-slate-400">Đang tải...</p>
              ) : visibleNotifications.length === 0 ? (
                <p className="px-3.5 py-4 text-center text-xs text-slate-400">Chưa có thông báo nào</p>
              ) : (
                visibleNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "px-3.5 py-2.5 transition-colors",
                      // Yêu cầu trực tiếp người dùng: đã ấn vào (đã xem) -> nền trắng
                      // (mặc định); chưa ấn vào -> nền đậm hơn để dễ nhận ra.
                      seenIds.has(n.id) ? "bg-white hover:bg-slate-50" : "bg-brand-100/70 hover:bg-brand-100",
                      (n.lead_id || n.leave_request_id) && "cursor-pointer",
                    )}
                  >
                    <NotificationSenderRow n={n} />
                    <div className="flex items-start gap-2.5">
                      <NotificationIcon type={n.type} className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">{notificationTitle(n)}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(n.scheduled_at)}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[n.status])}>
                        {STATUS_LABEL[n.status]}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}

      {/*
        Toast nổi — cố định ngay dưới khu vực tài khoản ở header. Render qua
        Portal thẳng vào document.body (giống Modal, xem ghi chú ở
        components/ui/modal.tsx) — nút chuông nằm trong thanh header có
        "backdrop-blur", CSS backdrop-filter tạo containing block mới cho
        con position:fixed, nếu không portal thì toast sẽ bị nhốt gọn trong
        khung header thay vì nổi đúng vị trí trên toàn trang.
      */}
      {toasts.length > 0 &&
        createPortal(
          <div className="fixed top-14 right-3 z-40 flex w-[calc(100%-1.5rem)] max-w-80 flex-col gap-2 sm:right-6">
            {toasts.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  // Yêu cầu trực tiếp người dùng (2026-07-16): "đổi màu nền cho nổi bật,
                  // dễ gây chú ý hơn" — nền trắng trơn trước đây dễ bị bỏ qua giữa các
                  // khối trắng khác trên trang. Đổi sang nền gradient nhạt màu thương
                  // hiệu (brand) + viền trái đậm 4px kiểu "alert" + viền/bóng đổ màu
                  // thương hiệu, chữ vẫn giữ màu tối để không giảm độ đọc.
                  "rounded-xl border border-brand-200 border-l-4 border-l-brand-500 bg-gradient-to-br from-brand-50 to-white p-3 shadow-lg shadow-brand-900/20 ring-1 ring-brand-500/10",
                  (n.lead_id || n.leave_request_id) && "cursor-pointer",
                )}
              >
                <NotificationSenderRow n={n} />
                <div className="flex items-start gap-2.5">
                  <NotificationIcon type={n.type} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{notificationTitle(n)}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(n.scheduled_at)}</p>
                  </div>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissToast(n.id, true);
                    }}
                    className="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
