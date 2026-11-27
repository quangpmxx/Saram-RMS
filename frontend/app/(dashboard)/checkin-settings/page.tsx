import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasCap } from "@/lib/capabilities";
import { CheckinSettingsClient } from "./checkin-settings-client";

export const metadata: Metadata = { title: "Cài đặt Check in" };

/** Cài đặt Check in (2026-11-27, yêu cầu người dùng): trang riêng, mở từ nút ở Cài đặt tài khoản. Quyền checkin.manage. */
export default async function CheckinSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasCap(user, "checkin.manage")) redirect("/account-settings");
  return <CheckinSettingsClient />;
}
