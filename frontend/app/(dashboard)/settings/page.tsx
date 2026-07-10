import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { SystemConfig } from "@/lib/types";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  // Mục 9, docs/13-api-design.md — GET/PUT /config chỉ Admin được dùng.
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const configs = await serverApi<SystemConfig[]>("/config");

  return <SettingsClient initialConfigs={configs} />;
}
