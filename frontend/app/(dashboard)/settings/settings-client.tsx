"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Settings2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { SystemConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/lib/toast-context";

/** Tên hiển thị thân thiện cho từng tham số đã biết — Mục 9.2, docs/12-ui-design.md. */
const CONFIG_LABEL: Record<string, string> = {
  CARE_POOL_THRESHOLD_MINUTES: "Ngưỡng thời gian vào Cột chăm sóc (phút)",
  NOTIFICATION_LEAD_MINUTES: "Số phút nhắc trước giờ hẹn qua Zalo (phút)",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

export function SettingsClient({ initialConfigs }: { initialConfigs: SystemConfig[] }) {
  const router = useRouter();
  const [configs, setConfigs] = useState(initialConfigs);
  const [editing, setEditing] = useState<SystemConfig | null>(null);
  const toast = useToast();

  async function refresh() {
    const result = await clientApi<SystemConfig[]>("/config");
    setConfigs(result);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Cấu hình vận hành"
        description="Tham số vận hành toàn hệ thống — chỉ Admin xem/sửa được."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
                <th className="px-4 py-3">Tham số</th>
                <th className="px-4 py-3">Giá trị hiện tại</th>
                <th className="px-4 py-3">Mô tả</th>
                <th className="px-4 py-3">Cập nhật gần nhất</th>
                <th className="px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map((config) => (
                <tr key={config.key} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {CONFIG_LABEL[config.key] ?? config.key}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{config.value}</td>
                  <td className="px-4 py-3 text-slate-500">{config.description ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(config.updated_at)} · {config.updated_by.name}
                  </td>
                  <td className="px-4 py-3">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(config)}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Sửa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {configs.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-500">
            <Settings2 className="h-5 w-5" strokeWidth={1.75} />
            Chưa có tham số cấu hình nào
          </div>
        )}
      </Card>

      {editing && (
        <EditConfigModal
          config={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
            toast.success("Đã lưu cấu hình");
          }}
        />
      )}
    </div>
  );
}

function EditConfigModal({
  config,
  onClose,
  onSaved,
}: {
  config: SystemConfig;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(config.value);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!value.trim()) {
      setError("Vui lòng nhập giá trị");
      return;
    }
    if (
      !window.confirm(
        "Thay đổi tham số này sẽ ảnh hưởng đến toàn hệ thống. Bạn có chắc chắn muốn lưu?",
      )
    ) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/config/${config.key}`, {
        method: "PUT",
        body: JSON.stringify({ value: value.trim() }),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Sửa cấu hình — ${CONFIG_LABEL[config.key] ?? config.key}`}
      description={config.description ?? undefined}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Giá trị mới">
          <Input value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
