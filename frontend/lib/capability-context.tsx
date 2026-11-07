"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

/** Phân quyền chi tiết (2026-11-07): danh sách quyền nhỏ của người đang đăng nhập cho client component. */
const CapabilityContext = createContext<readonly string[]>([]);

export function CapabilityProvider({ capabilities, children }: { capabilities: readonly string[]; children: ReactNode }) {
  return <CapabilityContext.Provider value={capabilities}>{children}</CapabilityContext.Provider>;
}

/** `const can = useCan(); can("lead.assign")` — chỉ để ẩn/hiện nút, backend vẫn chặn thật. */
export function useCan(): (code: string) => boolean {
  const caps = useContext(CapabilityContext);
  return useCallback((code: string) => caps.includes(code), [caps]);
}

/** Danh sách quyền nhỏ thô — dùng cho lib/lead-permissions.ts (LeadViewer.caps). */
export function useCapabilities(): readonly string[] {
  return useContext(CapabilityContext);
}
