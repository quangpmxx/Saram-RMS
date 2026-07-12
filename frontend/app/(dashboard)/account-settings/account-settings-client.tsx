"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { ApiError, clientApi, clientApiUpload } from "@/lib/api-client";
import type { Account } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/lib/toast-context";

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — khớp đúng giới hạn backend (POST /me/avatar)

/**
 * Tinh chỉnh khu vực tài khoản (dự án phụ — nâng cấp toàn diện): trang riêng
 * "Cài đặt tài khoản" — ảnh đại diện, tên người dùng (readonly, chỉ Admin
 * đổi được cho tài khoản khác qua màn Quản lý tài khoản), đổi mật khẩu.
 * Trước đây là modal, đổi sang trang riêng để tránh giới hạn chiều cao popup.
 */
export function AccountSettingsClient({ user }: { user: Account }) {
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
      <PageHeader title="Cài đặt tài khoản" description="Ảnh đại diện, tên người dùng và mật khẩu đăng nhập." />

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

          {/* Tên người dùng — readonly, chỉ Admin đổi được cho tài khoản khác qua Quản lý tài khoản */}
          <section>
            <Field label="Tên người dùng" hint="Chỉ Admin mới đổi được, qua màn Quản lý tài khoản.">
              <Input value={user.full_name} disabled readOnly />
            </Field>
          </section>

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
