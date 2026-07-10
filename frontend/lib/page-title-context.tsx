"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface PageTitleValue {
  title: string;
  description?: string;
}

// Tách riêng 2 context: setter (ổn định, không đổi tham chiếu giữa các lần
// render — an toàn làm dependency của useEffect) và value (đổi mỗi khi tiêu
// đề đổi, chỉ PageTitleSlot cần đọc). Gộp chung 1 object context sẽ khiến
// object đó bị tạo mới mỗi lần PageTitleProvider render, làm useEffect ở
// useSetPageTitle chạy lại vô hạn (set state → re-render → context mới →
// effect chạy lại → set state → ...).
const SetPageTitleContext = createContext<((value: PageTitleValue | null) => void) | null>(null);
const PageTitleValueContext = createContext<PageTitleValue | null>(null);

/**
 * UI Polish — cho phép 1 trang "đăng" tiêu đề của mình lên thanh header dùng
 * chung (app/(dashboard)/layout.tsx), thay vì mỗi trang tự vẽ PageHeader
 * riêng trong nội dung. Chỉ trang nào chủ động gọi useSetPageTitle() mới có
 * tiêu đề hiện trên header — các trang khác không đổi hành vi hiện tại.
 */
export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<PageTitleValue | null>(null);
  return (
    <SetPageTitleContext.Provider value={setValue}>
      <PageTitleValueContext.Provider value={value}>{children}</PageTitleValueContext.Provider>
    </SetPageTitleContext.Provider>
  );
}

export function useSetPageTitle(title: string, description?: string): void {
  const setValue = useContext(SetPageTitleContext);
  useEffect(() => {
    if (!setValue) return;
    setValue({ title, description });
    return () => setValue(null);
  }, [setValue, title, description]);
}

export function PageTitleSlot() {
  const value = useContext(PageTitleValueContext);
  if (!value) return null;
  return (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-slate-900">{value.title}</h1>
      {value.description && <p className="truncate text-xs text-slate-500">{value.description}</p>}
    </div>
  );
}
