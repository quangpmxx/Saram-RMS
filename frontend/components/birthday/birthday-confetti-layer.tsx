"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = ["#2563eb", "#f97316", "#fde68a", "#60a5fa", "#fdba74"];
const CONFETTI_COUNT = 24;

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const duration = 5 + Math.random() * 3;
    return {
      id: i,
      left: Math.random() * 100,
      // Rải đều độ trễ trong cả chu kỳ rơi để lúc nào cũng có mảnh đang rơi.
      delay: Math.random() * duration,
      duration,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 6,
    };
  });
}

/**
 * Bóng bay bay chậm ở 2 mép màn hình + confetti rơi nhẹ LIÊN TỤC khi trang trí
 * sinh nhật đang bật (2026-11-18 user yêu cầu rơi liên tục, trước đây chỉ rơi
 * 1 lần đầu ngày). Lớp này pointer-events-none + z-0: không che dữ liệu, không
 * cản thao tác. Tôn trọng prefers-reduced-motion: không tạo confetti.
 */
export function BirthdayConfettiLayer() {
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // setState qua setTimeout(0) — khớp quy ước rule react-hooks/set-state-in-effect.
    const startTimeout = setTimeout(() => setConfetti(buildConfetti()), 0);
    return () => clearTimeout(startTimeout);
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
          className="birthday-confetti-piece absolute top-0 rounded-sm opacity-0"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.4,
            backgroundColor: piece.color,
            // Ghi thẳng cả animation (lặp vô hạn) để không phụ thuộc CSS cũ còn trong bộ nhớ trình duyệt.
            animation: `birthday-confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
