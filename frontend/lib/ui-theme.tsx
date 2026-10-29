"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { clientApi } from "./api-client";
import { useBirthdayTheme } from "./birthday-theme-context";
import type { Account, UiTheme } from "./types";

/**
 * Giao diện Sáng (mặc định) / Tối — riêng từng tài khoản (yêu cầu người dùng
 * 2026-10-29). Lựa chọn lưu ở DB (accounts.ui_theme, PUT /me/theme) nên đi
 * theo tài khoản, không theo trình duyệt. Bật bằng class "dark" trên <html>;
 * màu tối nằm ở app/dark-theme.css.
 *
 * Ngày có sinh nhật (giao diện sinh nhật đang bật) → luôn dùng giao diện
 * sinh nhật (sáng), bất kể lựa chọn của tài khoản.
 *
 * localStorage chỉ là bản nhớ tạm để script trong app/layout.tsx bật sẵn
 * class trước khi trang hiện ra (không bị nháy trắng); nguồn đúng vẫn là DB.
 */
export const UI_THEME_STORAGE_KEY = "saram_rms_ui_theme";

interface UiThemeValue {
  /** Lựa chọn đã lưu của tài khoản. */
  theme: UiTheme;
  /** Giao diện đang hiển thị thật (sinh nhật → luôn "light"). */
  effectiveTheme: UiTheme;
  /** true khi giao diện sinh nhật đang ghi đè lựa chọn Tối. */
  birthdayOverride: boolean;
  setTheme: (theme: UiTheme) => Promise<void>;
}

const UiThemeContext = createContext<UiThemeValue | null>(null);

function applyTheme(theme: UiTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage không khả dụng — chỉ mất phần chống nháy lúc tải trang.
  }
}

export function UiThemeProvider({ initialTheme, children }: { initialTheme: UiTheme; children: ReactNode }) {
  const [theme, setThemeState] = useState<UiTheme>(initialTheme);
  const { hasBirthdayToday, decorationsHidden } = useBirthdayTheme();
  const birthdayActive = hasBirthdayToday && !decorationsHidden;
  const effectiveTheme: UiTheme = birthdayActive ? "light" : theme;

  useLayoutEffect(() => {
    applyTheme(effectiveTheme);
  }, [effectiveTheme]);

  // Rời khu vực đăng nhập (vd về /login) → trả lại giao diện sáng.
  useLayoutEffect(() => () => document.documentElement.classList.remove("dark"), []);

  const setTheme = useCallback(
    async (next: UiTheme) => {
      const previous = theme;
      setThemeState(next);
      try {
        await clientApi<Account>("/me/theme", { method: "PUT", body: JSON.stringify({ theme: next }) });
      } catch (error) {
        setThemeState(previous);
        throw error;
      }
    },
    [theme],
  );

  return (
    <UiThemeContext.Provider
      value={{ theme, effectiveTheme, birthdayOverride: birthdayActive && theme === "dark", setTheme }}
    >
      {children}
    </UiThemeContext.Provider>
  );
}

export function useUiTheme(): UiThemeValue {
  const value = useContext(UiThemeContext);
  if (!value) throw new Error("useUiTheme phải dùng bên trong UiThemeProvider");
  return value;
}
