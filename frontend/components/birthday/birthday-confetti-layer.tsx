"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = ["#2563eb", "#f97316", "#fde68a", "#60a5fa", "#fdba74"];
const CONFETTI_COUNT = 24;
const CONFETTI_DURATION_MS = 4000;
const CONFETTI_PLAYED_KEY_PREFIX = "saram_rms_birthday_confetti_played_";
const TIMEZONE = "Asia/Ho_Chi_Minh";

function vnDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 3 + Math.random() * 1.5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 6,
  }));
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16), Mục 5: bóng bay bay chậm ở 2
 * mép màn hình (thường trực khi trang trí đang bật) + confetti rơi nhẹ
 * 3-5 giây CHỈ ở lần mở trang ĐẦU TIÊN trong ngày (sessionStorage, không
 * lặp lại mỗi lần chuyển trang trong cùng phiên — "Không chạy confetti liên
 * tục"). Toàn bộ lớp này pointer-events-none + z-0 (Mục 5/10: không che dữ
 * liệu, không cản thao tác, nằm phía sau nội dung chính).
 */
export function BirthdayConfettiLayer() {
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Mục 5: "Tôn trọng prefers-reduced-motion... chỉ hiển thị giao diện
    // tĩnh" — confetti đứng yên giữa không trung không có ý nghĩa gì, nên
    // không tạo ra luôn thay vì tạo rồi tắt animation.
    if (prefersReducedMotion) return;

    const key = CONFETTI_PLAYED_KEY_PREFIX + vnDateKey();
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage không khả dụng — vẫn phát cho phiên này, không chặn UI.
    }

    // Gọi setState qua setTimeout(0) thay vì trực tiếp trong thân effect —
    // khớp quy ước đã dùng ở notification-bell.tsx (rule react-hooks/set-state-in-effect
    // chỉ cảnh báo lệnh gọi TRỰC TIẾP, không cảnh báo bên trong callback timer).
    const startTimeout = setTimeout(() => setConfetti(buildConfetti()), 0);
    const hideTimeout = setTimeout(() => setConfetti(null), CONFETTI_DURATION_MS);
    return () => {
      clearTimeout(startTimeout);
      clearTimeout(hideTimeout);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <span className="birthday-balloon-float absolute top-24 left-2 text-4xl opacity-70 select-none md:left-4 md:text-5xl">🎈</span>
      <span
        className="birthday-balloon-float absolute top-40 right-2 text-4xl opacity-70 select-none md:right-4 md:text-5xl"
        style={{ animationDelay: "1.2s" }}
      >
        🎈
      </span>

      {confetti?.map((piece) => (
        <span
          key={piece.id}
          className="birthday-confetti-piece absolute top-0 rounded-sm"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.4,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
