import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { formatDate, getPost } from "@/lib/content-api";
import { isUploadUrl } from "@/lib/style";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Không tìm thấy bài viết" };
  const cover = post.cover ?? post.images[0];
  return {
    title: post.title,
    description: post.summary ?? undefined,
    openGraph: cover && isUploadUrl(cover) ? { images: [`/api${cover}`] } : undefined,
  };
}

/** Một bài tin tức / album ảnh (2026-11-18). Nội dung là chữ thường, xuống dòng giữ nguyên. */
export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const images = post.images.filter(isUploadUrl);
  return (
    <>
      <section className="hero-bg relative overflow-hidden text-white">
        <div className="grid-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 pt-28 pb-12 sm:px-6 sm:pt-36 sm:pb-16">
          <Link href="/tin-tuc" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Tin tức
          </Link>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-300">
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> {formatDate(post.published_at)}
          </p>
        </div>
      </section>
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        {post.cover && isUploadUrl(post.cover) && post.kind === "news" && (
          <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-3xl">
            <Image src={`/api${post.cover}`} alt={post.title} fill unoptimized className="object-cover" />
          </div>
        )}
        {post.summary && <p className="text-lg leading-relaxed font-medium text-slate-700">{post.summary}</p>}
        {post.body && <div className="mt-6 leading-relaxed whitespace-pre-line text-slate-700">{post.body}</div>}
        {images.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((src) => (
              <a key={src} href={`/api${src}`} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-2xl">
                <Image src={`/api${src}`} alt="" fill unoptimized className="object-cover transition-transform hover:scale-105" />
              </a>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
