import { ArrowRight } from "lucide-react";
import type { CustomBlock } from "@/lib/pages";
import { getJobs, getPosts } from "@/lib/content-api";
import { EImage, T } from "./editable";
import { ButtonLink, SectionHeading } from "./ui";
import { JobCard } from "./lists";
import { RegisterForm } from "./register";
import Link from "next/link";

/** Ảnh mặc định của khối mới (người sửa bấm vào ảnh để đổi). */
const PLACEHOLDER = "/images/ktx-nam-son-1.png";

/**
 * Khối thêm từ mẫu ở chế độ sửa (lib/pages.ts) — 2026-11-18.
 * Chữ dùng mã cb.<id>.<trường> nên sửa tại chỗ như mọi chỗ khác; cấu hình riêng (ảnh trái/phải, số câu hỏi,
 * video, loại form) đổi trên thanh khối.
 */
export async function CustomBlockView({ block }: { block: CustomBlock }) {
  const k = (f: string) => `cb.${block.id}.${f}`;
  switch (block.type) {
    case "text":
      return (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              <T k={k("title")}>Tiêu đề mới</T>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              <T k={k("text")}>Bấm vào đây để gõ nội dung. Xuống dòng bằng Enter.</T>
            </p>
          </div>
        </section>
      );
    case "text-image":
      return (
        <section className="py-14 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl ${block.right ? "lg:order-2" : ""}`}>
              <EImage k={k("img")} src={PLACEHOLDER} alt="" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                <T k={k("title")}>Tiêu đề mới</T>
              </h2>
              <p className="mt-5 leading-relaxed text-slate-600">
                <T k={k("text")}>Bấm vào đây để gõ nội dung; bấm vào ảnh để đổi ảnh.</T>
              </p>
            </div>
          </div>
        </section>
      );
    case "image":
      return (
        <section className="py-10 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative aspect-[16/7] overflow-hidden rounded-3xl">
              <EImage k={k("img")} src={PLACEHOLDER} alt="" fill sizes="100vw" className="object-cover" />
            </div>
            <p className="mt-3 text-center text-sm text-slate-500">
              <T k={k("caption")}>Chú thích ảnh</T>
            </p>
          </div>
        </section>
      );
    case "faq": {
      const n = block.n ?? 3;
      return (
        <section className="bg-mist py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
              <T k={k("title")}>Câu hỏi thường gặp</T>
            </h2>
            <div className="mt-8 space-y-3">
              {Array.from({ length: n }, (_, i) => (
                <details key={i} className="group rounded-2xl border border-slate-200 bg-white p-5 open:shadow-md" open={i === 0}>
                  <summary className="cursor-pointer list-none font-semibold">
                    <T k={k(`q${i}`)}>{`Câu hỏi ${i + 1}?`}</T>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    <T k={k(`a${i}`)}>Câu trả lời.</T>
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "video":
      return (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
              <T k={k("title")}>Video</T>
            </h2>
            <div className="mt-8 aspect-video overflow-hidden rounded-3xl bg-ink">
              {block.video ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${block.video}`}
                  title="Video"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <p className="grid h-full place-items-center text-sm text-slate-400">Chưa chọn video — bấm vào khối rồi bấm “Video YouTube” trên thanh sửa.</p>
              )}
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="hero-bg relative overflow-hidden py-14 text-white sm:py-20">
          <div className="grid-dots absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              <T k={k("title")}>Tiêu đề kêu gọi</T>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              <T k={k("text")}>Một câu ngắn mời khách hành động.</T>
            </p>
            <div className="mt-8 flex justify-center">
              <ButtonLink href="/lien-he">
                <T k={k("btn")}>Liên hệ ngay</T>
              </ButtonLink>
            </div>
          </div>
        </section>
      );
    case "jobs": {
      const jobs = (await getJobs()).slice(0, 6);
      return (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <SectionHeading k={k("head")} eyebrow="Việc làm" title="Đang tuyển" />
              <ButtonLink href="/viec-lam" variant="outline">
                <T k={k("btn")}>Xem tất cả việc làm</T> <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
            {jobs.length > 0 ? (
              <div className="mt-8 grid gap-x-5 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <p className="mt-8 rounded-2xl bg-mist px-5 py-6 text-center text-sm text-slate-500">Chưa có tin việc làm nào được đăng.</p>
            )}
          </div>
        </section>
      );
    }
    case "posts": {
      const posts = (await getPosts()).slice(0, 3);
      return (
        <section className="bg-mist py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading k={k("head")} eyebrow="Tin tức" title="Tin mới" />
            {posts.length > 0 ? (
              <ul className="mt-8 grid gap-4 sm:grid-cols-3">
                {posts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/tin-tuc/${p.slug}`} className="block h-full rounded-2xl border border-slate-200 bg-white p-5 font-semibold hover:border-royal">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 text-sm text-slate-500">Chưa có bài viết nào.</p>
            )}
          </div>
        </section>
      );
    }
    case "form":
      return (
        <section className="py-14 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                <T k={k("title")}>{block.form === "business" ? "Nhà máy cần tuyển người?" : "Đăng ký tìm việc ngay"}</T>
              </h2>
              <p className="mt-5 leading-relaxed text-slate-600">
                <T k={k("text")}>Để lại thông tin, Đại Việt gọi lại trong thời gian sớm nhất.</T>
              </p>
            </div>
            <div className="rounded-3xl bg-ink p-2">
              <RegisterForm kind={block.form ?? "worker"} />
            </div>
          </div>
        </section>
      );
  }
}
