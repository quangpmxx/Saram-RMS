import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Images } from "lucide-react";
import { formatDate, getPosts, type Post } from "@/lib/content-api";
import { isUploadUrl } from "@/lib/style";
import { pageMetadata } from "@/lib/site";
import { T } from "@/components/editable";
import { Blocks } from "@/components/blocks";
import { PageHero } from "@/components/ui";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("news");
}

function PostCard({ post }: { post: Post }) {
  const cover = post.cover ?? post.images[0];
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-xl">
      <div className="relative aspect-[16/10] overflow-hidden bg-mist">
        {cover && isUploadUrl(cover) && (
          <Image src={`/api${cover}`} alt="" fill unoptimized className="object-cover transition-transform group-hover:scale-105" />
        )}
        {post.kind === "album" && (
          <span className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-ink/80 px-2 py-1 text-xs font-semibold text-white">
            <Images className="h-3.5 w-3.5" aria-hidden="true" /> {post.images.length} ảnh
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {formatDate(post.published_at)}
        </p>
        <h2 className="mt-2 font-display text-lg leading-snug font-bold">
          <Link href={`/tin-tuc/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-royal">
            {post.title}
          </Link>
        </h2>
        {post.summary && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{post.summary}</p>}
      </div>
    </article>
  );
}

/** Tin tức + album ảnh (2026-11-18) — đăng tay ở /quan-ly. ?loai=tin / ?loai=album để lọc. */
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ loai?: string }> }) {
  const loai = (await searchParams).loai;
  const kind = loai === "album" ? "album" : loai === "tin" ? "news" : undefined;
  const posts = await getPosts(kind);
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-ink text-white" : "border border-slate-200 text-slate-600 hover:border-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <Blocks
      page="news"
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: (
            <PageHero
              k="news.hero"
              eyebrow="Tin tức"
              title="Tin tức & hình ảnh Đại Việt"
              text="Hoạt động tuyển dụng, đời sống ký túc xá và những câu chuyện của người lao động."
            />
          ),
        },
        {
          id: "list",
          label: "Danh sách bài",
          node: (
            <section className="py-10 sm:py-16">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="mb-8 flex flex-wrap gap-2">
                  {tab("/tin-tuc", "Tất cả", !kind)}
                  {tab("/tin-tuc?loai=tin", "Tin tức", kind === "news")}
                  {tab("/tin-tuc?loai=album", "Album ảnh", kind === "album")}
                </div>
                {posts.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {posts.map((p) => (
                      <PostCard key={p.id} post={p} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-mist px-5 py-8 text-center text-sm text-slate-500">
                    <T k="news.empty">Chưa có bài viết nào.</T>
                  </p>
                )}
              </div>
            </section>
          ),
        },
      ]}
    />
  );
}
