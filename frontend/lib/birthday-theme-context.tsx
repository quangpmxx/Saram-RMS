"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clientApi } from "./api-client";
import type { BirthdayToday, BirthdayEmployee } from "./types";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "Giao diện chúc mừng sinh nhật
 * nhân viên" — Mục 9: "Tạo BirthdayThemeProvider... dùng chung ở layout
 * chính. Không chèn riêng logic sinh nhật vào từng trang... Chỉ có MỘT
 * nguồn trạng thái chủ đề dùng chung toàn ứng dụng." Theo đúng khuôn mẫu
 * PageTitleProvider/ToastProvider đã có (frontend/lib/page-title-context.tsx,
 * toast-context.tsx) — 1 file lib/*.tsx xuất Provider + hook riêng.
 */

const TIMEZONE = "Asia/Ho_Chi_Minh";
const HIDE_STORAGE_PREFIX = "saram_rms_birthday_hide_";

/** "YYYY-MM-DD" theo giờ Việt Nam — dùng làm khóa lưu "đã ẩn trang trí hôm nay", TỰ ĐỘNG hết hạn khi sang ngày mới (Mục 8: "sang ngày sinh nhật khác có thể hiển thị lại"). */
function vnDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Mục 7: "Nếu người dùng đang mở trang qua thời điểm chuyển ngày: Tự cập
 * nhật... không cần F5, không reload toàn trang." — tính đúng số mili-giây
 * tới 00:00:00 NGÀY MAI theo giờ Việt Nam (KHÔNG phải giờ trình duyệt người
 * dùng — múi giờ có thể khác), để hẹn 1 lần refetch đúng lúc, không polling.
 */
function msUntilNextVnMidnight(): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const secondsSinceMidnight = get("hour") * 3600 + get("minute") * 60 + get("second");
  const secondsUntilMidnight = 24 * 3600 - secondsSinceMidnight;
  // Tối thiểu 1s — tránh setTimeout(0) lặp vô hạn nếu tính toán rơi đúng biên.
  return Math.max(1000, secondsUntilMidnight * 1000);
}

function loadHiddenToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(HIDE_STORAGE_PREFIX + vnDateKey()) === "1";
  } catch {
    return false;
  }
}

interface BirthdayThemeValue {
  employees: BirthdayEmployee[];
  hasBirthdayToday: boolean;
  isPreview: boolean;
  /** Mục 8: đã bấm "Ẩn trang trí hôm nay" — CHỈ ẩn hiệu ứng/họa tiết, banner lời chúc vẫn còn (gọn hơn). */
  decorationsHidden: boolean;
  hideDecorationsToday: () => void;
  /** Bù lại chiều ngược của hideDecorationsToday — trước đây không có cách nào bật lại trong cùng ngày (chỉ tự hết khi sang ngày mới), người dùng bị kẹt. */
  showDecorationsToday: () => void;
  /** Mục 11, chế độ xem thử — chỉ có tác dụng thật nếu backend xác nhận currentUser là Admin + không phải production (âm thầm bỏ qua nếu không đủ điều kiện). */
  startPreview: (params: { simulated_date?: string; force_account_id?: string }) => Promise<void>;
  stopPreview: () => void;
}

const BirthdayThemeContext = createContext<BirthdayThemeValue | null>(null);

export function BirthdayThemeProvider({
  initialData,
  children,
}: {
  /** Tải sẵn từ server (layout.tsx, cùng lúc với getCurrentUser()) — tránh 1 lượt gọi API thừa ngay khi mở trang. */
  initialData: BirthdayToday | null;
  children: ReactNode;
}) {
  const [data, setData] = useState<BirthdayToday | null>(initialData);
  const [decorationsHidden, setDecorationsHidden] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Đọc localStorage trong effect (không phải lúc render) — tránh lệch
  // SSR/hydrate (server không có localStorage). setTimeout(0) thay vì gọi
  // setState trực tiếp — khớp quy ước đã dùng ở notification-bell.tsx (rule
  // react-hooks/set-state-in-effect chỉ cảnh báo lệnh gọi TRỰC TIẾP).
  useEffect(() => {
    const timeout = setTimeout(() => setDecorationsHidden(loadHiddenToday()), 0);
    return () => clearTimeout(timeout);
  }, []);

  async function refetch() {
    try {
      const result = await clientApi<BirthdayToday>("/birthday/today");
      setData(result);
      setIsPreviewing(false);
    } catch {
      // Bỏ qua lỗi tải nền — giữ nguyên trạng thái cũ, không chặn UI.
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function schedule() {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        void refetch();
        setDecorationsHidden(loadHiddenToday());
        schedule();
      }, msUntilNextVnMidnight());
    }
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  function hideDecorationsToday() {
    setDecorationsHidden(true);
    try {
      localStorage.setItem(HIDE_STORAGE_PREFIX + vnDateKey(), "1");
    } catch {
      // localStorage không khả dụng — vẫn ẩn được cho phiên hiện tại, chỉ không nhớ lại sau khi tải lại trang.
    }
  }

  function showDecorationsToday() {
    setDecorationsHidden(false);
    try {
      localStorage.removeItem(HIDE_STORAGE_PREFIX + vnDateKey());
    } catch {
      // localStorage không khả dụng — vẫn hiện lại được cho phiên hiện tại.
    }
  }

  async function startPreview(params: { simulated_date?: string; force_account_id?: string }) {
    const query = new URLSearchParams();
    if (params.simulated_date) query.set("simulated_date", params.simulated_date);
    if (params.force_account_id) query.set("force_account_id", params.force_account_id);
    const result = await clientApi<BirthdayToday>(`/birthday/today?${query.toString()}`);
    setData(result);
    setIsPreviewing(true);
  }

  function stopPreview() {
    setIsPreviewing(false);
    void refetch();
  }

  const employees = data?.employees ?? [];

  return (
    <BirthdayThemeContext.Provider
      value={{
        employees,
        hasBirthdayToday: employees.length > 0,
        isPreview: isPreviewing || Boolean(data?.is_preview),
        decorationsHidden,
        hideDecorationsToday,
        showDecorationsToday,
        startPreview,
        stopPreview,
      }}
    >
      {children}
    </BirthdayThemeContext.Provider>
  );
}

export function useBirthdayTheme(): BirthdayThemeValue {
  const ctx = useContext(BirthdayThemeContext);
  if (!ctx) throw new Error("useBirthdayTheme phải được gọi bên trong BirthdayThemeProvider");
  return ctx;
}
