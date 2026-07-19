"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useSetPageTitle } from "@/lib/page-title-context";
import type { DsSaleAccountOption, DsSaleCompanyOption, DsSaleRow, PaginatedResult } from "@/lib/types";
import { DsSaleClient } from "./ds-sale-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, yêu cầu trực tiếp người
 * dùng): module "Nhập doanh số" có module con đầu tiên — "DS Sale". Yêu
 * cầu: "Trang DS Sale phải xuất hiện trong menu con của Nhập doanh số.
 * Không tạo thêm module độc lập ngoài sidebar." — sidebar-nav.tsx hiện KHÔNG
 * có khái niệm menu con lồng cấp (dùng chung cho toàn hệ thống, đụng vào sẽ
 * ảnh hưởng mọi module khác) — tái dùng đúng khuôn mẫu "tab trong 1 trang"
 * đã áp dụng ở attendance-client.tsx (tab "Check in GPS"/"Đơn xin nghỉ
 * phép") để có 1 "menu con" thật trong trang mà không đụng kiến trúc
 * sidebar dùng chung.
 */
export function SalesEntryClient({
  currentUserId,
  initialRows,
  initialSaleAccounts,
  initialPickupAccounts,
  initialCompanies,
}: {
  currentUserId: string;
  initialRows: PaginatedResult<DsSaleRow>;
  initialSaleAccounts: DsSaleAccountOption[];
  initialPickupAccounts: DsSaleAccountOption[];
  initialCompanies: DsSaleCompanyOption[];
}) {
  useSetPageTitle("Nhập doanh số");
  // Chỉ 1 tab hiện tại — vẫn giữ dạng "thanh tab" (không render thẳng nội
  // dung) để có 1 "menu con" thật trong trang, sẵn chỗ mở rộng thêm module
  // con khác của "Nhập doanh số" sau này mà không phải đổi cấu trúc.
  const [activeTab, setActiveTab] = useState<"ds-sale">("ds-sale");

  // Yêu cầu trực tiếp người dùng (2026-07-17): "Ghim cố định thanh tiêu đề
  // ... không cho di chuyển khi cuộn" — DsSaleClient tự đo header hệ thống +
  // thanh bộ lọc của chính nó, nhưng KHÔNG biết chiều cao thanh tab này (nằm
  // ở component cha) — đo riêng ở đây rồi truyền xuống làm phần cộng thêm,
  // khớp đúng kỹ thuật ResizeObserver đã dùng ở attendance/shuttle-client.tsx.
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [tabBarHeight, setTabBarHeight] = useState(0);

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setTabBarHeight(entry.target.getBoundingClientRect().height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-3">
      <div ref={tabBarRef} className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("ds-sale")}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            activeTab === "ds-sale" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
          )}
        >
          DS Sale
        </button>
      </div>

      {activeTab === "ds-sale" && (
        <DsSaleClient
          currentUserId={currentUserId}
          initialRows={initialRows}
          initialSaleAccounts={initialSaleAccounts}
          initialPickupAccounts={initialPickupAccounts}
          initialCompanies={initialCompanies}
          extraTopOffset={tabBarHeight}
        />
      )}
    </div>
  );
}
