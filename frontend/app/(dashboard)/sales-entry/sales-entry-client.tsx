"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useSetPageTitle } from "@/lib/page-title-context";
import type {
  AccountRole,
  DsKind,
  DsSaleAccountOption,
  DsSaleCompanyOption,
  DsSalePage,
  DsSaleRow,
  ModulePermissionLevel,
  PaginatedResult,
} from "@/lib/types";
import { listDsCheckAccounts, listDsSaleAccounts, listDsSaleRows } from "@/lib/ds-sale-api";
import { DsSaleClient } from "./ds-sale-client";

type MainTab = "sales" | "bonus";
type SalesSubTab = "ds-sale" | "ds-media" | "ds-recruitment" | "ds-shuttle";

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "sales", label: "Nhập doanh số" },
  { key: "bonus", label: "Nhập thưởng" },
];

const SALES_SUB_TABS: Array<{ key: SalesSubTab; label: string }> = [
  { key: "ds-sale", label: "DS Sale" },
  { key: "ds-media", label: "DS Media" },
  { key: "ds-recruitment", label: "DS Tuyển dụng" },
  { key: "ds-shuttle", label: "DS Đưa đón" },
];

const STAFF_KINDS: Record<Exclude<SalesSubTab, "ds-sale">, Exclude<DsKind, "sale" | "bonus">> = {
  "ds-media": "media",
  "ds-recruitment": "recruitment",
  "ds-shuttle": "shuttle",
};

const STAFF_TAB_KEYS = Object.keys(STAFF_KINDS) as Array<keyof typeof STAFF_KINDS>;

const STAFF_PAGE_SIZE = 100;

/** Người chọn được ở cột "Người tuyển" / "Check" — 3 tab dùng chung, tải 1 lần. */
interface StaffAccounts {
  recruiters: DsSaleAccountOption[];
  checkers: DsSaleAccountOption[];
}

/**
 * DS Media / DS Tuyển dụng / DS Đưa đón (2026-11-12): cùng bảng nhập kiểu sheet
 * với DS Sale, bộ cột theo file Excel mẫu của user. Cả 3 tab được tải ngầm ngay
 * khi vào trang và giữ nguyên (chỉ ẩn đi) khi chuyển tab — bấm sang là hiện
 * ngay, không phải chờ tải lại mỗi lần (yêu cầu người dùng 2026-11-12).
 */
function DsStaffTab({
  kind,
  active,
  accounts,
  accountsFailed,
  companies,
  year,
  month,
  ...shared
}: {
  kind: Exclude<DsKind, "sale">;
  /** Tab đang được chọn — tab khác vẫn chạy ngầm nhưng ẩn. */
  active: boolean;
  /** null = danh sách người chọn chưa tải xong. */
  accounts: StaffAccounts | null;
  accountsFailed: boolean;
  permissionLevel: ModulePermissionLevel;
  currentUserId: string;
  currentUserRole: AccountRole;
  currentUserFullName: string;
  currentUserNickname: string | null;
  companies: DsSaleCompanyOption[];
  /** Kỳ mặc định khi mở tab. */
  year: number;
  month: number;
  extraTopOffset: number;
}) {
  const [rows, setRows] = useState<DsSalePage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDsSaleRows({ kind, page: 1, page_size: STAFF_PAGE_SIZE, year, month })
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, year, month]);

  if (failed || accountsFailed) {
    if (!active) return null;
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        Không tải được dữ liệu. Tải lại trang để thử lại.
      </div>
    );
  }
  if (!rows || !accounts) {
    if (!active) return null;
    return <div className="px-4 py-10 text-center text-sm text-slate-500">Đang tải...</div>;
  }
  return (
    <div className={active ? undefined : "hidden"}>
      <DsSaleClient
        {...shared}
        kind={kind}
        initialRows={rows}
        initialSaleAccounts={accounts.recruiters}
        initialPickupAccounts={NO_ACCOUNTS}
        initialCheckAccounts={accounts.checkers}
        initialCompanies={companies}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}

const NO_ACCOUNTS: DsSaleAccountOption[] = [];

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
  initialYear,
  initialMonth,
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
  /** Kỳ mặc định (tháng hiện tại, giờ Việt Nam) — tính ở server để mọi tab khớp nhau. */
  initialYear: number;
  initialMonth: number;
}) {
  useSetPageTitle("Nhập DS/Thưởng");
  // Yêu cầu trực tiếp người dùng (2026-11-12): trang đổi tên "Nhập DS/Thưởng",
  // 2 tab lớn "Nhập doanh số" / "Nhập thưởng"; trong "Nhập doanh số" có tab nhỏ
  // DS Sale, DS Media... (thêm tab nhỏ mới: thêm vào SALES_SUB_TABS).
  const [mainTab, setMainTab] = useState<MainTab>("sales");
  const [activeTab, setActiveTab] = useState<SalesSubTab>("ds-sale");

  // Cột "Sale" của Nhập thưởng dùng đúng danh sách Sale đã tải sẵn cho DS Sale.
  const bonusAccounts = useMemo<StaffAccounts>(
    () => ({ recruiters: initialSaleAccounts, checkers: NO_ACCOUNTS }),
    [initialSaleAccounts],
  );

  // Danh sách người chọn (Người tuyển / Check) giống nhau ở cả 3 tab DS Media,
  // DS Tuyển dụng, DS Đưa đón — tải ngầm 1 lần ngay khi vào trang.
  const [staffAccounts, setStaffAccounts] = useState<StaffAccounts | null>(null);
  const [staffAccountsFailed, setStaffAccountsFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listDsSaleAccounts("media"), listDsCheckAccounts()])
      .then(([recruiters, checkers]) => {
        if (!cancelled) setStaffAccounts({ recruiters, checkers });
      })
      .catch(() => {
        if (!cancelled) setStaffAccountsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

      {/* Nhập thưởng: một danh sách dùng chung mọi bộ phận, để Kế toán chi (2026-11-12). */}
      <DsStaffTab
        kind="bonus"
        active={mainTab === "bonus"}
        accounts={bonusAccounts}
        accountsFailed={false}
        permissionLevel={permissionLevel}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        currentUserFullName={currentUserFullName}
        currentUserNickname={currentUserNickname}
        companies={initialCompanies}
          year={initialYear}
          month={initialMonth}
        extraTopOffset={tabBarHeight}
      />
      {STAFF_TAB_KEYS.map((tabKey) => (
        <DsStaffTab
          key={tabKey}
          kind={STAFF_KINDS[tabKey]}
          active={mainTab === "sales" && activeTab === tabKey}
          accounts={staffAccounts}
          accountsFailed={staffAccountsFailed}
          permissionLevel={permissionLevel}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          currentUserFullName={currentUserFullName}
          currentUserNickname={currentUserNickname}
          companies={initialCompanies}
          year={initialYear}
          month={initialMonth}
          extraTopOffset={tabBarHeight}
        />
      ))}

      {/* Ẩn chứ không gỡ khỏi trang — chuyển tab qua lại không mất dòng đang nhập dở. */}
      <div className={mainTab === "sales" && activeTab === "ds-sale" ? undefined : "hidden"}>
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
          initialYear={initialYear}
          initialMonth={initialMonth}
          extraTopOffset={tabBarHeight}
        />
      </div>
    </div>
  );
}
