"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSetPageTitle } from "@/lib/page-title-context";
import { CheckinLocationSettings } from "./checkin-location-settings";

export function CheckinSettingsClient() {
  useSetPageTitle("Cài đặt Check in");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account-settings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Cài đặt tài khoản
      </Link>
      <Card className="p-5">
        <CheckinLocationSettings />
      </Card>
    </div>
  );
}
