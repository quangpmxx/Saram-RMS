"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useSetPageTitle } from "@/lib/page-title-context";
import type { AccountRole, DsSaleAccountOption, DsSaleCompanyOption, DsSaleRow, ModulePermissionLevel, PaginatedResult } from "@/lib/types";
import { DsSaleClient } from "./ds-sale-client";

type MainTab = "sales" | "bonus";
type SalesSubTab = "ds-sale" | "ds-media";

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "sales", label: "Nhập doanh số" },
  { key: "bonus", label: "Nhập thưởng" },
];

const SALES_SUB_TABS: Array<{ key: SalesSubTab; label: string }> = [
  { key: "ds-sale", label: "DS Sale" },
  { key: "ds-media", label: "DS Media" },
];

/** Tab đã có chỗ nhưng chưa có nội dung — chờ user mô tả các cột cần nhập. */
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      Phần {name} đang được xây dựng.
    </div>
  );
}

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
  permissionLevel,
  currentUserId,
  currentUserRole,
  currentUserFullName,
  currentUserNickname,
  initialRows,
  initialSaleAccounts,
  initialPickupAccounts,
  initialCompanies,
}: {
  permissionLevel: ModulePermissionLevel;
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserFullName: string;
  currentUserNickname: string | null;
  initialRows: PaginatedResult<DsSaleRow>;
  initialSaleAccounts: DsSaleAccountOption[];
  initialPickupAccounts: DsSaleAccountOption[];
  initialCompanies: DsSaleCompanyOption[];
}) {
  useSetPageTitle("Nhập DS/Thưởng");
  // Yêu cầu trực tiếp người dùng (2026-11-12): trang đổi tên "Nhập DS/Thưởng",
  // 2 tab lớn "Nhập doanh số" / "Nhập thưởng"; trong "Nhập doanh số" có tab nhỏ
  // DS Sale, DS Media... (thêm tab nhỏ mới: thêm vào SALES_SUB_TABS).
  const [mainTab, setMainTab] = useState<MainTab>("sales");
  const [activeTab, setActiveTab] = useState<SalesSubTab>("ds-sale");

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
      <div ref={tabBarRef} className="space-y-2">
        <div className="flex gap-4 border-b border-slate-200">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMainTab(tab.key)}
              className={cn(
                "-mb-px border-b-2 px-1 pb-1.5 text-sm font-semibold transition-colors",
                mainTab === tab.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {mainTab === "sales" && (
          <div className="flex gap-1.5">
            {SALES_SUB_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  activeTab === tab.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mainTab === "bonus" && <ComingSoon name="Nhập thưởng" />}
      {mainTab === "sales" && activeTab === "ds-media" && <ComingSoon name="DS Media" />}

      {mainTab === "sales" && activeTab === "ds-sale" && (
        <DsSaleClient
          permissionLevel={permissionLevel}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          currentUserFullName={currentUserFullName}
          currentUserNickname={currentUserNickname}
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
