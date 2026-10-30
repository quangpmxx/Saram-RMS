"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Upload } from "lucide-react";
import { ApiError, clientApi, clientApiUpload } from "@/lib/api-client";
import type { Account } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { BirthdayPreviewPanel } from "@/components/birthday/birthday-preview-panel";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { useUiTheme } from "@/lib/ui-theme";
import { cn } from "@/lib/cn";
import type { UiTheme } from "@/lib/types";
import { CheckinLocationSettings } from "./checkin-location-settings";

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — khớp đúng giới hạn backend (POST /me/avatar)

/** "YYYY-MM-DD" -> "DD/MM/YYYY" cho dễ đọc — chỉ dùng để hiển thị readonly, không phải input thật. */
function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Tinh chỉnh khu vực tài khoản (dự án phụ — nâng cấp toàn diện): trang riêng
 * "Cài đặt tài khoản" — ảnh đại diện, tên người dùng (readonly, chỉ Admin
 * đổi được cho tài khoản khác qua màn Quản lý tài khoản), đổi mật khẩu.
 * Trước đây là modal, đổi sang trang riêng để tránh giới hạn chiều cao popup.
 */
export function AccountSettingsClient({ user, accounts }: { user: Account; accounts: Account[] }) {
  useSetPageTitle("Cài đặt tài khoản");
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);
  const hasChanges = Boolean(selectedFile) || wantsPasswordChange;

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setAvatarError(null);
    if (!file) return;

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setAvatarError("Chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WebP");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setAvatarError("Dung lượng ảnh tối đa 2MB");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSaveChanges() {
    setAvatarError(null);
    setPasswordError(null);

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError("Vui lòng nhập đầy đủ 3 trường");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Mật khẩu mới và xác nhận mật khẩu không khớp");
        return;
      }
    }
    if (!selectedFile && !wantsPasswordChange) return;

    setIsSaving(true);
    try {
      if (selectedFile) {
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);
          await clientApiUpload("/me/avatar", formData);
          toast.success("Đã cập nhật ảnh đại diện");
          setSelectedFile(null);
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
          setAvatarError(error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
        }
      }

      if (wantsPasswordChange) {
        try {
          await clientApi("/me/password", {
            method: "PUT",
            body: JSON.stringify({
              current_password: currentPassword,
              new_password: newPassword,
              confirm_password: confirmPassword,
            }),
          });
          toast.success("Đã đổi mật khẩu thành công");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } catch (error) {
          setPasswordError(error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
        }
      }

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          {/* Ảnh đại diện */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Ảnh đại diện</h3>
            <div className="mt-3 flex items-center gap-4">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview cục bộ từ URL.createObjectURL, không phải asset tĩnh
                <img src={previewUrl} alt="Xem trước ảnh đại diện" className="h-16 w-16 shrink-0 rounded-full object-cover" />
              ) : (
                <Avatar fullName={user.full_name} avatarUrl={user.avatar_url} className="h-16 w-16 text-lg" />
              )}
              <div className="flex flex-col gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="avatar-upload-input"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                  Đổi ảnh
                </Button>
                <p className="text-xs text-slate-400">JPEG/PNG/WebP, tối đa 2MB.</p>
              </div>
            </div>
            {avatarError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {avatarError}
              </p>
            )}
          </section>

          <ThemeSection />

          {/* Tên người dùng — readonly, chỉ Admin đổi được cho tài khoản khác qua Quản lý tài khoản */}
          <section>
            <Field label="Tên người dùng">
              <Input value={user.full_name} disabled readOnly />
            </Field>
          </section>

          {/* Thông tin nhân sự — readonly (yêu cầu trực tiếp người dùng,
              2026-07-15): "Nhân viên nhìn thấy thông tin ở mục Cài đặt tài
              khoản" — CHỈ Admin sửa được qua trang Quản lý tài khoản, ở đây
              chỉ hiển thị, cùng pattern disabled/readOnly + hint đã dùng cho
              "Tên người dùng" ở trên. */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Thông tin nhân sự</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Ngày sinh">
                <Input value={formatDateOnly(user.date_of_birth)} disabled readOnly />
              </Field>
              <Field label="Ngày bắt đầu làm việc">
                <Input value={formatDateOnly(user.hire_date)} disabled readOnly />
              </Field>
              <Field label="Số điện thoại cá nhân">
                <Input value={user.personal_phone ?? "—"} disabled readOnly />
              </Field>
              <Field label="Email cá nhân">
                <Input value={user.personal_email ?? "—"} disabled readOnly />
              </Field>
              <Field label="Số ngày phép còn lại">
                <Input value={user.remaining_leave_days != null ? String(user.remaining_leave_days) : "—"} disabled readOnly />
              </Field>
              <Field label="Số CCCD">
                <Input value={user.citizen_id ?? "—"} disabled readOnly />
              </Field>
              <Field label="Số tài khoản ngân hàng">
                <Input value={user.bank_account_number ?? "—"} disabled readOnly />
              </Field>
            </div>
          </section>

          {/* Cài đặt Check in — Mục 7, yêu cầu trực tiếp người dùng
              (2026-07-15): "Trong phần Cài đặt tài khoản dành cho Admin,
              thêm mục 'Cài đặt Check in'" — CHỈ hiện với Admin, backend
              (checkin.service.ts) kiểm tra quyền lại lần nữa. */}
          {/* Quản lý cũng cấu hình được (rà soát phân quyền 2026-10-30). */}
          {(user.role === "admin" || user.role === "manager") && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Cài đặt Check in</h3>
              <p className="mt-1 text-xs text-slate-500">Vị trí công ty dùng để xác định nhân viên Check in trong/ngoài phạm vi.</p>
              <div className="mt-3">
                <CheckinLocationSettings />
              </div>
            </section>
          )}

          {/* Xem thử giao diện sinh nhật — dời từ trang Cấu hình vận hành
              sang đây (yêu cầu trực tiếp người dùng, 2026-07-24), chỉ Admin
              thấy — cùng pattern admin-only với "Cài đặt Check in" ở trên. */}
          {user.role === "admin" && (
            <section>
              <BirthdayPreviewPanel accounts={accounts} />
            </section>
          )}

          {/* Đổi mật khẩu */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Đổi mật khẩu</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Mật khẩu hiện tại">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Field label="Mật khẩu mới">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Xác nhận mật khẩu mới">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              {passwordError && (
                <p role="alert" className="text-sm text-red-600">
                  {passwordError}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push("/")}>
            Quay lại
          </Button>
          <Button type="button" disabled={isSaving || !hasChanges} onClick={() => void handleSaveChanges()}>
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

const THEME_OPTIONS: { value: UiTheme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Mặc định", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
];

/**
 * Giao diện Sáng/Tối (yêu cầu người dùng 2026-10-29) — đổi là áp dụng và lưu
 * ngay (không chờ nút Lưu), chỉ cho chính tài khoản này.
 */
function ThemeSection() {
  const { theme, birthdayOverride, setTheme } = useUiTheme();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function pick(next: UiTheme) {
    if (next === theme || pending) return;
    setPending(true);
    try {
      await setTheme(next);
      toast.success(next === "dark" ? "Đã chuyển sang giao diện Tối" : "Đã chuyển về giao diện mặc định");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">Giao diện</h3>
      <div role="radiogroup" aria-label="Giao diện" className="mt-3 flex gap-2">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => void pick(value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                selected
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </div>
      {birthdayOverride && (
        <p className="mt-2 text-xs text-slate-500">Hôm nay có sinh nhật nên đang dùng giao diện sinh nhật.</p>
      )}
    </section>
  );
}
