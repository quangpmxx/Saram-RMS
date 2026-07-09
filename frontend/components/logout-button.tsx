"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    try {
      await clientApi("/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void handleLogout()} disabled={isLoading}>
      <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
      {isLoading ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  );
}
