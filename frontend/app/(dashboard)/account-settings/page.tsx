import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AccountSettingsClient } from "./account-settings-client";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <AccountSettingsClient user={user} />;
}
