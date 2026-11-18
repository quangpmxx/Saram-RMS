import { BadgeCheck } from "lucide-react";
import { dorms } from "@/lib/content";
import { SectionHeading } from "./ui";
import { EImage, T } from "./editable";
import { WorriesGrid } from "./lists";

/** 4 nỗi lo của người lao động → cách SARAM giải quyết. */
export function WorriesSection() {
  return (
    <section className="bg-mist py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          k="worries"
          eyebrow="Thấu hiểu người lao động"
          title={
            <>
              <T k="worries.title1">4 nỗi lo khi đi làm xa —</T>{" "}
              <span className="text-brand">
                <T k="worries.title2">Đại Việt lo hết</T>
              </span>
            </>
          }
          text="Giải quyết trọn những điều người lao động lo nhất là cách để họ yên tâm làm việc và gắn bó lâu dài với nhà máy."
        />
        <WorriesGrid />
      </div>
    </section>
  );
}

/** Ký túc xá — ảnh thật từ hồ sơ năng lực. */
export function DormsSection() {
  return (
    <section className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            k="dorms"
            eyebrow="Chỗ ở"
            title="Ký túc xá ngay sát khu công nghiệp"
            text="Mạng lưới ký túc xá tại Quang Châu, Quế Võ, Nam Sơn – Hạp Lĩnh và VSIP. Mỗi khu 15–30 phòng, phòng 18–25m² cho 6–8 người, khép kín, đầy đủ tiện nghi."
          />
          <div className="flex shrink-0 gap-8">
            {[
              ["4+", "khu vực"],
              ["15–30", "phòng/khu"],
              ["100%", "phòng khép kín"],
            ].map(([n, l], i) => (
              <div key={l}>
                <p className="font-display text-3xl font-bold text-brand">
                  <T k={`dorms.fact${i}.value`}>{n}</T>
                </p>
                <p className="text-xs font-medium text-slate-500">
                  <T k={`dorms.fact${i}.label`}>{l}</T>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid sm:mt-12 gap-8 lg:grid-cols-2">
          {dorms.map((d, di) => (
            <article
              key={d.name}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
            >
              <div className="grid grid-cols-2 gap-1">
                {d.images.map((src, i) => (
                  <div
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden sm:aspect-[4/5]"
                  >
                    <EImage
                      k={`dorms.${di}.image${i}`}
                      src={src}
                      alt={`${d.name} — ảnh ${i + 1}`}
                      fill
                      sizes="(min-width: 1024px) 280px, 50vw"
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">
                    <T k={`dorms.${di}.name`}>{d.name}</T>
                  </h3>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    <T k={`dorms.${di}.capacity`}>{d.capacity}</T>
                  </span>
                </div>
                <ul className="mt-4 space-y-2">
                  {d.points.map((p, pi) => (
                    <li key={p} className="flex gap-2 text-sm text-slate-600">
                      <BadgeCheck
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                        aria-hidden="true"
                      />
                      <T k={`dorms.${di}.point${pi}`}>{p}</T>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Xe điện miễn phí. */
export function BikeSection() {
  return (
    <section className="hero-bg relative overflow-hidden py-14 text-white sm:py-24">
      <div className="grid-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            light
            k="bike"
            eyebrow="Đi lại"
            title={
              <>
                <T k="bike.title1">Mượn xe điện đi làm —</T>{" "}
                <span className="text-orange-400">
                  <T k="bike.title2">0 đồng</T>
                </span>
              </>
            }
            text="Không cần mua xe, không lo lỡ ca. Đại Việt cho người lao động mượn xe điện miễn phí và bảo dưỡng định kỳ để ai cũng đi làm đúng giờ."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["2 người / 1 xe", "Ghép cặp theo ca kíp"],
              ["Miễn phí 100%", "Không thu bất kỳ chi phí"],
              ["Bảo dưỡng trọn gói", "Đại Việt lo sửa chữa"],
            ].map(([t, s], i) => (
              <div
                key={t}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="font-display font-bold">
                  <T k={`bike.fact${i}.title`}>{t}</T>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  <T k={`bike.fact${i}.text`}>{s}</T>
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[0.8fr_1fr] items-end gap-4">
          <div className="relative aspect-[240/381] overflow-hidden rounded-3xl">
            <EImage
              k="bike.image1"
              src="/images/xe-dien-1.png"
              alt="Người lao động nhận xe điện Đại Việt"
              fill
              sizes="240px"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[360/307] overflow-hidden rounded-3xl">
            <EImage
              k="bike.image2"
              src="/images/xe-dien-2.png"
              alt="Hệ thống xe điện miễn phí Đại Việt"
              fill
              sizes="320px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Thủ tục + thu nhập. */
export function PolicySection() {
  return (
    <section className="py-14 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <article className="rounded-3xl bg-mist p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-brand">
            <T k="policy.docs.eyebrow">Hồ sơ</T>
          </p>
          <h3 className="mt-3 font-display text-3xl font-bold">
            <T k="policy.docs.title1">Chỉ cần</T>{" "}
            <span className="text-brand">
              <T k="policy.docs.title2">CCCD</T>
            </span>
          </h3>
          <p className="mt-3 text-slate-600">
            <T k="policy.docs.text">Không thủ tục rườm rà — có thể nhận việc ngay trong ngày.</T>
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Vỏ hồ sơ miễn phí", "Có sẵn biểu mẫu, sơ yếu lý lịch chuẩn."],
              ["Chụp ảnh thẻ tại chỗ", "Ảnh 3x4, 4x6 chụp và in miễn phí."],
              [
                "Photo giấy tờ không giới hạn",
                "Sao chụp mọi giấy tờ cần nộp nhà máy.",
              ],
            ].map(([t, s], i) => (
              <li key={t} className="flex gap-3 rounded-2xl bg-white p-4">
                <BadgeCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>
                  <span className="block font-semibold">
                    <T k={`policy.docs.item${i}.title`}>{t}</T>
                  </span>
                  <span className="text-sm text-slate-500">
                    <T k={`policy.docs.item${i}.text`}>{s}</T>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="flex flex-col rounded-3xl bg-royal p-8 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-200">
            <T k="policy.income.eyebrow">Thu nhập</T>
          </p>
          <h3 className="mt-3 font-display text-3xl font-bold">
            <T k="policy.income.title">Phụ cấp theo ngày công</T>
          </h3>
          <p className="mt-6 font-display text-5xl font-bold tracking-tight text-orange-300 sm:text-6xl">
            <T k="policy.income.amount">30–70K</T>
          </p>
          <p className="mt-1 text-blue-100">
            <T k="policy.income.unit">đồng / công, tùy từng đơn hàng</T>
          </p>
          <div className="mt-8 rounded-2xl bg-white/10 p-5">
            <p className="text-sm text-blue-100">
              <T k="policy.income.monthly_label">Đi làm đủ 26–28 công, mỗi tháng nhận thêm</T>
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              <T k="policy.income.monthly_amount">800.000 – 1.800.000đ</T>
            </p>
          </div>
          <p className="mt-auto pt-6 text-xs text-blue-200">
            <T k="policy.income.note">
              Mức phụ cấp cụ thể được báo rõ trước khi nhận việc, theo từng nhà máy và vị trí.
            </T>
          </p>
        </article>
      </div>
    </section>
  );
}

// Danh sách sửa được (đối tác, các bước, việc làm…) nằm ở components/lists.tsx.
export { JobCard, PartnersStrip, StepsList } from "./lists";
