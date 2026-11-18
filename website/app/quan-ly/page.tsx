import type { Metadata } from "next";
import { ManageClient } from "./manage-client";

export const metadata: Metadata = {
  title: "Quản lý tin",
  robots: { index: false, follow: false },
};

/** Quản lý tin việc làm, tin tức, album (2026-11-18) — người có quyền "Sửa nội dung website". */
export default function ManagePage() {
  return (
    <section className="min-h-screen bg-mist pt-24 pb-16 sm:pt-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <ManageClient />
      </div>
    </section>
  );
}
