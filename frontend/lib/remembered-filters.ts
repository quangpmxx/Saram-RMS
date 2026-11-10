"use client";

import { useEffect, useRef } from "react";
import { computeDateRange, type DateRangeValue } from "./date-range";

/**
 * Ghi nhớ bộ lọc của từng trang (yêu cầu người dùng 2026-11-10): lọc "Hôm
 * qua", bấm vào 1 data xử lý rồi quay lại → trang vẫn đang lọc "Hôm qua".
 *
 * Lưu trong sessionStorage — chỉ sống trong tab hiện tại, đóng tab là mất;
 * đăng nhập lại thì xoá sạch (clearRememberedFilters ở form đăng nhập) để
 * không mang bộ lọc của người trước sang. Vị trí cuộn do NavigationTracker
 * (lib/navigation-history.ts) lo.
 *
 * Mốc ngày kiểu "Hôm nay", "Tháng này"... được TÍNH LẠI khi khôi phục (để
 * qua ngày mới thì "Hôm nay" vẫn là hôm nay); chỉ khoảng tự chọn mới giữ
 * nguyên ngày cũ.
 */
const PREFIX = "saram_rms_filters:";

function isDateRangeValue(value: unknown): value is DateRangeValue {
  return (
    !!value &&
    typeof value === "object" &&
    "preset" in value &&
    "from" in value &&
    "to" in value
  );
}

function refreshPresets<T>(value: T): T {
  if (isDateRangeValue(value)) {
    if (value.preset === "custom") return value;
    return { ...value, ...computeDateRange(value.preset) } as T;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = refreshPresets(v);
    return out as T;
  }
  return value;
}

export function readRememberedFilters<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? refreshPresets(JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearRememberedFilters() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    // sessionStorage không khả dụng — bỏ qua.
  }
}

/**
 * Gắn vào 1 trang: lúc mở trang, nếu có bộ lọc đã nhớ (khác bộ lọc mặc định)
 * thì gọi `onRestore(saved)` — trang tự đặt lại state + tải lại dữ liệu theo
 * bộ lọc đó. Sau đó mỗi lần bộ lọc đổi thì tự lưu lại.
 *
 * `enabled = false`: không khôi phục (vd URL đã mang sẵn bộ lọc từ Dashboard)
 * nhưng vẫn lưu bộ lọc mới.
 */
export function useRememberedFilters<T>(
  key: string,
  value: T,
  onRestore: (saved: T) => void,
  enabled = true,
) {
  const readyRef = useRef(false);
  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (enabled) {
      const saved = readRememberedFilters<T>(key);
      if (saved && JSON.stringify(saved) !== serialized) onRestore(saved);
    }
    // Lượt lưu đầu tiên bỏ qua (giá trị mặc định lúc mở trang) — tránh ghi đè
    // bộ lọc đã nhớ trước khi state kịp khôi phục.
    const timer = window.setTimeout(() => {
      readyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
    // Chỉ chạy 1 lần lúc mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    try {
      sessionStorage.setItem(PREFIX + key, serialized);
    } catch {
      // sessionStorage không khả dụng — bỏ qua.
    }
  }, [key, serialized]);
}
