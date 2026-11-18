import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomPages, pageMetadata } from "@/lib/site";
import { Blocks } from "@/components/blocks";
import { PageHero } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };

async function findPage(slug: string) {
  return (await getCustomPages()).find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await findPage((await params).slug);
  return page ? pageMetadata(`p-${page.slug}`) : { title: "Không tìm thấy trang" };
}

/**
 * Trang tự thêm ở chế độ sửa ("Trang này" → "Thêm trang mới", 2026-11-18).
 * Mở đầu bằng dải tiêu đề; thêm nội dung bằng "Thêm khối" trên thanh sửa.
 */
export default async function CustomPage({ params }: Props) {
  const page = await findPage((await params).slug);
  if (!page) notFound();
  return (
    <Blocks
      page={`p-${page.slug}`}
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: <PageHero k={`p.${page.slug}.hero`} eyebrow="Đại Việt" title={page.title} text="Bấm “Sửa nội dung” để gõ phần giới thiệu và thêm khối cho trang này." />,
        },
      ]}
    />
  );
}
