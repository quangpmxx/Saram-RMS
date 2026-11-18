import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Clock, Factory, Flame, MapPin } from "lucide-react";
import { getJob } from "@/lib/content-api";
import { isUploadUrl } from "@/lib/style";
import { RegisterForm } from "@/components/register";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getJob((await params).slug);
  if (!job) return { title: "Không tìm thấy tin" };
  const desc = [job.company, job.area, job.salary].filter(Boolean).join(" · ");
  return {
    title: job.title,
    description: desc || undefined,
    openGraph: job.image && isUploadUrl(job.image) ? { images: [`/api${job.image}`] } : undefined,
  };
}

/** Chi tiết tin việc làm (2026-11-18) — tin đăng tay ở /quan-ly. */
export default async function JobDetailPage({ params }: Props) {
  const job = await getJob((await params).slug);
  if (!job) notFound();
  const facts = [
    { icon: Factory, label: "Nhà máy", value: job.company },
    { icon: MapPin, label: "Nơi làm", value: job.area },
    { icon: Banknote, label: "Thu nhập", value: job.salary },
    { icon: Clock, label: "Ca làm", value: job.shift },
  ].filter((f) => f.value);
  return (
    <>
      <section className="hero-bg relative overflow-hidden text-white">
        <div className="grid-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-12 sm:px-6 sm:pt-36 sm:pb-16">
          <Link href="/viec-lam" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Tất cả việc làm
          </Link>
          {job.urgent && (
            <p className="mt-5 inline-flex items-center gap-1 rounded-md bg-[#ef4444] px-2.5 py-1 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Tuyển gấp
            </p>
          )}
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-5xl">{job.title}</h1>
        </div>
      </section>
      <section className="py-10 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div>
            {job.image && isUploadUrl(job.image) && (
              <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-3xl">
                <Image src={`/api${job.image}`} alt={job.title} fill unoptimized className="object-cover" />
              </div>
            )}
            {facts.length > 0 && (
              <dl className="grid gap-3 sm:grid-cols-2">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="font-semibold">{value}</dd>
                    </span>
                  </div>
                ))}
              </dl>
            )}
            {job.description && (
              <div className="mt-8">
                <h2 className="font-display text-xl font-bold">Mô tả công việc & quyền lợi</h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-slate-700">{job.description}</p>
              </div>
            )}
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl bg-ink p-2">
              <RegisterForm jobTitle={job.title} />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
